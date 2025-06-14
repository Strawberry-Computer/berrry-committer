const test = require('tape');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Test the complete robust parser solution
test('Complete solution - prevent original bug', async (t) => {
  t.plan(8);
  
  const testDir = '/tmp/test-complete-solution';
  const originalCwd = process.cwd();
  
  try {
    // Clean up and setup test directory
    if (fs.existsSync(testDir)) {
      execSync(`rm -rf ${testDir}`);
    }
    fs.mkdirSync(testDir, { recursive: true });
    process.chdir(testDir);
    
    // Import the robust parser using absolute path
    const { parseAndWriteFiles } = require(path.join(originalCwd, 'src/robust-file-parser.js'));
    
    // Test the exact LLM output that caused the original bug
    const problematicLLMOutput = `I'll help you create a React component.

=== FILENAME: src/components/Button.js ===
import React from 'react';

const Button = ({ children, onClick }) => {
  return (
    <button onClick={onClick} className="btn">
      {children}
    </button>
  );
};

export default Button;
=== END: src/components/Button.js ===

=== FILENAME: path/to/file.ext ===
[complete file content]
=== END: path/to/file.ext ===

The component is ready to use!`;
    
    // Parse with robust parser
    const result = parseAndWriteFiles(problematicLLMOutput);
    
    // Verify results
    t.equal(result.files.length, 1, 'Should only create 1 valid file');
    t.ok(result.files.includes('src/components/Button.js'), 'Should create the legitimate file');
    t.notOk(result.files.includes('path/to/file.ext'), 'Should NOT create placeholder file');
    t.notOk(fs.existsSync('path/to/file.ext'), 'Placeholder file should not exist on filesystem');
    t.ok(fs.existsSync('src/components/Button.js'), 'Valid file should exist');
    
    // Test intersecting blocks
    const intersectingOutput = `
=== FILENAME: outer.js ===
console.log("outer start");
=== FILENAME: inner.js ===
console.log("inner");
=== END: inner.js ===
console.log("outer end");
=== END: outer.js ===
`;
    
    const intersectingResult = parseAndWriteFiles(intersectingOutput);
    t.equal(intersectingResult.files.length, 1, 'Should only create outer file from intersecting blocks');
    
    // Test security validation
    const dangerousOutput = `
=== FILENAME: ../../../etc/passwd ===
root:x:0:0:root:/root:/bin/bash
=== END: ../../../etc/passwd ===
`;
    
    const dangerousResult = parseAndWriteFiles(dangerousOutput);
    t.equal(dangerousResult.files.length, 0, 'Should reject dangerous path traversal');
    
    // Test malformed blocks
    const malformedOutput = `
=== FILENAME: good.js ===
console.log("good");
=== END: good.js ===

=== FILENAME: broken.js ===
console.log("broken");
=== END: different.js ===

=== FILENAME: another.js ===
console.log("another");
=== END: another.js ===
`;
    
    const malformedResult = parseAndWriteFiles(malformedOutput);
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

test('Validation functions work correctly', (t) => {
  t.plan(8);
  
  const { isPlaceholderFile, isDangerousPath } = require('../src/robust-file-parser.js');
  
  // Test placeholder detection
  t.ok(isPlaceholderFile('path/to/file.ext', 'anything'), 'Should detect generic path');
  t.ok(isPlaceholderFile('test.js', '[complete file content]'), 'Should detect placeholder content');
  t.ok(isPlaceholderFile('test.js', 'short'), 'Should detect suspiciously short content');
  t.notOk(isPlaceholderFile('src/Button.js', 'const Button = () => <button>Click</button>;'), 'Should not flag real code');
  
  // Test dangerous path detection
  t.ok(isDangerousPath('../../../etc/passwd'), 'Should detect path traversal');
  t.ok(isDangerousPath('/etc/shadow'), 'Should detect system directory');
  t.ok(isDangerousPath('file\0name'), 'Should detect null bytes');
  t.notOk(isDangerousPath('src/components/Button.js'), 'Should not flag normal paths');
});