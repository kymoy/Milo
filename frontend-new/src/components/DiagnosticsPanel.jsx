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

export default function DiagnosticsPanel({ c }) {
  const [data, setData] = useState(null)
  const [lastFetch, setLastFetch] = useState(null)

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

  const history = data?.history ?? []
  const current = data?.current ?? {}

  const get = key => history.map(h => h[key] ?? null)
  const latest = key => history.length > 0 ? history[history.length - 1][key] : null

  const hasGpu = history.some(h => h.gpu_percent != null) || current.gpu_percent != null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ ...MONO_U, fontSize: '11px', color: c.accent, marginBottom: '4px' }}>Diagnostics</div>
          <div style={{ ...SERIF, fontSize: '14px', color: c.muted }}>
            Live system stats · updates every 5s · {history.length} requests recorded
          </div>
        </div>
        {lastFetch && (
          <div style={{ ...MONO, fontSize: '11px', color: c.muted }}>
            Last update: {lastFetch.toLocaleTimeString()}
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${hasGpu ? 3 : 2}, 1fr)`, gap: '12px' }}>
        <StatCard
          label="Response time" unit="ms"
          current={latest('response_ms')}
          values={get('response_ms')}
          color={c.accent} max={10000} c={c}
          detail="Time from send to first token received"
        />
        <StatCard
          label="Tokens / sec" unit="tok/s"
          current={latest('tokens_per_sec')}
          values={get('tokens_per_sec')}
          color="#4ade80" c={c}
          detail="Generation speed — higher is faster"
        />
        <StatCard
          label="CPU usage" unit="%"
          current={current.cpu_percent ?? latest('cpu_percent')}
          values={get('cpu_percent')}
          color="#60a5fa" max={100} c={c}
          detail="Sustained >80% means CPU is the bottleneck"
        />
        <StatCard
          label="RAM used" unit="%"
          current={current.ram_percent ?? latest('ram_percent')}
          values={get('ram_percent')}
          color="#a78bfa"
          max={100}
          c={c}
          detail={current.ram_used_gb && current.ram_total_gb ? `${current.ram_used_gb} GB / ${current.ram_total_gb} GB total` : null}
        />
        {hasGpu && (
          <StatCard
            label="GPU usage" unit="%"
            current={current.gpu_percent ?? latest('gpu_percent')}
            values={get('gpu_percent')}
            color="#fb923c" max={100} c={c}
            detail={current.gpu_temp != null ? `${current.gpu_temp}°C — throttles at ~85°C` : 'GPU utilisation'}
          />
        )}
        {hasGpu && current.vram_total_mb != null && (
          <StatCard
            label="VRAM used" unit="MB"
            current={current.vram_used_mb}
            values={get('vram_used_mb')}
            color="#f472b6"
            max={current.vram_total_mb}
            c={c}
            detail={`${current.vram_total_mb} MB total · overflow spills to RAM`}
          />
        )}
      </div>

      {history.length === 0 && (
        <div style={{ ...SERIF, fontSize: '15px', color: c.muted, fontStyle: 'italic', textAlign: 'center', padding: '20px 0' }}>
          Send a message in chat to start recording metrics.
        </div>
      )}

      <div style={{ background: c.botBubble ?? c.input, border: `1px solid ${c.border}`, borderRadius: '10px', padding: '20px' }}>
        <div style={{ ...MONO_U, fontSize: '10px', color: c.accent, marginBottom: '14px' }}>Efficiency tips</div>
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
                <div style={{ ...SERIF, fontSize: '13px', color: c.muted, fontStyle: 'italic', marginTop: '2px' }}>{detail}</div>
                {cmd && <code style={{ ...MONO, fontSize: '12px', color: c.accent, background: `${c.accent}12`, padding: '2px 8px', borderRadius: '4px', display: 'inline-block', marginTop: '4px' }}>{cmd}</code>}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ background: c.botBubble ?? c.input, border: `1px solid ${c.border}`, borderRadius: '10px', padding: '20px' }}>
        <div style={{ ...MONO_U, fontSize: '10px', color: c.accent, marginBottom: '4px' }}>Model alternatives</div>
        <div style={{ ...SERIF, fontSize: '13px', color: c.muted, fontStyle: 'italic', marginBottom: '16px' }}>
          Current: <span style={{ color: c.accent }}>llama3.1:8b</span> — change OLLAMA_MODEL in main.py after pulling
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', ...SERIF, fontSize: '14px' }}>
            <thead>
              <tr>
                {['Model', 'VRAM', 'Download', '~Tok/s (GPU)', 'Context', 'Cutoff', 'Notes'].map(h => (
                  <th key={h} style={{ ...MONO_U, fontSize: '9px', color: c.muted, textAlign: 'left', padding: '6px 14px 10px 0', borderBottom: `1px solid ${c.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { model: 'llama3.2:3b',         vram: '2–3 GB',   dl: '2.0 GB',  tps: '80–120',  ctx: '128K', cut: 'mid-2024',  note: 'Fastest option, minimal hardware, weaker reasoning' },
                { model: 'mistral:7b',           vram: '4–5 GB',   dl: '4.1 GB',  tps: '50–70',   ctx: '32K',  cut: 'early 2023', note: 'Reliable, fast, good at following instructions' },
                { model: 'llama3.1:8b',          vram: '6–8 GB',   dl: '4.9 GB',  tps: '40–60',   ctx: '128K', cut: 'early 2023', note: 'Current — balanced, large context window', current: true },
                { model: 'llama3.1:8b-q4_K_M',  vram: '4.5–5 GB', dl: '4.7 GB',  tps: '55–75',   ctx: '128K', cut: 'early 2023', note: 'Same model quantized — less VRAM, slightly faster' },
                { model: 'qwen2.5:7b',           vram: '4–5 GB',   dl: '4.7 GB',  tps: '50–70',   ctx: '128K', cut: 'late 2024',  note: 'Less VRAM, faster, more recent knowledge — best overall swap', best: true },
                { model: 'phi4:14b',             vram: '8–10 GB',  dl: '8.9 GB',  tps: '25–40',   ctx: '16K',  cut: 'early 2024', note: 'Noticeably better reasoning and coding, needs 10 GB VRAM' },
                { model: 'llama3.3:70b-q4_K_M', vram: '35–42 GB', dl: '43 GB',   tps: '5–15',    ctx: '128K', cut: 'Dec 2023',   note: 'Near frontier-model quality, requires high-end GPU' },
              ].map(({ model, vram, dl, tps, ctx, cut, note, current, best }) => (
                <tr key={model} style={{ background: current ? `${c.accent}0d` : best ? 'rgba(74,222,128,0.05)' : 'transparent' }}>
                  <td style={{ padding: '10px 14px 10px 0', borderBottom: `1px solid ${c.border}`, whiteSpace: 'nowrap' }}>
                    <code style={{ ...MONO, fontSize: '13px', color: current ? c.accent : best ? '#4ade80' : c.text }}>{model}</code>
                    {current && <span style={{ ...MONO_U, fontSize: '8px', color: c.accent, marginLeft: '8px', opacity: 0.8 }}>active</span>}
                    {best    && <span style={{ ...MONO_U, fontSize: '8px', color: '#4ade80', marginLeft: '8px', opacity: 0.8 }}>recommended</span>}
                  </td>
                  <td style={{ padding: '10px 14px 10px 0', color: c.text, borderBottom: `1px solid ${c.border}`, whiteSpace: 'nowrap' }}>{vram}</td>
                  <td style={{ padding: '10px 14px 10px 0', color: c.text, borderBottom: `1px solid ${c.border}`, whiteSpace: 'nowrap' }}>{dl}</td>
                  <td style={{ padding: '10px 14px 10px 0', color: c.text, borderBottom: `1px solid ${c.border}`, whiteSpace: 'nowrap' }}>{tps}</td>
                  <td style={{ padding: '10px 14px 10px 0', color: c.text, borderBottom: `1px solid ${c.border}`, whiteSpace: 'nowrap' }}>{ctx}</td>
                  <td style={{ padding: '10px 14px 10px 0', color: cut.includes('2024') ? '#4ade80' : c.muted, borderBottom: `1px solid ${c.border}`, whiteSpace: 'nowrap' }}>{cut}</td>
                  <td style={{ padding: '10px 14px 10px 0', color: c.muted, fontStyle: 'italic', borderBottom: `1px solid ${c.border}` }}>{note}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ ...SERIF, fontSize: '14px', color: c.text, marginTop: '12px' }}>
            Tok/s estimates on a mid-range GPU (e.g. RTX 3080). CPU-only is roughly 5–10× slower. Knowledge cutoff dates are approximate.
          </div>
        </div>
      </div>
    </div>
  )
}
