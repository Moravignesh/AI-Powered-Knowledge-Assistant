import { useEffect, useState } from 'react'
import { Trash2, MessageSquare, ChevronDown, ChevronUp } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import toast from 'react-hot-toast'
import { chatAPI } from '../services/api'
import { format } from 'date-fns'
import styles from './HistoryPage.module.css'

export default function HistoryPage() {
  const [history, setHistory] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState({})
  const [page, setPage] = useState(1)

  const fetchHistory = async (p = 1) => {
    setLoading(true)
    try {
      const { data } = await chatAPI.history(p)
      setHistory(data.conversations)
      setTotal(data.total)
    } catch {
      toast.error('Failed to load history')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchHistory(page) }, [page])

  const handleDelete = async (id) => {
    if (!confirm('Delete this conversation?')) return
    try {
      await chatAPI.deleteConversation(id)
      setHistory((prev) => prev.filter((c) => c.id !== id))
      toast.success('Conversation deleted')
    } catch {
      toast.error('Failed to delete')
    }
  }

  const toggle = (id) => setExpanded((p) => ({ ...p, [id]: !p[id] }))

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Conversation History</h1>
          <p className={styles.subtitle}>{total} conversation{total !== 1 ? 's' : ''} total</p>
        </div>
      </div>

      {loading ? (
        <div className={styles.loading}><div className="spinner" /></div>
      ) : history.length === 0 ? (
        <div className={styles.empty}>
          <MessageSquare size={40} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
          <p>No conversations yet</p>
        </div>
      ) : (
        <div className={styles.list}>
          {history.map((conv) => (
            <div key={conv.id} className={styles.card}>
              <div className={styles.cardHeader} onClick={() => toggle(conv.id)}>
                <div className={styles.question}>
                  <MessageSquare size={14} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2 }} />
                  <span>{conv.question}</span>
                </div>
                <div className={styles.meta}>
                  <span className={styles.time}>{format(new Date(conv.created_at), 'MMM d, yyyy HH:mm')}</span>
                  {conv.model_used && <span className={styles.model}>{conv.model_used}</span>}
                  {conv.tokens_used && <span className={styles.tokens}>{conv.tokens_used} tokens</span>}
                  <button className={styles.deleteBtn} onClick={(e) => { e.stopPropagation(); handleDelete(conv.id) }}>
                    <Trash2 size={14} />
                  </button>
                  {expanded[conv.id] ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
              </div>

              {expanded[conv.id] && (
                <div className={styles.answer}>
                  <div className={styles.answerLabel}>Answer</div>
                  <div className={styles.answerContent}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{conv.answer}</ReactMarkdown>
                  </div>
                  {conv.sources?.length > 0 && (
                    <div className={styles.sources}>
                      <div className={styles.sourcesLabel}>Sources ({conv.sources.length})</div>
                      {conv.sources.map((s, i) => (
                        <div key={i} className={styles.source}>
                          <span className={styles.sourceDoc}>{s.document_name}</span>
                          <span className={styles.score}>{Math.round(s.relevance_score * 100)}% match</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Pagination */}
          {total > 20 && (
            <div className={styles.pagination}>
              <button className="btn btn-ghost" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Previous</button>
              <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Page {page} of {Math.ceil(total / 20)}</span>
              <button className="btn btn-ghost" onClick={() => setPage((p) => p + 1)} disabled={page >= Math.ceil(total / 20)}>Next</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
