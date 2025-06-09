# 🛠️ Local Development Usage Guide

## Running Locally (Safe Mode)

The AI coder script automatically detects when it's running locally vs GitHub Actions and adjusts behavior accordingly.

### Environment Detection

```javascript
// Auto-detects environment
this.isGitHubActions = !!process.env.GITHUB_ACTIONS;
this.yoloMode = process.env.YOLO === 'true' || this.isGitHubActions;
```

- **GitHub Actions**: Always auto-executes (YOLO mode)
- **Local Development**: Prompts for confirmation (Safe mode)

## Local Setup

### 1. Prerequisites
```bash
# Node.js 18+
node --version

# Git repository
git status
```

### 2. Set Environment Variables
```bash
# Required: API Key
export OPENROUTER_API_KEY="sk-or-v1-your-key-here"
# OR
export ANTHROPIC_API_KEY="sk-ant-api03-your-key-here"

# Optional: Custom test command
export TEST_COMMAND="npm test && npm run lint"

# Optional: Force auto-execution (not recommended locally)
export YOLO="true"
```

### 3. Create Mock GitHub Event
```bash
# Create test event file
cat > /tmp/github_event.json << 'EOF'
{
  "issue": {
    "number": 123,
    "title": "Add user login functionality",
    "body": "@fastclaude Please create a login component with email/password validation"
  }
}
EOF

export GITHUB_EVENT_PATH="/tmp/github_event.json"
```

### 4. Run the Script
```bash
node .github/scripts/ai-coder.js
```

## Local Execution Flow

### Safe Mode (Default)
```
🏃 Running in: Local Development
⚡ YOLO Mode: OFF (manual confirm)

🔄 Step 1/5
🧠 LLM Call: anthropic/claude-3.5-sonnet
📄 LLM Output:
==================================================
## ANALYSIS
Creating a login component with validation...

## CODE
=== FILENAME: src/components/Login.tsx ===
import React from 'react';
...
=== END ===

## EVAL
```bash
#!/bin/bash
set -euo pipefail
echo "Checking TypeScript compilation..."
npx tsc --noEmit || exit 1
exit 0
```
==================================================

📝 Committing: Add login component with validation

🤔 Generated eval.sh script:
========================================
#!/bin/bash
set -euo pipefail
echo "Checking TypeScript compilation..."
npx tsc --noEmit || exit 1
exit 0
========================================
Execute this eval script? (y/N): y

🚀 Executing eval.sh...
Checking TypeScript compilation...
✅ Eval exit code 0 - Ready for PR, stopping iteration
```

### YOLO Mode (Force Auto-Execute)
```bash
export YOLO="true"
node .github/scripts/ai-coder.js
```

```
🏃 Running in: Local Development  
⚡ YOLO Mode: ON (auto-execute)

# No prompts - auto-executes everything
```

## Safety Features

### Script Preview
Before execution, you'll see:
```bash
🤔 Generated eval.sh script:
========================================
#!/bin/bash
set -euo pipefail

# Check what files were created
ls -la src/components/Login.tsx || exit 1

# Verify TypeScript compilation
npx tsc --noEmit || exit 1

# Check for security issues
grep -r "eval\|innerHTML" src/ && exit 1

exit 0
========================================
Execute this eval script? (y/N): 
```

### User Control
- **y/Y/yes**: Execute the script
- **n/N/no/Enter**: Skip and assume success
- **Ctrl+C**: Abort entirely

### Git Safety
- Creates commits after each step
- Never pushes automatically in local mode
- Easy to `git reset` if needed

## Common Local Workflows

### 1. Quick Prototyping
```bash
# Fast iteration with minimal testing
export TEST_COMMAND=""
export YOLO="true"
node .github/scripts/ai-coder.js
```

### 2. Careful Development
```bash
# Review each step manually
unset YOLO
export TEST_COMMAND="npm test && npm run lint"
node .github/scripts/ai-coder.js
```

### 3. Testing AI Prompts
```bash
# Modify the GitHub event JSON to test different prompts
cat > /tmp/github_event.json << 'EOF'
{
  "issue": {
    "number": 456,
    "title": "Refactor authentication system",
    "body": "@fastclaude The current auth is messy. Please refactor to use modern patterns. See `src/auth/legacy.js`"
  }
}
EOF
```

## Troubleshooting

### No GitHub Event File
```
Error: GITHUB_EVENT_PATH not found - not running in GitHub Actions?
```
**Solution**: Create mock event file (see setup above)

### API Key Missing
```
Error: API key required: set ANTHROPIC_API_KEY or OPENROUTER_API_KEY
```
**Solution**: Set environment variable with your API key

### Permission Denied
```
Error: EACCES: permission denied, open 'eval.sh'
```
**Solution**: Ensure you're in a writable directory

### Git Not Configured
```
Error: Please tell me who you are
```
**Solution**: 
```bash
git config user.email "you@example.com"
git config user.name "Your Name"
```

## Local vs GitHub Actions Differences

| Feature | Local Development | GitHub Actions |
|---------|------------------|----------------|
| **Eval Confirmation** | Manual prompt | Auto-execute |
| **Push/PR Creation** | Manual | Automatic |
| **Environment** | Your machine | Ephemeral container |
| **Git Config** | Uses your config | Sets action@github.com |
| **Error Handling** | Interactive | Logs only |
| **Safety** | High (confirmations) | Medium (automated) |

The script adapts automatically - same code, different behavior based on context! 🎯
