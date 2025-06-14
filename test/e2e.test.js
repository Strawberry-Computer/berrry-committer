#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

class E2ETestRunner {
  constructor() {
    this.testCases = [];
    this.results = [];
    this.baseDir = path.join(__dirname, '..');
    this.scriptPath = path.join(this.baseDir, 'bin', 'berrry');
  }

  async setup() {
    // Ensure main script exists
    try {
      await fs.access(this.scriptPath);
    } catch (e) {
      throw new Error(`Script not found: ${this.scriptPath}`);
    }
  }

  async createTempRepo() {
    // Create temporary directory for test project
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'berrry-test-'));
    
    // Initialize git repo
    execSync('git init', { cwd: tempDir });
    execSync('git config user.email "test@example.com"', { cwd: tempDir });
    execSync('git config user.name "Test User"', { cwd: tempDir });
    
    // Create a simple README to have something to commit
    await fs.writeFile(path.join(tempDir, 'README.md'), '# Test Project\n\nThis is a test repository for e2e testing.');
    
    // Create initial commit
    execSync('git add .', { cwd: tempDir });
    execSync('git commit -m "Initial commit"', { cwd: tempDir });
    
    return tempDir;
  }

  async cleanupTempRepo(tempDir) {
    try {
      await fs.rm(tempDir, { recursive: true });
    } catch (e) {
      console.warn(`Failed to cleanup temp repo: ${tempDir}`);
    }
  }

  addTestCase(name, issueData, expectedFiles, validation, testType = 'github') {
    this.testCases.push({
      name,
      issueData,
      expectedFiles,
      validation: validation || (() => true),
      testType
    });
  }

  async createMockEvent(issueData, tempDir) {
    const eventPath = path.join(tempDir, `event-${Date.now()}.json`);
    await fs.writeFile(eventPath, JSON.stringify({
      issue: issueData
    }, null, 2));
    return eventPath;
  }

  async runSingleTest(testCase) {
    console.log(`\n🧪 Running test: ${testCase.name} (${testCase.testType} mode)`);
    let tempDir;
    
    try {
      // Create temporary git repo
      tempDir = await this.createTempRepo();
      console.log(`   📁 Temp repo: ${tempDir}`);
      
      let scriptCommand;
      let env = {
        ...process.env,
        YOLO: 'true', // Auto-execute for tests
        MODEL: 'anthropic/claude-3.5-haiku', // Use faster model for tests
      };
      
      if (testCase.testType === 'github') {
        // GitHub event flow
        const eventPath = await this.createMockEvent(testCase.issueData, tempDir);
        env.GITHUB_EVENT_PATH = eventPath;
        scriptCommand = `node ${this.scriptPath}`;
      } else {
        // Direct prompt flow
        const promptText = typeof testCase.issueData === 'string' 
          ? testCase.issueData 
          : testCase.issueData.body;
        scriptCommand = `node ${this.scriptPath} -p "${promptText}"`;
      }
      
      // Run the script with timeout
      const result = execSync(scriptCommand, {
        env,
        encoding: 'utf8',
        timeout: 120000, // Increased to 2 minutes
        cwd: tempDir
      });
      
      // Check expected files were created in temp repo
      const missingFiles = [];
      const createdFiles = [];
      
      // List all files that were actually created
      const actualFiles = [];
      try {
        const entries = await fs.readdir(tempDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isFile() && !entry.name.startsWith('.') && entry.name !== 'event-' + Date.now() + '.json') {
            actualFiles.push(entry.name);
          }
        }
      } catch (e) {
        // ignore
      }
      
      for (const expectedFile of testCase.expectedFiles) {
        const filePath = path.join(tempDir, expectedFile);
        try {
          await fs.access(filePath);
          createdFiles.push(expectedFile);
        } catch (e) {
          missingFiles.push(expectedFile);
        }
      }
      
      if (missingFiles.length > 0) {
        console.log(`   🔍 Expected: ${testCase.expectedFiles.join(', ')}`);
        console.log(`   🔍 Actually created: ${actualFiles.join(', ')}`);
        throw new Error(`Missing expected files: ${missingFiles.join(', ')}`);
      }
      
      // Run custom validation
      const validationResult = await testCase.validation(tempDir);
      if (!validationResult) {
        throw new Error('Custom validation failed');
      }
      
      console.log(`   ✅ Created files: ${createdFiles.join(', ')}`);
      
      return {
        name: testCase.name,
        status: 'PASS',
        output: result.slice(0, 500) + '...', // Truncate output
        filesCreated: createdFiles,
        tempDir
      };
      
    } catch (error) {
      return {
        name: testCase.name,
        status: 'FAIL',
        error: error.message,
        filesCreated: [],
        tempDir
      };
    } finally {
      if (tempDir) {
        await this.cleanupTempRepo(tempDir);
      }
    }
  }

  async runAllTests() {
    console.log(`🚀 Running ${this.testCases.length} E2E tests...\n`);
    
    for (const testCase of this.testCases) {
      const result = await this.runSingleTest(testCase);
      this.results.push(result);
      
      if (result.status === 'PASS') {
        console.log(`✅ ${result.name}`);
      } else {
        console.log(`❌ ${result.name}: ${result.error}`);
      }
    }
  }

  generateReport() {
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    
    console.log(`\n📊 Test Results:`);
    console.log(`   Passed: ${passed}`);
    console.log(`   Failed: ${failed}`);
    console.log(`   Total:  ${this.results.length}`);
    
    if (failed > 0) {
      console.log(`\n❌ Failed Tests:`);
      this.results
        .filter(r => r.status === 'FAIL')
        .forEach(r => console.log(`   - ${r.name}: ${r.error}`));
    }
    
    return failed === 0;
  }
}

// Define test cases
async function setupTests() {
  const runner = new E2ETestRunner();
  
  // Test 1: GitHub event flow (traditional)
  runner.addTestCase(
    'GitHub Event Flow - HTML Page',
    {
      number: 1,
      title: 'Create hello world page',
      body: 'Please create a simple HTML page that says "Hello World" with some basic styling',
      user: {
        login: 'testuser'
      }
    },
    ['index.html'],
    async (tempDir) => {
      const content = await fs.readFile(path.join(tempDir, 'index.html'), 'utf8');
      return content.includes('<!DOCTYPE html>') && 
             content.includes('Hello World') && 
             content.length > 100;
    },
    'github' // Test type
  );
  
  // Test 2: Direct prompt flow (new)
  runner.addTestCase(
    'Direct Prompt Flow - Calculator',
    'Create a simple calculator web app in HTML with basic math operations',
    [], // No specific file requirements - validate any HTML file
    async (tempDir) => {
      const entries = await fs.readdir(tempDir, { withFileTypes: true });
      const htmlFiles = entries.filter(entry => 
        entry.isFile() && entry.name.endsWith('.html')
      );
      
      if (htmlFiles.length === 0) return false;
      
      const content = await fs.readFile(path.join(tempDir, htmlFiles[0].name), 'utf8');
      return content.includes('<!DOCTYPE html>') && 
             (content.toLowerCase().includes('calculator') || content.toLowerCase().includes('math')) && 
             content.length > 300;
    },
    'prompt' // Test type
  );
  
  return runner;
}

// Run tests
async function main() {
  try {
    const runner = await setupTests();
    await runner.setup();
    await runner.runAllTests();
    const success = runner.generateReport();
    
    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error('❌ E2E Test setup failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { E2ETestRunner };