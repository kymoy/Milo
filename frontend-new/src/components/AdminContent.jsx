import { useState, useEffect, useRef } from 'react'
import DiagnosticsPanel from './DiagnosticsPanel'

const BACKEND = 'http://localhost:8000'

const SERIF  = { fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 300 }
const MONO_U = { fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 200, letterSpacing: '3px', textTransform: 'uppercase' }
const MONO   = { fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 300 }

const RECOMMENDED = [
  { model: 'llama3.2:3b',         vram: '2–3 GB',   dl: '2.0 GB',  tps: '80–120',  ctx: '128K', cut: 'mid-2024',   note: 'Fastest option, minimal hardware, weaker reasoning' },
  { model: 'mistral:7b',           vram: '4–5 GB',   dl: '4.1 GB',  tps: '50–70',   ctx: '32K',  cut: 'early 2023', note: 'Reliable, fast, good at following instructions' },
  { model: 'llama3.1:8b',          vram: '6–8 GB',   dl: '4.9 GB',  tps: '40–60',   ctx: '128K', cut: 'early 2023', note: 'Balanced, large context window' },
  { model: 'llama3.1:8b-instruct-q4_K_M',  vram: '4.5–5 GB', dl: '4.7 GB',  tps: '55–75',   ctx: '128K', cut: 'early 2023', note: 'Same model quantized — less VRAM, slightly faster' },
  { model: 'qwen2.5:7b',           vram: '4–5 GB',   dl: '4.7 GB',  tps: '50–70',   ctx: '128K', cut: 'late 2024',  note: 'Less VRAM, faster, most recent knowledge — best overall swap', best: true },
  { model: 'phi4:14b',             vram: '8–10 GB',  dl: '8.9 GB',  tps: '25–40',   ctx: '16K',  cut: 'early 2024', note: 'Noticeably better reasoning, needs 10 GB VRAM' },
  { model: 'llama3.3:70b-instruct-q4_K_M', vram: '35–42 GB', dl: '43 GB',   tps: '5–15',    ctx: '128K', cut: 'Dec 2023',   note: 'Near frontier-model quality, requires high-end GPU' },
  { model: 'gemma4:e4b',                   vram: '6–8 GB',   dl: '9.6 GB',  tps: '55–165',  ctx: '128K', cut: 'Jan 2025',   note: 'Multimodal (text + images), edge-optimized, fast with MTP' },
]

const PROC_COLORS = {
  ollama:            '#818cf8',
  python:            '#38bdf8',
  python3:           '#38bdf8',
  chrome:            '#fb923c',
  msedge:            '#22d3ee',
  firefox:           '#f97316',
  code:              '#a78bfa',
  'code - insiders': '#a78bfa',
  node:              '#4ade80',
  explorer:          '#94a3b8',
  slack:             '#e879f9',
  teams:             '#60a5fa',
  discord:           '#818cf8',
  free:              '#1e293b',
  'other processes': '#334155',
}
function procColor(name) {
  return PROC_COLORS[name.toLowerCase()] ?? '#475569'
}

function RamDonut({ bm, c }) {
  const fmt = mb => mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`

  // Fallback for old benchmarks without process_breakdown
  if (!bm.process_breakdown) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', minWidth: '180px' }}>
        {[
          { label: 'System RAM used', value: `${bm.ram_percent}%` },
          { label: 'Model loaded',    value: bm.ram_delta_mb > 0 ? `+${fmt(bm.ram_delta_mb)}` : '~0 MB' },
        ].map(r => (
          <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
            <span style={{ ...SERIF, fontSize: '13px', color: c.muted }}>{r.label}</span>
            <span style={{ ...MONO, fontSize: '12px', color: c.text }}>{r.value}</span>
          </div>
        ))}
        <div style={{ ...SERIF, fontSize: '11px', color: c.muted, fontStyle: 'italic', marginTop: '2px' }}>Re-run benchmark for full breakdown</div>
      </div>
    )
  }

  const total = bm.ram_total_mb
  if (!total) return null

  const segs = (bm.process_breakdown ?? []).filter(p => p.mb > 0)
  if (!segs.length) return null

  const cx = 50, cy = 50, R = 38, ri = 24
  const toRad = d => d * Math.PI / 180
  let cursor = -90
  const paths = segs.map(seg => {
    const sweep = (seg.mb / total) * 360
    if (sweep < 0.5) return null
    const s = toRad(cursor), e = toRad(cursor + sweep)
    cursor += sweep
    const x1 = cx + R * Math.cos(s), y1 = cy + R * Math.sin(s)
    const x2 = cx + R * Math.cos(e), y2 = cy + R * Math.sin(e)
    const ix1 = cx + ri * Math.cos(s), iy1 = cy + ri * Math.sin(s)
    const ix2 = cx + ri * Math.cos(e), iy2 = cy + ri * Math.sin(e)
    const large = sweep > 180 ? 1 : 0
    const d = `M${x1.toFixed(2)},${y1.toFixed(2)} A${R},${R} 0 ${large} 1 ${x2.toFixed(2)},${y2.toFixed(2)} L${ix2.toFixed(2)},${iy2.toFixed(2)} A${ri},${ri} 0 ${large} 0 ${ix1.toFixed(2)},${iy1.toFixed(2)}Z`
    return { ...seg, d, color: procColor(seg.name) }
  }).filter(Boolean)
  return (
    <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
      <svg width="90" height="90" viewBox="0 0 100 100" style={{ flexShrink: 0 }}>
        {paths.map(p => <path key={p.name} d={p.d} fill={p.color} />)}
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {segs.map(s => (
          <div key={s.name} style={{ display: 'flex', gap: '7px', alignItems: 'center' }}>
            <div style={{ width: '9px', height: '9px', borderRadius: '2px', background: procColor(s.name), flexShrink: 0 }} />
            <span style={{ ...MONO, fontSize: '11px', color: c.muted }}>{s.name}</span>
            <span style={{ ...MONO, fontSize: '11px', color: c.text, marginLeft: 'auto', paddingLeft: '8px' }}>{fmt(s.mb)}</span>
          </div>
        ))}
        <div style={{ ...SERIF, fontSize: '11px', color: c.muted, marginTop: '3px', borderTop: `1px solid ${c.border}`, paddingTop: '4px' }}>
          Total: {fmt(total)}
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ status }) {
  if (!status) return null
  const ok = status.type === 'success'
  return (
    <div style={{
      padding: '11px 16px', borderRadius: '8px', fontSize: '15px',
      background: ok ? 'rgba(74,222,128,0.08)' : 'rgba(248,113,113,0.08)',
      border: `1px solid ${ok ? 'rgba(74,222,128,0.35)' : 'rgba(248,113,113,0.35)'}`,
      color: ok ? '#4ade80' : '#f87171', ...SERIF,
    }}>
      {status.message}
    </div>
  )
}

function TypeToggle({ value, onChange, c }) {
  const options = [
    { key: 'library',  label: 'Knowledge Library' },
    { key: 'markdown', label: 'Markdown File'      },
  ]
  return (
    <div style={{ display: 'flex', gap: '6px' }}>
      {options.map(o => {
        const active = value === o.key
        return (
          <button key={o.key} onClick={() => onChange(o.key)} style={{
            padding: '7px 14px', borderRadius: '20px', cursor: 'pointer',
            background: active ? c.accent : 'transparent',
            border: `1px solid ${active ? c.accent : c.border}`,
            color: active ? '#fff' : c.muted,
            ...SERIF, fontSize: '14px', transition: 'all 0.15s',
          }}>
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

export default function AdminContent({ c, admin }) {
  const [activeTab, setActiveTab] = useState('library')

  const {
    uploadFile, setUploadFile, uploading, uploadStatus, dragOver, setDragOver, fileInputRef, handleDrop, handleUpload,
    sourceName, setSourceName, content, setContent, docType, setDocType, creating, createStatus, handleCreate,
    rulesContent, setRulesContent, savingRules, rulesStatus, handleSaveRules,
    models, modelsDetailed, activeModel, switchingModel, modelStatus, handleSwitchModel,
    sources, loadingSources, loadSources, deleteSource, fetchSourceContent, saveSourceContent,
    benchmarks, benchmarkRunning, benchmarkError, runBenchmark,
  } = admin

  const [viewingSource, setViewingSource] = useState(null)
  const [sourceChunks, setSourceChunks]   = useState([])
  const [loadingChunks, setLoadingChunks] = useState(false)
  const [editMode, setEditMode]           = useState(false)
  const [editText, setEditText]           = useState('')
  const [saving, setSaving]               = useState(false)
  const [saveStatus, setSaveStatus]       = useState(null)

  async function openSource(name) {
    setViewingSource(name)
    setSourceChunks([])
    setEditMode(false)
    setEditText('')
    setSaveStatus(null)
    setLoadingChunks(true)
    try {
      const chunks = await fetchSourceContent(name)
      setSourceChunks(chunks)
      setEditText(chunks.map(c => c.text).join('\n\n'))
    } catch { setSourceChunks([]) }
    finally { setLoadingChunks(false) }
  }

  function closeModal() {
    setViewingSource(null)
    setEditMode(false)
    setEditText('')
    setSaveStatus(null)
  }

  async function handleSaveEdit() {
    if (!editText.trim() || !viewingSource) return
    setSaving(true); setSaveStatus(null)
    try {
      const count = await saveSourceContent(viewingSource, editText.trim())
      setSaveStatus({ type: 'success', message: `Saved — ${count} chunks re-ingested.` })
      setEditMode(false)
      const chunks = await fetchSourceContent(viewingSource)
      setSourceChunks(chunks)
      loadSources()
    } catch (err) {
      setSaveStatus({ type: 'error', message: err.message })
    } finally { setSaving(false) }
  }

  const [pullInput, setPullInput] = useState('')
  const [copied, setCopied] = useState(false)
  const [tooltipModel, setTooltipModel] = useState(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })
  const tooltipRef = useRef(null)
  const [ramHoverModel, setRamHoverModel] = useState(null)
  const [ramHoverPos, setRamHoverPos] = useState({ x: 0, y: 0 })

  const { diagHistory } = admin

  function modelStats(modelName) {
    const rows = diagHistory.filter(h => h.model === modelName)
    if (rows.length === 0) return null
    const avg = key => {
      const vals = rows.map(r => r[key]).filter(v => v != null)
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
    }
    const fmt = (v, dec = 1) => v != null ? v.toFixed(dec) : '—'
    return {
      requests: rows.length,
      response_ms: fmt(avg('response_ms'), 0),
      tokens_per_sec: fmt(avg('tokens_per_sec')),
      cpu_percent: fmt(avg('cpu_percent')),
      ram_percent: fmt(avg('ram_percent')),
      gpu_percent: avg('gpu_percent') != null ? fmt(avg('gpu_percent')) : null,
    }
  }
  function copyPullCmd() {
    if (!pullInput.trim()) return
    navigator.clipboard.writeText(`ollama pull ${pullInput.trim()}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const inputStyle = {
    background: c.input, border: `1px solid ${c.border}`, borderRadius: '8px',
    padding: '12px 16px', color: c.text, fontSize: '15px', outline: 'none',
    fontFamily: 'system-ui', width: '100%', boxSizing: 'border-box',
  }

  const btnStyle = (disabled) => ({
    background: disabled ? 'transparent' : c.accent,
    border: `1px solid ${disabled ? c.border : c.accent}`,
    borderRadius: '8px', padding: '11px 22px',
    color: disabled ? c.muted : '#fff',
    cursor: disabled ? 'not-allowed' : 'pointer',
    ...SERIF, fontSize: '16px', transition: 'background 0.15s',
  })

  const saveDisabled = !sourceName.trim() || !content.trim() || creating

  const TABS = ['library', 'models']

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: '4px', borderBottom: `1px solid ${c.border}`, paddingBottom: '0' }}>
        {TABS.map(t => {
          const active = activeTab === t
          return (
            <button key={t} onClick={() => setActiveTab(t)} style={{
              ...MONO_U, fontSize: '11px', padding: '10px 20px',
              background: 'none', border: 'none', cursor: 'pointer',
              color: active ? c.accent : c.muted,
              borderBottom: `2px solid ${active ? c.accent : 'transparent'}`,
              marginBottom: '-1px', transition: 'color 0.15s, border-color 0.15s',
            }}>
              {t === 'library' ? 'Library' : 'Models'}
            </button>
          )
        })}
      </div>

      {activeTab === 'library' && <>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>

        {/* Upload file */}
        <div style={{ background: c.botBubble ?? c.input, border: `1px solid ${c.border}`, borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <div style={{ ...MONO_U, fontSize: '11px', color: c.accent, marginBottom: '8px' }}>Upload file</div>
            <div style={{ ...SERIF, fontSize: '15px', color: c.text }}>Add a .md or .txt file to the knowledge library</div>
          </div>

          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            style={{
              border: `2px dashed ${dragOver ? c.accent : uploadFile ? 'rgba(74,222,128,0.5)' : c.border}`,
              borderRadius: '10px', padding: '32px 20px', textAlign: 'center',
              cursor: 'pointer', transition: 'border-color 0.2s',
              background: dragOver ? `${c.accent}10` : 'transparent',
            }}>
            {uploadFile ? (
              <>
                <div style={{ fontSize: '26px', marginBottom: '10px' }}>📄</div>
                <div style={{ ...SERIF, fontSize: '16px', color: c.text }}>{uploadFile.name}</div>
                <div style={{ ...SERIF, fontSize: '14px', color: c.muted, marginTop: '4px' }}>{(uploadFile.size / 1024).toFixed(1)} KB</div>
              </>
            ) : (
              <>
                <div style={{ ...SERIF, fontSize: '16px', color: c.text }}>Drop a file here or click to browse</div>
                <div style={{ ...SERIF, fontSize: '14px', color: c.muted, marginTop: '6px', fontStyle: 'italic' }}>.md and .txt only</div>
              </>
            )}
          </div>
          <input ref={fileInputRef} type="file" accept=".md,.txt" style={{ display: 'none' }}
            onChange={e => setUploadFile(e.target.files[0] ?? null)} />

          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={handleUpload} disabled={!uploadFile || uploading} style={btnStyle(!uploadFile || uploading)}>
              {uploading ? 'Uploading...' : 'Upload & ingest'}
            </button>
            {uploadFile && (
              <button onClick={() => setUploadFile(null)} style={{ background: 'none', border: `1px solid ${c.border}`, borderRadius: '8px', padding: '11px 16px', color: c.text, cursor: 'pointer', ...SERIF, fontSize: '16px' }}>
                Clear
              </button>
            )}
          </div>
          <StatusBadge status={uploadStatus} />
        </div>

        {/* Create document / Rules */}
        <div style={{ background: c.botBubble ?? c.input, border: `1px solid ${c.border}`, borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <div style={{ ...MONO_U, fontSize: '11px', color: c.accent, marginBottom: '8px' }}>Document</div>
            <TypeToggle value={docType} onChange={setDocType} c={c} />
          </div>

          {docType === 'library' ? (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <div style={{ ...SERIF, fontSize: '15px', color: c.text, marginBottom: '7px' }}>Document name</div>
                  <input value={sourceName} onChange={e => setSourceName(e.target.value)} placeholder="e.g. my-notes" style={inputStyle}
                    onFocus={e => e.target.style.borderColor = c.accent}
                    onBlur={e => e.target.style.borderColor = c.border} />
                  <div style={{ ...SERIF, fontSize: '13px', color: c.muted, marginTop: '5px', fontStyle: 'italic' }}>Letters, numbers, hyphens, underscores only</div>
                </div>
                <div>
                  <div style={{ ...SERIF, fontSize: '15px', color: c.text, marginBottom: '7px' }}>Content</div>
                  <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Write your markdown here..." rows={7}
                    style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
                    onFocus={e => e.target.style.borderColor = c.accent}
                    onBlur={e => e.target.style.borderColor = c.border} />
                </div>
              </div>
              <button onClick={handleCreate} disabled={saveDisabled} style={btnStyle(saveDisabled)}>
                {creating ? 'Saving...' : 'Save & ingest'}
              </button>
              <StatusBadge status={createStatus} />
            </>
          ) : (
            <>
              <div>
                <div style={{ ...SERIF, fontSize: '15px', color: c.text, marginBottom: '4px' }}>Milo Rules</div>
                <div style={{ ...SERIF, fontSize: '13px', color: c.muted, fontStyle: 'italic' }}>Write rules here and Milo will follow them in every conversation.</div>
              </div>
              <textarea
                value={rulesContent}
                onChange={e => setRulesContent(e.target.value)}
                placeholder={'Always respond concisely.\nNever break character.\nAlways greet users by name.'}
                rows={10}
                style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
                onFocus={e => e.target.style.borderColor = c.accent}
                onBlur={e => e.target.style.borderColor = c.border}
              />
              <button onClick={handleSaveRules} disabled={savingRules} style={btnStyle(savingRules)}>
                {savingRules ? 'Saving...' : 'Save rules'}
              </button>
              <StatusBadge status={rulesStatus} />
            </>
          )}
        </div>
      </div>

      {/* Sources */}
      <div style={{ background: c.botBubble ?? c.input, border: `1px solid ${c.border}`, borderRadius: '12px', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <div style={{ ...MONO_U, fontSize: '11px', color: c.accent, marginBottom: '6px' }}>Knowledge library</div>
            <div style={{ ...SERIF, fontSize: '15px', color: c.text }}>{sources.length} source{sources.length !== 1 ? 's' : ''} in the database</div>
          </div>
          <button onClick={loadSources} disabled={loadingSources} style={{ background: 'none', border: `1px solid ${c.border}`, borderRadius: '6px', padding: '7px 16px', color: c.text, cursor: 'pointer', ...SERIF, fontSize: '15px' }}>
            {loadingSources ? 'Loading...' : 'Refresh'}
          </button>
        </div>
        {sources.length === 0 ? (
          <div style={{ ...SERIF, fontSize: '15px', color: c.muted, fontStyle: 'italic' }}>No sources ingested yet.</div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {sources.map(s => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: `${c.accent}15`, border: `1px solid ${c.accent}40`, borderRadius: '6px', padding: '6px 10px 6px 14px', ...SERIF, fontSize: '15px', color: c.accent }}>
                <span
                  onClick={() => openSource(s)}
                  title="Click to view content"
                  style={{ cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: '3px', textDecorationStyle: 'dotted' }}>
                  {s}
                </span>
                <button
                  onClick={() => deleteSource(s)}
                  title={`Remove "${s}" from library`}
                  style={{ background: 'none', border: 'none', color: c.accent, cursor: 'pointer', fontSize: '16px', lineHeight: 1, padding: '0 2px', opacity: 0.6, transition: 'opacity 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                  onMouseLeave={e => e.currentTarget.style.opacity = '0.6'}>
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      </>}

      {activeTab === 'models' && <>

        {/* Model selector */}
        <div style={{ background: c.botBubble ?? c.input, border: `1px solid ${c.border}`, borderRadius: '12px', padding: '20px 24px', display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
          <div style={{ ...MONO_U, fontSize: '10px', color: c.muted, flexShrink: 0 }}>Active model</div>
          {modelsDetailed.length === 0 ? (
            <div style={{ ...SERIF, fontSize: '14px', color: c.muted, fontStyle: 'italic' }}>No models found — make sure Ollama is running.</div>
          ) : (
            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
              <select
                value={activeModel || ''}
                onChange={e => handleSwitchModel(e.target.value)}
                disabled={switchingModel}
                style={{ ...MONO, fontSize: '14px', background: c.input, border: `1px solid ${c.accent}`, borderRadius: '8px', padding: '9px 36px 9px 14px', color: c.accent, cursor: switchingModel ? 'wait' : 'pointer', outline: 'none', appearance: 'none', WebkitAppearance: 'none' }}
              >
                {modelsDetailed.map(m => (
                  <option key={m.name} value={m.name} style={{ background: '#1a1a2e', color: c.text }}>
                    {m.name}  ·  {m.size_gb} GB  ·  {m.params}
                  </option>
                ))}
              </select>
              <span style={{ position: 'absolute', right: '12px', pointerEvents: 'none', color: c.accent, fontSize: '10px' }}>▾</span>
            </div>
          )}
          {switchingModel && <div style={{ ...SERIF, fontSize: '13px', color: c.muted, fontStyle: 'italic' }}>Switching…</div>}
          {modelStatus && <div style={{ ...SERIF, fontSize: '13px', color: modelStatus.type === 'success' ? '#4ade80' : '#f87171' }}>{modelStatus.message}</div>}
        </div>

        {/* Diagnostics */}
        <DiagnosticsPanel c={c} activeModel={activeModel} />

        {/* Pull a model */}
        <div style={{ background: c.botBubble ?? c.input, border: `1px solid ${c.border}`, borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <div style={{ ...MONO_U, fontSize: '11px', color: c.accent, marginBottom: '6px' }}>Pull a model</div>
            <div style={{ ...SERIF, fontSize: '15px', color: c.text }}>Enter a model name to get the terminal command to download it</div>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <input value={pullInput} onChange={e => setPullInput(e.target.value)} placeholder="e.g. qwen2.5:7b"
              style={{ flex: 1, minWidth: '180px', background: c.input, border: `1px solid ${c.border}`, borderRadius: '8px', padding: '11px 14px', color: c.text, fontSize: '15px', outline: 'none', fontFamily: 'system-ui' }}
              onFocus={e => e.target.style.borderColor = c.accent}
              onBlur={e => e.target.style.borderColor = c.border} />
            <button onClick={copyPullCmd} disabled={!pullInput.trim()} style={{
              background: !pullInput.trim() ? 'transparent' : c.accent,
              border: `1px solid ${!pullInput.trim() ? c.border : c.accent}`,
              borderRadius: '8px', padding: '11px 20px', color: !pullInput.trim() ? c.muted : '#fff',
              cursor: !pullInput.trim() ? 'not-allowed' : 'pointer', ...SERIF, fontSize: '15px',
            }}>
              {copied ? 'Copied!' : 'Copy command'}
            </button>
          </div>
          {pullInput.trim() && (
            <code style={{ ...MONO, fontSize: '14px', color: c.accent, background: `${c.accent}10`, padding: '10px 16px', borderRadius: '8px', display: 'block' }}>
              ollama pull {pullInput.trim()}
            </code>
          )}
          <div style={{ ...SERIF, fontSize: '14px', color: c.muted, fontStyle: 'italic' }}>
            Run the command in your terminal. Once complete, refresh this page and the model will appear above.
          </div>
        </div>

        {/* Recommendations table */}
        <div style={{ background: c.botBubble ?? c.input, border: `1px solid ${c.border}`, borderRadius: '12px', padding: '24px' }}>
          <div style={{ ...MONO_U, fontSize: '11px', color: c.accent, marginBottom: '6px' }}>Model comparison</div>
          <div style={{ ...SERIF, fontSize: '14px', color: c.muted, marginBottom: '16px' }}>
            Currently active: <span style={{ color: c.accent }}>{activeModel || '—'}</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', ...SERIF, fontSize: '14px' }}>
              <thead>
                <tr>
                  {['Model', 'VRAM', 'Download', '~Tok/s (GPU)', 'Context', 'Cutoff', 'Actual Tok/s', 'CPU %', 'RAM', 'Accuracy', '', 'Notes'].map(h => (
                    <th key={h} style={{ ...MONO_U, fontSize: '9px', color: c.muted, textAlign: 'left', padding: '6px 14px 10px 0', borderBottom: `1px solid ${c.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {RECOMMENDED.map(({ model, vram, dl, tps, ctx, cut, note, best }) => {
                  const isCurrent    = model === activeModel
                  const stats        = modelStats(model)
                  const bm           = benchmarks[model]
                  const isInstalled  = models.includes(model)
                  const isRunning    = benchmarkRunning === model
                  const hasError     = benchmarkError?.model === model
                  const tdBase       = { padding: '10px 14px 10px 0', borderBottom: `1px solid ${c.border}`, whiteSpace: 'nowrap' }
                  return (
                    <tr key={model}
                      style={{ background: isCurrent ? `${c.accent}0d` : best ? 'rgba(74,222,128,0.04)' : 'transparent' }}
                      onMouseEnter={e => { if (stats) { setTooltipModel(model); setTooltipPos({ x: e.clientX, y: e.clientY }) } }}
                      onMouseMove={e => { if (stats) setTooltipPos({ x: e.clientX, y: e.clientY }) }}
                      onMouseLeave={() => setTooltipModel(null)}>
                      <td style={tdBase}>
                        <code style={{ ...MONO, fontSize: '13px', color: isCurrent ? c.accent : best ? '#4ade80' : c.text }}>{model}</code>
                        {isCurrent && <span style={{ ...MONO_U, fontSize: '8px', color: c.accent, marginLeft: '8px' }}>active</span>}
                        {best && !isCurrent && <span style={{ ...MONO_U, fontSize: '8px', color: '#4ade80', marginLeft: '8px' }}>recommended</span>}
                        {stats && <span style={{ ...MONO_U, fontSize: '8px', color: c.muted, marginLeft: '8px' }}>{stats.requests} req</span>}
                      </td>
                      <td style={{ ...tdBase, color: c.text }}>{vram}</td>
                      <td style={{ ...tdBase, color: c.text }}>{dl}</td>
                      <td style={{ ...tdBase, color: c.text }}>{tps}</td>
                      <td style={{ ...tdBase, color: c.text }}>{ctx}</td>
                      <td style={{ ...tdBase, color: cut.includes('2024') ? '#4ade80' : c.muted }}>{cut}</td>

                      {/* Measured tok/s */}
                      <td style={{ ...tdBase, color: bm ? '#4ade80' : c.muted }}>
                        {bm ? `${bm.tokens_per_sec ?? '—'} t/s` : '—'}
                      </td>

                      {/* Measured CPU */}
                      <td style={{ ...tdBase, color: bm ? c.text : c.muted }}>
                        {bm ? `${bm.cpu_percent}%` : '—'}
                      </td>

                      {/* Measured RAM — hover for pie breakdown */}
                      <td
                        style={{ ...tdBase, color: bm ? c.text : c.muted, cursor: bm?.ram_total_mb ? 'default' : 'default' }}
                        onMouseEnter={e => { if (bm) { setRamHoverModel(model); setRamHoverPos({ x: e.clientX, y: e.clientY }) } }}
                        onMouseMove={e => { if (bm) setRamHoverPos({ x: e.clientX, y: e.clientY }) }}
                        onMouseLeave={() => setRamHoverModel(null)}
                      >
                        {bm ? `${bm.ram_percent}% (${bm.ram_delta_mb > 0 ? `+${bm.ram_delta_mb}MB` : '~0MB'})` : '—'}
                      </td>

                      {/* Accuracy */}
                      <td style={{ ...tdBase, color: bm ? (bm.accuracy === bm.accuracy_total ? '#4ade80' : bm.accuracy > 0 ? '#fbbf24' : '#f87171') : c.muted }}>
                        {bm ? `${bm.accuracy}/${bm.accuracy_total}` : '—'}
                      </td>

                      {/* Run button */}
                      <td style={{ ...tdBase }}>
                        {!isInstalled ? (
                          <span style={{ ...MONO_U, fontSize: '8px', color: c.muted }}>not installed</span>
                        ) : isRunning ? (
                          <span style={{ ...MONO_U, fontSize: '8px', color: c.accent }}>running…</span>
                        ) : (
                          <button
                            onClick={() => runBenchmark(model)}
                            style={{
                              ...MONO, fontSize: '12px', padding: '4px 12px', borderRadius: '6px',
                              background: 'transparent', border: `1px solid ${hasError ? '#f87171' : c.border}`,
                              color: hasError ? '#f87171' : c.text, cursor: 'pointer',
                            }}
                            title={hasError ? benchmarkError.message : bm ? 'Re-run benchmark' : 'Run benchmark'}
                          >
                            {hasError ? 'failed' : bm ? 'Re-run' : 'Run'}
                          </button>
                        )}
                      </td>

                      {/* Notes */}
                      <td style={{ ...tdBase, color: c.muted, fontStyle: 'italic' }}>{note}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div style={{ ...SERIF, fontSize: '13px', color: c.muted, fontStyle: 'italic', marginTop: '10px' }}>
              Estimated columns (VRAM, ~Tok/s, Context) are reference values for a mid-range GPU. Measured columns come from running a benchmark on your hardware. RAM shows system-wide % used and the delta from loading the model. Accuracy is 3 factual questions. Run benchmarks one at a time for accurate CPU/RAM readings.
            </div>
          </div>
        </div>

        {/* Efficiency tips */}
        <div style={{ background: c.botBubble ?? c.input, border: `1px solid ${c.border}`, borderRadius: '12px', padding: '24px' }}>
          <div style={{ ...MONO_U, fontSize: '11px', color: c.accent, marginBottom: '14px' }}>Efficiency tips</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[
              { tip: 'Switch to a quantized model', cmd: 'ollama pull llama3.1:8b-q4_K_M', detail: 'Cuts VRAM from ~8 GB to ~5 GB with minimal quality loss. Run in terminal then update OLLAMA_MODEL in main.py.' },
              { tip: 'keep_alive is active', cmd: null, detail: 'Model stays loaded in VRAM for 10 min between requests — cold-start cost already eliminated.', done: true },
              { tip: 'num_ctx is set to 4096', cmd: null, detail: 'Context window capped at 4K tokens, reducing VRAM pressure without affecting typical conversations.', done: true },
              { tip: 'Monitor VRAM closely', cmd: 'nvidia-smi', detail: 'If VRAM used ≈ VRAM total the model spills into RAM and generation speed drops sharply.' },
            ].map(({ tip, cmd, detail, done }) => (
              <div key={tip} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <div style={{ width: '18px', height: '18px', borderRadius: '50%', border: `1px solid ${done ? '#4ade80' : c.border}`, background: done ? 'rgba(74,222,128,0.12)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '2px' }}>
                  {done && <span style={{ color: '#4ade80', fontSize: '11px' }}>✓</span>}
                </div>
                <div>
                  <div style={{ ...SERIF, fontSize: '15px', color: done ? '#4ade80' : c.text }}>{tip}</div>
                  <div style={{ ...SERIF, fontSize: '14px', color: c.text, marginTop: '2px' }}>{detail}</div>
                  {cmd && <code style={{ ...MONO, fontSize: '12px', color: c.accent, background: `${c.accent}12`, padding: '2px 8px', borderRadius: '4px', display: 'inline-block', marginTop: '4px' }}>{cmd}</code>}
                </div>
              </div>
            ))}
          </div>
        </div>

      </>}

      {/* Model stats tooltip */}
      {tooltipModel && (() => {
        const stats = modelStats(tooltipModel)
        if (!stats) return null
        return (
          <div ref={tooltipRef} style={{
            position: 'fixed', left: tooltipPos.x + 16, top: tooltipPos.y - 8,
            background: c.sidebar ?? '#1a1a2e', border: `1px solid ${c.border}`,
            borderRadius: '10px', padding: '12px 16px', zIndex: 2000,
            display: 'flex', flexDirection: 'column', gap: '6px',
            pointerEvents: 'none', minWidth: '200px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          }}>
            <div style={{ ...MONO_U, fontSize: '9px', color: c.accent, marginBottom: '2px' }}>{tooltipModel}</div>
            {[
              { label: 'Avg response', value: stats.response_ms, unit: 'ms' },
              { label: 'Avg tok/s', value: stats.tokens_per_sec, unit: 'tok/s' },
              { label: 'Avg CPU', value: stats.cpu_percent, unit: '%' },
              { label: 'Avg RAM', value: stats.ram_percent, unit: '%' },
              ...(stats.gpu_percent != null ? [{ label: 'Avg GPU', value: stats.gpu_percent, unit: '%' }] : []),
            ].map(({ label, value, unit }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: '20px' }}>
                <span style={{ ...SERIF, fontSize: '13px', color: c.muted }}>{label}</span>
                <span style={{ ...MONO, fontSize: '13px', color: c.text }}>{value} <span style={{ color: c.muted }}>{unit}</span></span>
              </div>
            ))}
            <div style={{ ...SERIF, fontSize: '11px', color: c.muted, fontStyle: 'italic', marginTop: '2px', borderTop: `1px solid ${c.border}`, paddingTop: '6px' }}>
              Based on {stats.requests} request{stats.requests !== 1 ? 's' : ''}
            </div>
          </div>
        )
      })()}

      {/* RAM pie tooltip */}
      {ramHoverModel && benchmarks[ramHoverModel] && (
        <div style={{
          position: 'fixed', left: ramHoverPos.x + 16, top: ramHoverPos.y - 60,
          background: c.sidebar ?? '#1a1a2e', border: `1px solid ${c.border}`,
          borderRadius: '10px', padding: '14px 16px', zIndex: 2000,
          pointerEvents: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        }}>
          <div style={{ ...MONO_U, fontSize: '9px', color: c.accent, marginBottom: '10px' }}>RAM breakdown</div>
          <RamDonut bm={benchmarks[ramHoverModel]} c={c} />
        </div>
      )}

      {/* Source content modal */}
      {viewingSource && (
        <div
          onClick={closeModal}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '32px' }}>
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: c.sidebar ?? '#1a1a2e', border: `1px solid ${c.border}`, borderRadius: '14px', width: '100%', maxWidth: '720px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: `1px solid ${c.border}` }}>
              <div>
                <div style={{ ...MONO_U, fontSize: '10px', color: c.muted, marginBottom: '4px' }}>Knowledge library</div>
                <div style={{ ...MONO, fontSize: '16px', color: c.accent }}>{viewingSource}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {!loadingChunks && (
                  <button
                    onClick={() => { setEditMode(v => !v); setSaveStatus(null) }}
                    style={{ ...SERIF, fontSize: '14px', padding: '6px 16px', borderRadius: '8px', cursor: 'pointer', background: editMode ? c.accent : 'transparent', border: `1px solid ${editMode ? c.accent : c.border}`, color: editMode ? '#fff' : c.text, transition: 'all 0.15s' }}>
                    {editMode ? 'View' : 'Edit'}
                  </button>
                )}
                <button onClick={closeModal} style={{ background: 'none', border: 'none', color: c.muted, fontSize: '22px', cursor: 'pointer', lineHeight: 1, padding: '0 4px' }}>×</button>
              </div>
            </div>

            {/* Body */}
            <div style={{ overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
              {loadingChunks ? (
                <div style={{ ...SERIF, fontSize: '15px', color: c.muted, fontStyle: 'italic' }}>Loading…</div>
              ) : editMode ? (
                <textarea
                  value={editText}
                  onChange={e => setEditText(e.target.value)}
                  style={{ ...SERIF, fontSize: '14px', color: c.text, background: `${c.accent}08`, border: `1px solid ${c.border}`, borderRadius: '8px', padding: '14px 16px', lineHeight: 1.7, resize: 'vertical', minHeight: '320px', outline: 'none', width: '100%', boxSizing: 'border-box' }}
                  onFocus={e => e.target.style.borderColor = c.accent}
                  onBlur={e => e.target.style.borderColor = c.border}
                />
              ) : sourceChunks.length === 0 ? (
                <div style={{ ...SERIF, fontSize: '15px', color: c.muted, fontStyle: 'italic' }}>No content found.</div>
              ) : sourceChunks.map((chunk, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                    <div style={{ ...MONO_U, fontSize: '9px', color: c.muted, flexShrink: 0 }}>Chunk {chunk.index + 1}</div>
                    {chunk.topic && <div style={{ ...SERIF, fontSize: '12px', color: c.accent, fontStyle: 'italic' }}>{chunk.topic}</div>}
                  </div>
                  <div style={{ ...SERIF, fontSize: '14px', color: c.text, lineHeight: 1.7, whiteSpace: 'pre-wrap', background: `${c.accent}08`, border: `1px solid ${c.border}`, borderRadius: '8px', padding: '12px 16px' }}>
                    {chunk.text}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div style={{ padding: '12px 24px', borderTop: `1px solid ${c.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              <div style={{ ...SERIF, fontSize: '13px', color: c.muted, fontStyle: 'italic' }}>
                {editMode ? 'Saving re-ingests the document' : `${sourceChunks.length} chunk${sourceChunks.length !== 1 ? 's' : ''} · Click outside to close`}
              </div>
              {editMode && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {saveStatus && (
                    <div style={{ ...SERIF, fontSize: '13px', color: saveStatus.type === 'success' ? '#4ade80' : '#f87171' }}>{saveStatus.message}</div>
                  )}
                  <button
                    onClick={handleSaveEdit}
                    disabled={saving || !editText.trim()}
                    style={{ ...SERIF, fontSize: '14px', padding: '7px 20px', borderRadius: '8px', cursor: saving ? 'wait' : 'pointer', background: (!editText.trim() || saving) ? 'transparent' : c.accent, border: `1px solid ${(!editText.trim() || saving) ? c.border : c.accent}`, color: (!editText.trim() || saving) ? c.muted : '#fff', transition: 'all 0.15s' }}>
                    {saving ? 'Saving…' : 'Save & re-ingest'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
