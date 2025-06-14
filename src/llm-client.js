class LLMClient {
  constructor(options = {}) {
    this.options = {
      verbose: false,
      ...options
    };
    
    this.apiKey = process.env.ANTHROPIC_API_KEY || process.env.OPENROUTER_API_KEY;
    this.model = process.env.MODEL || 'anthropic/claude-sonnet-4';
    this.commitModel = process.env.COMMIT_MODEL || 'anthropic/claude-3.5-haiku';
    this.apiUrl = process.env.API_URL || 'https://openrouter.ai/api/v1/chat/completions';
    
    if (!this.apiKey) {
      throw new Error('API key required. Set ANTHROPIC_API_KEY or OPENROUTER_API_KEY environment variable.');
    }

    // Use Anthropic API if we have that key
    if (process.env.ANTHROPIC_API_KEY) {
      this.apiUrl = 'https://api.anthropic.com/v1/messages';
      this.isAnthropic = true;
    }

    if (this.options.verbose) {
      console.log('🔧 LLM Client configured:');
      console.log(`  - Model: ${this.model}`);
      console.log(`  - Commit Model: ${this.commitModel}`);
      console.log(`  - API URL: ${this.apiUrl}`);
      console.log(`  - Provider: ${this.isAnthropic ? 'Anthropic' : 'OpenRouter'}`);
    }
  }

  async generateResponse(prompt, options = {}) {
    const model = options.useCommitModel ? this.commitModel : this.model;
    
    if (this.options.verbose) {
      console.log(`\n🤖 Making LLM request to ${model}...`);
      console.log(`📊 Prompt length: ${prompt.length} characters`);
    }

    try {
      if (this.isAnthropic) {
        return await this.callAnthropicAPI(prompt, model);
      } else {
        return await this.callOpenRouterAPI(prompt, model);
      }
    } catch (error) {
      console.error('❌ LLM API call failed:', error.message);
      if (this.options.verbose) {
        console.error('Full error:', error);
      }
      throw error;
    }
  }

  async callAnthropicAPI(prompt, model) {
    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: model.replace('anthropic/', ''),
        max_tokens: 4000,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      if (this.options.verbose) {
        console.error('API Error Response:', errorText);
      }
      throw new Error(`Anthropic API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (this.options.verbose) {
      console.log('✅ LLM response received');
      console.log(`📊 Response length: ${data.content[0].text.length} characters`);
      if (data.usage) {
        console.log(`🔢 Token usage: ${data.usage.input_tokens} input, ${data.usage.output_tokens} output`);
      }
    }
    
    return data.content[0].text;
  }

  async callOpenRouterAPI(prompt, model) {
    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/Strawberry-Computer/berrry-committer',
        'X-Title': 'Berrry Committer'
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 4000,
        temperature: 0.1
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      if (this.options.verbose) {
        console.error('API Error Response:', errorText);
      }
      throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (this.options.verbose) {
      console.log('✅ LLM response received');
      console.log(`📊 Response length: ${data.choices[0].message.content.length} characters`);
      if (data.usage) {
        console.log(`🔢 Token usage: ${data.usage.prompt_tokens} input, ${data.usage.completion_tokens} output`);
      }
    }
    
    return data.choices[0].message.content;
  }
}

module.exports = { LLMClient };