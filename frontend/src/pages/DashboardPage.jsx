import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileText, MessageSquare, Clock, ArrowRight, Upload, Brain } from 'lucide-react'
import { analyticsAPI } from '../services/api'
import { useAuthStore } from '../store/authStore'
import { formatDistanceToNow } from 'date-fns'
import styles from './DashboardPage.module.css'

export default function DashboardPage() {
  const { user } = useAuthStore()
  const [analytics, setAnalytics] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    analyticsAPI.get().then(({ data }) => setAnalytics(data)).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const stats = analytics?.user_stats || {}
  const recent = analytics?.recent_conversations || []

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>
            Good {getGreeting()}, <span className={styles.name}>{user?.full_name || user?.username}</span>
          </h1>
          <p className={styles.subtitle}>Your AI knowledge assistant is ready</p>
        </div>
        <Link to="/chat" className="btn btn-primary">
          <Brain size={16} /> Ask AI
        </Link>
      </div>

      <div className={styles.statsGrid}>
        <StatCard icon={<FileText size={20} />} label="Documents" value={stats.total_documents ?? '—'} color="blue" link="/documents" />
        <StatCard icon={<MessageSquare size={20} />} label="Questions Asked" value={stats.total_questions ?? '—'} color="purple" link="/history" />
        <StatCard icon={<Clock size={20} />} label="Avg Response" value={stats.avg_response_time_ms ? `${Math.round(stats.avg_response_time_ms)}ms` : '—'} color="green" />
      </div>

      <div className={styles.bottom}>
        <div className={styles.recentCard}>
          <div className={styles.cardHeader}>
            <h2>Recent Conversations</h2>
            <Link to="/history" className={styles.seeAll}>See all <ArrowRight size={14} /></Link>
          </div>
          {loading ? (
            <div className={styles.empty}><div className="spinner" /></div>
          ) : recent.length === 0 ? (
            <div className={styles.empty}>
              <MessageSquare size={32} style={{ color: 'var(--text-muted)', marginBottom: 8 }} />
              <p>No conversations yet</p>
              <Link to="/chat" className="btn btn-primary" style={{ marginTop: 12 }}>Start chatting</Link>
            </div>
          ) : (
            <div className={styles.conversationList}>
              {recent.map((c) => (
                <div key={c.id} className={styles.conversationItem}>
                  <p className={styles.question}>{c.question}</p>
                  <span className={styles.time}>{formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={styles.quickActions}>
          <h2 style={{ marginBottom: 16, fontSize: 16, fontWeight: 700 }}>Quick Actions</h2>
          <Link to="/documents" className={styles.action}>
            <div className={styles.actionIcon}><Upload size={18} /></div>
            <div>
              <div className={styles.actionTitle}>Upload Document</div>
              <div className={styles.actionDesc}>PDF, DOCX, or TXT</div>
            </div>
            <ArrowRight size={16} style={{ marginLeft: 'auto', color: 'var(--text-muted)' }} />
          </Link>
          <Link to="/chat" className={styles.action}>
            <div className={styles.actionIcon}><Brain size={18} /></div>
            <div>
              <div className={styles.actionTitle}>Ask a Question</div>
              <div className={styles.actionDesc}>Query your documents</div>
            </div>
            <ArrowRight size={16} style={{ marginLeft: 'auto', color: 'var(--text-muted)' }} />
          </Link>
          <Link to="/analytics" className={styles.action}>
            <div className={styles.actionIcon}><FileText size={18} /></div>
            <div>
              <div className={styles.actionTitle}>View Analytics</div>
              <div className={styles.actionDesc}>Usage stats & insights</div>
            </div>
            <ArrowRight size={16} style={{ marginLeft: 'auto', color: 'var(--text-muted)' }} />
          </Link>
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, color, link }) {
  const colors = {
    blue: 'rgba(59, 130, 246, 0.15)',
    purple: 'var(--accent-dim)',
    green: 'rgba(34, 197, 94, 0.15)',
  }
  const textColors = { blue: '#60a5fa', purple: 'var(--accent-light)', green: 'var(--success)' }
  const card = (
    <div className={styles.statCard}>
      <div className={styles.statIcon} style={{ background: colors[color], color: textColors[color] }}>{icon}</div>
      <div className={styles.statValue}>{value}</div>
      <div className={styles.statLabel}>{label}</div>
    </div>
  )
  return link ? <Link to={link} style={{ textDecoration: 'none' }}>{card}</Link> : card
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}
