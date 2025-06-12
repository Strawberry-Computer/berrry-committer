const fs = require('fs').promises;
const { execSync } = require('child_process');

async function callLLM(messages, options = {}) {
  const {
    apiKey = process.env.ANTHROPIC_API_KEY || process.env.OPENROUTER_API_KEY,
    model = 'anthropic/claude-sonnet-4',
    apiUrl = process.env.API_URL || 'https://openrouter.ai/api/v1/chat/completions',
    maxTokens = 64000,
    temperature = 0.1
  } = options;

  if (!apiKey) {
    throw new Error('API key required. Set ANTHROPIC_API_KEY or OPENROUTER_API_KEY');
  }

  const requestBody = {
    model,
    messages,
    max_tokens: maxTokens,
    temperature
  };

  console.log(`🧠 Calling ${model}...`);
  
  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://github.com/Strawberry-Computer/berrry-committer',
        'X-Title': 'Berrry Committer'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorData}`);
    }

    const data = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Invalid API response format');
    }

    const content = data.choices[0].message.content;
    console.log(`✅ LLM response: ${content.substring(0, 100)}...`);
    
    return content;
  } catch (error) {
    console.error('❌ LLM call failed:', error.message);
    throw error;
  }
}

async function generateCommitMessage(files, issueContext, options = {}) {
  const {
    model = 'anthropic/claude-3.5-haiku',
    apiKey,
    includeStats = true
  } = options;

  try {
    // Get git context
    const gitDiff = execSync('git diff --cached', { encoding: 'utf8' });
    const gitLog = execSync('git log --oneline -5', { encoding: 'utf8' });
    const gitStats = includeStats ? execSync('git diff --stat --cached', { encoding: 'utf8' }) : '';

    const prompt = `Generate a concise git commit message for these changes:

Issue Title: ${issueContext.title || 'Direct prompt'}
Issue Description: ${issueContext.description || issueContext.body || 'N/A'}

Git Diff:
${gitDiff}

Recent Commits:
${gitLog}

${gitStats ? `Change Stats:\n${gitStats}\n` : ''}

Files modified: ${files.join(', ')}

Generate a conventional commit message. Be descriptive but concise.`;

    const message = await callLLM(
      [{ role: 'user', content: prompt }], 
      { model, apiKey, maxTokens: 1024 }
    );

    // Clean up the response and add issue reference
    const cleanMessage = message.replace(/^["']|["']$/g, '').trim();
    const issueRef = issueContext.number ? `\n\nCloses #${issueContext.number}` : '';
    
    return cleanMessage + issueRef;
  } catch (error) {
    console.error('❌ Commit message generation failed:', error.message);
    // Fallback to basic message
    const fallbackMessage = `feat: Update ${files.length} files`;
    return issueContext.number ? `${fallbackMessage}\n\nCloses #${issueContext.number}` : fallbackMessage;
  }
}

module.exports = {
  callLLM,
  generateCommitMessage
};