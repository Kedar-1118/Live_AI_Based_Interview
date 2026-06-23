import { OpenAI } from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config';
import { getDb } from '../db';

export interface ChatCompletionParams {
  systemPrompt?: string;
  userPrompt: string;
  jsonMode?: boolean;
}

// Unified chat completion routing function
export async function generateChatCompletion(
  provider: string,
  model: string,
  params: ChatCompletionParams,
  apiKey: string
): Promise<string> {
  const normalizedProvider = provider.toLowerCase();

  switch (normalizedProvider) {
    case 'mock':
      return mockCompletion(params);

    case 'anthropic': {
      const client = new Anthropic({ apiKey });
      const response = await client.messages.create({
        model: model || 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: params.systemPrompt,
        messages: [{ role: 'user', content: params.userPrompt }],
      });
      if (response.content && response.content[0] && response.content[0].type === 'text') {
        return response.content[0].text;
      }
      throw new Error('Anthropic returned an empty or invalid content block');
    }

    case 'openai': {
      const client = new OpenAI({ apiKey });
      const messages: any[] = [];
      if (params.systemPrompt) {
        messages.push({ role: 'system', content: params.systemPrompt });
      }
      messages.push({ role: 'user', content: params.userPrompt });

      const response = await client.chat.completions.create({
        model: model || 'gpt-4o-mini',
        messages,
        response_format: params.jsonMode ? { type: 'json_object' } : undefined,
        max_tokens: 1000,
      });
      return response.choices[0]?.message?.content || '';
    }

    case 'groq': {
      // Groq uses OpenAI-compatible endpoint
      const client = new OpenAI({
        apiKey,
        baseURL: 'https://api.groq.com/openai/v1',
      });
      const messages: any[] = [];
      if (params.systemPrompt) {
        messages.push({ role: 'system', content: params.systemPrompt });
      }
      messages.push({ role: 'user', content: params.userPrompt });

      const response = await client.chat.completions.create({
        model: model || 'llama3-8b-8192',
        messages,
        response_format: params.jsonMode ? { type: 'json_object' } : undefined,
        max_tokens: 1000,
      });
      return response.choices[0]?.message?.content || '';
    }

    case 'gemini': {
      const geminiModel = model || 'gemini-1.5-flash';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`;

      const requestBody: any = {
        contents: [
          {
            role: 'user',
            parts: [{ text: params.userPrompt }],
          },
        ],
      };

      if (params.systemPrompt) {
        requestBody.systemInstruction = {
          parts: [{ text: params.systemPrompt }],
        };
      }

      if (params.jsonMode) {
        requestBody.generationConfig = {
          responseMimeType: 'application/json',
        };
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Gemini API error: ${res.statusText} (${res.status}) - ${errorText}`);
      }

      const data: any = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text !== undefined) {
        return text;
      }
      throw new Error('Gemini API returned an empty or invalid content structure');
    }

    case 'ollama': {
      const ollamaModel = model || 'llama3';
      const host = config.OLLAMA_HOST || 'http://localhost:11434';
      const url = `${host}/api/chat`;

      const messages: any[] = [];
      if (params.systemPrompt) {
        messages.push({ role: 'system', content: params.systemPrompt });
      }
      messages.push({ role: 'user', content: params.userPrompt });

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: ollamaModel,
          messages,
          stream: false,
          format: params.jsonMode ? 'json' : undefined,
        }),
      });

      if (!res.ok) {
        throw new Error(`Ollama local error: ${res.statusText} (${res.status})`);
      }

      const data: any = await res.json();
      return data.message?.content || '';
    }

    default:
      throw new Error(`Unsupported AI LLM provider: ${provider}`);
  }
}

// Check for personal keys, fall back to system keys, check and increment system limits
export async function checkAndGetApiKey(
  userId: string,
  provider: string,
  user: any
): Promise<string> {
  const db = getDb();
  const normalizedProvider = provider.toLowerCase();

  if (normalizedProvider === 'mock') {
    return 'mock';
  }
  if (normalizedProvider === 'ollama') {
    return 'ollama'; // Local Ollama does not need keys
  }

  let userKey: string | null = null;
  let systemKey: string | null = null;

  if (normalizedProvider === 'openai') {
    userKey = user.openai_api_key;
    systemKey = config.OPENAI_API_KEY;
  } else if (normalizedProvider === 'anthropic') {
    userKey = user.anthropic_api_key;
    systemKey = config.ANTHROPIC_API_KEY;
  } else if (normalizedProvider === 'gemini') {
    userKey = user.gemini_api_key;
    systemKey = config.GEMINI_API_KEY;
  } else if (normalizedProvider === 'groq') {
    userKey = user.groq_api_key;
    systemKey = config.GROQ_API_KEY;
  } else {
    throw new Error(`Unsupported provider: ${provider}`);
  }

  // If candidate has a custom key configured, return it immediately (unlimited system use)
  if (userKey && userKey.trim() !== '') {
    return userKey.trim();
  }

  // Else, check if system has config defaults
  if (!systemKey || systemKey.trim() === '' || systemKey.includes('your-')) {
    throw new Error(
      `No personal API key configured by candidate for ${provider}, ` +
      `and no system default configured. Please set your personal key in Settings.`
    );
  }

  // Check system usage limit
  if (user.system_key_usage_count >= config.SYSTEM_KEY_USAGE_LIMIT) {
    const err: any = new Error(
      `System-provided API usage limit reached (${config.SYSTEM_KEY_USAGE_LIMIT} calls). ` +
      `Please configure your own personal API key in settings to continue.`
    );
    err.status = 402; // Payment Required / Limit Exceeded
    throw err;
  }

  // Increment usage count in DB
  await db.run(
    'UPDATE users SET system_key_usage_count = system_key_usage_count + 1 WHERE id = ?',
    [userId]
  );

  // Update object reference so consecutive calls in this request context know the updated limit
  user.system_key_usage_count++;

  return systemKey.trim();
}

function mockCompletion(params: ChatCompletionParams): string {
  const promptLower = params.userPrompt.toLowerCase();

  // If request matches evaluator query
  if (promptLower.includes('rubric') || promptLower.includes('evaluate')) {
    // Generate a mock evaluation JSON response
    const wordCount = promptLower.length / 5;
    const accuracy = wordCount > 80 ? 8 : wordCount > 40 ? 6 : 4;
    return JSON.stringify({
      technical_accuracy: accuracy,
      definition_present: wordCount > 30,
      mechanism_explained: wordCount > 50,
      example_given: promptLower.includes('example') || promptLower.includes('instance'),
      edge_cases_mentioned: promptLower.includes('edge') || promptLower.includes('corner'),
      missing_concepts: ['Could expand on edge cases'],
      incorrect_statements: [],
      follow_up_angle: 'Probe deeper into design details',
      answer_summary: 'Candidate provided a mock response.',
    });
  }

  // Default mock interviewer questions
  return 'Can you explain the main difference between supervised and unsupervised learning?';
}
