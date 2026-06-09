import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { Users, FileText, MessageSquare, Zap } from 'lucide-react'
import { analyticsAPI } from '../services/api'
import styles from './AnalyticsPage.module.css'

const COLORS = ['#7c6af7', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4']

export default function AnalyticsPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    analyticsAPI.get().then(({ data }) => setData(data)).catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 400 }}><div className="spinner" /></div>
  if (!data) return <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 40 }}>Failed to load analytics</div>

  const { user_stats, global_stats, most_active_users, documents_by_type } = data

  const docTypeData = Object.entries(documents_by_type || {}).map(([name, value]) => ({ name: name.toUpperCase(), value }))
  const activeUsersData = (most_active_users || []).map((u) => ({ name: u.username, questions: u.question_count }))

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Analytics</h1>
      <p className={styles.subtitle}>Usage statistics and insights</p>

      {/* Global Stats */}
      <div className={styles.statsGrid}>
        <StatCard icon={<Users size={20} />} label="Total Users" value={global_stats?.total_users ?? 0} color="#7c6af7" />
        <StatCard icon={<FileText size={20} />} label="Total Documents" value={global_stats?.total_documents ?? 0} color="#22c55e" />
        <StatCard icon={<MessageSquare size={20} />} label="Total Questions" value={global_stats?.total_questions ?? 0} color="#f59e0b" />
        <StatCard icon={<Zap size={20} />} label="Avg Response" value={`${Math.round(user_stats?.avg_response_time_ms || 0)}ms`} color="#06b6d4" />
      </div>

      <div className={styles.chartsGrid}>
        {/* Document types */}
        <div className={styles.chartCard}>
          <h2 className={styles.chartTitle}>Documents by Type</h2>
          {docTypeData.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 14, textAlign: 'center', padding: 40 }}>No documents yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={docTypeData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                  {docTypeData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)' }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Most active users */}
        <div className={styles.chartCard}>
          <h2 className={styles.chartTitle}>Most Active Users</h2>
          {activeUsersData.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 14, textAlign: 'center', padding: 40 }}>No activity yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={activeUsersData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)' }} />
                <Bar dataKey="questions" fill="var(--accent)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* My Stats */}
      <div className={styles.myStats}>
        <h2 className={styles.chartTitle}>My Statistics</h2>
        <div className={styles.myStatsGrid}>
          <div className={styles.myStat}>
            <div className={styles.myStatValue}>{user_stats?.total_documents ?? 0}</div>
            <div className={styles.myStatLabel}>My Documents</div>
          </div>
          <div className={styles.myStat}>
            <div className={styles.myStatValue}>{user_stats?.total_questions ?? 0}</div>
            <div className={styles.myStatLabel}>Questions Asked</div>
          </div>
          <div className={styles.myStat}>
            <div className={styles.myStatValue}>{Math.round(user_stats?.avg_response_time_ms || 0)}ms</div>
            <div className={styles.myStatLabel}>Avg Response Time</div>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, color }) {
  return (
    <div className={styles.statCard}>
      <div className={styles.statIcon} style={{ background: `${color}22`, color }}>{icon}</div>
      <div className={styles.statValue}>{value}</div>
      <div className={styles.statLabel}>{label}</div>
    </div>
  )
}
