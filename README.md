# 🍓 Berrry Committer

AI-powered GitHub automation tool that processes issues and generates code automatically using Claude.

## ✨ Features

- **Automatic Code Generation**: Responds to GitHub issues with complete code solutions
- **Smart File Management**: Creates, updates, and organizes files based on issue context
- **Iterative Development**: Uses evaluation scripts to refine solutions across multiple steps
- **Safe Local Testing**: Interactive mode for local development with manual confirmations
- **GitHub Actions Integration**: Fully automated workflow for production use

## 🚀 Quick Start

### GitHub Actions Setup

1. **Add Repository Secrets**:
   - `ANTHROPIC_API_KEY` or `OPENROUTER_API_KEY`

2. **Create Workflow** (`.github/workflows/ai-coder.yml`):
```yaml
name: AI Coder
on:
  issues:
    types: [opened, edited]
  issue_comment:
    types: [created]

jobs:
  ai-code:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      - name: Run AI Coder
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: node script.js
```

3. **Create an Issue**: Mention `@fastclaude` or describe your coding request

### Local Development

```bash
# 1. Set up environment
export ANTHROPIC_API_KEY="your-api-key"
export GITHUB_EVENT_PATH="/tmp/test_event.json"

# 2. Create test issue
cat > /tmp/test_event.json << 'EOF'
{
  "issue": {
    "number": 1,
    "title": "Add user authentication",
    "body": "Please create a login component with email/password validation"
  }
}
EOF

# 3. Run locally (safe mode with confirmations)
node script.js

# 4. Or run in YOLO mode (auto-execute)
YOLO=true node script.js
```

## 🛠️ Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | Yes* | - | Anthropic API key |
| `OPENROUTER_API_KEY` | Yes* | - | OpenRouter API key (alternative) |
| `MODEL` | No | `anthropic/claude-3.5-sonnet` | Main LLM model |
| `COMMIT_MODEL` | No | `anthropic/claude-3.5-haiku` | Model for commit messages |
| `TEST_COMMAND` | No | - | Command to run for validation |
| `YOLO` | No | `false` | Skip confirmations (auto `true` in Actions) |

*One of the API keys is required

### Advanced Configuration

```bash
# Custom model configuration
export MODEL="anthropic/claude-3-opus"
export COMMIT_MODEL="anthropic/claude-3-haiku"

# Test integration
export TEST_COMMAND="npm test && npm run lint"

# API endpoint override (for proxies)
export API_URL="https://your-proxy.com/v1/chat/completions"
```

## 📋 How It Works

1. **Issue Processing**: Parses GitHub issue/comment for coding requests
2. **Context Gathering**: Automatically includes relevant files and repository structure
3. **Code Generation**: Uses Claude to generate complete solutions with analysis
4. **File Creation**: Writes files using the `=== FILENAME: path ===` format
5. **Evaluation**: Runs bash scripts to validate and determine if more work is needed
6. **Iteration**: Continues refining until solution is complete (max 5 steps)
7. **PR Creation**: Automatically creates pull request with all changes

### Code Generation Format

The AI outputs files in this format:

```
## CODE
=== FILENAME: src/components/Login.tsx ===
import React from 'react';

export const Login = () => {
  // Component implementation
};
=== END ===

## EVAL
```bash
#!/bin/bash
set -euo pipefail
# Validation script
npx tsc --noEmit || exit 1
exit 0
```

## 🎯 Usage Examples

### Simple Feature Request
```
Title: Add dark mode toggle
Body: @fastclaude Please add a dark mode toggle to the settings page
```

### Complex Implementation
```
Title: Implement user authentication system
Body: Need a complete auth system with:
- Login/signup forms
- JWT token handling  
- Protected routes
- User profile management

See existing code in `src/auth/` for context.
```

### Bug Fix
```
Title: Fix memory leak in data processing
Body: The data processor in `src/utils/processor.js` is causing memory leaks. 
Please refactor to use streaming and proper cleanup.
```

## 🔒 Security & Safety

- **Local Mode**: Manual confirmation for all script execution
- **No Automatic Pushes**: Creates commits locally, manual push in local mode
- **Script Preview**: Shows generated evaluation scripts before execution
- **Git Safety**: Easy to reset changes with standard git commands
- **API Key Protection**: Uses environment variables, never logged

## 🛟 Troubleshooting

### Common Issues

**"GITHUB_EVENT_PATH not found"**
```bash
# Create mock event for local testing
export GITHUB_EVENT_PATH="/tmp/test_event.json"
```

**"API key required"**
```bash
export ANTHROPIC_API_KEY="your-key-here"
```

**Permission denied on eval.sh**
```bash
# Ensure you're in a writable directory
chmod +x eval.sh
```

### Debug Mode

Add verbose logging:
```bash
DEBUG=true node script.js
```

## 📖 Documentation

- [CLAUDE.md](./CLAUDE.md) - Technical architecture guide for Claude Code
- [dev.md](./dev.md) - Detailed local development guide

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch
3. Test locally with mock GitHub events
4. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

---

*Made with 🍓 by Strawberry Computer*