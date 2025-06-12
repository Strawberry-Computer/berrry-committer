const { callLLM, generateCommitMessage } = require('./llm-client.js');
const { getIssueContext, getRepoContext, extractMentionedFiles, getMentionedFilesContent } = require('./context-generator.js');
const { commitFiles, getCurrentBranch, createBranch, pushAndCreatePR, generateBranchName } = require('./git-operations.js');
const { parseAndWriteFiles, runEvalScript, hasEvalScript } = require('./file-processor.js');

class AICoder {
  constructor(options = {}) {
    this.maxSteps = 5;
    this.currentStep = 0;
    
    // Configuration
    this.config = {
      apiKey: process.env.ANTHROPIC_API_KEY || process.env.OPENROUTER_API_KEY,
      model: process.env.MODEL || 'anthropic/claude-sonnet-4',
      commitModel: process.env.COMMIT_MODEL || 'anthropic/claude-3.5-haiku',
      apiUrl: process.env.API_URL || 'https://openrouter.ai/api/v1/chat/completions',
      testCommand: process.env.TEST_COMMAND,
      isGitHubActions: !!process.env.GITHUB_ACTIONS,
      yoloMode: process.env.YOLO === 'true' || !!process.env.GITHUB_ACTIONS,
      ...options
    };
    
    if (!this.config.apiKey) {
      throw new Error('API key required: set ANTHROPIC_API_KEY or OPENROUTER_API_KEY');
    }
    
    console.log(`🏃 Running in: ${this.config.isGitHubActions ? 'GitHub Actions' : 'Local Development'}`);
    console.log(`🤖 Using model: ${this.config.model}`);
    console.log(`⚡ YOLO mode: ${this.config.yoloMode ? 'ON' : 'OFF'}`);
  }

  async run() {
    console.log('\n🍓 Berrry Committer - Starting AI code generation...');
    
    try {
      // Get issue context from GitHub event
      const issueContext = await getIssueContext();
      console.log(`📋 Processing: ${issueContext.title}`);
      
      await this.processIssue(issueContext);
    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  }

  async runDirectPrompt(promptText) {
    console.log('\n🍓 Berrry Committer - Direct prompting mode...');
    
    try {
      const issueContext = await getIssueContext(null, { 
        promptMode: true, 
        promptText 
      });
      
      console.log(`📋 Processing prompt: ${promptText.substring(0, 100)}...`);
      
      await this.processIssue(issueContext);
    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  }

  async processIssue(issueContext) {
    // Create a new branch for this work
    const branchName = generateBranchName(issueContext);
    console.log(`🌿 Working on branch: ${branchName}`);
    
    if (!createBranch(branchName)) {
      throw new Error('Failed to create/switch to branch');
    }

    // Main iteration loop
    while (this.currentStep < this.maxSteps) {
      this.currentStep++;
      console.log(`\n📍 Step ${this.currentStep}/${this.maxSteps}`);
      
      const shouldContinue = await this.executeStep(issueContext);
      
      if (!shouldContinue) {
        console.log('✅ All done! Ready to create PR.');
        break;
      }
    }

    if (this.currentStep >= this.maxSteps) {
      console.log('⚠️ Reached maximum steps. Creating PR with current progress.');
    }

    // Create pull request
    await this.createPullRequest(branchName, issueContext);
  }

  async executeStep(issueContext) {
    try {
      // Generate code
      console.log('🧠 Generating code...');
      const response = await this.generateUnifiedResponse(issueContext);
      
      // Parse and write files
      const writtenFiles = await parseAndWriteFiles(response, { 
        logOutput: true 
      });
      
      if (writtenFiles.length === 0) {
        console.log('⚠️ No files were generated');
        return false;
      }

      // Commit the changes
      const commitMessage = await generateCommitMessage(
        writtenFiles, 
        issueContext, 
        this.config
      );
      
      const commitSuccess = await commitFiles(writtenFiles, commitMessage);
      
      if (!commitSuccess) {
        console.log('⚠️ Failed to commit files');
        return false;
      }

      // Run evaluation if present
      if (hasEvalScript(response)) {
        const evalResult = await runEvalScript(response, { 
          safeMode: !this.config.yoloMode,
          yolo: this.config.yoloMode 
        });
        
        if (evalResult.skipped) {
          console.log('⏸️ Eval skipped - assuming ready for PR');
          return false;
        }
        
        if (evalResult.success) {
          console.log('✅ Evaluation passed - ready for PR');
          return false;
        } else {
          console.log('🔄 Evaluation failed - continuing to next step');
          console.log(`📋 Eval output: ${evalResult.output}`);
          return true;
        }
      } else {
        console.log('✅ No evaluation script - assuming complete');
        return false;
      }
      
    } catch (error) {
      console.error(`❌ Step ${this.currentStep} failed:`, error.message);
      return false;
    }
  }

  async generateUnifiedResponse(issueContext) {
    // Get repository context
    const repoContext = await getRepoContext({ 
      maxFiles: 100 
    });
    
    // Extract mentioned files from issue/comment
    const mentionedFiles = extractMentionedFiles(issueContext.description || '');
    let mentionedContent = '';
    
    if (mentionedFiles.length > 0) {
      console.log(`📂 Found mentioned files: ${mentionedFiles.join(', ')}`);
      mentionedContent = await getMentionedFilesContent(mentionedFiles);
    }

    // Build the unified prompt
    const prompt = `You are a professional software developer. I need you to help with this task:

## Task
${issueContext.title}

## Description  
${issueContext.description || issueContext.body || 'No description provided'}

## Repository Context
${repoContext}

${mentionedContent ? `## Referenced Files\n${mentionedContent}` : ''}

## Instructions
1. Analyze the request and repository structure
2. Generate complete file contents using this EXACT format:

=== FILENAME: path/to/file.ext ===
[complete file content here]
=== END: path/to/file.ext ===

3. Include an evaluation script at the end to test if the solution works:

\`\`\`bash
# EVAL
#!/bin/bash
set -euo pipefail

# Add your validation logic here
# Exit 0 if ready for PR, non-zero if needs more work
echo "Checking implementation..."

# Example checks:
# - Run tests if they exist
# - Check file syntax
# - Validate functionality
# - Run build commands

echo "✅ All checks passed"
exit 0
\`\`\`

## Current Step
This is step ${this.currentStep} of up to ${this.maxSteps} steps. Make meaningful progress toward completing the task.

Generate the code now:`;

    const messages = [{ role: 'user', content: prompt }];
    
    return await callLLM(messages, {
      ...this.config,
      maxTokens: 64000,
      temperature: 0.1
    });
  }

  async createPullRequest(branchName, issueContext) {
    const title = `${issueContext.title} (AI Generated)`;
    
    console.log('\n🚀 Creating pull request...');
    
    const success = await pushAndCreatePR(branchName, title, issueContext, {
      createPR: true,
      pushFirst: true,
      dryRun: false
    });
    
    if (success) {
      console.log('✅ Pull request workflow complete!');
    } else {
      console.log('⚠️ PR creation had issues - check output above');
    }
  }

  async promptUser(question) {
    if (this.config.yoloMode) {
      console.log(`🚀 YOLO mode: Auto-answering "${question}" with YES`);
      return true;
    }

    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const answer = await new Promise(resolve => {
      readline.question(`${question} (y/N): `, resolve);
    });
    
    readline.close();
    
    return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
  }
}

module.exports = { AICoder };