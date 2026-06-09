import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Brain, Mail, Lock, User, Loader } from 'lucide-react'
import toast from 'react-hot-toast'
import { authAPI } from '../services/api'
import { useAuthStore } from '../store/authStore'
import styles from './AuthPage.module.css'

export default function RegisterPage() {
  const [form, setForm] = useState({ email: '', username: '', full_name: '', password: '' })
  const [loading, setLoading] = useState(false)
  const { login } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.email || !form.username || !form.password) return toast.error('Please fill required fields')
    if (form.password.length < 8) return toast.error('Password must be at least 8 characters')
    setLoading(true)
    try {
      const { data } = await authAPI.register(form)
      login(data.access_token, data.user)
      toast.success('Account created! Welcome aboard.')
      navigate('/dashboard')
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  return (
    <div className={styles.page}>
      <div className={styles.bg} />
      <div className={styles.card}>
        <div className={styles.logo}>
          <Brain size={32} />
          <span>KnowledgeAI</span>
        </div>
        <h1 className={styles.title}>Create account</h1>
        <p className={styles.subtitle}>Start asking questions from your documents</p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label>Full Name <span style={{ color: 'var(--text-muted)' }}>(optional)</span></label>
            <div className={styles.inputWrap}>
              <User size={16} className={styles.inputIcon} />
              <input className={`input ${styles.inputPadded}`} placeholder="John Doe" value={form.full_name} onChange={set('full_name')} />
            </div>
          </div>

          <div className={styles.field}>
            <label>Username *</label>
            <div className={styles.inputWrap}>
              <User size={16} className={styles.inputIcon} />
              <input className={`input ${styles.inputPadded}`} placeholder="johndoe" value={form.username} onChange={set('username')} />
            </div>
          </div>

          <div className={styles.field}>
            <label>Email *</label>
            <div className={styles.inputWrap}>
              <Mail size={16} className={styles.inputIcon} />
              <input className={`input ${styles.inputPadded}`} type="email" placeholder="you@example.com" value={form.email} onChange={set('email')} />
            </div>
          </div>

          <div className={styles.field}>
            <label>Password *</label>
            <div className={styles.inputWrap}>
              <Lock size={16} className={styles.inputIcon} />
              <input className={`input ${styles.inputPadded}`} type="password" placeholder="Min. 8 characters" value={form.password} onChange={set('password')} />
            </div>
          </div>

          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '12px' }} disabled={loading}>
            {loading ? <><Loader size={16} className="spinner" /> Creating account...</> : 'Create Account'}
          </button>
        </form>

        <p className={styles.switch}>
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
