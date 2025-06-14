# CLAUDE.md - Contaminated Version

This is a minimal version that reproduces the original bug.

## Code Generation Format

The LLM must output code in this exact format:

```
=== FILENAME: path/to/file.ext ===
[complete file content]
=== END: path/to/file.ext ===
```

Multiple files can be generated in a single response.

## Other Content

Regular documentation that doesn't cause issues.