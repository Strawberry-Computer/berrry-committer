/**
 * Robust file parser for === FILENAME: === format
 * Handles nested blocks, malformed blocks, and intersections correctly
 */

function parseAndWriteFiles(codeOutput) {
  const files = [];
  const fileRegex = /=== FILENAME: (.+?) ===\s*\n([\s\S]*?)\n=== END: \1 ===/g;
  let match;
  const foundRanges = [];

  // First pass: find all valid ranges using backreference validation
  while ((match = fileRegex.exec(codeOutput)) !== null) {
    const filename = match[1].trim();
    const content = match[2].trim();
    
    foundRanges.push({
      filename,
      content,
      start: match.index,
      end: match.index + match[0].length
    });
  }
  
  // Second pass: remove ranges that are contained within other ranges
  const outerRanges = foundRanges.filter(range => {
    return !foundRanges.some(other => 
      other !== range && 
      other.start < range.start && 
      other.end > range.end
    );
  });
  
  // Third pass: apply content validation and create files
  for (const range of outerRanges) {
    const { filename, content } = range;
    
    // Content validation - reject placeholder patterns
    if (isPlaceholderFile(filename, content)) {
      console.log(`Skipping placeholder file: ${filename}`);
      continue;
    }
    
    // Security validation - reject dangerous paths
    if (isDangerousPath(filename)) {
      console.log(`Skipping dangerous path: ${filename}`);
      continue;
    }
    
    // Create the file
    const success = createFile(filename, content);
    if (success) {
      files.push(filename);
    }
  }
  
  return { files, parsedFiles: outerRanges.reduce((acc, range) => {
    acc[range.filename] = range.content;
    return acc;
  }, {}) };
}

function isPlaceholderFile(filename, content) {
  // Check for generic placeholder paths
  const genericPathPatterns = [
    /path\/to\//,
    /example\//,
    /sample\//,
    /template\//,
    /\.ext$/,
    /file\.(txt|ext|tmp)$/
  ];
  
  if (genericPathPatterns.some(pattern => pattern.test(filename))) {
    return true;
  }
  
  // Check for placeholder content patterns
  const placeholderContentPatterns = [
    /^\[.*\]$/,           // [complete file content]
    /^<.*>$/,             // <placeholder content>
    /^TODO:/i,            // TODO: implement this
    /^FIXME:/i,           // FIXME: add real content
    /placeholder/i,       // contains "placeholder"
    /example.*content/i   // example content
  ];
  
  if (placeholderContentPatterns.some(pattern => pattern.test(content.trim()))) {
    return true;
  }
  
  // Check for suspiciously short content (likely placeholder)
  if (content.trim().length < 10) {
    return true;
  }
  
  return false;
}

function isDangerousPath(filename) {
  // Check for path traversal attempts
  if (filename.includes('..')) {
    return true;
  }
  
  // Check for null bytes
  if (filename.includes('\0')) {
    return true;
  }
  
  // Check for system directories
  const dangerousPaths = [
    /^\/etc\//,
    /^\/proc\//,
    /^\/sys\//,
    /^\/dev\//,
    /^\/root\//,
    /^\/boot\//
  ];
  
  if (dangerousPaths.some(pattern => pattern.test(filename))) {
    return true;
  }
  
  // Check for very long paths (potential DoS)
  if (filename.length > 255) {
    return true;
  }
  
  return false;
}

function createFile(filename, content) {
  try {
    const fs = require('fs');
    const path = require('path');
    
    // Create directory if it doesn't exist
    const dir = path.dirname(filename);
    if (dir !== '.') {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Write file
    fs.writeFileSync(filename, content, 'utf8');
    console.log(`Created/updated: ${filename}`);
    return true;
    
  } catch (error) {
    console.error(`Failed to create ${filename}:`, error.message);
    return false;
  }
}

module.exports = {
  parseAndWriteFiles,
  isPlaceholderFile,
  isDangerousPath
};