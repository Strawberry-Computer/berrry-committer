const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { LLMClient } = require('./llm-client.js');
const { getIssueContext, getRepoContext } = require('./context-generator.js');
const { parseAndWriteFiles, runEvalScript } = require('./file-processor.js');

const SYSTEM_PROMPT = "You are a professional software developer. Help with this request:";

const INSTRUCTIONS = `Analyze the request and repository structure. 

Think what files need to be:
- observed
- modified
- created
- deleted

IMPORTANT: When modifying existing files, you MUST read their current contents first:
   - It's already included in the context
   - Or need to use \`cat filename\` in eval script to read files before modifying them in next step.

It's ok to just respond with a plan and eval script and not generate any files.

Generate complete file contents using this EXACT format:

=== FILENAME: path/to/file.ext ===
[complete file content here]
=== END: path/to/file.ext ===

=== FILENAME: eval.sh ===
[complete eval script here]
=== END: eval.sh ===

For deleted files just include empty file.

Include an evaluation script at the end

<sample_eval_script>
#!/bin/bash
set -euo pipefail

# Read files before modifying
cat existing-file.js

# Grep to find more files to read
grep "TODO" -R src/

# Exit 1 as we need more steps when not ready for PR
exit 1

# In a later step, you can add more validation logic here instead of exiting 1
</sample_eval_script>`;

const formatTask = (input) => {
  if (!input) throw new Error("Input is required for formatTask");
  return input.number 
    ? `GitHub Issue #${input.number}\nTitle: ${input.title}\nDescription:\n${input.description}`
    : input.description;
};

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
      this.input = await this.getInput();
      
      // 2. Generate context
      this.context = await this.generateContext(this.input);
      
      // 3. Build unified prompt
      const systemPrompt = this.buildPrompt(this.input, this.context);
      
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
    return `${SYSTEM_PROMPT}

<task>
${formatTask(input)}
</task>

<instructions>
${INSTRUCTIONS}
</instructions>

<step>
${this.currentStep}/${this.maxSteps}
</step>

<context>
${context}
</context>

Make meaningful progress toward completing the task.`;
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
      let evalResultText = evalResult.output;
      if (evalResult.stdout) {
        evalResultText += '\n\n<stdout>\n' + evalResult.stdout + '\n</stdout>';
      }
      if (evalResult.stderr) {
        evalResultText += '\n\n<stderr>\n' + evalResult.stderr + '\n</stderr>';
      }
      
      systemPrompt = `${SYSTEM_PROMPT}

<task>
${formatTask(this.input)}
</task>

<instructions>
${INSTRUCTIONS}
</instructions>

<step>
${this.currentStep}/${this.maxSteps}
</step>

<context>
${this.context}
</context>

<previous_response>
${response}
</previous_response>

<eval_result>
${evalResultText}
</eval_result>

Continue making progress toward completing the task.`;
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
    try {
      // Get git log and diff for context
      const gitLog = execSync('git log --oneline -5', { encoding: 'utf8' }).trim();
      const gitDiff = execSync('git diff HEAD', { encoding: 'utf8' }).trim();
      
      
      const prompt = `<task>
Generate a concise git commit message for the changes made
</task>

<original_task>
${formatTask(this.input)}
</original_task>

<git_log>
${gitLog}
</git_log>

<git_diff>
${gitDiff}
</git_diff>

Respond with just the commit message, no explanation.`;
    
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