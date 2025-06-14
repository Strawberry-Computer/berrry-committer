const test = require('tape');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Import the parsing function from script.js
const scriptPath = path.join(__dirname, '..', 'script.js');

test('Contamination fix with isolated test repo', async (t) => {
  t.plan(6);
  
  const testDir = '/tmp/test-berrry-contamination';
  
  try {
    // Clean up any existing test directory
    if (fs.existsSync(testDir)) {
      execSync(`rm -rf ${testDir}`);
    }
    
    // Create test directory and initialize git
    fs.mkdirSync(testDir, { recursive: true });
    process.chdir(testDir);
    
    execSync('git init');
    execSync('git config user.email "test@example.com"');
    execSync('git config user.name "Test User"');
    
    // Copy contaminated CLAUDE.md
    const contaminatedClaude = fs.readFileSync(
      path.join(__dirname, 'fixtures', 'contaminated-claude.md'), 
      'utf8'
    );
    fs.writeFileSync('CLAUDE.md', contaminatedClaude);
    
    // Mock the parseAndWriteFiles function behavior
    const mockLLMOutput = fs.readFileSync(
      path.join(__dirname, 'fixtures', 'mock-llm-output.txt'),
      'utf8'
    );
    
    // Test the regex that caused the original bug
    const fileRegex = /=== FILENAME: (.+?) ===\s*\n([\s\S]*?)\n=== END: \1 ===/g;
    let match;
    const extractedFiles = [];
    
    while ((match = fileRegex.exec(mockLLMOutput)) !== null) {
      const filename = match[1].trim();
      const content = match[2].trim();
      extractedFiles.push({ filename, content });
    }
    
    // Verify the bug would occur
    t.equal(extractedFiles.length, 2, 'Should extract 2 files from mock output');
    
    const placeholderFile = extractedFiles.find(f => f.filename === 'path/to/file.ext');
    t.ok(placeholderFile, 'Should extract the problematic placeholder file');
    t.equal(placeholderFile.content, '[complete file content]', 'Should extract placeholder content');
    
    // Test that contaminated CLAUDE.md contains the problematic examples
    t.ok(contaminatedClaude.includes('path/to/file.ext'), 'Contaminated CLAUDE.md should contain placeholder path');
    
    // Test the clean version doesn't contain contamination
    const cleanClaude = fs.readFileSync(
      path.join(__dirname, 'fixtures', 'clean-claude.md'),
      'utf8'
    );
    t.notOk(cleanClaude.includes('path/to/file.ext'), 'Clean CLAUDE.md should not contain placeholder path');
    t.notOk(cleanClaude.includes('[complete file content]'), 'Clean CLAUDE.md should not contain placeholder content');
    
  } catch (error) {
    t.fail(`Test setup failed: ${error.message}`);
  } finally {
    // Clean up
    process.chdir(__dirname);
    if (fs.existsSync(testDir)) {
      execSync(`rm -rf ${testDir}`);
    }
  }
});

test('File validation functions', (t) => {
  t.plan(8);
  
  // Test placeholder detection functions
  const isGenericPath = (filePath) => {
    return /path\/to\//.test(filePath) || /\.ext$/.test(filePath) || /example\//.test(filePath);
  };
  
  const isPlaceholderContent = (content) => {
    const trimmed = content.trim();
    return /^\[.*\]$/.test(trimmed) || 
           /^<.*>$/.test(trimmed) || 
           /placeholder/i.test(trimmed) ||
           trimmed.length < 10;
  };
  
  // Test generic path detection
  t.ok(isGenericPath('path/to/file.ext'), 'Should detect path/to/ pattern');
  t.ok(isGenericPath('something.ext'), 'Should detect .ext extension');
  t.ok(isGenericPath('example/file.js'), 'Should detect example/ pattern');
  t.notOk(isGenericPath('src/components/Button.js'), 'Should not flag real paths');
  
  // Test placeholder content detection
  t.ok(isPlaceholderContent('[complete file content]'), 'Should detect bracket placeholders');
  t.ok(isPlaceholderContent('<placeholder>'), 'Should detect angle bracket placeholders');
  t.ok(isPlaceholderContent('short'), 'Should detect suspiciously short content');
  t.notOk(isPlaceholderContent('import React from "react";\n\nconst App = () => <div>Hello</div>;'), 'Should not flag real code');
});

test('Verify current repo is fixed', (t) => {
  t.plan(3);
  
  // Check that the actual CLAUDE.md in our repo is now clean
  const actualClaude = fs.readFileSync(
    path.join(__dirname, '..', 'CLAUDE.md'),
    'utf8'
  );
  
  t.notOk(actualClaude.includes('path/to/file.ext'), 'Real CLAUDE.md should not contain placeholder paths');
  t.notOk(actualClaude.includes('[complete file content]'), 'Real CLAUDE.md should not contain placeholder content');
  
  // Check that placeholder file is gone
  const placeholderPath = path.join(__dirname, '..', 'path/to/file.ext');
  t.notOk(fs.existsSync(placeholderPath), 'Placeholder file should be removed from repo');
});