const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

async function getIssueContext(githubEvent = null, options = {}) {
  const { promptMode = false, promptText = '' } = options;

  if (promptMode && promptText) {
    // Direct prompting mode
    return {
      title: 'Direct Prompt',
      description: promptText,
      body: promptText,
      number: null,
      user: 'local'
    };
  }

  if (!githubEvent && process.env.GITHUB_EVENT_PATH) {
    try {
      const eventData = await fs.readFile(process.env.GITHUB_EVENT_PATH, 'utf8');
      githubEvent = JSON.parse(eventData);
    } catch (error) {
      throw new Error(`Failed to read GitHub event: ${error.message}`);
    }
  }

  if (!githubEvent) {
    throw new Error('No GitHub event data available');
  }

  // Handle both issue events and issue comment events
  const issue = githubEvent.issue;
  const comment = githubEvent.comment;

  if (!issue) {
    throw new Error('No issue found in GitHub event');
  }

  // If there's a comment, use it as additional context
  const description = comment 
    ? `${issue.body || ''}\n\n--- Latest Comment ---\n${comment.body}`
    : issue.body || '';

  return {
    title: issue.title,
    description,
    body: issue.body,
    number: issue.number,
    user: issue.user.login,
    comment: comment ? {
      body: comment.body,
      user: comment.user.login
    } : null
  };
}

async function getRepoContext(options = {}) {
  const {
    includeGitFiles = true,
    maxFiles = 100,
    excludePatterns = ['node_modules', '.git', 'dist', 'build', '*.log'],
    coreFiles = [
      'CLAUDE.md', 'README.md', 'package.json', 'package-lock.json',
      'tsconfig.json', '.gitignore', 'Dockerfile', 'docker-compose.yml',
      'Makefile', 'Cargo.toml', 'go.mod', 'requirements.txt', 'pyproject.toml'
    ]
  } = options;

  let context = '';

  // Always include core configuration files if they exist
  for (const filename of coreFiles) {
    try {
      const content = await fs.readFile(filename, 'utf8');
      context += `\n=== ${filename} ===\n${content}\n`;
    } catch (error) {
      // File doesn't exist, skip silently
    }
  }

  if (includeGitFiles) {
    try {
      // Get list of git-tracked files
      const gitFiles = execSync('git ls-files', { encoding: 'utf8' })
        .trim()
        .split('\n')
        .filter(file => file && !excludePatterns.some(pattern => 
          file.includes(pattern) || file.match(new RegExp(pattern.replace('*', '.*')))
        ))
        .slice(0, maxFiles);

      context += `\n=== Git Tracked Files (${gitFiles.length}) ===\n`;
      context += gitFiles.join('\n') + '\n';
    } catch (error) {
      console.warn('⚠️ Could not get git tracked files:', error.message);
    }
  }

  return context;
}

function extractMentionedFiles(text, options = {}) {
  const { 
    extensions = ['.js', '.ts', '.jsx', '.tsx', '.py', '.go', '.rs', '.java', '.cpp', '.c', '.h'],
    patterns = [
      /`([^`]+\.(js|ts|jsx|tsx|py|go|rs|java|cpp|c|h|json|yml|yaml|md|txt))`/g,
      /(?:^|\s)([a-zA-Z0-9_-]+\/[a-zA-Z0-9_\/.+-]+\.(js|ts|jsx|tsx|py|go|rs|java|cpp|c|h|json|yml|yaml|md|txt))/g,
      /@([a-zA-Z0-9_-]+\.(js|ts|jsx|tsx|py|go|rs|java|cpp|c|h|json|yml|yaml|md|txt))/g
    ]
  } = options;

  const mentionedFiles = new Set();

  // Apply each pattern to find file mentions
  patterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const filename = match[1];
      if (filename && (extensions.length === 0 || extensions.some(ext => filename.endsWith(ext)))) {
        mentionedFiles.add(filename);
      }
    }
  });

  return Array.from(mentionedFiles);
}

async function getMentionedFilesContent(mentionedFiles, options = {}) {
  const { maxFileSize = 10000 } = options;
  let content = '';

  for (const filename of mentionedFiles) {
    try {
      const stats = await fs.stat(filename);
      if (stats.size > maxFileSize) {
        content += `\n=== ${filename} (truncated - file too large) ===\n`;
        const fileContent = await fs.readFile(filename, 'utf8');
        content += fileContent.substring(0, maxFileSize) + '\n...[truncated]\n';
      } else {
        const fileContent = await fs.readFile(filename, 'utf8');
        content += `\n=== ${filename} ===\n${fileContent}\n`;
      }
    } catch (error) {
      content += `\n=== ${filename} (not found) ===\n`;
    }
  }

  return content;
}

module.exports = {
  getIssueContext,
  getRepoContext,
  extractMentionedFiles,
  getMentionedFilesContent
};