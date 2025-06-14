const test = require('tape');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Test just the intersection-handling fix
test('Intersection handling fix', async (t) => {
  t.plan(4);
  
  const testDir = '/tmp/test-intersection-fix';
  const originalCwd = process.cwd();
  
  try {
    // Clean up and setup test directory
    if (fs.existsSync(testDir)) {
      execSync(`rm -rf ${testDir}`);
    }
    fs.mkdirSync(testDir, { recursive: true });
    process.chdir(testDir);
    
    const { parseAndWriteFiles } = require(path.join(originalCwd, 'src/robust-file-parser.js'));
    
    // Test 1: Simple case - should work same as before
    const simpleCase = `
=== FILENAME: test.js ===
console.log("hello");
=== END: test.js ===
`;
    
    const simpleResult = parseAndWriteFiles(simpleCase);
    t.equal(simpleResult.files.length, 1, 'Should parse simple case');
    
    // Test 2: Intersecting blocks - should only keep outer
    const intersectingBlocks = `
=== FILENAME: outer.js ===
console.log("outer start");
=== FILENAME: inner.js ===
console.log("inner");
=== END: inner.js ===
console.log("outer end");
=== END: outer.js ===
`;
    
    const intersectingResult = parseAndWriteFiles(intersectingBlocks);
    t.equal(intersectingResult.files.length, 1, 'Should only keep outer file from intersecting blocks');
    t.equal(intersectingResult.files[0], 'outer.js', 'Should keep the outer file');
    
    // Test 3: Malformed blocks - should skip bad ones
    const malformedBlocks = `
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
    
    const malformedResult = parseAndWriteFiles(malformedBlocks);
    t.equal(malformedResult.files.length, 2, 'Should parse valid files and skip malformed ones');
    
  } catch (error) {
    t.fail(`Test failed: ${error.message}`);
  } finally {
    // Clean up
    process.chdir(originalCwd);
    if (fs.existsSync(testDir)) {
      execSync(`rm -rf ${testDir}`);
    }
  }
});

test('Parser only handles intersection - validation is separate concern', (t) => {
  t.plan(3);
  
  const { parseAndWriteFiles } = require('../src/robust-file-parser.js');
  
  // The parser should NOT filter placeholder files - that's a separate concern
  const placeholderOutput = `
=== FILENAME: path/to/file.ext ===
[complete file content]
=== END: path/to/file.ext ===
`;
  
  const result = parseAndWriteFiles(placeholderOutput);
  t.equal(result.files.length, 1, 'Parser should extract placeholder file (filtering is separate)');
  t.equal(result.files[0], 'path/to/file.ext', 'Should extract the placeholder filename');
  t.equal(result.parsedFiles['path/to/file.ext'], '[complete file content]', 'Should extract the content');
});