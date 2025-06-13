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

test('handle missing END markers', async (t) => {
  const responseWithoutEnd = `=== FILENAME: incomplete.js ===
console.log('no end marker');
// more content`;

  const result = await parseAndWriteFiles(responseWithoutEnd, { 
    logOutput: false,
    dryRun: true 
  });

  t.ok(result.includes('incomplete.js'), 'should handle missing END marker');
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

test('handle empty file content', async (t) => {
  const emptyFileResponse = `=== FILENAME: empty.txt ===
=== END: empty.txt ===`;

  const result = await parseAndWriteFiles(emptyFileResponse, { 
    logOutput: false,
    dryRun: true 
  });

  t.ok(result.includes('empty.txt'), 'should handle empty files');
  t.end();
});