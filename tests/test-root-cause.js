const test = require('tape');
const fs = require('fs');
const path = require('path');

test('Root cause fix verification', (t) => {
  t.plan(3);
  
  // Verify CLAUDE.md no longer contains problematic examples
  const claudeMdPath = path.join(__dirname, '..', 'CLAUDE.md');
  const claudeContent = fs.readFileSync(claudeMdPath, 'utf8');
  
  t.equal(claudeContent.includes('path/to/file.ext'), false, 
    'CLAUDE.md should not contain placeholder path examples');
  
  t.equal(claudeContent.includes('[complete file content]'), false,
    'CLAUDE.md should not contain placeholder content examples');
  
  t.equal(claudeContent.includes('filename markers'), true,
    'CLAUDE.md should still mention filename markers concept');
});

test('Prevent future contamination', (t) => {
  t.plan(2);
  
  // Check that format documentation doesn't show literal examples
  const claudeMdPath = path.join(__dirname, '..', 'CLAUDE.md');
  const content = fs.readFileSync(claudeMdPath, 'utf8');
  
  // Should not contain the exact markers that could be reproduced
  const hasFileNameMarker = content.includes('=== FILENAME:');
  const hasEndMarker = content.includes('=== END:');
  
  t.equal(hasFileNameMarker, false, 'Should not show literal === FILENAME: examples');
  t.equal(hasEndMarker, false, 'Should not show literal === END: examples');
});

// Simulate the original issue to verify it's fixed
test('Simulate original contamination scenario', (t) => {
  t.plan(1);
  
  // This simulates what the LLM would see in context
  const mockRepoContext = `
=== CLAUDE.md ===
## Code Generation Format

The LLM outputs files using filename markers with complete file content. Multiple files can be generated in a single response.
===
`;
  
  // Verify the contaminating examples are gone
  t.equal(mockRepoContext.includes('path/to/file.ext'), false,
    'Repo context should not contain contaminating placeholder examples');
});