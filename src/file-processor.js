const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

async function parseAndWriteFiles(response, options = {}) {
  const { 
    dryRun = false,
    createDirectories = true,
    logOutput = true 
  } = options;

  const files = [];
  
  // Use robust parsing algorithm with regex and backreferences
  const fileRegex = /=== FILENAME: (.+?) ===\s*\n([\s\S]*?)\n=== END: \1 ===/g;
  let match;
  const foundRanges = [];

  // First pass: find all valid ranges using backreference validation
  while ((match = fileRegex.exec(response)) !== null) {
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
  
  // Convert to the format expected by the rest of the function
  for (const range of outerRanges) {
    files.push({ path: range.filename, content: range.content });
  }

  if (files.length === 0) {
    if (logOutput) console.log('⚠️ No files found in LLM response');
    return [];
  }

  if (dryRun) {
    if (logOutput) {
      console.log(`🔍 DRY RUN: Would create/update ${files.length} files:`);
      files.forEach(file => console.log(`  - ${file.path}`));
    }
    return files.map(f => f.path);
  }

  // Write files
  const writtenFiles = [];
  
  for (const file of files) {
    try {
      if (createDirectories) {
        const dir = path.dirname(file.path);
        if (dir !== '.') {
          await fs.mkdir(dir, { recursive: true });
        }
      }

      await fs.writeFile(file.path, file.content);
      writtenFiles.push(file.path);
      
      if (logOutput) {
        console.log(`📝 Created: ${file.path} (${file.content.length} chars)`);
      }
    } catch (error) {
      if (logOutput) {
        console.error(`❌ Failed to write ${file.path}: ${error.message}`);
      }
    }
  }

  if (logOutput) {
    console.log(`✅ Successfully created/updated ${writtenFiles.length} files`);
  }

  return writtenFiles;
}

async function runEvalScript(response, options = {}) {
  const { 
    timeout = 30000,
    safeMode = true,
    logOutput = true,
    yolo = process.env.YOLO === 'true'
  } = options;

  // Extract eval script from response
  const evalMatch = response.match(/```(?:bash|sh)?\s*\n# EVAL\s*\n([\s\S]*?)```/);
  
  if (!evalMatch) {
    if (logOutput) console.log('⚠️ No eval script found in response');
    return { success: true, output: 'No eval script' };
  }

  const evalScript = evalMatch[1].trim();
  
  if (!evalScript) {
    if (logOutput) console.log('⚠️ Empty eval script');
    return { success: true, output: 'Empty eval script' };
  }

  if (logOutput) {
    console.log('\n🧪 Generated eval script:');
    console.log('---');
    console.log(evalScript);
    console.log('---');
  }

  // Safety check in interactive mode
  if (safeMode && !yolo) {
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const answer = await new Promise(resolve => {
      readline.question('🤔 Execute this eval script? (y/N): ', resolve);
    });
    
    readline.close();

    if (answer.toLowerCase() !== 'y' && answer.toLowerCase() !== 'yes') {
      if (logOutput) console.log('⏸️ Eval script execution skipped by user');
      return { success: false, output: 'Skipped by user', skipped: true };
    }
  }

  // Write script to temporary file
  const scriptPath = '.berrry_eval.sh';
  const scriptContent = `#!/bin/bash\nset -euo pipefail\n\n${evalScript}`;
  
  try {
    await fs.writeFile(scriptPath, scriptContent);
    execSync(`chmod +x ${scriptPath}`);

    if (logOutput) console.log('🏃 Running eval script...');

    // Execute with timeout
    const output = execSync(`./${scriptPath}`, { 
      encoding: 'utf8',
      timeout,
      stdio: 'pipe'  
    });

    // Clean up
    await fs.unlink(scriptPath);

    if (logOutput) {
      console.log('✅ Eval script completed successfully');
      if (output.trim()) {
        console.log('📋 Script output:');
        console.log(output);
      }
    }

    return { success: true, output: output.trim() };
  } catch (error) {
    // Clean up on error
    try {
      await fs.unlink(scriptPath);
    } catch (cleanupError) {
      // Ignore cleanup errors
    }

    if (logOutput) {
      console.log('❌ Eval script failed:', error.message);
      if (error.stdout) {
        console.log('📋 Stdout:', error.stdout);
      }
      if (error.stderr) {
        console.log('📋 Stderr:', error.stderr);
      }
    }

    return { 
      success: false, 
      output: error.message,
      stdout: error.stdout,
      stderr: error.stderr
    };
  }
}

function extractEvalScript(response) {
  const evalMatch = response.match(/```(?:bash|sh)?\s*\n# EVAL\s*\n([\s\S]*?)```/);
  return evalMatch ? evalMatch[1].trim() : null;
}

function hasEvalScript(response) {
  return /```(?:bash|sh)?\s*\n# EVAL\s*\n/.test(response);
}

module.exports = {
  parseAndWriteFiles,
  runEvalScript,
  extractEvalScript,
  hasEvalScript
};