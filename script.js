#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    prompt: false,
    help: false,
    promptText: ''
  };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '-p' || arg === '--prompt') {
      options.prompt = true;
      // If next arg exists and doesn't start with -, use it as prompt text
      if (args[i + 1] && !args[i + 1].startsWith('-')) {
        options.promptText = args[i + 1];
        i++; // Skip next arg since we consumed it
      }
    } else if (arg === '-h' || arg === '--help') {
      options.help = true;
    }
  }
  
  return options;
}

function showHelp() {
  console.log(`
🍓 Berrry Committer - AI-powered code generation

Usage:
  node script.js                    # GitHub Actions mode (requires GITHUB_EVENT_PATH)
  node script.js -p "prompt text"   # Direct prompting with text
  node script.js --prompt           # Direct prompting via stdin
  echo "prompt" | node script.js -p # Direct prompting via pipe

Options:
  -p, --prompt [text]   Enable direct prompting mode
  -h, --help           Show this help message

Environment Variables:
  ANTHROPIC_API_KEY     API key for Anthropic Claude
  OPENROUTER_API_KEY    API key for OpenRouter (alternative)
  YOLO=true            Skip confirmations (auto-execute)
  MODEL                Custom model name
  TEST_COMMAND         Command to run for validation

Examples:
  node script.js -p "Create a todo app with React"
  echo "Build a calculator" | node script.js --prompt
  node script.js -p < my_request.txt
`);
}

// Read from stdin if needed
async function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    
    // Check if stdin has data
    if (process.stdin.isTTY) {
      resolve(''); // No piped input
      return;
    }
    
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => data += chunk);
    process.stdin.on('end', () => resolve(data.trim()));
  });
}

class AICoder {
  constructor(options = {}) {
    this.maxSteps = 5;
    this.currentStep = 0;
    this.promptMode = options.prompt || false;
    this.promptText = options.promptText || '';
    
    // API configuration with defaults
    this.apiUrl = process.env.API_URL || 'https://openrouter.ai/api/v1/chat/completions';
    this.apiKey = process.env.ANTHROPIC_API_KEY || process.env.OPENROUTER_API_KEY;
    this.model = process.env.MODEL || 'anthropic/claude-3.5-sonnet';
    this.commitModel = process.env.COMMIT_MODEL || 'anthropic/claude-3.5-haiku';
    
    // Configuration
    this.testCommand = process.env.TEST_COMMAND; // If not set, assume tests pass
    this.isGitHubActions = !!process.env.GITHUB_ACTIONS; // Auto-detect GitHub Actions
    this.yoloMode = process.env.YOLO === 'true' || this.isGitHubActions; // Force YOLO in GH Actions
    
    if (!this.apiKey) {
      throw new Error('API key required: set ANTHROPIC_API_KEY or OPENROUTER_API_KEY');
    }
    
    console.log(`🏃 Running in: ${this.isGitHubActions ? 'GitHub Actions' : 'Local Development'}`);
    console.log(`⚡ YOLO Mode: ${this.yoloMode ? 'ON (auto-execute)' : 'OFF (manual confirm)'}`);
  }

  async callLLM(messages, model = null, maxTokens = 6000) {
    console.log('🧠 LLM Call:', model || this.model);
    console.log('📝 Prompt length:', JSON.stringify(messages).length, 'chars');
    
    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        'HTTP-Referer': 'https://github.com',
        'X-Title': 'AI GitHub Action'
      },
      body: JSON.stringify({
        model: model || this.model,
        messages: messages,
        max_tokens: maxTokens,
        temperature: 0.1
      })
    });

    if (!response.ok) {
      throw new Error(`API call failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    console.log('🔍 LLM Response length:', content.length, 'chars');
    console.log('📄 LLM Output:\n' + '='.repeat(50));
    console.log(content);
    console.log('='.repeat(50));
    
    return content;
  }

  async getIssueContext() {
    if (this.promptMode) {
      // Direct prompting mode
      let promptText = this.promptText;
      
      // If no prompt text provided, try to read from stdin
      if (!promptText) {
        promptText = await readStdin();
      }
      
      if (!promptText) {
        throw new Error('No prompt provided. Use -p "your prompt" or pipe text to stdin.');
      }
      
      return {
        title: 'Direct Prompt',
        number: 1,
        description: promptText,
        comment: '',
        fullContext: promptText
      };
    } else {
      // GitHub Actions mode
      const eventPath = process.env.GITHUB_EVENT_PATH;
      if (!eventPath) {
        throw new Error('GITHUB_EVENT_PATH not found - not running in GitHub Actions? Use -p for direct prompting.');
      }
      
      const event = JSON.parse(await fs.readFile(eventPath, 'utf8'));
      
      // Extract relevant information based on event type
      let issueBody = '';
      let commentBody = '';
      let issueTitle = '';
      let issueNumber = null;
      
      if (event.issue) {
        // Issue event (opened, edited) or issue_comment event
        issueTitle = event.issue.title || '';
        issueBody = event.issue.body || '';
        issueNumber = event.issue.number;
        
        if (event.comment) {
          // This is an issue_comment event
          commentBody = event.comment.body || '';
        }
      }
      
      // Build the full context string that will be sent to the LLM
      const fullContext = [
        `Title: ${issueTitle}`,
        issueBody ? `Description: ${issueBody}` : '',
        commentBody ? `Comment: ${commentBody}` : ''
      ].filter(Boolean).join('\n\n');
      
      return {
        title: issueTitle,
        number: issueNumber,
        description: issueBody,
        comment: commentBody,
        fullContext: fullContext
      };
    }
  }

  async getRepoContext(issueContext) {
    try {
      const context = [];
      
      // Default context files (including CLAUDE.md as a regular file)
      const coreFiles = ['CLAUDE.md', 'README.md', 'package.json', 'tsconfig.json', 'pyproject.toml', 'requirements.txt'];
      for (const file of coreFiles) {
        try {
          const content = await fs.readFile(file, 'utf8');
          context.push(`=== ${file} ===\n${content.slice(0, 2000)}...\n`);
        } catch (e) {
          // File doesn't exist, skip
        }
      }

      // Get git tracked files (more accurate than find)
      let gitFiles = [];
      try {
        const gitOutput = execSync('git ls-files', { encoding: 'utf8' });
        gitFiles = gitOutput.split('\n').filter(f => f.trim());
        context.push(`\n=== GIT TRACKED FILES ===\n${gitFiles.join('\n')}\n`);
      } catch (e) {
        // Fallback to find if not in git repo
        const findOutput = execSync('find . -type f -name "*.js" -o -name "*.py" -o -name "*.ts" -o -name "*.json" -o -name "*.md" | grep -v node_modules | head -50', 
          { encoding: 'utf8' });
        gitFiles = findOutput.split('\n').filter(f => f.trim());
        context.push(`\n=== FILES FOUND ===\n${gitFiles.join('\n')}\n`);
      }

      // Extract mentioned files from issue/comments and include their content
      const mentionedFiles = this.extractMentionedFiles(issueContext.fullContext, gitFiles);
      for (const file of mentionedFiles) {
        try {
          const content = await fs.readFile(file, 'utf8');
          context.push(`\n=== MENTIONED: ${file} ===\n${content}\n`);
        } catch (e) {
          context.push(`\n=== MENTIONED: ${file} === (FILE NOT FOUND)\n`);
        }
      }
      
      return context.join('\n---\n');
    } catch (e) {
      return 'No repository context available';
    }
  }

  extractMentionedFiles(text, availableFiles = []) {
    const files = [];
    
    // Match code blocks with filenames: `src/file.js` or `file.py`
    const codeBlockFiles = text.match(/`([^`]+\.[a-zA-Z]+)`/g);
    if (codeBlockFiles) {
      files.push(...codeBlockFiles.map(f => f.replace(/`/g, '')));
    }
    
    // Match @filename mentions (GitHub-style)
    const atMentions = text.match(/@(\w+\.[a-zA-Z]+)/g);
    if (atMentions) {
      files.push(...atMentions.map(f => f.substring(1)));
    }
    
    // Match file paths in text: src/components/Login.js
    const pathMatches = text.match(/\b[a-zA-Z_][\w\/]*\.\w+/g);
    if (pathMatches) {
      files.push(...pathMatches.filter(f => 
        f.includes('/') || ['js', 'py', 'ts', 'json', 'md', 'css', 'html'].includes(f.split('.').pop())
      ));
    }
    
    // Filter to only include files that actually exist in the repo
    const existingFiles = files.filter(file => {
      if (availableFiles.length > 0) {
        return availableFiles.includes(file) || availableFiles.includes('./' + file);
      }
      return true; // If we don't have git files list, try all mentioned files
    });
    
    return [...new Set(existingFiles)]; // Remove duplicates
  }

  async generateUnifiedResponse(issueContext, repoContext, previousResult = '', designContext = '') {
    const designSection = designContext ? `Previous design:\n${designContext}\n\n---\n` : `
IF THIS ISSUE IS COMPLEX (multiple components, architecture changes, new systems):
First create a design section with:
## DESIGN
### Plan
- Step 1
- Step 2
...

### Diagram
[ASCII diagram showing components/flow]

### Files
- file1.js - purpose
- file2.py - purpose

---
`;

    const prompt = `${designSection}
Generate a complete development step for this GitHub issue:

${issueContext.fullContext}

Repository context:
${repoContext}

${previousResult ? `Previous step context:\n${previousResult}\n` : ''}

Provide a UNIFIED response with these sections:

## ANALYSIS
Briefly analyze what needs to be done this step.

## CODE
Generate complete file contents. Format each file as:
=== FILENAME: path/to/file.ext ===
[complete file content]
=== END ===

## EVAL
Generate a bash script to gather context for the next step.
Use proper bash practices: set -euo pipefail at the start.
Exit with code 0 if ready for PR, non-zero if needs more work.
\`\`\`bash
#!/bin/bash
set -euo pipefail
# Check what was created, find missing deps, scan for TODOs, detect syntax errors
# Exit 0 if ready for PR, exit 1 if needs more work
\`\`\`

Only include files that need to be created or completely replaced. Focus on making meaningful progress toward solving the issue.`;

    const content = await this.callLLM([{ role: 'user', content: prompt }]);
    return content;
  }

  parseUnifiedResponse(response) {
    const sections = {};
    
    // Extract DESIGN section
    const designMatch = response.match(/## DESIGN\s*\n([\s\S]*?)(?=\n##|$)/);
    if (designMatch) {
      sections.design = designMatch[1].trim();
    }
    
    // Extract ANALYSIS section
    const analysisMatch = response.match(/## ANALYSIS\s*\n([\s\S]*?)(?=\n##|$)/);
    if (analysisMatch) {
      sections.analysis = analysisMatch[1].trim();
    }
    
    // Extract CODE section
    const codeMatch = response.match(/## CODE\s*\n([\s\S]*?)(?=\n##|$)/);
    if (codeMatch) {
      sections.code = codeMatch[1].trim();
    }
    
    // Extract EVAL section
    const evalMatch = response.match(/## EVAL\s*\n```bash\s*\n([\s\S]*?)\n```/);
    if (evalMatch) {
      sections.eval = evalMatch[1].trim();
    }
    
    return sections;
  }

  async generateTestScript(issueContext) {
    const prompt = `Generate a bash script to validate if we're ready to create a PR:

Issue: ${issueContext.title}

Create test.sh that validates the implementation is complete:
1. Run all relevant tests (npm test, pytest, etc.)
2. Check build/compilation passes
3. Validate all expected functionality works
4. Check code quality/linting
5. Verify no critical errors

This determines if we should create a PR or continue iterating.
Return just the bash script content:`;

    const response = await anthropic.messages.create({
      model: 'claude-3-sonnet-20240229',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }]
    });

    return response.content[0].text;
  }

  async parseAndWriteFiles(codeOutput) {
    const files = [];
    const fileRegex = /=== FILENAME: (.+?) ===\n([\s\S]*?)\n=== END ===/g;
    let match;

    while ((match = fileRegex.exec(codeOutput)) !== null) {
      const filename = match[1].trim();
      const content = match[2].trim();
      
      // Create directory if it doesn't exist
      const dir = path.dirname(filename);
      if (dir !== '.') {
        await fs.mkdir(dir, { recursive: true });
      }
      
      await fs.writeFile(filename, content);
      files.push(filename);
      console.log(`Created/updated: ${filename}`);
    }

    return files;
  }

  async commitFiles(files, issueTitle) {
    if (files.length === 0) return;
    
    try {
      // Add files to git
      for (const file of files) {
        execSync(`git add "${file}"`);
      }
      
      // Create commit message
      const commitMessage = `Generate code for: ${issueTitle}

Files: ${files.join(', ')}

🤖 Generated by AI Code Generator`;
      
      execSync(`git commit -m "${commitMessage}"`);
      console.log(`📝 Committed ${files.length} files`);
    } catch (error) {
      console.log(`⚠️ Commit failed: ${error.message}`);
    }
  }

  async promptUser(question) {
    // In GitHub Actions, always return true (auto-proceed)
    if (this.isGitHubActions) {
      return true;
    }
    
    // Local development: prompt for confirmation
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    return new Promise((resolve) => {
      rl.question(`${question} (y/N): `, (answer) => {
        rl.close();
        resolve(answer.toLowerCase().startsWith('y'));
      });
    });
  }

  async runEvalScript(script) {
    try {
      await fs.writeFile('eval.sh', script);
      execSync('chmod +x eval.sh');
      
      if (!this.yoloMode) {
        console.log('\n🤔 Generated eval.sh script:');
        console.log('='.repeat(40));
        console.log(script);
        console.log('='.repeat(40));
        
        const shouldExecute = await this.promptUser('Execute this eval script?');
        if (!shouldExecute) {
          console.log('📋 Eval script skipped by user - assuming success');
          return { success: false, output: 'Eval skipped by user' };
        }
      }
      
      console.log('🚀 Executing eval.sh...');
      const result = execSync('./eval.sh', { encoding: 'utf8', timeout: 30000 });
      return { success: true, output: result };
    } catch (error) {
      return { success: false, output: `Eval failed: ${error.message}` };
    }
  }

  async runTestScript(script) {
    try {
      await fs.writeFile('test.sh', script);
      execSync('chmod +x test.sh');
      const result = execSync('./test.sh', { encoding: 'utf8', timeout: 60000 });
      return result;
    } catch (error) {
      return `Tests failed: ${error.message}`;
    }
  }

  async run() {
    try {
      console.log('🤖 AI Code Generator starting...');
      
      const issueContext = await this.getIssueContext();
      const repoContext = await this.getRepoContext(issueContext);
      
      console.log(`📋 Processing: ${issueContext.title}`);
      
      let designContext = '';
      let previousResult = '';
      
      // Configure git user for commits
      execSync('git config user.email "action@github.com"');
      execSync('git config user.name "FastClaude AI"');
      
      for (this.currentStep = 1; this.currentStep <= this.maxSteps; this.currentStep++) {
        console.log(`\n🔄 Step ${this.currentStep}/${this.maxSteps}`);
        
        // Single unified LLM call for everything
        const unifiedResponse = await this.generateUnifiedResponse(
          issueContext, 
          repoContext, 
          previousResult, 
          designContext
        );
        
        const sections = this.parseUnifiedResponse(unifiedResponse);
        
        // Capture design context for future steps (don't save to file)
        if (sections.design && !designContext) {
          console.log('🏗️  Design generated for complex issue');
          designContext = sections.design;
        }
        
        // Display analysis
        if (sections.analysis) {
          console.log('📊 Analysis:', sections.analysis.slice(0, 200) + '...');
        }
        
        // Process files
        const files = await this.parseAndWriteFiles(sections.code || '');
        
        if (files.length === 0) {
          console.log('No files to update, stopping...');
          break;
        }
        
        // Commit files immediately after each LLM generation
        await this.commitFiles(files, issueContext.title);
        
        // Run evaluation if provided
        if (sections.eval) {
          const evalResult = await this.runEvalScript(sections.eval);
          console.log('📊 Evaluation result:');
          console.log(evalResult.output);
          
          // Check exit code - 0 means ready for PR
          if (evalResult.success) {
            console.log('✅ Eval exit code 0 - Ready for PR, stopping iteration');
            break;
          }
          
          previousResult = evalResult.output;
        }
      }
      
      // Run final tests if configured
      if (this.testCommand) {
        console.log('\n🧪 Running final validation tests...');
        try {
          const testResult = execSync(this.testCommand, { encoding: 'utf8', timeout: 120000 });
          console.log('✅ All tests passing!');
          console.log(testResult);
        } catch (error) {
          console.log('⚠️ Tests failed - but continuing with PR creation');
          console.log(error.message);
        }
      } else {
        console.log('📋 No test command configured - assuming tests pass');
      }
      
      // Push all commits and create PR at the end
      console.log('\n🚀 Pushing commits and creating PR...');
      await this.pushAndCreatePR(issueContext);
      
      console.log('🎉 AI Code Generator completed!');
      
    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  }

  async pushAndCreatePR(issueContext) {
    try {
      // Create branch name from issue title
      const branchName = `ai/${issueContext.title.toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, '-')
        .slice(0, 50)}`;
      
      console.log(`🌿 Creating branch: ${branchName}`);
      
      // Create and switch to new branch
      execSync(`git checkout -b "${branchName}"`);
      
      // Push the branch
      execSync(`git push -u origin "${branchName}"`);
      console.log(`✅ Pushed branch: ${branchName}`);
      
      // Create pull request using GitHub API
      const prCreated = await this.createPullRequest(branchName, issueContext);
      
      if (!prCreated) {
        console.log(`📋 Manual PR creation needed:`);
        console.log(`   Branch: ${branchName}`);
        console.log(`   Title: ${issueContext.title}`);
      }
      
    } catch (error) {
      console.log(`⚠️ Push/PR creation failed: ${error.message}`);
    }
  }

  async createPullRequest(branchName, issueContext) {
    try {
      // This would typically use GitHub API to create PR
      // For local testing, we'll just log what would happen
      console.log(`🔗 Would create PR:`);
      console.log(`   From: ${branchName}`);
      console.log(`   To: main`);
      console.log(`   Title: ${issueContext.title}`);
      console.log(`   Body: Resolves #${issueContext.number}`);
      return false; // Indicates manual creation needed
    } catch (error) {
      console.log(`⚠️ PR creation failed: ${error.message}`);
      return false;
    }
  }
}

// Run if called directly
if (require.main === module) {
  const options = parseArgs();
  
  if (options.help) {
    showHelp();
    process.exit(0);
  }
  
  new AICoder(options).run().catch(error => {
    console.error('❌ Error:', error.message);
    process.exit(1);
  });
}
