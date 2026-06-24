import { useState, useEffect, useRef } from 'react'

const BACKEND = 'http://localhost:8000'

const SERIF  = { fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 300 }
const MONO_U = { fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 200, letterSpacing: '3px', textTransform: 'uppercase' }
const MONO   = { fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 300 }

const THEORY_METRICS = [
  { key: 'ingestion_time_s',     label: 'Ingest (s)',  color: '#818cf8', raw: false },
  { key: 'chunk_count',          label: 'Chunks',      color: '#f59e0b', raw: false },
  { key: 'avg_query_latency_ms', label: 'Query (s)',   color: '#34d399', raw: false },
  { key: 'accuracy_pct',         label: 'Accuracy %',  color: '#f472b6', raw: true  },
]

const REALITY_METRICS = THEORY_METRICS.filter(m => m.key !== 'accuracy_pct')
const CVE_METRICS     = THEORY_METRICS

function fmtTime(s) {
  if (s == null) return '—'
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const rem = Math.round(s % 60)
  return rem > 0 ? `${m}m ${rem}s` : `${m}m`
}

function BenchmarkChart({ results, metrics, c }) {
  const [hovered, setHovered] = useState(null)
  const [cursorY, setCursorY] = useState(null)
  const svgRef = useRef(null)

  const valid = results.filter(r => !r.error && r.pages != null)
  if (valid.length < 2) return null
  const sorted = [...valid].sort((a, b) => a.pages - b.pages)

  const W = 580, H = 260
  const PAD = { top: 24, right: 24, bottom: 44, left: 58 }
  const plotW = W - PAD.left - PAD.right
  const plotH = H - PAD.top - PAD.bottom

  const pages  = sorted.map(r => r.pages)
  const logMin = Math.log10(Math.min(...pages))
  const logMax = Math.log10(Math.max(...pages))
  const xOf    = p => PAD.left + ((Math.log10(p) - logMin) / ((logMax - logMin) || 1)) * plotW
  const maxOf  = key => Math.max(...sorted.map(r => r[key] ?? 0), 0.001)
  const yOf    = (val, m) => {
    const pct = m.raw ? val : (val / maxOf(m.key)) * 100
    return PAD.top + plotH - (Math.max(0, Math.min(100, pct)) / 100) * plotH
  }

  function fmtVal(key, val) {
    if (val == null) return '—'
    if (key === 'ingestion_time_s') {
      if (val < 60) return `${val < 10 ? val.toFixed(1) : Math.round(val)}s`
      const mins = Math.floor(val / 60), rem = Math.round(val % 60)
      return rem > 0 ? `${mins}m ${rem}s` : `${mins}m`
    }
    if (key === 'avg_query_latency_ms') return `${(val / 1000).toFixed(2)}s`
    if (key === 'accuracy_pct') return `${Math.round(val)}%`
    if (key === 'chunk_count') return val >= 1000 ? `${(val / 1000).toFixed(1)}k` : String(Math.round(val))
    return String(val)
  }

  function handleMouseMove(e) {
    if (!svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    setCursorY((e.clientY - rect.top) / rect.height * H)
  }

  // Find which metric line the cursor is nearest to vertically at the hovered column
  let activeMetric = null
  if (hovered != null && cursorY != null) {
    let minDist = Infinity
    for (const m of metrics) {
      const val = sorted[hovered]?.[m.key]
      if (val == null) continue
      const dist = Math.abs(yOf(val, m) - cursorY)
      if (dist < minDist) { minDist = dist; activeMetric = m }
    }
  }

  // Y-axis ticks: actual units for the nearest metric when hovering, normalized % otherwise
  const yTicks = activeMetric
    ? [0, 0.25, 0.5, 0.75, 1].map(frac => ({
        pct: frac * 100,
        label: fmtVal(activeMetric.key, activeMetric.raw ? frac * 100 : frac * maxOf(activeMetric.key)),
      }))
    : [0, 25, 50, 75, 100].map(pct => ({ pct, label: `${pct}%` }))

  const hovR = hovered != null ? sorted[hovered] : null
  const hovX = hovR ? xOf(hovR.pages) : 0
  const TW   = 158
  const TH   = 22 + metrics.length * 20 + 6
  const tipX = hovX + TW + 14 > W - PAD.right ? hovX - TW - 10 : hovX + 10
  const tipY = PAD.top + 4

  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`}
      style={{ width: '100%', height: 'auto', overflow: 'visible' }}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => { setHovered(null); setCursorY(null) }}>

      {/* grid + dynamic Y-axis */}
      {yTicks.map(({ pct, label }) => {
        const y = PAD.top + plotH - (pct / 100) * plotH
        return (
          <g key={pct}>
            <line x1={PAD.left} y1={y} x2={PAD.left + plotW} y2={y}
              stroke={activeMetric ? `${activeMetric.color}28` : c.border}
              strokeWidth={pct === 0 ? 1 : 0.5}
              strokeDasharray={pct === 0 ? undefined : '3,4'} />
            <text x={PAD.left - 6} y={y + 4} textAnchor="end"
              fill={activeMetric ? activeMetric.color : c.muted}
              fontSize={9} fontFamily="Inter, sans-serif">{label}</text>
          </g>
        )
      })}
      <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + plotH}
        stroke={activeMetric ? activeMetric.color : c.border} strokeWidth={activeMetric ? 1.5 : 1} />

      {/* hover crosshair */}
      {hovR && (
        <line x1={hovX.toFixed(1)} y1={PAD.top} x2={hovX.toFixed(1)} y2={PAD.top + plotH}
          stroke={c.muted} strokeWidth={1} strokeDasharray="3,3" opacity={0.4} />
      )}

      {/* lines + circles — dim non-active metrics */}
      {metrics.map(m => {
        const isActive = !activeMetric || activeMetric.key === m.key
        const pts = sorted.filter(r => r[m.key] != null)
          .map(r => ({ x: xOf(r.pages), y: yOf(r[m.key], m), i: sorted.indexOf(r) }))
        if (pts.length < 2) return null
        const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
        return (
          <g key={m.key} opacity={isActive ? 1 : 0.2}>
            <path d={d} fill="none" stroke={m.color} strokeWidth={2.5} strokeLinejoin="round" opacity={0.9} />
            {pts.map(p => (
              <circle key={p.i} cx={p.x.toFixed(1)} cy={p.y.toFixed(1)}
                r={hovered === p.i && isActive ? 6 : 4}
                fill={m.color} stroke={c.sidebar ?? '#1a1a2e'} strokeWidth={1.5} />
            ))}
          </g>
        )
      })}

      {/* x-axis */}
      {sorted.map(r => {
        const x = xOf(r.pages).toFixed(1)
        return (
          <g key={r.pages}>
            <line x1={x} y1={PAD.top + plotH} x2={x} y2={PAD.top + plotH + 4} stroke={c.border} strokeWidth={1} />
            <text x={x} y={H - 6} textAnchor="middle" fill={c.muted} fontSize={9} fontFamily="Inter, sans-serif">
              {r.pages}
            </text>
          </g>
        )
      })}
      <text x={PAD.left + plotW / 2} y={H - 1} textAnchor="middle"
        fill={c.muted} fontSize={8} fontFamily="Inter, sans-serif" letterSpacing="2">
        PAGES (log scale)
      </text>

      {/* invisible hit areas */}
      {sorted.map((r, i) => {
        const x       = xOf(r.pages)
        const leftHw  = i > 0 ? (x - xOf(sorted[i - 1].pages)) / 2 : 28
        const rightHw = i < sorted.length - 1 ? (xOf(sorted[i + 1].pages) - x) / 2 : 28
        const hw      = Math.min(leftHw, rightHw, 28)
        return (
          <rect key={i}
            x={(x - hw).toFixed(1)} y={PAD.top}
            width={(hw * 2).toFixed(1)} height={plotH}
            fill="transparent" style={{ cursor: 'crosshair' }}
            onMouseEnter={() => setHovered(i)} />
        )
      })}

      {/* tooltip */}
      {hovR && (
        <g style={{ pointerEvents: 'none' }}>
          <rect x={tipX} y={tipY} width={TW} height={TH} rx={6} ry={6}
            fill={c.sidebar ?? '#1a1a2e'}
            stroke={activeMetric ? activeMetric.color : c.border}
            strokeWidth={1} opacity={0.97} />
          <text x={tipX + 10} y={tipY + 15}
            fill={c.text} fontSize={10} fontWeight={600} fontFamily="Inter, sans-serif">
            {hovR.pages} pages
          </text>
          {metrics.map((m, mi) => {
            const isActive = !activeMetric || activeMetric.key === m.key
            return (
              <g key={m.key} opacity={isActive ? 1 : 0.4}>
                <rect x={tipX + 10} y={tipY + 24 + mi * 20} width={8} height={8} rx={2} fill={m.color} />
                <text x={tipX + 24} y={tipY + 32 + mi * 20}
                  fill={c.muted} fontSize={9} fontFamily="Inter, sans-serif">{m.label}</text>
                <text x={tipX + TW - 8} y={tipY + 32 + mi * 20}
                  textAnchor="end"
                  fill={isActive ? m.color : c.text}
                  fontSize={isActive ? 10 : 9} fontWeight={500} fontFamily="Inter, sans-serif">
                  {fmtVal(m.key, hovR[m.key])}
                </text>
              </g>
            )
          })}
        </g>
      )}
    </svg>
  )
}

export default function PDFBenchmarkPanel({ c }) {
  const [mode, setMode] = useState('theory')

  // Theory state
  const [status, setStatus]           = useState('idle')
  const [progress, setProgress]       = useState(0)
  const [currentTest, setCurrentTest] = useState(null)
  const [results, setResults]         = useState([])
  const [startError, setStartError]   = useState(null)

  // Reality state
  const [realStatus, setRealStatus]           = useState('idle')
  const [realCurrentTest, setRealCurrentTest] = useState(null)
  const [realResults, setRealResults]         = useState([])
  const [realFiles, setRealFiles]             = useState([])
  const [selectedFile, setSelectedFile]       = useState(null)
  const [realError, setRealError]             = useState(null)
  const [uploading, setUploading]             = useState(false)

  // CVE state
  const [cveStatus, setCveStatus]           = useState('idle')
  const [cveProgress, setCveProgress]       = useState(0)
  const [cveCurrentTest, setCveCurrentTest] = useState(null)
  const [cveResults, setCveResults]         = useState([])
  const [cveError, setCveError]             = useState(null)

  const pollRef      = useRef(null)
  const realPollRef  = useRef(null)
  const cvePollRef   = useRef(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    fetch(`${BACKEND}/admin/benchmark/pdf/status`)
      .then(r => r.json())
      .then(data => {
        if (data.status === 'running') {
          setStatus('running'); setProgress(data.progress ?? 0)
          setCurrentTest(data.current_test); setResults(data.results ?? [])
        } else if ((data.status === 'done' || data.status === 'cancelled') && data.results?.length) {
          setStatus(data.status); setResults(data.results)
          setProgress(data.progress ?? data.results.length)
        }
      }).catch(() => {})

    fetch(`${BACKEND}/admin/benchmark/real/status`)
      .then(r => r.json())
      .then(data => {
        if (data.status === 'running') {
          setRealStatus('running'); setRealCurrentTest(data.current_test)
          setRealResults(data.results ?? [])
        } else if (data.status === 'done' && data.results?.length) {
          setRealStatus('done'); setRealResults(data.results)
        }
      }).catch(() => {})

    fetch(`${BACKEND}/admin/benchmark/cve/status`)
      .then(r => r.json())
      .then(data => {
        if (data.status === 'running') {
          setCveStatus('running'); setCveProgress(data.progress ?? 0)
          setCveCurrentTest(data.current_test); setCveResults(data.results ?? [])
        } else if ((data.status === 'done' || data.status === 'cancelled') && data.results?.length) {
          setCveStatus(data.status); setCveResults(data.results)
          setCveProgress(data.progress ?? data.results.length)
        }
      }).catch(() => {})

    loadRealFiles()
  }, [])

  function loadRealFiles() {
    fetch(`${BACKEND}/admin/benchmark/real/list`)
      .then(r => r.json())
      .then(data => {
        const files = data.files ?? []
        setRealFiles(files)
        setSelectedFile(prev => {
          if (prev && files.find(f => f.filename === prev)) return prev
          return files[0]?.filename ?? null
        })
      })
      .catch(() => {})
  }

  useEffect(() => {
    if (status !== 'running') return
    pollRef.current = setInterval(async () => {
      try {
        const data = await fetch(`${BACKEND}/admin/benchmark/pdf/status`).then(r => r.json())
        setProgress(data.progress ?? 0); setCurrentTest(data.current_test); setResults(data.results ?? [])
        if (data.status === 'done' || data.status === 'error' || data.status === 'cancelled') { setStatus(data.status); clearInterval(pollRef.current) }
      } catch {}
    }, 2000)
    return () => clearInterval(pollRef.current)
  }, [status])

  useEffect(() => {
    if (realStatus !== 'running') return
    realPollRef.current = setInterval(async () => {
      try {
        const data = await fetch(`${BACKEND}/admin/benchmark/real/status`).then(r => r.json())
        setRealCurrentTest(data.current_test); setRealResults(data.results ?? [])
        if (data.status === 'done' || data.status === 'error') { setRealStatus(data.status); clearInterval(realPollRef.current) }
      } catch {}
    }, 2000)
    return () => clearInterval(realPollRef.current)
  }, [realStatus])

  useEffect(() => {
    if (cveStatus !== 'running') return
    cvePollRef.current = setInterval(async () => {
      try {
        const data = await fetch(`${BACKEND}/admin/benchmark/cve/status`).then(r => r.json())
        setCveProgress(data.progress ?? 0); setCveCurrentTest(data.current_test); setCveResults(data.results ?? [])
        if (data.status === 'done' || data.status === 'error' || data.status === 'cancelled') {
          setCveStatus(data.status); clearInterval(cvePollRef.current)
        }
      } catch {}
    }, 2000)
    return () => clearInterval(cvePollRef.current)
  }, [cveStatus])

  async function startTheory() {
    setStartError(null); setResults([]); setProgress(0); setCurrentTest(null); setStatus('running')
    try {
      const res = await fetch(`${BACKEND}/admin/benchmark/pdf/run`, { method: 'POST' })
      if (!res.ok) { const d = await res.json(); setStartError(d.detail ?? 'Failed.'); setStatus('error') }
    } catch { setStartError('Could not reach the backend.'); setStatus('error') }
  }

  async function cancelTheory() {
    try {
      await fetch(`${BACKEND}/admin/benchmark/pdf/cancel`, { method: 'POST' })
    } catch {}
  }

  async function startReality() {
    if (!selectedFile) return
    setRealError(null); setRealCurrentTest(null); setRealStatus('running')
    try {
      const res = await fetch(`${BACKEND}/admin/benchmark/real/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: selectedFile }),
      })
      if (!res.ok) { const d = await res.json(); setRealError(d.detail ?? 'Failed.'); setRealStatus('error') }
    } catch { setRealError('Could not reach the backend.'); setRealStatus('error') }
  }

  async function handleUpload(file) {
    if (!file?.name.endsWith('.pdf')) return
    setUploading(true)
    try {
      const form = new FormData(); form.append('file', file)
      const res = await fetch(`${BACKEND}/admin/benchmark/real/upload`, { method: 'POST', body: form })
      if (res.ok) {
        const data = await res.json()
        loadRealFiles()
        setSelectedFile(data.filename)
      } else { const d = await res.json(); setRealError(d.detail ?? 'Upload failed.') }
    } catch { setRealError('Upload failed.') }
    finally { setUploading(false) }
  }

  async function deleteFile(filename) {
    try {
      await fetch(`${BACKEND}/admin/benchmark/real/files/${encodeURIComponent(filename)}`, { method: 'DELETE' })
      loadRealFiles()
    } catch {}
  }

  async function startCve() {
    setCveError(null); setCveResults([]); setCveProgress(0); setCveCurrentTest(null); setCveStatus('running')
    try {
      const res = await fetch(`${BACKEND}/admin/benchmark/cve/run`, { method: 'POST' })
      if (!res.ok) { const d = await res.json(); setCveError(d.detail ?? 'Failed.'); setCveStatus('error') }
    } catch { setCveError('Could not reach the backend.'); setCveStatus('error') }
  }

  async function cancelCve() {
    try { await fetch(`${BACKEND}/admin/benchmark/cve/cancel`, { method: 'POST' }) } catch {}
  }

  const isTheory   = mode === 'theory'
  const isReality  = mode === 'reality'
  const isCve      = mode === 'cve'
  const running    = isTheory ? status === 'running' : isReality ? realStatus === 'running' : cveStatus === 'running'
  const done       = isTheory ? status === 'done'    : isReality ? realStatus === 'done'    : cveStatus === 'done'
  const curResults = isTheory ? results              : isReality ? realResults              : cveResults
  const curProgress = isTheory ? progress            : isCve ? cveProgress                  : 0
  const curTotal    = isTheory ? 8                   : isCve ? 6                             : 0
  const curTest     = isTheory ? currentTest         : isReality ? realCurrentTest           : cveCurrentTest
  const curError    = isTheory ? startError          : isReality ? realError                 : cveError
  const activeMetrics = isReality ? REALITY_METRICS : CVE_METRICS
  const runDisabled   = running || (isReality && !selectedFile)
  const validResults  = curResults.filter(r => !r.error)
  const selectedFileInfo = realFiles.find(f => f.filename === selectedFile)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ ...MONO_U, fontSize: '10px', color: c.muted, marginBottom: '4px' }}>Knowledge Base</div>
          <div style={{ ...SERIF, fontSize: '22px', color: c.text }}>PDF Scale Benchmark</div>
        </div>
        <button
          onClick={
            running && isTheory ? cancelTheory :
            running && isCve    ? cancelCve    :
            isTheory            ? startTheory  :
            isCve               ? startCve     :
                                  startReality
          }
          disabled={!running && runDisabled}
          style={{
            ...SERIF, fontSize: '16px', padding: '10px 26px', borderRadius: '10px',
            cursor: (!running && runDisabled) ? 'default' : 'pointer',
            background: (running && (isTheory || isCve)) ? 'transparent' : (!running && runDisabled) ? 'transparent' : c.accent,
            border: `1px solid ${(running && (isTheory || isCve)) ? '#c0392b' : (!running && runDisabled) ? c.border : c.accent}`,
            color: (running && (isTheory || isCve)) ? '#c0392b' : (!running && runDisabled) ? c.muted : '#fff',
            transition: 'all 0.15s',
          }}
        >
          {(running && (isTheory || isCve)) ? 'Cancel' : running ? 'Running…' : done ? 'Run Again' : 'Run Benchmark'}
        </button>
      </div>

      {/* Mode dropdown */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ ...MONO_U, fontSize: '10px', color: c.muted }}>Mode</div>
        <select
          value={mode}
          onChange={e => setMode(e.target.value)}
          disabled={running}
          style={{
            ...MONO, fontSize: '13px',
            background: c.sidebar,
            border: `1px solid ${c.border}`,
            borderRadius: '8px', color: c.text,
            padding: '7px 12px',
            cursor: running ? 'not-allowed' : 'pointer',
            outline: 'none',
          }}
        >
          <option value="theory">Theory — Synthetic PDFs</option>
          <option value="reality">Reality — Real PDFs</option>
          <option value="cve">CVE — Real-World Dataset</option>
        </select>
      </div>

      {/* Theory idle description */}
      {isTheory && status === 'idle' && !results.length && (
        <div style={{ ...SERIF, fontSize: '15px', color: c.muted, fontStyle: 'italic', lineHeight: 1.6 }}>
          Generates synthetic PDFs at 5, 10, 50, 100, 500, and 1,000 pages with unique per-page content
          and planted facts. Measures ingestion time, chunk count, query latency, and retrieval accuracy.
          PDFs are saved to <em>Test PDFs/</em>.
        </div>
      )}

      {/* CVE idle description */}
      {isCve && cveStatus === 'idle' && !cveResults.length && (
        <div style={{ ...SERIF, fontSize: '15px', color: c.muted, fontStyle: 'italic', lineHeight: 1.6 }}>
          Reads CVE JSON data directly from cvelistV5-main.zip — no PDF generation or parsing.
          Six non-overlapping tiers of high/critical CVEs are ingested and queried independently.
          Virtual page count is calculated from content size (~4,000 chars per page).
          Requires cvelistV5-main.zip in <em>Test PDFs/real/</em>.
        </div>
      )}

      {/* Reality: PDF selector + upload */}
      {!isTheory && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ ...MONO_U, fontSize: '10px', color: c.muted }}>PDF</div>
          {realFiles.length === 0 ? (
            <span style={{ ...SERIF, fontSize: '14px', color: c.muted, fontStyle: 'italic' }}>
              No PDFs yet — upload one to begin.
            </span>
          ) : (
            <select
              value={selectedFile ?? ''}
              onChange={e => setSelectedFile(e.target.value)}
              disabled={running}
              style={{
                ...MONO, fontSize: '13px',
                background: c.sidebar,
                border: `1px solid ${c.border}`,
                borderRadius: '8px', color: c.text,
                padding: '7px 12px',
                cursor: running ? 'not-allowed' : 'pointer',
                outline: 'none', flex: 1, minWidth: 0,
              }}
            >
              {realFiles.map(f => (
                <option key={f.filename} value={f.filename}>
                  {f.filename}{f.pages != null ? ` — ${f.pages}p` : ''}{f.size_kb ? ` · ${f.size_kb} KB` : ''}
                </option>
              ))}
            </select>
          )}
          {selectedFile && (
            <button onClick={() => deleteFile(selectedFile)} disabled={running}
              style={{ background: 'none', border: 'none', color: '#f87171', cursor: running ? 'not-allowed' : 'pointer', padding: '4px 8px', fontSize: '13px', flexShrink: 0 }}>
              ✕
            </button>
          )}
          {uploading
            ? <span style={{ ...MONO, fontSize: '12px', color: c.muted }}>Uploading…</span>
            : (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={running}
                style={{
                  ...MONO, fontSize: '12px', padding: '7px 14px', borderRadius: '8px',
                  background: 'transparent', border: `1px solid ${c.border}`,
                  color: c.text, cursor: running ? 'not-allowed' : 'pointer', flexShrink: 0,
                }}
              >
                + Upload PDF
              </button>
            )
          }
          <input ref={fileInputRef} type="file" accept=".pdf" style={{ display: 'none' }}
            onChange={e => { if (e.target.files[0]) handleUpload(e.target.files[0]); e.target.value = '' }} />
        </div>
      )}

      {/* Error */}
      {curError && (
        <div style={{
          padding: '12px 16px', borderRadius: '8px',
          background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.35)',
          color: '#f87171', ...SERIF, fontSize: '15px',
        }}>{curError}</div>
      )}

      {/* Cancelled notice */}
      {(isTheory && status === 'cancelled') || (isCve && cveStatus === 'cancelled') ? (
        <div style={{
          padding: '10px 16px', borderRadius: '8px',
          background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.3)',
          color: '#ca8a04', ...SERIF, fontSize: '14px',
        }}>
          Benchmark cancelled. {curResults.length > 0 ? `${curResults.filter(r => !r.error).length} tier(s) completed before cancellation.` : 'No results recorded.'}
        </div>
      ) : null}

      {/* Progress */}
      {running && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ ...MONO, fontSize: '13px', color: c.text }}>{curTest ?? 'Preparing…'}</div>
            {isTheory && <div style={{ ...MONO, fontSize: '12px', color: c.muted }}>{curProgress}/{curTotal}</div>}
          </div>
          {isTheory && (
            <div style={{ height: '4px', borderRadius: '4px', background: c.border, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: '4px', background: c.accent,
                width: `${curTotal > 0 ? (curProgress / curTotal) * 100 : 0}%`,
                transition: 'width 0.4s ease',
              }} />
            </div>
          )}
          {isTheory && validResults.length > 0 && (
            <div style={{ ...MONO, fontSize: '11px', color: c.muted }}>Chart updates live as each test completes.</div>
          )}
        </div>
      )}

      {/* Chart */}
      {validResults.length >= 2 && (
        <div style={{ background: c.botBubble ?? c.input, border: `1px solid ${c.border}`, borderRadius: '12px', padding: '20px 16px 12px' }}>
          <div style={{ ...MONO_U, fontSize: '10px', color: c.muted, marginBottom: '14px' }}>
            {isReality ? 'All metrics normalized to % of peak value' : 'All metrics normalized to % of peak value · hover for actual units'}
          </div>
          <BenchmarkChart results={curResults} metrics={activeMetrics} c={c} />
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginTop: '12px', paddingLeft: '4px' }}>
            {activeMetrics.map(m => (
              <div key={m.key} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ width: '22px', height: '2.5px', background: m.color, borderRadius: '2px', flexShrink: 0 }} />
                <span style={{ ...MONO, fontSize: '11px', color: c.muted }}>{m.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Results table */}
      {curResults.length > 0 && (
        <div style={{ border: `1px solid ${c.border}`, borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: isReality ? '1fr 70px 90px 70px 90px 90px' : '70px 90px 70px 90px 100px 90px',
            padding: '10px 18px', background: `${c.accent}10`, borderBottom: `1px solid ${c.border}`,
          }}>
            {(isReality
              ? ['File', 'Pages', 'Ingest', 'Chunks', 'Query', 'Size (KB)']
              : ['Pages', 'Ingest', 'Chunks', 'Query', 'Accuracy', 'Size (KB)']
            ).map(h => <div key={h} style={{ ...MONO_U, fontSize: '9px', color: c.muted }}>{h}</div>)}
          </div>
          {curResults.map((r, i) => (
            <div key={i} style={{
              display: 'grid',
              gridTemplateColumns: isReality ? '1fr 70px 90px 70px 90px 90px' : '70px 90px 70px 90px 100px 90px',
              padding: '12px 18px', borderTop: i > 0 ? `1px solid ${c.border}` : 'none', alignItems: 'center',
            }}>
              {r.error ? (
                <>
                  <div style={{ ...MONO, fontSize: '13px', color: c.text }}>{r.pages ?? r.filename ?? r.tier ?? '—'}</div>
                  <div style={{ ...MONO, fontSize: '12px', color: '#f87171', gridColumn: '2 / -1' }}>{r.error}</div>
                </>
              ) : isReality ? (
                <>
                  <div style={{ ...MONO, fontSize: '12px', color: c.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.filename}</div>
                  <div style={{ ...MONO, fontSize: '13px', color: c.text }}>{r.pages ?? '—'}</div>
                  <div style={{ ...MONO, fontSize: '13px', color: c.text }}>{fmtTime(r.ingestion_time_s)}</div>
                  <div style={{ ...MONO, fontSize: '13px', color: c.text }}>{r.chunk_count ?? '—'}</div>
                  <div style={{ ...MONO, fontSize: '13px', color: c.text }}>
                    {r.avg_query_latency_ms != null ? (r.avg_query_latency_ms / 1000).toFixed(2) + 's' : '—'}
                  </div>
                  <div style={{ ...MONO, fontSize: '12px', color: c.muted }}>{r.file_size_kb ?? '—'}</div>
                </>
              ) : (
                <>
                  <div style={{ ...MONO, fontSize: '13px', color: c.text }}>{r.pages}</div>
                  <div style={{ ...MONO, fontSize: '13px', color: c.text }}>{fmtTime(r.ingestion_time_s)}</div>
                  <div style={{ ...MONO, fontSize: '13px', color: c.text }}>{r.chunk_count ?? '—'}</div>
                  <div style={{ ...MONO, fontSize: '13px', color: c.text }}>
                    {r.avg_query_latency_ms != null ? (r.avg_query_latency_ms / 1000).toFixed(2) + 's' : '—'}
                  </div>
                  <div style={{ ...MONO, fontSize: '13px', color: r.accuracy_pct >= 67 ? '#4ade80' : r.accuracy_pct >= 34 ? '#f59e0b' : '#f87171' }}>
                    {r.accuracy_pct ?? '—'}%
                  </div>
                  <div style={{ ...MONO, fontSize: '12px', color: c.muted }}>{r.file_size_kb ?? '—'}</div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

    </div>
  )
}
