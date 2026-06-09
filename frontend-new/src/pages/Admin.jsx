import { useState, useRef, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'

const BACKEND = 'http://localhost:8000'

const SERIF  = { fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 300 }
const MONO_U = { fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 200, letterSpacing: '3px', textTransform: 'uppercase' }
const C = {
  bg: '#0d0d14', card: '#13131f', border: '#2a2a3a', text: '#e8e8f0',
  muted: '#6b6b8a', accent: '#a78bfa', input: '#1a1a28',
}

function StatusBadge({ status }) {
  if (!status) return null
  const isOk = status.type === 'success'
  return (
    <div style={{
      padding: '10px 14px', borderRadius: '8px', fontSize: '13px',
      background: isOk ? 'rgba(74,222,128,0.08)' : 'rgba(248,113,113,0.08)',
      border: `1px solid ${isOk ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)'}`,
      color: isOk ? '#4ade80' : '#f87171',
      ...SERIF,
    }}>
      {status.message}
    </div>
  )
}

export default function Admin() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [uploadFile, setUploadFile]       = useState(null)
  const [uploading, setUploading]         = useState(false)
  const [uploadStatus, setUploadStatus]   = useState(null)
  const [dragOver, setDragOver]           = useState(false)
  const fileInputRef = useRef(null)

  const [sourceName, setSourceName]       = useState('')
  const [content, setContent]             = useState('')
  const [creating, setCreating]           = useState(false)
  const [createStatus, setCreateStatus]   = useState(null)

  const [sources, setSources]             = useState([])
  const [loadingSources, setLoadingSources] = useState(false)

  const loadSources = useCallback(async () => {
    setLoadingSources(true)
    try {
      const res = await fetch(`${BACKEND}/admin/sources`)
      const data = await res.json()
      setSources(data.sources ?? [])
    } catch {
      setSources([])
    } finally {
      setLoadingSources(false)
    }
  }, [])

  useEffect(() => { loadSources() }, [loadSources])

  function handleLogout() { logout(); navigate('/login') }

  function handleDrop(e) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) setUploadFile(file)
  }

  async function handleUpload() {
    if (!uploadFile) return
    setUploading(true)
    setUploadStatus(null)
    const form = new FormData()
    form.append('file', uploadFile)
    try {
      const res = await fetch(`${BACKEND}/admin/upload`, { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail ?? 'Upload failed')
      setUploadStatus({ type: 'success', message: `Ingested "${data.source}" — ${data.chunks} chunks added to library.` })
      setUploadFile(null)
      loadSources()
    } catch (err) {
      setUploadStatus({ type: 'error', message: err.message })
    } finally {
      setUploading(false)
    }
  }

  async function handleCreate() {
    if (!sourceName.trim() || !content.trim()) return
    setCreating(true)
    setCreateStatus(null)
    try {
      const res = await fetch(`${BACKEND}/admin/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_name: sourceName.trim(), content: content.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail ?? 'Failed to create document')
      setCreateStatus({ type: 'success', message: `Saved "${data.source}" — ${data.chunks} chunks added to library.` })
      setSourceName('')
      setContent('')
      loadSources()
    } catch (err) {
      setCreateStatus({ type: 'error', message: err.message })
    } finally {
      setCreating(false)
    }
  }

  const inputStyle = {
    background: C.input, border: `1px solid ${C.border}`, borderRadius: '8px',
    padding: '11px 14px', color: C.text, fontSize: '14px', outline: 'none',
    fontFamily: 'system-ui', width: '100%', boxSizing: 'border-box',
  }

  const btnStyle = (disabled) => ({
    background: disabled ? C.input : C.accent,
    border: `1px solid ${disabled ? C.border : C.accent}`,
    borderRadius: '8px', padding: '10px 20px',
    color: disabled ? C.muted : '#fff',
    cursor: disabled ? 'not-allowed' : 'pointer',
    ...SERIF, fontSize: '15px', transition: 'background 0.15s',
  })

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: 'system-ui' }}>
      <div style={{ maxWidth: '860px', margin: '0 auto', padding: '0 24px' }}>

        {/* Header */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 0', borderBottom: `1px solid ${C.border}`, marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ ...MONO_U, fontSize: '13px', color: C.accent }}>MILO</span>
            <span style={{ color: C.border }}>|</span>
            <span style={{ ...SERIF, fontSize: '18px', color: C.text }}>Admin</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', ...SERIF, fontSize: '14px' }}
              onMouseEnter={e => e.currentTarget.style.color = C.accent}
              onMouseLeave={e => e.currentTarget.style.color = C.muted}>
              ← Back to chat
            </button>
            <span style={{ ...SERIF, fontSize: '14px', color: C.muted }}>{user?.username}</span>
            <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', ...SERIF, fontSize: '14px' }}
              onMouseEnter={e => e.currentTarget.style.color = '#f87171'}
              onMouseLeave={e => e.currentTarget.style.color = C.muted}>
              Sign out
            </button>
          </div>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>

          {/* Upload file */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <div style={{ ...MONO_U, fontSize: '11px', color: C.accent, marginBottom: '6px' }}>Upload file</div>
              <div style={{ ...SERIF, fontSize: '13px', color: C.muted }}>Add a .md or .txt file to the knowledge library</div>
            </div>

            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              style={{
                border: `2px dashed ${dragOver ? C.accent : uploadFile ? 'rgba(74,222,128,0.4)' : C.border}`,
                borderRadius: '10px', padding: '28px 20px', textAlign: 'center',
                cursor: 'pointer', transition: 'border-color 0.2s',
                background: dragOver ? `${C.accent}08` : 'transparent',
              }}>
              {uploadFile ? (
                <>
                  <div style={{ fontSize: '24px', marginBottom: '8px' }}>📄</div>
                  <div style={{ ...SERIF, fontSize: '15px', color: C.text }}>{uploadFile.name}</div>
                  <div style={{ ...SERIF, fontSize: '12px', color: C.muted, marginTop: '4px' }}>{(uploadFile.size / 1024).toFixed(1)} KB</div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: '24px', marginBottom: '8px' }}>⬆</div>
                  <div style={{ ...SERIF, fontSize: '15px', color: C.muted }}>Drop a file here or click to browse</div>
                  <div style={{ ...SERIF, fontSize: '12px', color: C.muted, marginTop: '4px', fontStyle: 'italic' }}>.md and .txt only</div>
                </>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept=".md,.txt" style={{ display: 'none' }} onChange={e => setUploadFile(e.target.files[0] ?? null)} />

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={handleUpload} disabled={!uploadFile || uploading} style={btnStyle(!uploadFile || uploading)}>
                {uploading ? 'Uploading...' : 'Upload & ingest'}
              </button>
              {uploadFile && (
                <button onClick={() => setUploadFile(null)} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: '8px', padding: '10px 16px', color: C.muted, cursor: 'pointer', ...SERIF, fontSize: '15px' }}>
                  Clear
                </button>
              )}
            </div>

            <StatusBadge status={uploadStatus} />
          </div>

          {/* Create document */}
          <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <div style={{ ...MONO_U, fontSize: '11px', color: C.accent, marginBottom: '6px' }}>Create document</div>
              <div style={{ ...SERIF, fontSize: '13px', color: C.muted }}>Write markdown directly and save it to the library</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <div style={{ ...SERIF, fontSize: '12px', color: C.muted, marginBottom: '6px' }}>Document name</div>
                <input
                  value={sourceName}
                  onChange={e => setSourceName(e.target.value)}
                  placeholder="e.g. my-notes"
                  style={inputStyle}
                  onFocus={e => e.target.style.borderColor = C.accent}
                  onBlur={e => e.target.style.borderColor = C.border}
                />
                <div style={{ ...SERIF, fontSize: '11px', color: C.muted, marginTop: '4px', fontStyle: 'italic' }}>Letters, numbers, hyphens, underscores only</div>
              </div>

              <div>
                <div style={{ ...SERIF, fontSize: '12px', color: C.muted, marginBottom: '6px' }}>Content</div>
                <textarea
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  placeholder="Write your markdown here..."
                  rows={8}
                  style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
                  onFocus={e => e.target.style.borderColor = C.accent}
                  onBlur={e => e.target.style.borderColor = C.border}
                />
              </div>
            </div>

            <button onClick={handleCreate} disabled={!sourceName.trim() || !content.trim() || creating} style={btnStyle(!sourceName.trim() || !content.trim() || creating)}>
              {creating ? 'Saving...' : 'Save & ingest'}
            </button>

            <StatusBadge status={createStatus} />
          </div>
        </div>

        {/* Library sources */}
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '24px', marginBottom: '40px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <div style={{ ...MONO_U, fontSize: '11px', color: C.accent, marginBottom: '4px' }}>Knowledge library</div>
              <div style={{ ...SERIF, fontSize: '13px', color: C.muted }}>{sources.length} source{sources.length !== 1 ? 's' : ''} in the database</div>
            </div>
            <button onClick={loadSources} disabled={loadingSources} style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: '6px', padding: '6px 14px', color: C.muted, cursor: 'pointer', ...SERIF, fontSize: '13px' }}>
              {loadingSources ? 'Loading...' : 'Refresh'}
            </button>
          </div>
          {sources.length === 0 ? (
            <div style={{ ...SERIF, fontSize: '14px', color: C.muted, fontStyle: 'italic', padding: '12px 0' }}>No sources ingested yet.</div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {sources.map(s => (
                <div key={s} style={{ background: `${C.accent}12`, border: `1px solid ${C.accent}33`, borderRadius: '6px', padding: '5px 12px', ...SERIF, fontSize: '14px', color: C.accent }}>
                  {s}
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
