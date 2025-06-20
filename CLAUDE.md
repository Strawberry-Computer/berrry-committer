# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project: Berrry Committer

Berrry Committer is an AI-powered GitHub automation tool that processes issues and generates code automatically.

## Core Architecture

Berrry Committer is an AI-powered GitHub automation tool that operates in two modes:

1. **GitHub Actions Mode**: Automatically processes GitHub issues/comments and generates code
2. **Local Development Mode**: Interactive development with manual confirmations

The main entry point is `src/main.js` via the `berrry` CLI - a Node.js application that:
- Parses GitHub event context from issues/comments
- Uses LLM calls to generate code responses
- Creates files based on LLM output in a specific format
- Runs evaluation scripts to determine if more iterations are needed
- Commits changes and creates pull requests

### Key Components

- **AICoder Class**: Main orchestrator class in src/main.js
- **API Integration**: Uses OpenRouter or Anthropic API for LLM calls
- **File Generation**: Parses `=== FILENAME: path ===` format from LLM responses
- **Evaluation System**: Runs bash scripts to validate progress
- **Git Integration**: Auto-commits and creates branches/PRs

## Environment Configuration

### Required Environment Variables
- `ANTHROPIC_API_KEY` or `OPENROUTER_API_KEY`: API access
- `GITHUB_EVENT_PATH`: Path to GitHub event JSON (auto-set in Actions)

### Optional Configuration
- `MODEL`: LLM model (default: `anthropic/claude-sonnet-4`)
- `COMMIT_MODEL`: Model for commit messages (default: `anthropic/claude-3.5-haiku`)
- `TEST_COMMAND`: Command to run for final validation
- `YOLO`: Set to "true" to skip confirmations in local mode

## Development Commands

### Local Testing
```bash
# Set up mock GitHub event for local testing
export GITHUB_EVENT_PATH="/tmp/github_event.json"
cat > /tmp/github_event.json << 'EOF'
{
  "issue": {
    "number": 123,
    "title": "Your test issue title",
    "body": "Issue description with code requests"
  }
}
EOF

# Run Berrry Committer
berrry
```

### Execution Modes
- **Safe Mode (Local)**: Prompts for confirmation before executing eval scripts
- **YOLO Mode (Actions/Forced)**: Auto-executes all generated scripts

## Code Generation Format

The LLM outputs files using filename markers with complete file content. Multiple files can be generated in a single response. The system automatically creates directories and writes files.

## Evaluation System

Each LLM response should include an EVAL section with a bash script:

```bash
#!/bin/bash
set -euo pipefail
# Validation logic here
# Exit 0 if ready for PR, non-zero if needs more work
```

The script determines whether to continue iterating or create a PR.

## File Context Discovery

The system automatically includes context from:
- Core config files (CLAUDE.md, README.md, package.json, etc.)
- Git tracked files list
- Files mentioned in issue/comment text (via pattern matching)

## Development Notes

- Maximum 5 iteration steps per issue
- Commits are created after each step
- Branch naming: `ai/issue-title-normalized`
- Auto-detects GitHub Actions vs local environment
- Uses git config: `action@github.com` / `Berrry Committer AI` for commits

## Development Guidance
- Let's always run tests in tmp git repo instead of our repo
- Remember to use consistent "Berrry Committer" branding throughout the codebase
- The CLI command is `berrry` and the main entry point is `src/main.js`