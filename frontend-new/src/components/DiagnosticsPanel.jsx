import { useState, useEffect, useCallback } from 'react'

const BACKEND = 'http://localhost:8000'
const SERIF  = { fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 300 }
const MONO_U = { fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 200, letterSpacing: '3px', textTransform: 'uppercase' }
const MONO   = { fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 300 }

function Sparkline({ values, color, max, height = 48 }) {
  const pts = values.filter(v => v != null)
  if (pts.length < 2) return <div style={{ height }} />
  const hi = max ?? Math.max(...pts, 1)
  const coords = pts.map((v, i) => {
    const x = (i / (pts.length - 1)) * 260
    const y = height - Math.min(v / hi, 1) * (height - 4) - 2
    return `${x},${y}`
  }).join(' ')
  const areaCoords = `0,${height} ${coords} ${260},${height}`
  return (
    <svg viewBox={`0 0 260 ${height}`} style={{ width: '100%', height, display: 'block' }} preserveAspectRatio="none">
      <polygon points={areaCoords} fill={`${color}18`} />
      <polyline points={coords} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
      {pts.length > 0 && (
        <circle cx={(pts.length - 1) / (pts.length - 1) * 260} cy={height - Math.min(pts[pts.length - 1] / hi, 1) * (height - 4) - 2} r="3" fill={color} />
      )}
    </svg>
  )
}

function StatCard({ label, current, unit, values, color, max, detail, c }) {
  const isHigh = max && current != null && (current / max) > 0.8
  const isMed  = max && current != null && (current / max) > 0.6
  const barColor = isHigh ? '#f87171' : isMed ? '#fb923c' : color
  const pct = max && current != null ? Math.min((current / max) * 100, 100) : null

  return (
    <div style={{ background: c.botBubble ?? c.input, border: `1px solid ${isHigh ? 'rgba(248,113,113,0.4)' : c.border}`, borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ ...MONO_U, fontSize: '10px', color: c.muted }}>{label}</div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ ...MONO, fontSize: '22px', color: isHigh ? '#f87171' : color }}>
            {current != null ? (Number.isInteger(current) ? current : current.toFixed(1)) : '—'}
          </span>
          <span style={{ ...MONO, fontSize: '13px', color: c.muted, marginLeft: '3px' }}>{unit}</span>
        </div>
      </div>

      {pct !== null && (
        <div style={{ height: '5px', background: c.border, borderRadius: '3px', overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: barColor, borderRadius: '3px', transition: 'width 0.4s ease' }} />
        </div>
      )}

      <Sparkline values={values} color={barColor} max={max} />

      {detail && <div style={{ ...SERIF, fontSize: '14px', color: c.text, marginTop: '2px' }}>{detail}</div>}
    </div>
  )
}

export default function DiagnosticsPanel({ c, activeModel: externalModel }) {
  const [data, setData] = useState(null)
  const [lastFetch, setLastFetch] = useState(null)
  const [selectedModel, setSelectedModel] = useState(null)

  useEffect(() => {
    if (externalModel) setSelectedModel(externalModel)
  }, [externalModel])

  const fetchDiagnostics = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND}/admin/diagnostics`)
      const json = await res.json()
      setData(json)
      setLastFetch(new Date())
    } catch {}
  }, [])

  useEffect(() => {
    fetchDiagnostics()
    const id = setInterval(fetchDiagnostics, 5000)
    return () => clearInterval(id)
  }, [fetchDiagnostics])

  const allHistory = data?.history ?? []
  const current = data?.current ?? {}

  // Unique models seen in history, newest first
  const seenModels = [...new Set(allHistory.map(h => h.model).filter(Boolean))].reverse()

  // Auto-select most recent model if nothing selected yet
  const activeModel = selectedModel ?? seenModels[0] ?? null

  // Filter history to the selected model
  const history = activeModel
    ? allHistory.filter(h => h.model === activeModel)
    : allHistory

  const get = key => history.map(h => h[key] ?? null)
  const latest = key => history.length > 0 ? history[history.length - 1][key] : null

  const hasGpu = history.some(h => h.gpu_percent != null) || current.gpu_percent != null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ ...MONO_U, fontSize: '11px', color: c.accent, marginBottom: '4px' }}>Diagnostics</div>
          <div style={{ ...SERIF, fontSize: '14px', color: c.muted }}>
            {activeModel
              ? <><span style={{ color: c.text, fontWeight: 500 }}>{activeModel}</span> · {history.length} requests · {allHistory.length} total</>
              : `Live system stats · updates every 5s · ${allHistory.length} requests recorded`}
          </div>
        </div>
        {lastFetch && (
          <div style={{ ...MONO, fontSize: '11px', color: c.muted }}>
            Last: {lastFetch.toLocaleTimeString()}
          </div>
        )}
      </div>

      {history.length >= 2 && (() => {
        const rTimes = get('response_ms').filter(v => v != null).sort((a, b) => a - b)
        const avg = rTimes.length ? Math.round(rTimes.reduce((a, b) => a + b, 0) / rTimes.length) : null
        const p90 = rTimes.length > 1 ? rTimes[Math.floor(rTimes.length * 0.9)] : null
        return (
          <div style={{ display: 'flex', gap: '24px', padding: '10px 16px', background: `${c.accent}0a`, borderRadius: '8px', border: `1px solid ${c.border}`, flexWrap: 'wrap' }}>
            {[
              { label: 'min', value: rTimes[0] },
              { label: 'avg', value: avg },
              { label: 'max', value: rTimes[rTimes.length - 1] },
              ...(p90 != null ? [{ label: 'p90', value: p90 }] : []),
            ].map(({ label, value }) => (
              <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ ...MONO_U, fontSize: '8px', color: c.muted }}>{label}</span>
                <span style={{ ...MONO, fontSize: '18px', color: c.accent }}>{value != null ? (value / 1000).toFixed(2) : '—'}<span style={{ fontSize: '11px', color: c.muted, marginLeft: '2px' }}>s</span></span>
              </div>
            ))}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginLeft: 'auto' }}>
              <span style={{ ...MONO_U, fontSize: '8px', color: c.muted }}>samples</span>
              <span style={{ ...MONO, fontSize: '18px', color: c.muted }}>{rTimes.length}</span>
            </div>
          </div>
        )
      })()}

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${hasGpu ? 3 : 2}, 1fr)`, gap: '12px' }}>
        <StatCard label="Response time" unit="ms" current={latest('response_ms')} values={get('response_ms')} color={c.accent} max={10000} c={c} detail="Time from send to first token received" />
        <StatCard label="Tokens / sec" unit="tok/s" current={latest('tokens_per_sec')} values={get('tokens_per_sec')} color="#4ade80" c={c} detail="Generation speed — higher is faster" />
        <StatCard label="CPU usage" unit="%" current={current.cpu_percent ?? latest('cpu_percent')} values={get('cpu_percent')} color="#60a5fa" max={100} c={c} detail="Sustained >80% means CPU is the bottleneck" />
        <StatCard label="RAM used" unit="%" current={current.ram_percent ?? latest('ram_percent')} values={get('ram_percent')} color="#a78bfa" max={100} c={c} detail={current.ram_used_gb && current.ram_total_gb ? `${current.ram_used_gb} GB / ${current.ram_total_gb} GB total` : null} />
        {hasGpu && <StatCard label="GPU usage" unit="%" current={current.gpu_percent ?? latest('gpu_percent')} values={get('gpu_percent')} color="#fb923c" max={100} c={c} detail={current.gpu_temp != null ? `${current.gpu_temp}°C — throttles at ~85°C` : 'GPU utilisation'} />}
        {hasGpu && current.vram_total_mb != null && <StatCard label="VRAM used" unit="MB" current={current.vram_used_mb} values={get('vram_used_mb')} color="#f472b6" max={current.vram_total_mb} c={c} detail={`${current.vram_total_mb} MB total · overflow spills to RAM`} />}
      </div>

      {history.length === 0 && (
        <div style={{ ...SERIF, fontSize: '15px', color: c.muted, fontStyle: 'italic', textAlign: 'center', padding: '20px 0' }}>
          Send a message in chat to start recording metrics.
        </div>
      )}

    </div>
  )
}
