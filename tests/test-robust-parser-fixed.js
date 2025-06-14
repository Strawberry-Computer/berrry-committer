const test = require('tape');

test('Fixed robust parser', (t) => {
  t.plan(4);
  
  // Fixed parser - track nesting depth correctly
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
        marker.depth = stack.filter(s => s.matched !== false).length; // Only count matched pairs
        stack.push(marker);
      } else if (marker.type === 'END') {
        // Find matching FILENAME marker (LIFO)
        for (let i = stack.length - 1; i >= 0; i--) {
          if (stack[i].filename === marker.filename && stack[i].matched !== false) {
            const startMarker = stack.splice(i, 1)[0];
            validRanges.push({
              filename: marker.filename,
              startPos: startMarker.endPosition,
              endPos: marker.position,
              depth: startMarker.depth
            });
            break;
          }
        }
        // Mark unmatched items as unmatched (but don't remove them yet)
        for (let item of stack) {
          if (item.filename === marker.filename && item.matched === undefined) {
            item.matched = false;
          }
        }
      }
    }
    
    // Only keep outermost ranges (depth 0)
    const outerRanges = validRanges.filter(range => range.depth === 0);
    
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
  
  // Test 1: Simple case
  const simpleCase = `
=== FILENAME: test.js ===
console.log("hello");
=== END: test.js ===
`;
  
  const simpleFiles = parseFilesRobust(simpleCase);
  t.equal(simpleFiles.length, 1, 'Should parse simple case');
  
  // Test 2: Malformed blocks - this should work now
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
  t.equal(malformedFiles.length, 2, 'Should parse 2 valid files and skip malformed one');
  
  // Test 3: Nested blocks - should only keep outer
  const nestedBlocks = `
=== FILENAME: outer.js ===
outer start
=== FILENAME: inner.js ===
inner content
=== END: inner.js ===
outer end
=== END: outer.js ===
`;
  
  const nestedFiles = parseFilesRobust(nestedBlocks);
  t.equal(nestedFiles.length, 1, 'Should only keep outermost of nested blocks');
  
  // Test 4: Multiple separate blocks
  const multipleBlocks = `
=== FILENAME: file1.js ===
content1
=== END: file1.js ===

=== FILENAME: file2.js ===
content2
=== END: file2.js ===
`;
  
  const multipleFiles = parseFilesRobust(multipleBlocks);
  t.equal(multipleFiles.length, 2, 'Should parse multiple separate blocks');
});

// Alternative even simpler approach
test('Alternative simple approach', (t) => {
  t.plan(2);
  
  // Simpler approach: just validate each match independently
  const parseFilesSimple = (codeOutput) => {
    const files = [];
    const fileRegex = /=== FILENAME: (.+?) ===\s*\n([\s\S]*?)\n=== END: \1 ===/g;
    let match;
    const foundRanges = [];

    // First pass: find all valid ranges
    while ((match = fileRegex.exec(codeOutput)) !== null) {
      foundRanges.push({
        filename: match[1].trim(),
        content: match[2].trim(),
        start: match.index,
        end: match.index + match[0].length
      });
    }
    
    // Second pass: remove ranges that are contained within other ranges
    const outerRanges = foundRanges.filter(range => {
      return !foundRanges.some(other => 
        other !== range && 
        other.start < range.start && 
        other.end > range.end
      );
    });
    
    return outerRanges.map(range => ({
      filename: range.filename,
      content: range.content
    }));
  };
  
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
  
  const simpleFiles = parseFilesSimple(malformedBlocks);
  t.equal(simpleFiles.length, 2, 'Simple approach should also work');
  
  const nestedBlocks = `
=== FILENAME: outer.js ===
outer start
=== FILENAME: inner.js ===
inner content
=== END: inner.js ===
outer end
=== END: outer.js ===
`;
  
  const nestedFiles = parseFilesSimple(nestedBlocks);
  t.equal(nestedFiles.length, 1, 'Simple approach should handle nesting');
});