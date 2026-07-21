import { ChatMessage, OpenRouterResponse } from '@/types'

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY
const OPENROUTER_BASE_URL = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1'

interface OpenRouterConfig {
  model?: string
  maxTokens?: number
  temperature?: number
  top_p?: number
  frequency_penalty?: number
}

const defaultConfig: OpenRouterConfig = {
  model: 'openai/gpt-4-turbo',
  maxTokens: 1024,
  temperature: 0.7,
}

export async function sendMessage(
  messages: ChatMessage[],
  model?: string,
  config?: Partial<OpenRouterConfig>
): Promise<OpenRouterResponse> {
  const finalConfig = { ...defaultConfig, ...config }

  if (!OPENROUTER_API_KEY) {
    throw new Error('OpenRouter API key is not configured')
  }

  const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'X-Title': 'AI Chatbot Platform',
    },
    body: JSON.stringify({
      model: model || finalConfig.model,
      messages,
      max_tokens: finalConfig.maxTokens,
      temperature: finalConfig.temperature,
      ...(finalConfig.top_p !== undefined && { top_p: finalConfig.top_p }),
      ...(finalConfig.frequency_penalty !== undefined && { frequency_penalty: finalConfig.frequency_penalty }),
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error?.message || 'Failed to get response from OpenRouter')
  }

  return response.json()
}

export async function streamMessage(
  messages: ChatMessage[],
  model?: string,
  onChunk?: (chunk: string) => void,
  config?: Partial<OpenRouterConfig>
): Promise<string> {
  const finalConfig = { ...defaultConfig, ...config }

  if (!OPENROUTER_API_KEY) {
    throw new Error('OpenRouter API key is not configured')
  }

  const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      'X-Title': 'AI Chatbot Platform',
    },
    body: JSON.stringify({
      model: model || finalConfig.model,
      messages,
      max_tokens: finalConfig.maxTokens,
      temperature: finalConfig.temperature,
      stream: true,
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error?.message || 'Failed to get response from OpenRouter')
  }

  const reader = response.body?.getReader()
  const decoder = new TextDecoder()
  let fullContent = ''

  if (!reader) {
    throw new Error('No response body')
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const chunk = decoder.decode(value)
    const lines = chunk.split('\n')

    for (const line of lines) {
      if (line.startsWith('data: ') && line !== 'data: [DONE]') {
        try {
          const json = JSON.parse(line.slice(6))
          const content = json.choices?.[0]?.delta?.content
          if (content) {
            fullContent += content
            onChunk?.(content)
          }
        } catch {
          // Ignore parsing errors for incomplete chunks
        }
      }
    }
  }

  return fullContent
}

// Available models on OpenRouter
export const availableModels = [
  { id: 'openai/gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'OpenAI' },
  { id: 'openai/gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'OpenAI' },
  { id: 'anthropic/claude-3-opus', name: 'Claude 3 Opus', provider: 'Anthropic' },
  { id: 'anthropic/claude-3-sonnet', name: 'Claude 3 Sonnet', provider: 'Anthropic' },
  { id: 'anthropic/claude-3-haiku', name: 'Claude 3 Haiku', provider: 'Anthropic' },
  { id: 'google/gemini-pro', name: 'Gemini Pro', provider: 'Google' },
  { id: 'meta-llama/llama-3-70b-instruct', name: 'Llama 3 70B', provider: 'Meta' },
]
