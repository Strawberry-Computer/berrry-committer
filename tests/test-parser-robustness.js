const test = require('tape');

test('Parser robustness - END marker validation', (t) => {
  t.plan(4);
  
  const parseFiles = (codeOutput) => {
    const files = [];
    const fileRegex = /=== FILENAME: (.+?) ===\s*\n([\s\S]*?)\n=== END: \1 ===/g;
    let match;

    while ((match = fileRegex.exec(codeOutput)) !== null) {
      files.push({
        filename: match[1].trim(),
        content: match[2].trim()
      });
    }
    return files;
  };
  
  // Test 1: Correct format - should work
  const correctFormat = `
=== FILENAME: test.js ===
console.log("hello");
=== END: test.js ===
`;
  
  const correctFiles = parseFiles(correctFormat);
  t.equal(correctFiles.length, 1, 'Should parse correctly formatted file');
  
  // Test 2: Mismatched END marker - should be rejected
  const mismatchedEnd = `
=== FILENAME: test.js ===
console.log("hello");
=== END: different.js ===
`;
  
  const mismatchedFiles = parseFiles(mismatchedEnd);
  t.equal(mismatchedFiles.length, 0, 'Should reject mismatched END marker');
  
  // Test 3: Placeholder with correct format - currently passes (the bug!)
  const placeholderCorrect = `
=== FILENAME: path/to/file.ext ===
[complete file content]
=== END: path/to/file.ext ===
`;
  
  const placeholderFiles = parseFiles(placeholderCorrect);
  t.equal(placeholderFiles.length, 1, 'Currently accepts placeholder with correct format');
  
  // Test 4: Enhanced parser with content validation
  const parseFilesEnhanced = (codeOutput) => {
    const files = [];
    const fileRegex = /=== FILENAME: (.+?) ===\s*\n([\s\S]*?)\n=== END: \1 ===/g;
    let match;

    while ((match = fileRegex.exec(codeOutput)) !== null) {
      const filename = match[1].trim();
      const content = match[2].trim();
      
      // Enhanced validation
      const isGenericPath = /path\/to\//.test(filename) || /\.ext$/.test(filename);
      const isPlaceholderContent = /^\[.*\]$/.test(content) || content.length < 10;
      
      if (!isGenericPath && !isPlaceholderContent) {
        files.push({ filename, content });
      }
    }
    return files;
  };
  
  const enhancedFiles = parseFilesEnhanced(placeholderCorrect);
  t.equal(enhancedFiles.length, 0, 'Enhanced parser should reject placeholder content');
});

test('Additional robust format ideas', (t) => {
  t.plan(2);
  
  // Idea: Require checksum in END marker
  const parseWithChecksum = (codeOutput) => {
    const files = [];
    const fileRegex = /=== FILENAME: (.+?) ===\s*\n([\s\S]*?)\n=== END: \1 \[(\d+)\] ===/g;
    let match;

    while ((match = fileRegex.exec(codeOutput)) !== null) {
      const filename = match[1].trim();
      const content = match[2].trim();
      const declaredLength = parseInt(match[3]);
      
      // Validate content length matches declared length
      if (content.length === declaredLength) {
        files.push({ filename, content });
      }
    }
    return files;
  };
  
  const checksumFormat = `
=== FILENAME: test.js ===
console.log("hello");
=== END: test.js [21] ===
`;
  
  const checksumFiles = parseWithChecksum(checksumFormat);
  t.equal(checksumFiles.length, 1, 'Checksum validation should work');
  
  // Idea: Require file type validation
  const parseWithTypeValidation = (codeOutput) => {
    const files = [];
    const fileRegex = /=== FILENAME: (.+?) ===\s*\n([\s\S]*?)\n=== END: \1 ===/g;
    let match;

    while ((match = fileRegex.exec(codeOutput)) !== null) {
      const filename = match[1].trim();
      const content = match[2].trim();
      
      // Validate file extension matches content
      const ext = filename.split('.').pop();
      const hasValidContent = ext === 'js' ? content.includes('function') || content.includes('const') || content.includes('import') : true;
      
      if (hasValidContent) {
        files.push({ filename, content });
      }
    }
    return files;
  };
  
  const jsContent = `
=== FILENAME: test.js ===
const x = 1;
=== END: test.js ===
`;
  
  const typeFiles = parseWithTypeValidation(jsContent);
  t.equal(typeFiles.length, 1, 'Type validation should work for valid JS');
});