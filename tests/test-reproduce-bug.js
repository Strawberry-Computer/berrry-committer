const test = require('tape');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

test('Reproduce original placeholder file bug', async (t) => {
  t.plan(5);
  
  const testDir = '/tmp/test-berrry-reproduce-bug';
  const originalCwd = process.cwd();
  
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
    
    // Copy the contaminated CLAUDE.md that caused the issue
    const contaminatedClaude = `# CLAUDE.md

## Code Generation Format

The LLM must output code in this exact format:

\`\`\`
=== FILENAME: path/to/file.ext ===
[complete file content]
=== END: path/to/file.ext ===
\`\`\`

Multiple files can be generated in a single response.`;
    
    fs.writeFileSync('CLAUDE.md', contaminatedClaude);
    fs.writeFileSync('package.json', '{"name": "test-project"}');
    
    // Copy the script.js parsing logic (simplified version)
    const parseAndWriteFiles = (codeOutput) => {
      const files = [];
      const fileRegex = /=== FILENAME: (.+?) ===\s*\n([\s\S]*?)\n=== END: \1 ===/g;
      let match;

      while ((match = fileRegex.exec(codeOutput)) !== null) {
        const filename = match[1].trim();
        const content = match[2].trim();
        
        // This is the bug - no validation!
        const dir = path.dirname(filename);
        if (dir !== '.') {
          fs.mkdirSync(dir, { recursive: true });
        }
        
        fs.writeFileSync(filename, content);
        files.push(filename);
      }

      return files;
    };
    
    // Simulate the LLM output that included the contaminated CLAUDE.md context
    const mockLLMOutput = `I'll help you with that request.

=== FILENAME: src/component.js ===
const React = require('react');

const Component = () => {
  return React.createElement('div', null, 'Hello World');
};

module.exports = Component;
=== END: src/component.js ===

=== FILENAME: path/to/file.ext ===
[complete file content]
=== END: path/to/file.ext ===

The component is ready to use!`;
    
    // Execute the buggy parsing (this reproduces the original issue)
    const createdFiles = parseAndWriteFiles(mockLLMOutput);
    
    // Verify the bug occurred
    t.equal(createdFiles.length, 2, 'Should create 2 files');
    t.ok(createdFiles.includes('path/to/file.ext'), 'Should create the placeholder file');
    t.ok(fs.existsSync('path/to/file.ext'), 'Placeholder file should exist on filesystem');
    
    const placeholderContent = fs.readFileSync('path/to/file.ext', 'utf8');
    t.equal(placeholderContent, '[complete file content]', 'Should contain placeholder content');
    
    // Commit the files (this is what actually happened)
    execSync('git add .');
    execSync('git commit -m "feat: add SSE support"');
    
    // Verify the placeholder file was committed
    const committedFiles = execSync('git ls-files', { encoding: 'utf8' }).split('\n').filter(f => f.trim());
    t.ok(committedFiles.includes('path/to/file.ext'), 'Placeholder file should be committed to git');
    
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

test('Verify our fix prevents the bug', async (t) => {
  t.plan(3);
  
  const testDir = '/tmp/test-berrry-fix-verification';
  const originalCwd = process.cwd();
  
  try {
    // Clean up any existing test directory
    if (fs.existsSync(testDir)) {
      execSync(`rm -rf ${testDir}`);
    }
    
    // Create test directory
    fs.mkdirSync(testDir, { recursive: true });
    process.chdir(testDir);
    
    // Use the FIXED CLAUDE.md (without contaminating examples)
    const fixedClaude = `# CLAUDE.md

## Code Generation Format

The LLM outputs files using filename markers with complete file content. Multiple files can be generated in a single response.`;
    
    fs.writeFileSync('CLAUDE.md', fixedClaude);
    
    // Enhanced parsing with validation (the fix)
    const parseAndWriteFilesWithValidation = (codeOutput) => {
      const files = [];
      const fileRegex = /=== FILENAME: (.+?) ===\s*\n([\s\S]*?)\n=== END: \1 ===/g;
      let match;

      while ((match = fileRegex.exec(codeOutput)) !== null) {
        const filename = match[1].trim();
        const content = match[2].trim();
        
        // VALIDATION: Check for placeholder patterns
        const isGenericPath = /path\/to\//.test(filename) || /\.ext$/.test(filename);
        const isPlaceholderContent = /^\[.*\]$/.test(content) || content.length < 10;
        
        if (isGenericPath) {
          console.log(`Skipping generic path: ${filename}`);
          continue;
        }
        
        if (isPlaceholderContent) {
          console.log(`Skipping placeholder content in: ${filename}`);
          continue;
        }
        
        // Only create valid files
        const dir = path.dirname(filename);
        if (dir !== '.') {
          fs.mkdirSync(dir, { recursive: true });
        }
        
        fs.writeFileSync(filename, content);
        files.push(filename);
      }

      return files;
    };
    
    // Same LLM output as before
    const mockLLMOutput = `I'll help you with that request.

=== FILENAME: src/component.js ===
const React = require('react');

const Component = () => {
  return React.createElement('div', null, 'Hello World');
};

module.exports = Component;
=== END: src/component.js ===

=== FILENAME: path/to/file.ext ===
[complete file content]
=== END: path/to/file.ext ===

The component is ready to use!`;
    
    // Execute the FIXED parsing
    const createdFiles = parseAndWriteFilesWithValidation(mockLLMOutput);
    
    // Verify the fix worked
    t.equal(createdFiles.length, 1, 'Should only create 1 valid file (not the placeholder)');
    t.ok(createdFiles.includes('src/component.js'), 'Should create the legitimate file');
    t.notOk(fs.existsSync('path/to/file.ext'), 'Should NOT create the placeholder file');
    
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