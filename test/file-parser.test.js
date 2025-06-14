const test = require('tape');
const { parseAndWriteFiles } = require('../src/file-processor.js');
const fs = require('fs').promises;
const path = require('path');

test('reproduce malformed filename bug from PR #8', async (t) => {
  // This is the actual LLM response that caused the bug
  const malformedResponse = `=== FILENAME: README.md ===
# Test README
This is a test file.
=== END: README.md ===

=== FILENAME: src/components/Login.tsx ===
import React from 'react';

export const Login = () => {
  return <div>Login</div>;
};
=== END: src/components/Login.tsx ===`;

  const result = await parseAndWriteFiles(malformedResponse, { 
    logOutput: false,
    dryRun: true 
  });

  console.log('Files found:', result);
  
  // The bug: filenames include === markers
  t.notOk(result.some(f => f.includes(' ===')), 'filenames should not contain === markers');
  
  // This should happen - clean filenames
  t.ok(result.includes('README.md'), 'should contain README.md');
  t.ok(result.includes('src/components/Login.tsx'), 'should contain Login.tsx');
  
  t.end();
});

test('handle filename with extra spaces', async (t) => {
  const response = `=== FILENAME:   spaced-file.txt   ===
content here
=== END:   spaced-file.txt   ===`;

  const result = await parseAndWriteFiles(response, { 
    logOutput: false,
    dryRun: true 
  });
  
  t.equal(result[0], 'spaced-file.txt', 'should trim spaces from filename');
  t.end();
});

test('handle multiple files correctly', async (t) => {
  const multiFileResponse = `=== FILENAME: file1.js ===
// file 1
=== END: file1.js ===

=== FILENAME: file2.py ===
# file 2
=== END: file2.py ===`;

  const result = await parseAndWriteFiles(multiFileResponse, { 
    logOutput: false,
    dryRun: true 
  });
  
  t.equal(result.length, 2, 'should find 2 files');
  t.ok(result.includes('file1.js'), 'should include file1.js');
  t.ok(result.includes('file2.py'), 'should include file2.py');
  t.end();
});

test('handle empty file content with proper markers', async (t) => {
  const emptyFileResponse = `=== FILENAME: empty.txt ===

=== END: empty.txt ===`;

  const result = await parseAndWriteFiles(emptyFileResponse, { 
    logOutput: false,
    dryRun: true 
  });

  t.ok(result.includes('empty.txt'), 'should handle empty files with proper END markers');
  t.end();
});

test('strict parsing: reject files without END markers', async (t) => {
  const responseWithoutEnd = `=== FILENAME: incomplete.js ===
console.log('no end marker');
// more content`;

  const result = await parseAndWriteFiles(responseWithoutEnd, { 
    logOutput: false,
    dryRun: true 
  });

  t.equal(result.length, 0, 'should reject files without proper END markers');
  t.end();
});

test('robust parsing: reject mismatched filename markers', async (t) => {
  const mismatchedResponse = `=== FILENAME: correct.js ===
console.log('correct');
=== END: wrong.js ===

=== FILENAME: valid.py ===
print('valid')
=== END: valid.py ===`;

  const result = await parseAndWriteFiles(mismatchedResponse, { 
    logOutput: false,
    dryRun: true 
  });

  // Should only find the valid.py file, not the mismatched one
  t.equal(result.length, 1, 'should only find 1 valid file');
  t.ok(result.includes('valid.py'), 'should include valid.py');
  t.notOk(result.includes('correct.js'), 'should reject mismatched filename');
  t.end();
});

test('robust parsing: handle intersecting blocks by keeping outermost', async (t) => {
  const intersectingResponse = `=== FILENAME: outer.js ===
// Outer file start
=== FILENAME: inner.js ===
// Inner file content
=== END: inner.js ===
// Outer file end
=== END: outer.js ===`;

  const result = await parseAndWriteFiles(intersectingResponse, { 
    logOutput: false,
    dryRun: true 
  });

  // Should only keep the outermost block (outer.js), not the inner one
  t.equal(result.length, 1, 'should only find 1 file (outermost)');
  t.ok(result.includes('outer.js'), 'should include outer.js');
  t.notOk(result.includes('inner.js'), 'should not include nested inner.js');
  t.end();
});

test('robust parsing: handle multiple non-intersecting blocks', async (t) => {
  const multipleResponse = `=== FILENAME: first.js ===
console.log('first');
=== END: first.js ===

Some text between files

=== FILENAME: second.py ===
print('second')
=== END: second.py ===`;

  const result = await parseAndWriteFiles(multipleResponse, { 
    logOutput: false,
    dryRun: true 
  });

  t.equal(result.length, 2, 'should find 2 separate files');
  t.ok(result.includes('first.js'), 'should include first.js');
  t.ok(result.includes('second.py'), 'should include second.py');
  t.end();
});