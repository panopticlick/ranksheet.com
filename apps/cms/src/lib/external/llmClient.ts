/**
 * LLM API Client (VectorEngine)
 * 提供 OpenAI 兼容的聊天接口
 * 支持 grok-4.1-thinking 和 claude-sonnet-4-5 模型
 */

import { logger } from '../logger'

// ============================================================================
// Types
// ============================================================================

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatCompletionResponse {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    index: number
    message: {
      role: string
      content: string
    }
    finish_reason: string
  }>
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

export interface ChatOptions {
  model?: string
  temperature?: number
  maxTokens?: number
  topP?: number
  frequencyPenalty?: number
  presencePenalty?: number
}

// ============================================================================
// Configuration
// ============================================================================

const API_BASE_URL = process.env.LLM_API_BASE_URL || 'https://vectorengine.apifox.cn'
const API_KEY = process.env.LLM_API_KEY

// 模型配置
const MODEL_ANALYSIS = process.env.LLM_MODEL_ANALYSIS || 'grok-4.1-thinking'
const MODEL_CREATIVE = process.env.LLM_MODEL_CREATIVE || 'claude-sonnet-4-5-20250929'

// 默认参数
const DEFAULT_TEMPERATURE = 0.7
const DEFAULT_MAX_TOKENS = 4096

// ============================================================================
// Core Chat Function
// ============================================================================

/**
 * 通用聊天接口 (OpenAI 兼容)
 */
export async function chat(
  messages: ChatMessage[],
  options: ChatOptions = {}
): Promise<string> {
  if (!API_KEY) {
    throw new Error('LLM_API_KEY not configured')
  }

  const {
    model = MODEL_CREATIVE,
    temperature = DEFAULT_TEMPERATURE,
    maxTokens = DEFAULT_MAX_TOKENS,
    topP = 1,
    frequencyPenalty = 0,
    presencePenalty = 0,
  } = options

  logger.info('LLM API request', {
    model,
    messageCount: messages.length,
    temperature,
    maxTokens,
  })

  try {
    const response = await fetch(`${API_BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        top_p: topP,
        frequency_penalty: frequencyPenalty,
        presence_penalty: presencePenalty,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      logger.error('LLM API error', {
        status: response.status,
        error: errorText,
      })
      throw new Error(`LLM API error: ${response.status} - ${errorText}`)
    }

    const data = (await response.json()) as ChatCompletionResponse

    const content = data.choices[0]?.message?.content

    if (!content) {
      throw new Error('LLM API returned empty content')
    }

    logger.info('LLM API success', {
      model,
      usage: data.usage,
      contentLength: content.length,
    })

    return content
  } catch (error) {
    logger.error('LLM API request failed', {
      model,
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

// ============================================================================
// Specialized Functions
// ============================================================================

/**
 * 使用分析模型 (grok-4.1-thinking)
 * 适合数据分析、推理任务
 */
export async function generateAnalysis(
  prompt: string,
  options: Omit<ChatOptions, 'model'> = {}
): Promise<string> {
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content:
        'You are a data analysis expert. Provide detailed, structured analysis based on the given information.',
    },
    {
      role: 'user',
      content: prompt,
    },
  ]

  return chat(messages, {
    ...options,
    model: MODEL_ANALYSIS,
    temperature: options.temperature ?? 0.3, // 更低的温度以获得更一致的分析
  })
}

/**
 * 使用创意模型 (claude-sonnet-4-5)
 * 适合内容创作、文案撰写
 */
export async function generateCreativeContent(
  prompt: string,
  options: Omit<ChatOptions, 'model'> = {}
): Promise<string> {
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content:
        'You are a creative content writer. Generate engaging, informative, and SEO-optimized content.',
    },
    {
      role: 'user',
      content: prompt,
    },
  ]

  return chat(messages, {
    ...options,
    model: MODEL_CREATIVE,
    temperature: options.temperature ?? 0.7, // 适中的温度以保持创意和一致性
  })
}

/**
 * 生成结构化 JSON 输出
 * 使用分析模型以获得更可靠的结构
 */
export async function generateStructuredOutput<T = unknown>(
  prompt: string,
  schema: {
    description: string
    example: T
  },
  options: Omit<ChatOptions, 'model'> = {}
): Promise<T> {
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `You are a helpful assistant that generates structured JSON output.
Always respond with valid JSON only, no markdown code blocks or additional text.

Schema description: ${schema.description}

Example format:
${JSON.stringify(schema.example, null, 2)}`,
    },
    {
      role: 'user',
      content: prompt,
    },
  ]

  const response = await chat(messages, {
    ...options,
    model: MODEL_ANALYSIS,
    temperature: 0.1, // 很低的温度以获得一致的 JSON
  })

  try {
    // 尝试提取 JSON（处理可能的 markdown 代码块）
    let jsonText = response.trim()

    // 移除可能的 markdown 代码块标记
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    }

    return JSON.parse(jsonText) as T
  } catch (error) {
    logger.error('Failed to parse LLM JSON response', {
      error: error instanceof Error ? error.message : String(error),
      response: response.substring(0, 500),
    })
    throw new Error('LLM API returned invalid JSON')
  }
}

/**
 * 多轮对话
 * 维护对话历史
 */
export class Conversation {
  private messages: ChatMessage[] = []
  private model: string

  constructor(
    systemPrompt?: string,
    options: { model?: 'analysis' | 'creative' } = {}
  ) {
    this.model =
      options.model === 'analysis' ? MODEL_ANALYSIS : MODEL_CREATIVE

    if (systemPrompt) {
      this.messages.push({
        role: 'system',
        content: systemPrompt,
      })
    }
  }

  async send(
    userMessage: string,
    options: Omit<ChatOptions, 'model'> = {}
  ): Promise<string> {
    this.messages.push({
      role: 'user',
      content: userMessage,
    })

    const response = await chat(this.messages, {
      ...options,
      model: this.model,
    })

    this.messages.push({
      role: 'assistant',
      content: response,
    })

    return response
  }

  getHistory(): ChatMessage[] {
    return [...this.messages]
  }

  clear(): void {
    const systemMessage = this.messages.find((m) => m.role === 'system')
    this.messages = systemMessage ? [systemMessage] : []
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * 验证 API 配置
 */
export function isLlmConfigured(): boolean {
  return !!API_KEY && !!API_BASE_URL
}

/**
 * 获取可用模型列表
 */
export function getAvailableModels(): {
  analysis: string
  creative: string
} {
  return {
    analysis: MODEL_ANALYSIS,
    creative: MODEL_CREATIVE,
  }
}

/**
 * 估算 token 使用量（粗略估计）
 */
export function estimateTokens(text: string): number {
  // 简单估算：英文约 4 字符 = 1 token，中文约 1.5 字符 = 1 token
  const englishChars = text.match(/[a-zA-Z0-9\s]/g)?.length || 0
  const otherChars = text.length - englishChars

  return Math.ceil(englishChars / 4 + otherChars / 1.5)
}

/**
 * 批量处理提示（避免超过 token 限制）
 */
export async function batchProcess(
  prompts: string[],
  processor: (prompt: string) => Promise<string>,
  options: {
    maxConcurrent?: number
    delayMs?: number
  } = {}
): Promise<Array<{ success: boolean; result?: string; error?: string }>> {
  const { maxConcurrent = 3, delayMs = 1000 } = options
  const results: Array<{ success: boolean; result?: string; error?: string }> =
    []

  for (let i = 0; i < prompts.length; i += maxConcurrent) {
    const batch = prompts.slice(i, i + maxConcurrent)

    const batchResults = await Promise.allSettled(batch.map(processor))

    batchResults.forEach((result) => {
      if (result.status === 'fulfilled') {
        results.push({ success: true, result: result.value })
      } else {
        results.push({
          success: false,
          error: result.reason instanceof Error ? result.reason.message : String(result.reason),
        })
      }
    })

    // 批次间延迟
    if (i + maxConcurrent < prompts.length) {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }

  return results
}
