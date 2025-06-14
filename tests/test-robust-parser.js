const test = require('tape');

test('Robust parser with range detection', (t) => {
  t.plan(5);
  
  // New robust parser using single regex for all markers
  const parseFilesRobust = (codeOutput) => {
    const files = [];
    
    // Single regex to find all FILENAME and END markers with positions
    const markerRegex = /=== (FILENAME|END): (.+?) ===/g;
    const markers = [];
    let match;
    
    // Collect all markers with their positions
    while ((match = markerRegex.exec(codeOutput)) !== null) {
      markers.push({
        type: match[1], // 'FILENAME' or 'END'
        filename: match[2].trim(),
        position: match.index,
        endPosition: match.index + match[0].length
      });
    }
    
    // Find valid start/end pairs
    const stack = [];
    const validRanges = [];
    
    for (const marker of markers) {
      if (marker.type === 'FILENAME') {
        stack.push(marker);
      } else if (marker.type === 'END') {
        // Find matching FILENAME marker (LIFO - innermost first)
        for (let i = stack.length - 1; i >= 0; i--) {
          if (stack[i].filename === marker.filename) {
            const startMarker = stack.splice(i, 1)[0];
            validRanges.push({
              filename: marker.filename,
              startPos: startMarker.endPosition,
              endPos: marker.position,
              isNested: stack.length > 0 // Is this nested inside another block?
            });
            break;
          }
        }
      }
    }
    
    // Only keep outermost (non-nested) ranges
    const outerRanges = validRanges.filter(range => !range.isNested);
    
    // Extract content from valid ranges
    for (const range of outerRanges) {
      const content = codeOutput.substring(range.startPos, range.endPos).trim();
      
      // Remove leading newline if present
      const cleanContent = content.replace(/^\n/, '');
      
      if (cleanContent) {
        files.push({
          filename: range.filename,
          content: cleanContent
        });
      }
    }
    
    return files;
  };
  
  // Test 1: Simple valid case
  const simpleCase = `
=== FILENAME: test.js ===
console.log("hello");
=== END: test.js ===
`;
  
  const simpleFiles = parseFilesRobust(simpleCase);
  t.equal(simpleFiles.length, 1, 'Should parse simple case correctly');
  
  // Test 2: Intersecting blocks - should only keep outer
  const intersectingBlocks = `
=== FILENAME: outer.js ===
console.log("start outer");
=== FILENAME: inner.js ===
console.log("inner content");
=== END: inner.js ===
console.log("end outer");
=== END: outer.js ===
`;
  
  const intersectingFiles = parseFilesRobust(intersectingBlocks);
  t.equal(intersectingFiles.length, 1, 'Should only keep outermost block');
  t.equal(intersectingFiles[0].filename, 'outer.js', 'Should keep the outer file');
  
  // Test 3: Multiple separate blocks
  const multipleBlocks = `
=== FILENAME: file1.js ===
console.log("file1");
=== END: file1.js ===

=== FILENAME: file2.js ===
console.log("file2");
=== END: file2.js ===
`;
  
  const multipleFiles = parseFilesRobust(multipleBlocks);
  t.equal(multipleFiles.length, 2, 'Should parse multiple separate blocks');
  
  // Test 4: Malformed blocks (mismatched names)
  const malformedBlocks = `
=== FILENAME: correct.js ===
console.log("correct");
=== END: correct.js ===

=== FILENAME: broken.js ===
console.log("broken");
=== END: different.js ===

=== FILENAME: another.js ===
console.log("another");
=== END: another.js ===
`;
  
  const malformedFiles = parseFilesRobust(malformedBlocks);
  t.equal(malformedFiles.length, 2, 'Should skip malformed blocks and keep valid ones');
});

test('Edge cases for robust parser', (t) => {
  t.plan(3);
  
  // Same robust parser function (would be extracted to module)
  const parseFilesRobust = (codeOutput) => {
    const files = [];
    const markerRegex = /=== (FILENAME|END): (.+?) ===/g;
    const markers = [];
    let match;
    
    while ((match = markerRegex.exec(codeOutput)) !== null) {
      markers.push({
        type: match[1],
        filename: match[2].trim(),
        position: match.index,
        endPosition: match.index + match[0].length
      });
    }
    
    const stack = [];
    const validRanges = [];
    
    for (const marker of markers) {
      if (marker.type === 'FILENAME') {
        stack.push(marker);
      } else if (marker.type === 'END') {
        for (let i = stack.length - 1; i >= 0; i--) {
          if (stack[i].filename === marker.filename) {
            const startMarker = stack.splice(i, 1)[0];
            validRanges.push({
              filename: marker.filename,
              startPos: startMarker.endPosition,
              endPos: marker.position,
              isNested: stack.length > 0
            });
            break;
          }
        }
      }
    }
    
    const outerRanges = validRanges.filter(range => !range.isNested);
    
    for (const range of outerRanges) {
      const content = codeOutput.substring(range.startPos, range.endPos).trim();
      const cleanContent = content.replace(/^\n/, '');
      
      if (cleanContent) {
        files.push({
          filename: range.filename,
          content: cleanContent
        });
      }
    }
    
    return files;
  };
  
  // Test 1: Deeply nested blocks
  const deeplyNested = `
=== FILENAME: level1.js ===
outer content
=== FILENAME: level2.js ===
middle content
=== FILENAME: level3.js ===
inner content
=== END: level3.js ===
more middle
=== END: level2.js ===
more outer
=== END: level1.js ===
`;
  
  const nestedFiles = parseFilesRobust(deeplyNested);
  t.equal(nestedFiles.length, 1, 'Should only keep outermost of deeply nested blocks');
  
  // Test 2: Orphaned END markers
  const orphanedEnd = `
=== END: orphan.js ===
=== FILENAME: valid.js ===
console.log("valid");
=== END: valid.js ===
`;
  
  const orphanFiles = parseFilesRobust(orphanedEnd);
  t.equal(orphanFiles.length, 1, 'Should ignore orphaned END markers');
  
  // Test 3: Multiple END markers for same file
  const multipleEnds = `
=== FILENAME: test.js ===
console.log("content");
=== END: test.js ===
=== END: test.js ===
`;
  
  const multipleEndFiles = parseFilesRobust(multipleEnds);
  t.equal(multipleEndFiles.length, 1, 'Should handle multiple END markers correctly');
});