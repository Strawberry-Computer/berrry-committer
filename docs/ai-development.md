# 🤖 AI-Assisted Development Guide

This repository uses the Berrry Committer to develop itself! Here's how to use AI to enhance this project.

## 🚀 Quick Start

### Method 1: Create an AI Issue
1. Go to [Issues](../../issues/new/choose)
2. Select "AI Code Request" template
3. Fill out your request
4. The AI will automatically process it and create a PR

### Method 2: Comment on Existing Issues
Comment with `@fastclaude` plus your request:
```
@fastclaude Please add error handling to the file parsing function
```

### Method 3: Use Title Prefixes
Create issues with titles starting with `ai:` or `claude:`:
```
ai: Add TypeScript support
claude: Refactor the test suite
```

## 📝 Writing Good AI Requests

### ✅ Good Examples
```markdown
@fastclaude Please add a --version flag that shows the current version from package.json

@fastclaude The error handling in script.js lines 150-200 needs improvement. Add try-catch blocks and better error messages.

ai: Create a Docker setup with Dockerfile and docker-compose.yml for easy deployment
```

### ❌ Avoid These
```markdown
Make it better (too vague)
Fix the bug (no specific bug mentioned)
Add features (no specific features)
```

## 🎯 Best Practices

### Be Specific
- Reference specific files, functions, or line numbers
- Describe expected behavior
- Include examples or test cases

### Provide Context
- Mention related issues or PRs
- Reference existing patterns in the codebase
- Explain the "why" behind your request

### Break Down Complex Requests
Instead of:
> "Rewrite the entire application to use TypeScript with better error handling and add Docker support"

Try:
> "ai: Add TypeScript configuration and convert script.js to TypeScript"
> 
> Then in a separate issue:
> "ai: Add Docker setup for containerized development"

## 🔄 AI Workflow

1. **Issue Created** → AI analyzes request and codebase
2. **Code Generation** → AI creates/modifies files
3. **Testing** → Runs `npm test` to validate changes
4. **Branch Creation** → Creates feature branch (e.g., `ai/add-version-flag`)
5. **PR Creation** → Opens pull request for review
6. **Human Review** → You review and merge the PR

## 🛠️ Environment Setup

The AI has access to:
- Full repository context
- Package.json dependencies
- Existing code patterns
- Test suite
- Documentation

## 🔧 Troubleshooting

### AI Not Responding?
- Check that you included `@fastclaude` in the issue body
- Or use `ai:` or `claude:` title prefix
- Verify the GitHub Action is enabled in Settings → Actions

### Generated Code Issues?
- Comment on the PR with feedback
- Create a new issue for improvements: `@fastclaude The generated calculator.js needs better input validation`

### Want to Test Locally?
```bash
# Direct prompting
node script.js -p "Add a help command"

# Run tests
npm test
```

## 📚 Examples

### Adding New Features
```markdown
Title: ai: Add configuration file support

@fastclaude Please add support for a `.berrry.json` configuration file that allows users to:
- Set default model preferences
- Configure output directories  
- Set custom API endpoints

The config should be loaded in the AICoder constructor and override environment variables.
```

### Bug Fixes
```markdown
@fastclaude There's a bug in the parseAndWriteFiles function around line 315. When the filename contains spaces, the file creation fails. Please add proper path escaping.
```

### Code Improvements
```markdown
claude: Refactor the E2E test suite for better maintainability

The current test suite in test/e2e.test.js could be improved:
- Extract common test utilities into a separate module
- Add more comprehensive validation functions
- Add test for edge cases like malformed prompts
```

## 🎉 Have Fun!

The AI is here to help make development faster and more enjoyable. Don't hesitate to experiment with different types of requests!