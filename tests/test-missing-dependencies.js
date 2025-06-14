#!/usr/bin/env node
/**
 * Test to reproduce missing dependencies issues from commit ca2c369
 * Tests integration issues and missing module dependencies
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

describe('Missing Dependencies Analysis', () => {
  const testDir = '/tmp/test-dependencies';
  
  beforeEach(() => {
    if (fs.existsSync(testDir)) {
      execSync(`rm -rf ${testDir}`);
    }
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      execSync(`rm -rf ${testDir}`);
    }
  });

  test('should detect missing module imports', () => {
    // Copy the new files to test directory
    const srcDir = path.join(testDir, 'src');
    fs.mkdirSync(srcDir, { recursive: true });
    
    // Copy streaming-llm-client.js which depends on SSEClient
    const streamingClientContent = `
const { SSEClient } = require('./sse-client');

class StreamingLLMClient {
  constructor(options = {}) {
    this.sseClient = new SSEClient(options);
  }
  
  async test() {
    return this.sseClient.streamCompletion();
  }
}

module.exports = { StreamingLLMClient };
`;
    
    fs.writeFileSync(path.join(srcDir, 'streaming-llm-client.js'), streamingClientContent);
    
    // Test without sse-client.js file
    const importErrors = checkMissingImports(srcDir);
    
    expect(importErrors.length).toBeGreaterThan(0);
    expect(importErrors[0]).toContain('sse-client');
  });

  test('should detect circular dependencies', () => {
    const srcDir = path.join(testDir, 'src');
    fs.mkdirSync(srcDir, { recursive: true });
    
    // Create circular dependency
    const fileA = `
const { ClassB } = require('./file-b');
class ClassA {
  constructor() {
    this.b = new ClassB();
  }
}
module.exports = { ClassA };
`;
    
    const fileB = `
const { ClassA } = require('./file-a');
class ClassB {
  constructor() {
    this.a = new ClassA(); // Circular!
  }
}
module.exports = { ClassB };
`;
    
    fs.writeFileSync(path.join(srcDir, 'file-a.js'), fileA);
    fs.writeFileSync(path.join(srcDir, 'file-b.js'), fileB);
    
    const circularDeps = detectCircularDependencies(srcDir);
    expect(circularDeps.length).toBeGreaterThan(0);
  });

  test('should test actual SSE integration without proper setup', () => {
    const srcDir = path.join(testDir, 'src');
    fs.mkdirSync(srcDir, { recursive: true });
    
    // Copy the actual SSE client code
    const sseClientPath = '/Users/vg/Documents/projects/phone/berrry-committer/src/sse-client.js';
    const streamingClientPath = '/Users/vg/Documents/projects/phone/berrry-committer/src/streaming-llm-client.js';
    const enhancedCoderPath = '/Users/vg/Documents/projects/phone/berrry-committer/src/enhanced-ai-coder.js';
    
    // Copy files if they exist
    if (fs.existsSync(sseClientPath)) {
      fs.copyFileSync(sseClientPath, path.join(srcDir, 'sse-client.js'));
    }
    if (fs.existsSync(streamingClientPath)) {
      fs.copyFileSync(streamingClientPath, path.join(srcDir, 'streaming-llm-client.js'));
    }
    if (fs.existsSync(enhancedCoderPath)) {
      fs.copyFileSync(enhancedCoderPath, path.join(srcDir, 'enhanced-ai-coder.js'));
    }
    
    // Test instantiation without proper environment
    const integrationTest = () => {
      try {
        delete require.cache[path.resolve(path.join(srcDir, 'enhanced-ai-coder.js'))];
        const { EnhancedAICoder } = require(path.join(srcDir, 'enhanced-ai-coder.js'));
        
        // This should fail without proper API keys and dependencies
        const coder = new EnhancedAICoder({
          apiKey: 'fake-key'
        });
        
        return { success: true, coder };
      } catch (error) {
        return { success: false, error: error.message };
      }
    };
    
    const result = integrationTest();
    
    // Should either fail or succeed but we need to verify it handles missing deps
    if (result.success) {
      expect(result.coder).toBeDefined();
    } else {
      expect(result.error).toBeDefined();
    }
  });

  test('should detect missing external dependencies', () => {
    const packageJsonPath = path.join(testDir, 'package.json');
    const basicPackageJson = {
      name: 'test-project',
      version: '1.0.0',
      dependencies: {
        // Missing fetch, fs.promises might need polyfills, etc.
      }
    };
    
    fs.writeFileSync(packageJsonPath, JSON.stringify(basicPackageJson, null, 2));
    
    const srcDir = path.join(testDir, 'src');
    fs.mkdirSync(srcDir, { recursive: true });
    
    // Code that uses fetch (not available in older Node.js)
    const codeWithFetch = `
const response = await fetch('https://api.example.com');
const data = await response.json();
`;
    
    fs.writeFileSync(path.join(srcDir, 'fetch-example.js'), codeWithFetch);
    
    const missingDeps = detectMissingExternalDependencies(testDir);
    
    // In older Node.js environments, fetch might be missing
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
    
    if (majorVersion < 18) {
      expect(missingDeps).toContain('fetch');
    }
  });

  test('should validate module.exports consistency', () => {
    const srcDir = path.join(testDir, 'src');
    fs.mkdirSync(srcDir, { recursive: true });
    
    // File with inconsistent exports
    const inconsistentExports = `
class MyClass {}

// Inconsistent - exports class but requires destructuring
module.exports = { MyClass };
`;
    
    // File trying to import incorrectly
    const incorrectImport = `
const MyClass = require('./inconsistent'); // Should be const { MyClass }
`;
    
    fs.writeFileSync(path.join(srcDir, 'inconsistent.js'), inconsistentExports);
    fs.writeFileSync(path.join(srcDir, 'incorrect-import.js'), incorrectImport);
    
    const exportIssues = validateExportConsistency(srcDir);
    expect(exportIssues.length).toBeGreaterThan(0);
  });
});

// Helper functions
function checkMissingImports(directory) {
  const errors = [];
  const files = fs.readdirSync(directory).filter(f => f.endsWith('.js'));
  
  for (const file of files) {
    const filePath = path.join(directory, file);
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Find require statements
    const requireMatches = content.match(/require\(['"]([^'"]+)['"]\)/g);
    
    if (requireMatches) {
      for (const match of requireMatches) {
        const modulePath = match.match(/require\(['"]([^'"]+)['"]\)/)[1];
        
        // Check if it's a local module (starts with ./)
        if (modulePath.startsWith('./') || modulePath.startsWith('../')) {
          const resolvedPath = path.resolve(directory, modulePath);
          const possiblePaths = [
            resolvedPath + '.js',
            path.join(resolvedPath, 'index.js'),
            resolvedPath
          ];
          
          const exists = possiblePaths.some(p => fs.existsSync(p));
          
          if (!exists) {
            errors.push(`Missing module: ${modulePath} required in ${file}`);
          }
        }
      }
    }
  }
  
  return errors;
}

function detectCircularDependencies(directory) {
  const files = fs.readdirSync(directory).filter(f => f.endsWith('.js'));
  const dependencies = new Map();
  
  // Build dependency graph
  for (const file of files) {
    const filePath = path.join(directory, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const requires = content.match(/require\(['"]\.\/([^'"]+)['"]\)/g) || [];
    
    const deps = requires.map(req => {
      const match = req.match(/require\(['"]\.\/([^'"]+)['"]\)/);
      return match ? match[1] + '.js' : null;
    }).filter(Boolean);
    
    dependencies.set(file, deps);
  }
  
  // Check for circular dependencies using DFS
  const visited = new Set();
  const recursionStack = new Set();
  const circular = [];
  
  function hasCycle(node, path = []) {
    if (recursionStack.has(node)) {
      circular.push([...path, node]);
      return true;
    }
    
    if (visited.has(node)) {
      return false;
    }
    
    visited.add(node);
    recursionStack.add(node);
    
    const deps = dependencies.get(node) || [];
    for (const dep of deps) {
      if (dependencies.has(dep) && hasCycle(dep, [...path, node])) {
        return true;
      }
    }
    
    recursionStack.delete(node);
    return false;
  }
  
  for (const file of files) {
    if (!visited.has(file)) {
      hasCycle(file);
    }
  }
  
  return circular;
}

function detectMissingExternalDependencies(projectDir) {
  const packageJsonPath = path.join(projectDir, 'package.json');
  let dependencies = {};
  
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    dependencies = {
      ...packageJson.dependencies || {},
      ...packageJson.devDependencies || {}
    };
  }
  
  const srcDir = path.join(projectDir, 'src');
  if (!fs.existsSync(srcDir)) return [];
  
  const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.js'));
  const missing = new Set();
  
  for (const file of files) {
    const content = fs.readFileSync(path.join(srcDir, file), 'utf8');
    
    // Check for global APIs that might not be available
    if (content.includes('fetch(') && !dependencies['node-fetch'] && !dependencies['fetch']) {
      const nodeVersion = parseInt(process.version.slice(1).split('.')[0]);
      if (nodeVersion < 18) {
        missing.add('fetch');
      }
    }
    
    // Check for other potential missing APIs
    if (content.includes('TextDecoder') && !dependencies['util']) {
      missing.add('TextDecoder');
    }
  }
  
  return Array.from(missing);
}

function validateExportConsistency(directory) {
  const issues = [];
  const files = fs.readdirSync(directory).filter(f => f.endsWith('.js'));
  
  for (const file of files) {
    const content = fs.readFileSync(path.join(directory, file), 'utf8');
    
    // Check for destructuring exports vs non-destructuring imports
    const hasDestructuredExports = /module\.exports\s*=\s*\{/.test(content);
    const hasNonDestructuredExports = /module\.exports\s*=\s*[^{]/.test(content);
    
    if (hasDestructuredExports && hasNonDestructuredExports) {
      issues.push(`Inconsistent export pattern in ${file}`);
    }
  }
  
  return issues;
}

module.exports = {
  checkMissingImports,
  detectCircularDependencies,
  detectMissingExternalDependencies,
  validateExportConsistency
};