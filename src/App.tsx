import { useState, useEffect, useRef } from 'react'
import './App.css'

// ── Constants ─────────────────────────────────────────────────────────────────

const USER_NAME = 'Maximo'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Message {
  id: string
  role: 'user' | 'bot'
  content: string
  meta?: {
    intent: string
    skill: string
    confidence: number
    method: string
    executionTime: number
  }
  timestamp: Date
}

interface Skill {
  name: string
  description: string
  intents: string[]
  riskLevel: string
}

interface HelpData {
  skills: Skill[]
  intents: Record<string, string>
}

interface UnifiedCommandResponse {
  success: boolean
  message: string
  data?: unknown
  error?: string
  requiresConfirmation?: boolean
  confirmationToken?: string
  meta?: {
    intent: string
    skill: string
    confidence: number
    executionTime: number
    method: string
  }
}

// ── Helper Functions ──────────────────────────────────────────────────────────

function formatHelpContent(data: HelpData): string {
  const skillIcons: Record<string, string> = {
    'file': '📁',
    'app': '⚙️',
    'excel': '📊',
    'system': '🔒',
    'textedit': '✏️',
    'game': '🎮',
  }

  const intentExamples: Record<string, string[]> = {
    app: [
      'abrí chrome',
      'abrí vscode',
      'abrí discord',
      'cerrá chrome',
      'minimizá notepad',
    ],
    file: [
      'buscá ventas.xlsx',
      'leé archivo config.txt',
      'abrí archivo C:/Users/archivo.pdf',
      'listá archivo.zip',
      'extraé archivo.zip',
    ],
    excel: [
      'resumen por mes de ventas.xlsx',
      'detectá duplicados en clientes.xlsx',
      'convertí movimientos.csv a excel',
      'creá hoja resumen en datos.xlsx',
      'leé ventas.xlsx',
    ],
    system: [
      'bloqueá la PC',
      'apagá la PC  ⚠️ pide confirmación',
      'reiniciá la PC  ⚠️ pide confirmación',
    ],
    textedit: [
      'agregá al final de notas.txt: reunión el lunes',
      'reemplazá "viejo texto" por "nuevo texto" en archivo.txt',
      'eliminá la línea "texto a borrar" de notas.txt',
    ],
    game: [
      'jugá minecraft',
      'jugá cs2',
      'lanzá dota2',
      'lista juegos',
      'abrí steam',
    ],
  }

  let output = 'Escribí cualquiera de estos comandos:\n\n'

  for (const skill of data.skills) {
    const icon = skillIcons[skill.name] || '📌'
    output += `${icon} ${skill.name}\n`
    
    if (skill.description) {
      output += `   ${skill.description}\n`
    }
    
    const skillKey = skill.name.toLowerCase().replace('skill', '')
    const examples = intentExamples[skillKey]
    
    if (examples && examples.length > 0) {
      for (const example of examples) {
        output += `   - ${example}\n`
      }
    }
    
    output += '\n'
  }

  return output.trim()
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

// ── Main Component ────────────────────────────────────────────────────────────

function App() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [pendingConfirmation, setPendingConfirmation] = useState<string | null>(null)
  const [ollamaStatus, setOllamaStatus] = useState<'connected' | 'disconnected'>('disconnected')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Send greeting on mount
  useEffect(() => {
    const greeting: Message = {
      id: generateId(),
      role: 'bot',
      content: `¡Hola ${USER_NAME}! Soy tu asistente. ¿En qué te puedo ayudar hoy?`,
      timestamp: new Date(),
    }
    setMessages([greeting])

    // Listen for Ollama status from Electron
    if ((window as any).electron?.ipcRenderer) {
      (window as any).electron.ipcRenderer.on('ollama-status', (status: string) => {
        setOllamaStatus(status as 'connected' | 'disconnected')
      })
    }
  }, [])

  const addMessage = (role: 'user' | 'bot', content: string, meta?: Message['meta']) => {
    const message: Message = {
      id: generateId(),
      role,
      content,
      meta,
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, message])
  }

  const handleSend = async () => {
    if (!input.trim() || loading) return

    const userMessage = input.trim()
    setInput('')

    // Add user message
    addMessage('user', userMessage)

    // Check if this is a confirmation
    const isConfirmation = (userMessage.toLowerCase() === 'confirmar' || userMessage.toLowerCase() === 'confirm') && pendingConfirmation

    try {
      setLoading(true)

      const response = await fetch('/api/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: userMessage,
          confirmed: isConfirmation,
        }),
      })

      const result: UnifiedCommandResponse = await response.json()

      // Debug: log the full response
      console.log('[App] Command response:', result);

      // Handle confirmation requirement
      if (result.requiresConfirmation) {
        setPendingConfirmation(result.confirmationToken || null)
        addMessage('bot', `⚠️ ${result.message}\n\nEscribí 'confirmar' para continuar.`)
        return
      }

      // Clear pending confirmation if we got here
      setPendingConfirmation(null)

      // Format response
      let botMessage = result.message

      // Check if this is a help response
      if (result.data && typeof result.data === 'object' && 'skills' in result.data) {
        const helpData = result.data as HelpData
        botMessage = formatHelpContent(helpData)
      }

      // Add bot response
      if (result.success) {
        addMessage('bot', botMessage, result.meta)
      } else {
        addMessage('bot', `❌ ${botMessage || result.error}`)
      }

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Error desconocido'
      addMessage('bot', `❌ Error: ${errorMsg}`)
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-left">
          <span className="header-icon">🤖</span>
          <span className="header-title">Desktop Agent</span>
        </div>
        <div className="header-right">
          <span className={`status-pill ${ollamaStatus === 'connected' ? 'connected' : 'disconnected'}`}>
            <span className="status-dot">●</span>
            {ollamaStatus === 'connected' ? 'Con IA' : 'Sin IA'}
          </span>
        </div>
      </header>

      {/* Chat Area */}
      <div className="chat-area">
        {messages.map((message) => (
          <div key={message.id} className={`message-wrapper ${message.role}`}>
            <div className={`message-bubble ${message.role}`}>
              <div className="message-content">{message.content}</div>
              {message.meta && (
                <div className="skill-badge">
                  <span className="badge-item">⚡ {message.meta.skill}</span>
                  <span className="badge-item">{message.meta.method}</span>
                  <span className="badge-item">{(message.meta.confidence * 100).toFixed(0)}%</span>
                  <span className="badge-item">{message.meta.executionTime}ms</span>
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="message-wrapper bot">
            <div className="message-bubble bot">
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="input-area">
        <input
          type="text"
          className="chat-input"
          placeholder="Escribí un comando..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
        />
        <button
          className="send-button"
          onClick={handleSend}
          disabled={loading || !input.trim()}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
          </svg>
        </button>
      </div>
    </div>
  )
}

export default App
