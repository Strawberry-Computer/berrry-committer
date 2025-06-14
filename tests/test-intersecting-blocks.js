const test = require('tape');

test('Intersecting blocks vulnerability', (t) => {
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
  
  // Test case 1: Nested/intersecting blocks
  const intersectingBlocks = `
=== FILENAME: file1.js ===
console.log("start of file1");
=== FILENAME: file2.js ===
console.log("file2 content");
=== END: file1.js ===
console.log("this should not be in file2");
=== END: file2.js ===
`;
  
  const intersectingFiles = parseFiles(intersectingBlocks);
  console.log('Intersecting files parsed:', intersectingFiles);
  
  t.equal(intersectingFiles.length, 1, 'Current regex only matches first valid pair');
  
  if (intersectingFiles.length > 0) {
    t.ok(intersectingFiles[0].content.includes('=== FILENAME: file2.js ==='), 
         'file1 content incorrectly includes nested FILENAME marker');
  } else {
    t.pass('No files parsed due to malformed structure');
  }
  
  // Test case 2: Overlapping END markers
  const overlappingEnds = `
=== FILENAME: test.js ===
console.log("content");
=== END: test.js ===
=== END: test.js ===
`;
  
  const overlappingFiles = parseFiles(overlappingEnds);
  t.equal(overlappingFiles.length, 1, 'Should only match first END marker');
  
  // Test case 3: More robust parsing approach
  const parseFilesSafe = (codeOutput) => {
    const files = [];
    
    // Split by FILENAME markers first
    const blocks = codeOutput.split(/=== FILENAME: (.+?) ===/).slice(1);
    
    for (let i = 0; i < blocks.length; i += 2) {
      const filename = blocks[i];
      const contentBlock = blocks[i + 1];
      
      if (!contentBlock) continue;
      
      // Look for the specific END marker for this file
      const endMarker = `=== END: ${filename} ===`;
      const endIndex = contentBlock.indexOf(endMarker);
      
      if (endIndex !== -1) {
        const content = contentBlock.substring(0, endIndex).trim();
        files.push({ filename: filename.trim(), content });
      }
    }
    
    return files;
  };
  
  const safeFiles = parseFilesSafe(intersectingBlocks);
  console.log('Safe parser results:', safeFiles);
  t.ok(safeFiles.length >= 1, 'Safe parser should handle intersecting blocks better');
});

test('Complex nested scenarios', (t) => {
  t.plan(3);
  
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
  
  // Test: What if content contains the same filename pattern?
  const confusingContent = `
=== FILENAME: config.js ===
const settings = {
  template: \`
=== FILENAME: generated.js ===
// This is just a template string
=== END: generated.js ===
  \`
};
=== END: config.js ===
`;
  
  const confusingFiles = parseFiles(confusingContent);
  t.equal(confusingFiles.length, 1, 'Should parse despite confusing template content');
  
  // Test: Multiple valid non-intersecting blocks
  const validMultiple = `
=== FILENAME: file1.js ===
console.log("file1");
=== END: file1.js ===

=== FILENAME: file2.js ===
console.log("file2");
=== END: file2.js ===
`;
  
  const validFiles = parseFiles(validMultiple);
  t.equal(validFiles.length, 2, 'Should parse multiple valid blocks correctly');
  
  // Test: Malformed block in between valid ones
  const mixedValid = `
=== FILENAME: good1.js ===
console.log("good1");
=== END: good1.js ===

=== FILENAME: broken.js ===
console.log("broken");
=== END: different.js ===

=== FILENAME: good2.js ===
console.log("good2");
=== END: good2.js ===
`;
  
  const mixedFiles = parseFiles(mixedValid);
  t.equal(mixedFiles.length, 2, 'Should parse valid blocks and skip malformed ones');
});