/**
 * Robust file parser for === FILENAME: === format
 * Handles intersecting blocks by keeping only outermost ranges
 */

function parseAndWriteFiles(codeOutput) {
  const files = [];
  const parsedFiles = {};
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
  
  // Return the parsed file data (actual file creation happens in script.js)
  for (const range of outerRanges) {
    files.push(range.filename);
    parsedFiles[range.filename] = range.content;
  }
  
  return { files, parsedFiles };
}

module.exports = {
  parseAndWriteFiles
};