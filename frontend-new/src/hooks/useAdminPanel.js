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
  const [docType, setDocType]           = useState('library')
  const [creating, setCreating]         = useState(false)
  const [createStatus, setCreateStatus] = useState(null)

  const [rulesContent, setRulesContent] = useState('')
  const [savingRules, setSavingRules]   = useState(false)
  const [rulesStatus, setRulesStatus]   = useState(null)

  const [models, setModels]               = useState([])
  const [modelsDetailed, setModelsDetailed] = useState([])
  const [activeModel, setActiveModel]     = useState('')
  const [switchingModel, setSwitchingModel] = useState(false)
  const [modelStatus, setModelStatus]     = useState(null)

  const [sources, setSources]               = useState([])
  const [loadingSources, setLoadingSources] = useState(false)

  const [benchmarks, setBenchmarks]           = useState({})
  const [benchmarkRunning, setBenchmarkRunning] = useState(null)
  const [benchmarkError, setBenchmarkError]   = useState(null)
  const [diagHistory, setDiagHistory]         = useState([])
  const [diagCurrent, setDiagCurrent]         = useState(null)

  const [activeProvider, setActiveProvider]     = useState('ollama')
  const [claudeModels, setClaudeModels]         = useState([])
  const [claudeKeySet, setClaudeKeySet]         = useState(false)
  const [claudeKeyMasked, setClaudeKeyMasked]   = useState(null)
  const [switchingProvider, setSwitchingProvider] = useState(false)
  const [providerStatus, setProviderStatus]     = useState(null)
  const [savingClaudeKey, setSavingClaudeKey]   = useState(false)
  const [claudeKeyStatus, setClaudeKeyStatus]   = useState(null)

  const loadSources = useCallback(async () => {
    setLoadingSources(true)
    try {
      const res = await fetch(`${BACKEND}/admin/sources`)
      const data = await res.json()
      setSources(data.sources ?? [])
    } catch { setSources([]) }
    finally { setLoadingSources(false) }
  }, [])

  const loadRules = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND}/admin/rules`)
      const data = await res.json()
      setRulesContent(data.content ?? '')
    } catch {}
  }, [])

  const loadModels = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND}/admin/models`)
      const data = await res.json()
      setModels(data.models ?? [])
      setModelsDetailed(data.models_detailed ?? [])
      setActiveModel(data.active ?? '')
    } catch {}
  }, [])

  const loadBenchmarks = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND}/admin/benchmarks`)
      const data = await res.json()
      setBenchmarks(data ?? {})
    } catch {}
  }, [])

  const loadDiagHistory = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND}/admin/diagnostics`)
      const data = await res.json()
      setDiagHistory(data.history ?? [])
      if (data.current) setDiagCurrent(data.current)
    } catch {}
  }, [])

  const [ramBreakdown, setRamBreakdown] = useState(null)
  const [ramSnapshots, setRamSnapshots] = useState({})

  const loadRamBreakdown = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND}/admin/ram-breakdown`)
      const data = await res.json()
      setRamBreakdown(data)
    } catch {}
  }, [])

  const loadRamSnapshots = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND}/admin/ram-snapshots`)
      const data = await res.json()
      setRamSnapshots(data ?? {})
    } catch {}
  }, [])

  const loadProvider = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND}/admin/provider`)
      const data = await res.json()
      setActiveProvider(data.provider ?? 'ollama')
      setClaudeModels(data.claude_models ?? [])
      setClaudeKeySet(data.claude_key_set ?? false)
      setClaudeKeyMasked(data.claude_key_masked ?? null)
    } catch {}
  }, [])

  useEffect(() => { loadSources(); loadRules(); loadModels(); loadBenchmarks(); loadDiagHistory(); loadProvider(); loadRamBreakdown(); loadRamSnapshots() }, [loadSources, loadRules, loadModels, loadBenchmarks, loadDiagHistory, loadProvider, loadRamBreakdown, loadRamSnapshots])

  async function handleSwitchModel(name) {
    setSwitchingModel(true); setModelStatus(null)
    try {
      const res = await fetch(`${BACKEND}/admin/model`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: name }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail ?? 'Failed to switch model')
      setActiveModel(data.active)
      setModelStatus({ type: 'success', message: `Switched to ${data.active}` })
    } catch (err) { setModelStatus({ type: 'error', message: err.message }) }
    finally { setSwitchingModel(false) }
  }

  async function runBenchmark(model) {
    setBenchmarkRunning(model)
    setBenchmarkError(null)
    try {
      const res = await fetch(`${BACKEND}/admin/benchmark`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail ?? 'Benchmark failed')
      setBenchmarks(prev => ({ ...prev, [model]: data }))
    } catch (err) {
      setBenchmarkError({ model, message: err.message })
    } finally {
      setBenchmarkRunning(null)
    }
  }

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
      loadSources()
    } catch (err) { setCreateStatus({ type: 'error', message: err.message }) }
    finally { setCreating(false) }
  }

  async function handleSaveRules() {
    setSavingRules(true); setRulesStatus(null)
    try {
      const res = await fetch(`${BACKEND}/admin/rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: rulesContent }),
      })
      if (!res.ok) throw new Error('Failed to save rules')
      setRulesStatus({ type: 'success', message: 'Rules saved — Milo will follow these in every conversation.' })
    } catch (err) { setRulesStatus({ type: 'error', message: err.message }) }
    finally { setSavingRules(false) }
  }

  async function deleteSource(name) {
    try {
      const res = await fetch(`${BACKEND}/admin/sources/${encodeURIComponent(name)}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      loadSources()
    } catch (err) { console.error(err) }
  }

  async function fetchSourceContent(name) {
    const res = await fetch(`${BACKEND}/admin/sources/${encodeURIComponent(name)}/content`)
    if (!res.ok) throw new Error('Failed to load content')
    const data = await res.json()
    return data.chunks ?? []
  }

  async function handleSwitchProvider(provider) {
    setSwitchingProvider(true); setProviderStatus(null)
    try {
      const res = await fetch(`${BACKEND}/admin/provider`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail ?? 'Failed to switch provider')
      setActiveProvider(data.provider)
      setProviderStatus({ type: 'success', message: `Switched to ${data.provider}` })
      if (data.provider === 'ollama') loadModels()
    } catch (err) { setProviderStatus({ type: 'error', message: err.message }) }
    finally { setSwitchingProvider(false) }
  }

  async function handleSaveClaudeKey(key) {
    setSavingClaudeKey(true); setClaudeKeyStatus(null)
    try {
      const res = await fetch(`${BACKEND}/admin/claude-key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail ?? 'Failed to save key')
      setClaudeKeyStatus({ type: 'success', message: 'API key saved.' })
      await loadProvider()
    } catch (err) { setClaudeKeyStatus({ type: 'error', message: err.message }) }
    finally { setSavingClaudeKey(false) }
  }

  async function saveSourceContent(name, text) {
    const res = await fetch(`${BACKEND}/admin/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source_name: name, content: text }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.detail ?? 'Failed to save')
    return data.chunks
  }

  return {
    uploadFile, setUploadFile, uploading, uploadStatus, dragOver, setDragOver, fileInputRef, handleDrop, handleUpload,
    sourceName, setSourceName, content, setContent, docType, setDocType, creating, createStatus, handleCreate,
    rulesContent, setRulesContent, savingRules, rulesStatus, handleSaveRules,
    models, modelsDetailed, activeModel, switchingModel, modelStatus, handleSwitchModel,
    sources, loadingSources, loadSources, deleteSource, fetchSourceContent, saveSourceContent,
    benchmarks, benchmarkRunning, benchmarkError, runBenchmark,
    diagHistory, diagCurrent,
    ramBreakdown, ramSnapshots,
    activeProvider, claudeModels, claudeKeySet, claudeKeyMasked,
    switchingProvider, providerStatus, handleSwitchProvider,
    savingClaudeKey, claudeKeyStatus, handleSaveClaudeKey,
  }
}
