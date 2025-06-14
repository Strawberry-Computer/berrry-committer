#!/usr/bin/env node
/**
 * Test to reproduce the placeholder file issue from commit ca2c369
 * This test demonstrates how placeholder files can accidentally be committed
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

describe('Placeholder File Issue Analysis', () => {
  const testDir = '/tmp/test-placeholder-issue';
  const placeholderFile = path.join(testDir, 'path/to/file.ext');

  beforeEach(() => {
    // Create test directory
    if (fs.existsSync(testDir)) {
      execSync(`rm -rf ${testDir}`);
    }
    fs.mkdirSync(testDir, { recursive: true });
    
    // Initialize git repo
    execSync('git init', { cwd: testDir });
    execSync('git config user.email "test@example.com"', { cwd: testDir });
    execSync('git config user.name "Test User"', { cwd: testDir });
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      execSync(`rm -rf ${testDir}`);
    }
  });

  test('should detect placeholder file content', () => {
    // Reproduce the exact placeholder file from the commit
    const placeholderContent = '[complete file content]';
    
    // Create the directory structure
    fs.mkdirSync(path.dirname(placeholderFile), { recursive: true });
    
    // Write placeholder content
    fs.writeFileSync(placeholderFile, placeholderContent);
    
    // Read and verify it's a placeholder
    const content = fs.readFileSync(placeholderFile, 'utf8');
    
    // Assertions to detect placeholder patterns
    expect(content).toBe('[complete file content]');
    expect(isPlaceholderContent(content)).toBe(true);
    expect(content.includes('[')).toBe(true);
    expect(content.includes(']')).toBe(true);
    expect(content.length).toBeLessThan(50); // Suspiciously short
  });

  test('should detect placeholder files before git commit', () => {
    // Create a placeholder file
    fs.mkdirSync(path.dirname(placeholderFile), { recursive: true });
    fs.writeFileSync(placeholderFile, '[complete file content]');
    
    // Add to git
    execSync(`git add .`, { cwd: testDir });
    
    // Check git status
    const status = execSync('git status --porcelain', { cwd: testDir, encoding: 'utf8' });
    
    expect(status).toContain('path/to/file.ext');
    
    // Validate staged files for placeholders
    const stagedFiles = getStagedFiles(testDir);
    const placeholderFiles = stagedFiles.filter(file => {
      const fullPath = path.join(testDir, file);
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf8');
        return isPlaceholderContent(content);
      }
      return false;
    });
    
    expect(placeholderFiles).toContain('path/to/file.ext');
  });

  test('should identify generic path patterns', () => {
    const suspiciousPath = 'path/to/file.ext';
    
    expect(isGenericPath(suspiciousPath)).toBe(true);
    expect(isGenericPath('src/components/Button.js')).toBe(false);
    expect(isGenericPath('path/to/something.txt')).toBe(true);
    expect(isGenericPath('some/path/to/file.js')).toBe(true);
  });

  test('should prevent committing placeholder files', () => {
    // Create multiple files including placeholders
    const realFile = path.join(testDir, 'src/real-component.js');
    fs.mkdirSync(path.dirname(realFile), { recursive: true });
    fs.writeFileSync(realFile, 'console.log("real code");');
    
    fs.mkdirSync(path.dirname(placeholderFile), { recursive: true });
    fs.writeFileSync(placeholderFile, '[complete file content]');
    
    execSync(`git add .`, { cwd: testDir });
    
    // Pre-commit validation
    const validationResult = validateCommit(testDir);
    
    expect(validationResult.isValid).toBe(false);
    expect(validationResult.placeholderFiles).toContain('path/to/file.ext');
    expect(validationResult.errors).toContain('Placeholder files detected');
  });
});

// Helper functions
function isPlaceholderContent(content) {
  const placeholderPatterns = [
    /^\[.*\]$/,
    /^<.*>$/,
    /^TODO:/i,
    /^FIXME:/i,
    /complete.*content/i,
    /placeholder/i,
    /example.*content/i
  ];
  
  const trimmed = content.trim();
  
  // Check for common placeholder patterns
  return placeholderPatterns.some(pattern => pattern.test(trimmed)) ||
         trimmed.length < 10; // Suspiciously short files
}

function isGenericPath(filePath) {
  const genericPatterns = [
    /path\/to\//,
    /example\//,
    /sample\//,
    /template\//,
    /\.ext$/,
    /file\.(txt|ext|tmp)$/
  ];
  
  return genericPatterns.some(pattern => pattern.test(filePath));
}

function getStagedFiles(gitDir) {
  try {
    const output = execSync('git diff --cached --name-only', { 
      cwd: gitDir, 
      encoding: 'utf8' 
    });
    return output.trim().split('\n').filter(line => line.length > 0);
  } catch (error) {
    return [];
  }
}

function validateCommit(gitDir) {
  const stagedFiles = getStagedFiles(gitDir);
  const placeholderFiles = [];
  const errors = [];
  
  for (const file of stagedFiles) {
    // Check for generic paths
    if (isGenericPath(file)) {
      placeholderFiles.push(file);
      errors.push(`Generic path detected: ${file}`);
    }
    
    // Check file content
    const fullPath = path.join(gitDir, file);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (isPlaceholderContent(content)) {
        placeholderFiles.push(file);
        errors.push(`Placeholder content detected in: ${file}`);
      }
    }
  }
  
  if (placeholderFiles.length > 0) {
    errors.unshift('Placeholder files detected');
  }
  
  return {
    isValid: placeholderFiles.length === 0,
    placeholderFiles,
    errors
  };
}

module.exports = {
  isPlaceholderContent,
  isGenericPath,
  validateCommit
};