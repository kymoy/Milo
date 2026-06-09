import { useState, useRef, useEffect, useCallback } from 'react'

const BACKEND = 'http://localhost:8000'

export function useAdminPanel() {
  const [uploadFile, setUploadFile]     = useState(null)
  const [uploading, setUploading]       = useState(false)
  const [uploadStatus, setUploadStatus] = useState(null)
  const [dragOver, setDragOver]         = useState(false)
  const fileInputRef                    = useRef(null)

  const [sourceName, setSourceName]     = useState('')
  const [content, setContent]           = useState('')
  const [creating, setCreating]         = useState(false)
  const [createStatus, setCreateStatus] = useState(null)

  const [sources, setSources]               = useState([])
  const [loadingSources, setLoadingSources] = useState(false)

  const loadSources = useCallback(async () => {
    setLoadingSources(true)
    try {
      const res = await fetch(`${BACKEND}/admin/sources`)
      const data = await res.json()
      setSources(data.sources ?? [])
    } catch { setSources([]) }
    finally { setLoadingSources(false) }
  }, [])

  useEffect(() => { loadSources() }, [loadSources])

  function handleDrop(e) {
    e.preventDefault(); setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) setUploadFile(file)
  }

  async function handleUpload() {
    if (!uploadFile) return
    setUploading(true); setUploadStatus(null)
    const form = new FormData()
    form.append('file', uploadFile)
    try {
      const res = await fetch(`${BACKEND}/admin/upload`, { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail ?? 'Upload failed')
      setUploadStatus({ type: 'success', message: `Ingested "${data.source}" — ${data.chunks} chunks added.` })
      setUploadFile(null)
      loadSources()
    } catch (err) { setUploadStatus({ type: 'error', message: err.message }) }
    finally { setUploading(false) }
  }

  async function handleCreate() {
    if (!sourceName.trim() || !content.trim()) return
    setCreating(true); setCreateStatus(null)
    try {
      const res = await fetch(`${BACKEND}/admin/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_name: sourceName.trim(), content: content.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail ?? 'Failed to create document')
      setCreateStatus({ type: 'success', message: `Saved "${data.source}" — ${data.chunks} chunks added.` })
      setSourceName(''); setContent('')
      loadSources()
    } catch (err) { setCreateStatus({ type: 'error', message: err.message }) }
    finally { setCreating(false) }
  }

  return {
    uploadFile, setUploadFile, uploading, uploadStatus, dragOver, setDragOver, fileInputRef, handleDrop, handleUpload,
    sourceName, setSourceName, content, setContent, creating, createStatus, handleCreate,
    sources, loadingSources, loadSources,
  }
}
