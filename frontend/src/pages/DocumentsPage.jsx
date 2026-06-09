import { useEffect, useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { FileText, Trash2, Upload, RefreshCw, FileCheck, AlertCircle, Clock, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'
import { documentsAPI } from '../services/api'
import { formatDistanceToNow } from 'date-fns'
import styles from './DocumentsPage.module.css'

const FILE_TYPES = { pdf: '📄', docx: '📝', txt: '📃' }
const FILE_SIZE_LABELS = (bytes) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [summaries, setSummaries] = useState({})
  const [summarizing, setSummarizing] = useState({})

  const fetchDocuments = async () => {
    try {
      const { data } = await documentsAPI.list()
      setDocuments(data.documents)
    } catch {
      toast.error('Failed to load documents')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDocuments()
    // Poll for processing status
    const interval = setInterval(() => {
      if (documents.some((d) => d.status === 'processing')) fetchDocuments()
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  const onDrop = useCallback(async (acceptedFiles) => {
    if (!acceptedFiles.length) return
    const file = acceptedFiles[0]
    const ext = file.name.split('.').pop().toLowerCase()
    if (!['pdf', 'docx', 'txt'].includes(ext)) {
      return toast.error('Only PDF, DOCX, and TXT files are supported')
    }
    setUploading(true)
    setUploadProgress(0)
    try {
      const { data } = await documentsAPI.upload(file, setUploadProgress)
      toast.success(`"${file.name}" uploaded successfully!`)
      setDocuments((prev) => [data, ...prev])
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Upload failed')
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'], 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'], 'text/plain': ['.txt'] },
    maxFiles: 1,
    disabled: uploading,
  })

  const handleDelete = async (doc) => {
    if (!confirm(`Delete "${doc.original_filename}"?`)) return
    try {
      await documentsAPI.delete(doc.id)
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id))
      toast.success('Document deleted')
    } catch {
      toast.error('Failed to delete document')
    }
  }

  const handleSummarize = async (doc) => {
    setSummarizing((p) => ({ ...p, [doc.id]: true }))
    try {
      const { data } = await documentsAPI.summarize(doc.id)
      setSummaries((p) => ({ ...p, [doc.id]: data.summary }))
    } catch {
      toast.error('Failed to generate summary')
    } finally {
      setSummarizing((p) => ({ ...p, [doc.id]: false }))
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Documents</h1>
          <p className={styles.subtitle}>{documents.length} document{documents.length !== 1 ? 's' : ''} uploaded</p>
        </div>
        <button className="btn btn-ghost" onClick={fetchDocuments}>
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      {/* Upload Zone */}
      <div {...getRootProps()} className={`${styles.dropzone} ${isDragActive ? styles.dropzoneActive : ''} ${uploading ? styles.dropzoneUploading : ''}`}>
        <input {...getInputProps()} />
        <Upload size={28} className={styles.dropIcon} />
        {uploading ? (
          <div>
            <p className={styles.dropText}>Uploading... {uploadProgress}%</p>
            <div className={styles.progressBar}>
              <div className={styles.progressFill} style={{ width: `${uploadProgress}%` }} />
            </div>
          </div>
        ) : isDragActive ? (
          <p className={styles.dropText}>Drop the file here</p>
        ) : (
          <>
            <p className={styles.dropText}>Drag & drop a file, or <span>click to browse</span></p>
            <p className={styles.dropHint}>Supports PDF, DOCX, TXT · Max {50}MB</p>
          </>
        )}
      </div>

      {/* Document List */}
      {loading ? (
        <div className={styles.loadingState}><div className="spinner" /><p>Loading documents...</p></div>
      ) : documents.length === 0 ? (
        <div className={styles.emptyState}>
          <FileText size={48} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
          <p>No documents uploaded yet</p>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>Upload a document above to get started</p>
        </div>
      ) : (
        <div className={styles.docList}>
          {documents.map((doc) => (
            <div key={doc.id} className={styles.docCard}>
              <div className={styles.docMain}>
                <div className={styles.docIcon}>{FILE_TYPES[doc.file_type] || '📁'}</div>
                <div className={styles.docInfo}>
                  <div className={styles.docName}>{doc.original_filename}</div>
                  <div className={styles.docMeta}>
                    <span>{FILE_SIZE_LABELS(doc.file_size)}</span>
                    <span>·</span>
                    <span>{doc.chunk_count} chunks</span>
                    <span>·</span>
                    <span>{formatDistanceToNow(new Date(doc.created_at), { addSuffix: true })}</span>
                  </div>
                </div>
                <div className={styles.docActions}>
                  <span className={`badge badge-${doc.status === 'ready' ? 'ready' : doc.status === 'processing' ? 'processing' : 'error'}`}>
                    {doc.status === 'ready' ? <><FileCheck size={10} /> Ready</> : doc.status === 'processing' ? <><Clock size={10} className="pulse" /> Processing</> : <><AlertCircle size={10} /> Error</>}
                  </span>
                  {doc.status === 'ready' && (
                    <button className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => handleSummarize(doc)} disabled={summarizing[doc.id]}>
                      {summarizing[doc.id] ? <><div className="spinner" style={{ width: 12, height: 12 }} /> Summarizing</> : <><Sparkles size={13} /> Summarize</>}
                    </button>
                  )}
                  <button className="btn btn-danger" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => handleDelete(doc)}>
                    <Trash2 size={13} /> Delete
                  </button>
                </div>
              </div>

              {summaries[doc.id] && (
                <div className={styles.summary}>
                  <strong>Summary:</strong>
                  <p>{summaries[doc.id]}</p>
                </div>
              )}
              {doc.error_message && (
                <div className={styles.errorMsg}><AlertCircle size={14} /> {doc.error_message}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
