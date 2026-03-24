import { useState, useEffect, useRef } from 'react'
import './App.css'

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_USER_NAME = 'Usuario'

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
    'FileSkill': '📁',
    'AppSkill': '⚙️',
    'ExcelSkill': '📊',
    'SystemSkill': '🔒',
    'TextEditSkill': '✏️',
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
  const [aiStatus, setAiStatus] = useState<'claude' | 'ollama' | 'none' | 'checking'>('checking')
  const [isListening, setIsListening] = useState(false)
  const [userName, setUserName] = useState(DEFAULT_USER_NAME)
  const [isMuted, setIsMuted] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Send greeting on mount and load session history
  useEffect(() => {
    // Load user preferences first
    fetch('http://localhost:3001/api/preferences')
      .then(r => r.json())
      .then(data => {
        if (data.success && data.preferences?.userName) {
          setUserName(data.preferences.userName)
          console.log(`[Preferences] Loaded userName: ${data.preferences.userName}`)
        }
      })
      .catch(() => {
        console.log('[Preferences] Failed to load, using default')
      })

    // Load session history
    fetch('http://localhost:3001/api/session/history')
      .then(r => r.json())
      .then(data => {
        if (data.success && data.messages?.length > 0) {
          // Convert session messages to UI messages
          const loadedMessages: Message[] = data.messages.map((m: any) => ({
            id: generateId(),
            role: m.role === 'user' ? 'user' : 'bot',
            content: m.content,
            timestamp: new Date(m.timestamp),
          }))
          setMessages(loadedMessages)
          console.log(`[Session] Loaded ${loadedMessages.length} messages from history`)
        } else {
          // No history - show greeting
          const greeting: Message = {
            id: generateId(),
            role: 'bot',
            content: `¡Hola ${userName}! Soy tu asistente. ¿En qué te puedo ayudar hoy?`,
            timestamp: new Date(),
          }
          setMessages([greeting])
        }
      })
      .catch(() => {
        // Failed to load - show greeting
        const greeting: Message = {
          id: generateId(),
          role: 'bot',
          content: `¡Hola ${userName}! Soy tu asistente. ¿En qué te puedo ayudar hoy?`,
          timestamp: new Date(),
        }
        setMessages([greeting])
      })

    // Check AI status
    const checkAI = () => {
      fetch('http://localhost:3001/api/ai-status')
        .then(r => r.json())
        .then(data => {
          console.log('[AI Status]', data)
          if (data.claude) {
            setAiStatus('claude')
          } else if (data.ollama) {
            setAiStatus('ollama')
          } else {
            setAiStatus('none')
          }
        })
        .catch(() => setAiStatus('none'))
    }
    
    // Check immediately and retry after 3 seconds
    checkAI()
    const timer = setTimeout(checkAI, 3000)

    // Listen for Ollama status from Electron
    if ((window as any).electron?.ipcRenderer) {
      (window as any).electron.ipcRenderer.on('ollama-status', (status: string) => {
        // Update AI status based on Ollama
        if (status === 'connected' && aiStatus !== 'claude') {
          setAiStatus('ollama')
        } else if (status === 'disconnected' && aiStatus === 'ollama') {
          setAiStatus('none')
        }
      })

      // Listen for keyboard shortcuts
      (window as any).electron.ipcRenderer.on('shortcut-new-chat', () => {
        console.log('[Shortcut] New chat triggered')
        // Clear history and show greeting
        fetch('http://localhost:3001/api/session/history', { method: 'DELETE' })
          .then(() => {
            const greeting: Message = {
              id: generateId(),
              role: 'bot',
              content: `¡Hola ${userName}! Soy tu asistente. ¿En qué te puedo ayudar hoy?`,
              timestamp: new Date(),
            }
            setMessages([greeting])
          })
          .catch(err => console.error('[Shortcut] Failed to clear history:', err))
      })

      (window as any).electron.ipcRenderer.on('shortcut-voice-input', () => {
        console.log('[Shortcut] Voice input triggered')
        startListening()
      })
    }
    
    return () => clearTimeout(timer)
  }, [])

  // Browser keyboard shortcuts (work in both browser and Electron)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+N → new chat
      if (e.ctrlKey && e.key === 'n' && !e.shiftKey) {
        e.preventDefault()
        console.log('[Shortcut] New chat triggered (browser)')
        // Clear history and show greeting
        fetch('http://localhost:3001/api/session/history', { method: 'DELETE' })
          .then(() => {
            const greeting: Message = {
              id: generateId(),
              role: 'bot',
              content: `¡Hola${userName ? ' ' + userName : ''}! Soy tu asistente. ¿En qué te puedo ayudar hoy?`,
              timestamp: new Date(),
            }
            setMessages([greeting])
          })
          .catch(err => console.error('[Shortcut] Failed to clear history:', err))
      }

      // Ctrl+Shift+V → voice input
      if (e.ctrlKey && e.shiftKey && e.key === 'V') {
        e.preventDefault()
        console.log('[Shortcut] Voice input triggered (browser)')
        startListening()
      }

      // Ctrl+M → toggle mute
      if (e.ctrlKey && e.key === 'm') {
        e.preventDefault()
        console.log('[Shortcut] Toggle mute (browser)')
        setIsMuted(prev => !prev)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [userName, isMuted])

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

  const saveToSessionHistory = async (role: 'user' | 'assistant', content: string) => {
    try {
      await fetch('http://localhost:3001/api/session/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role,
          content,
          timestamp: new Date().toISOString(),
        }),
      })
    } catch (error) {
      console.error('[Session] Failed to save message:', error)
    }
  }

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || 
                              (window as any).webkitSpeechRecognition ||
                              (window as any).webkitSpeechRecognition

    if (!SpeechRecognition) {
      addMessage('bot', 'El reconocimiento de voz no está disponible en este navegador.')
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = 'es-AR'
    recognition.continuous = false
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    let finalTranscript = ''

    recognition.onresult = (event: any) => {
      let interimTranscript = ''
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        
        if (event.results[i].isFinal) {
          finalTranscript += transcript
        } else {
          interimTranscript += transcript
        }
      }

      // Show partial results in input
      setInput(finalTranscript || interimTranscript)
    }

    recognition.onend = () => {
      setIsListening(false)
      
      if (finalTranscript.trim()) {
        setTimeout(() => handleSend(), 300)
      }
    }

    recognition.onerror = (event: any) => {
      setIsListening(false)
      console.error('[Voice] Error:', event.error)
      
      if (event.error === 'not-allowed') {
        addMessage('bot', 'Necesito permiso para usar el micrófono.')
      }
    }

    setIsListening(true)
    recognition.start()
  }

  const handleSend = async () => {
    if (!input.trim() || loading) return

    const userMessage = input.trim()
    setInput('')

    // Add user message
    addMessage('user', userMessage)

    // Save user message to session history
    await saveToSessionHistory('user', userMessage)

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

      // Check response status
      if (!response.ok) {
        const errorText = await response.text()
        console.error('[Fetch] Server error:', response.status, errorText.substring(0, 200))
        throw new Error(`Error del servidor: ${response.status}`)
      }

      // Check content type
      const contentType = response.headers.get('content-type')
      if (!contentType?.includes('application/json')) {
        const text = await response.text()
        console.error('[Fetch] Non-JSON response:', text.substring(0, 200))
        throw new Error('Respuesta inválida del servidor')
      }

      const result: UnifiedCommandResponse = await response.json()

      // Debug: log the full response
      console.log('[App] Command response:', result);

      // Handle clear_history intent
      if (result.meta?.intent === 'clear_history' && result.success) {
        // Clear local messages and show greeting
        const greeting: Message = {
          id: generateId(),
          role: 'bot',
          content: `¡Hola ${userName}! Soy tu asistente. ¿En qué te puedo ayudar hoy?`,
          timestamp: new Date(),
        }
        setMessages([greeting])
        setLoading(false)
        return
      }

      // Handle confirmation requirement
      if (result.requiresConfirmation) {
        setPendingConfirmation(result.confirmationToken || null)
        const confirmMsg = `⚠️ ${result.message}\n\nEscribí 'confirmar' para continuar.`
        addMessage('bot', confirmMsg)
        await saveToSessionHistory('assistant', confirmMsg)
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

      // Add bot response (no ❌ prefix, use CSS class for styling)
      if (result.success) {
        addMessage('bot', botMessage, result.meta)
        await saveToSessionHistory('assistant', botMessage)
      } else {
        addMessage('bot', botMessage || result.error || 'Error desconocido')
        await saveToSessionHistory('assistant', botMessage || result.error || 'Error desconocido')
      }

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Error desconocido'
      addMessage('bot', `Error: ${errorMsg}`)
      await saveToSessionHistory('assistant', `Error: ${errorMsg}`)
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

  const speak = (text: string) => {
    // Check if muted
    if (isMuted) {
      console.log('[TTS] Muted, skipping speech')
      return
    }

    // Clean text from emojis and special characters
    const clean = text
      .replace(/[❌✅⚡🔊🔇🎤🤖●▸💡]/g, '')
      .replace(/\*\*/g, '')
      .replace(/`/g, '')
      .trim()
    
    if (!clean) return

    // Try Electron IPC first
    if ((window as any).electron?.ipcRenderer?.invoke) {
      (window as any).electron.ipcRenderer.invoke('speak', clean)
        .then((result: any) => {
          if (!result.success) {
            console.error('[TTS] Error:', result.error)
          }
        })
        .catch((error: any) => {
          console.error('[TTS] Exception:', error)
        })
      return
    }

    // Fallback to Web Speech API (browser mode)
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel()
      
      const utterance = new SpeechSynthesisUtterance(clean)
      utterance.lang = 'es-AR'
      utterance.rate = 1.0
      utterance.pitch = 1.0
      
      // Try to find Spanish voice
      const voices = window.speechSynthesis.getVoices()
      const spanishVoice = voices.find(v => 
        v.lang.startsWith('es') || v.name.toLowerCase().includes('spanish')
      )
      if (spanishVoice) {
        utterance.voice = spanishVoice
      }
      
      window.speechSynthesis.speak(utterance)
    } else {
      console.warn('[TTS] No TTS available (neither Electron nor Web Speech API)')
    }
  }

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-left">
          <span className="app-icon">🤖</span>
          <span className="app-title">Desktop Agent</span>
        </div>
        <div className="header-right">
          <button
            className="mute-btn"
            onClick={() => setIsMuted(prev => !prev)}
            title={isMuted ? 'Activar sonido (Ctrl+M)' : 'Silenciar (Ctrl+M)'}
          >
            {isMuted ? '🔇' : '🔊'}
          </button>
          <span className={`status-pill ${
            aiStatus === 'claude' ? 'connected' : 
            aiStatus === 'ollama' ? 'ollama' : 
            'disconnected'
          }`}>
            <span className="dot">●</span>
            {aiStatus === 'claude' ? '● ONLINE' : 
             aiStatus === 'ollama' ? '● LOCAL' : 
             aiStatus === 'checking' ? '● INIT...' :
             '● OFFLINE'}
          </span>
        </div>
      </header>

      {/* Chat Area */}
      <div className="messages">
        {messages.map((message) => (
          <div key={message.id} className={`message-wrapper ${message.role}`}>
            <div className={`message ${message.role}`}>
              {message.content}
            </div>
            {message.role === 'bot' && (
              <button
                className="speak-msg-btn"
                onClick={() => {
                  console.log('[Speak] Button clicked, content:', message.content.substring(0, 50))
                  speak(message.content)
                }}
                title="Escuchar respuesta"
              >
                🔊
              </button>
            )}
          </div>
        ))}
        {loading && (
          <div className="message-wrapper bot">
            <div className="message bot">
              <div className="loading-indicator">
                <div className="loading-dot"></div>
                <div className="loading-dot"></div>
                <div className="loading-dot"></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="input-area">
        <button
          className={`mic-btn ${isListening ? 'listening' : ''}`}
          onClick={startListening}
          disabled={loading || isListening}
          title="Usar micrófono (Ctrl+Shift+V)"
        >
          🎤
        </button>
        <div className="input-wrapper">
          <input
            type="text"
            className="chat-input"
            placeholder="INGRESÁ UN COMANDO..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
          />
        </div>
        <button
          className="send-btn"
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
