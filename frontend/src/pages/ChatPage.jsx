import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Send, Bot, User, FileText, Loader, ChevronDown } from 'lucide-react'
import toast from 'react-hot-toast'
import { chatAPI, documentsAPI } from '../services/api'
import { useAuthStore } from '../store/authStore'
import styles from './ChatPage.module.css'

export default function ChatPage() {
  const { user } = useAuthStore()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [documents, setDocuments] = useState([])
  const [selectedDocIds, setSelectedDocIds] = useState([])
  const messagesEndRef = useRef(null)
  const textareaRef = useRef(null)

  useEffect(() => {
    documentsAPI.list().then(({ data }) => setDocuments(data.documents.filter((d) => d.status === 'ready'))).catch(() => {})
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = async (e) => {
    e?.preventDefault()
    const question = input.trim()
    if (!question || streaming) return

    setInput('')
    setStreaming(true)

    // Add user message
    const userMsg = { id: Date.now(), role: 'user', content: question }
    setMessages((prev) => [...prev, userMsg])

    // Add placeholder assistant message
    const assistantId = Date.now() + 1
    setMessages((prev) => [...prev, { id: assistantId, role: 'assistant', content: '', sources: [], streaming: true }])

    try {
      let fullContent = ''
      let sources = []

      for await (const event of chatAPI.askStream({ question, document_ids: selectedDocIds.length ? selectedDocIds : null })) {
        if (event.type === 'sources') {
          sources = event.sources
          setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, sources } : m))
        } else if (event.type === 'token') {
          fullContent += event.content
          setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, content: fullContent } : m))
        } else if (event.type === 'done') {
          setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, streaming: false } : m))
        }
      }
    } catch (err) {
      toast.error('Failed to get response')
      setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, content: 'Error: Could not get a response. Please try again.', streaming: false } : m))
    } finally {
      setStreaming(false)
      textareaRef.current?.focus()
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const toggleDoc = (id) => {
    setSelectedDocIds((prev) => prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id])
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Ask AI</h1>
          <p className={styles.subtitle}>Ask questions about your uploaded documents</p>
        </div>
      </div>

      <div className={styles.layout}>
        {/* Sidebar - document filter */}
        <div className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <FileText size={14} />
            <span>Filter Documents</span>
          </div>
          {documents.length === 0 ? (
            <p className={styles.noDocNote}>No ready documents. <a href="/documents">Upload one</a></p>
          ) : (
            <div className={styles.docList}>
              <label className={styles.docItem}>
                <input type="checkbox" checked={selectedDocIds.length === 0} onChange={() => setSelectedDocIds([])} />
                <span>All documents</span>
              </label>
              {documents.map((doc) => (
                <label key={doc.id} className={styles.docItem}>
                  <input type="checkbox" checked={selectedDocIds.includes(doc.id)} onChange={() => toggleDoc(doc.id)} />
                  <span title={doc.original_filename}>{doc.original_filename}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Chat area */}
        <div className={styles.chatArea}>
          <div className={styles.messages}>
            {messages.length === 0 && (
              <div className={styles.welcome}>
                <Bot size={40} style={{ color: 'var(--accent)', marginBottom: 12 }} />
                <h2>Ask me anything</h2>
                <p>I'll answer based only on your uploaded documents.</p>
                <div className={styles.suggestions}>
                  {['What is the leave policy?', 'Summarize the onboarding process', 'What is the notice period?'].map((s) => (
                    <button key={s} className={styles.suggestion} onClick={() => { setInput(s); textareaRef.current?.focus() }}>{s}</button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <div key={msg.id} className={`${styles.message} ${msg.role === 'user' ? styles.userMsg : styles.assistantMsg} fade-in`}>
                <div className={styles.msgAvatar}>
                  {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                </div>
                <div className={styles.msgBody}>
                  {msg.role === 'user' ? (
                    <p className={styles.msgText}>{msg.content}</p>
                  ) : (
                    <div className={styles.msgMarkdown}>
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content || ' '}</ReactMarkdown>
                      {msg.streaming && <span className={styles.cursor}>▊</span>}
                    </div>
                  )}

                  {msg.sources?.length > 0 && !msg.streaming && (
                    <div className={styles.sources}>
                      <p className={styles.sourcesLabel}>Sources:</p>
                      {msg.sources.map((s, i) => (
                        <div key={i} className={styles.source}>
                          <span className={styles.sourceDoc}>{s.document_name}</span>
                          <span className={styles.sourceScore}>{Math.round(s.relevance_score * 100)}% match</span>
                          <p className={styles.sourceText}>{s.chunk_text?.slice(0, 120)}...</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div className={styles.inputArea}>
            <textarea
              ref={textareaRef}
              className={styles.textarea}
              placeholder="Ask a question about your documents... (Shift+Enter for new line)"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={2}
              disabled={streaming}
            />
            <button className={`btn btn-primary ${styles.sendBtn}`} onClick={handleSubmit} disabled={streaming || !input.trim()}>
              {streaming ? <Loader size={18} className="spinner" /> : <Send size={18} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
