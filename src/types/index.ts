export interface User {
  id: string
  firebaseUid: string
  email: string
  name: string | null
  createdAt: Date
  updatedAt: Date
}

export interface Conversation {
  id: string
  userId: string
  title: string | null
  createdAt: Date
  updatedAt: Date
  messages?: Message[]
}

export interface Message {
  id: string
  conversationId: string
  role: 'user' | 'assistant'
  content: string
  createdAt: Date
}

export interface Lead {
  id: string
  userId: string
  name: string
  email: string
  phone: string | null
  source: string | null
  status: 'new' | 'contacted' | 'qualified' | 'converted' | 'lost'
  notes: string | null
  createdAt: Date
  updatedAt: Date
}

export interface KnowledgeBase {
  id: string
  userId: string
  title: string
  content: string
  category: string | null
  createdAt: Date
  updatedAt: Date
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface OpenRouterResponse {
  id: string
  choices: {
    message: {
      role: string
      content: string
    }
    finish_reason: string
  }[]
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}
