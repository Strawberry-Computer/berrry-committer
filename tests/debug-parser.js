const test = require('tape');

test('Debug malformed blocks issue', (t) => {
  t.plan(1);
  
  const parseFilesDebug = (codeOutput) => {
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
    
    console.log('Found markers:', markers);
    
    const stack = [];
    const validRanges = [];
    
    for (const marker of markers) {
      console.log(`Processing ${marker.type}: ${marker.filename}, stack:`, stack.map(s => s.filename));
      
      if (marker.type === 'FILENAME') {
        stack.push(marker);
      } else if (marker.type === 'END') {
        // Find matching FILENAME marker
        let found = false;
        for (let i = stack.length - 1; i >= 0; i--) {
          if (stack[i].filename === marker.filename) {
            const startMarker = stack.splice(i, 1)[0];
            validRanges.push({
              filename: marker.filename,
              startPos: startMarker.endPosition,
              endPos: marker.position,
              isNested: stack.length > 0
            });
            console.log(`  Matched pair: ${marker.filename}`);
            found = true;
            break;
          }
        }
        if (!found) {
          console.log(`  No match found for END: ${marker.filename}`);
        }
      }
    }
    
    console.log('Valid ranges:', validRanges);
    console.log('Remaining in stack:', stack.map(s => s.filename));
    
    const outerRanges = validRanges.filter(range => !range.isNested);
    console.log('Outer ranges:', outerRanges.map(r => r.filename));
    
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
  
  const files = parseFilesDebug(malformedBlocks);
  console.log('Final files:', files.map(f => f.filename));
  
  t.equal(files.length, 2, `Should find 2 files, found ${files.length}`);
});