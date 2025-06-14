const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { LLMClient } = require('./llm-client.js');
const { getIssueContext, getRepoContext } = require('./context-generator.js');
const { parseAndWriteFiles, runEvalScript } = require('./file-processor.js');

class AICoder {
  constructor(options = {}) {
    this.options = {
      verbose: false,
      yolo: process.env.YOLO === 'true',
      ...options
    };
    
    this.llmClient = new LLMClient({ verbose: this.options.verbose });
    this.maxSteps = 5;
    this.currentStep = 1;
    
    if (this.options.verbose) {
      console.log('🔍 Verbose mode enabled');
    }
  }

  async run() {
    try {
      // 1. Get input (either direct prompt or GitHub event)
      const input = await this.getInput();
      
      // 2. Generate context
      const context = await this.generateContext(input);
      
      // 3. Build unified prompt
      const systemPrompt = this.buildPrompt(input, context);
      
      // 4. Process with LLM
      await this.processLLMResponse(systemPrompt);
      
    } catch (error) {
      console.error('❌ Error during execution:', error.message);
      if (this.options.verbose) {
        console.error('Stack trace:', error.stack);
      }
      throw error;
    }
  }

  async getInput() {
    if (this.options.prompt) {
      console.log('🚀 Running in direct prompt mode');
      if (this.options.verbose) {
        console.log('📝 Prompt:', this.options.prompt);
      }
      return await getIssueContext(null, { 
        promptMode: true, 
        promptText: this.options.prompt 
      });
    }
    
    // GitHub mode
    console.log('📋 Processing GitHub event');
    return await getIssueContext();
  }

  async generateContext(input) {
    return await getRepoContext({ 
      maxFiles: 50,
      includeGitFiles: true 
    });
  }

  buildPrompt(input, context) {
    const taskSection = input.number 
      ? `## GitHub Issue #${input.number}\n**Title:** ${input.title}\n**Description:**\n${input.description}`
      : `## Task\n${input.description}`;

    return `You are a professional software developer. Help with this request:

${taskSection}

## Repository Context
${context}

## Instructions
1. Analyze the request and repository structure
2. **IMPORTANT**: When modifying existing files, you MUST read their current contents first:
   - Either include existing file contents in your analysis
   - Or use \`cat filename\` in your evaluation script to read files before modifying
   - Never blindly overwrite files without knowing their current state
3. Generate complete file contents using this EXACT format:

=== FILENAME: path/to/file.ext ===
[complete file content here]
=== END: path/to/file.ext ===

4. Include an evaluation script at the end to test if the solution works:

\`\`\`bash
# EVAL
#!/bin/bash
set -euo pipefail

# Add your validation logic here
# Exit 0 if ready for PR, non-zero if needs more work
echo "Checking implementation..."

# Example: Read files before modifying
# cat existing-file.js
# Run tests, syntax checks, etc.

echo "✅ All checks passed"
exit 0
\`\`\`

## Current Step
This is step ${this.currentStep} of up to ${this.maxSteps} steps. Make meaningful progress toward completing the task.

Generate the code now:`;
  }

  async processLLMResponse(systemPrompt) {
    while (this.currentStep <= this.maxSteps) {
      console.log(`\n🔄 Step ${this.currentStep}/${this.maxSteps}`);
      
      if (this.options.verbose) {
        console.log('\n📤 LLM Input:');
        console.log('=' .repeat(80));
        console.log(systemPrompt);
        console.log('=' .repeat(80));
      }

      const response = await this.llmClient.generateResponse(systemPrompt);
      
      if (this.options.verbose) {
        console.log('\n📥 LLM Output:');
        console.log('=' .repeat(80));
        console.log(response);
        console.log('=' .repeat(80));
      }

      // Process files from response
      const writtenFiles = await parseAndWriteFiles(response, { 
        logOutput: true 
      });

      // Extract and run evaluation script
      const evalResult = await runEvalScript(response, { 
        safeMode: !this.options.yolo,
        yolo: this.options.yolo,
        logOutput: true
      });

      if (evalResult.skipped) {
        console.log('⏸️ Eval skipped - assuming ready for PR');
        break;
      }

      if (evalResult.success) {
        console.log('✅ Evaluation passed! Ready for PR.');
        break;
      }

      this.currentStep++;
      if (this.currentStep > this.maxSteps) {
        console.log('⚠️ Reached maximum steps. Creating PR with current progress.');
        break;
      }

      // Update system prompt for next iteration
      systemPrompt = `Continue working on the task. This is step ${this.currentStep} of ${this.maxSteps}.

Previous response:
${response}

Previous eval result: ${evalResult.output}

What needs to be done next? Generate any additional files or improvements needed.`;
    }

    await this.createCommit();
  }

  async createCommit() {
    try {
      // Check if we're in a git repository
      execSync('git rev-parse --git-dir', { stdio: 'ignore' });
      
      // Check if there are any changes to commit
      const status = execSync('git status --porcelain', { encoding: 'utf8' });
      if (!status.trim()) {
        console.log('📝 No changes to commit');
        return;
      }

      console.log('📝 Creating commit...');
      
      // Add all changes
      execSync('git add .', { stdio: 'inherit' });
      
      // Generate commit message
      const commitMessage = await this.generateCommitMessage();
      
      if (this.options.verbose) {
        console.log('💬 Commit message:', commitMessage);
      }
      
      // Create commit
      execSync(`git commit -m "${commitMessage}"`, { stdio: 'inherit' });
      console.log('✅ Commit created successfully');
      
    } catch (error) {
      if (this.options.verbose) {
        console.log('ℹ️ Git commit skipped:', error.message);
      } else {
        console.log('ℹ️ Git commit skipped (not in git repo or no changes)');
      }
    }
  }

  async generateCommitMessage() {
    const prompt = "Generate a concise git commit message for the changes made. Respond with just the commit message, no explanation.";
    
    try {
      const message = await this.llmClient.generateResponse(prompt, { useCommitModel: true });
      return message.trim().replace(/"/g, '\\"');
    } catch (error) {
      if (this.options.verbose) {
        console.log('⚠️ Failed to generate commit message:', error.message);
      }
      return "AI-generated code changes";
    }
  }
}

module.exports = { AICoder };