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

2. **Create Workflow** (`.github/workflows/berrry-committer.yml`):
```yaml
name: Berrry Committer
on:
  issues:
    types: [opened, edited]
  issue_comment:
    types: [created]

jobs:
  berrry-committer:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      - name: Run Berrry Committer
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: node src/main.js
```

3. **Create an Issue**: Describe your coding request to trigger Berrry Committer

### Local Development

```bash
# 1. Set up environment
export ANTHROPIC_API_KEY="your-api-key"

# 2. Direct prompting mode (new!)
berrry --prompt "Create a login component with email/password validation"

# 3. GitHub event mode
export GITHUB_EVENT_PATH="/tmp/test_event.json"
cat > /tmp/test_event.json << 'EOF'
{
  "issue": {
    "number": 1,
    "title": "Add user authentication",
    "body": "Please create a login component with email/password validation"
  }
}
EOF
berrry

# 4. Or run in YOLO mode (auto-execute)
berrry --yolo
```

## 🛠️ Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | Yes* | - | Anthropic API key |
| `OPENROUTER_API_KEY` | Yes* | - | OpenRouter API key (alternative) |
| `MODEL` | No | `anthropic/claude-sonnet-4` | Main LLM model |
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
3. **Code Generation**: Uses AI models to generate complete solutions with analysis
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
=== END: src/components/Login.tsx ===

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
Body: Please add a dark mode toggle to the settings page
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
berrry --verbose
```

## 📖 Documentation

- [CLAUDE.md](./CLAUDE.md) - Technical architecture guide for Berrry Committer
- [dev.md](./dev.md) - Detailed local development guide

## 🤖 AI-Assisted Development

This project uses itself for development! You can request AI-generated code:

### Quick Start
1. **Create an issue** describing your coding request
2. **Berrry Committer will** analyze, code, test, and create a PR automatically

### Examples
```markdown
Add --version flag support
Please improve error handling in the parser
Add Docker configuration for easy deployment
```

📖 **[Full AI Development Guide](docs/ai-development.md)**

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (or use Berrry Committer)
3. Test locally with `npm test`
4. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

---

*Made with 🍓 by Strawberry Computer*