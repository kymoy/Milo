import { useState } from 'react'

const BACKEND = 'http://localhost:8000'

const SERIF  = { fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 300 }
const MONO_U = { fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 200, letterSpacing: '3px', textTransform: 'uppercase' }
const MONO   = { fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 300 }

export default function TestsPanel({ c }) {
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState(null)
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState(null)
  const [hoveredId, setHoveredId] = useState(null)
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 })

  async function runTests() {
    setRunning(true)
    setResults(null)
    setSummary(null)
    setError(null)
    try {
      const res = await fetch(`${BACKEND}/admin/tests/run`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { setError(data.detail ?? 'Test run failed.'); return }
      setResults(data.results)
      setSummary(data.summary)
    } catch {
      setError('Could not reach the backend.')
    } finally {
      setRunning(false)
    }
  }

  function handleMouseEnter(e, id) {
    const rect = e.currentTarget.getBoundingClientRect()
    setHoverPos({ x: rect.left, y: rect.bottom + window.scrollY + 6 })
    setHoveredId(id)
  }

  const allPassed = summary && summary.failed === 0
  const totalTime = results ? results.reduce((s, r) => s + r.duration, 0).toFixed(2) : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ ...MONO_U, fontSize: '10px', color: c.muted, marginBottom: '4px' }}>Knowledge Library</div>
          <div style={{ ...SERIF, fontSize: '22px', color: c.text }}>Automated Tests</div>
        </div>
        <button
          onClick={runTests}
          disabled={running}
          style={{
            ...SERIF, fontSize: '16px',
            padding: '10px 26px', borderRadius: '10px', cursor: running ? 'default' : 'pointer',
            background: running ? 'transparent' : c.accent,
            border: `1px solid ${running ? c.border : c.accent}`,
            color: running ? c.muted : '#fff',
            transition: 'all 0.15s',
          }}
        >
          {running ? 'Running…' : results ? 'Run Again' : 'Run Tests'}
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div style={{ padding: '12px 16px', borderRadius: '8px', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.35)', color: '#f87171', ...SERIF, fontSize: '15px' }}>
          {error}
        </div>
      )}

      {/* Summary bar */}
      {summary && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '16px', padding: '14px 18px',
          borderRadius: '10px',
          background: allPassed ? 'rgba(74,222,128,0.07)' : 'rgba(248,113,113,0.07)',
          border: `1px solid ${allPassed ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)'}`,
        }}>
          <span style={{ fontSize: '20px' }}>{allPassed ? '✓' : '✗'}</span>
          <div style={{ display: 'flex', gap: '20px', flex: 1 }}>
            <span style={{ ...MONO, fontSize: '14px', color: '#4ade80' }}>{summary.passed} passed</span>
            {summary.failed > 0 && <span style={{ ...MONO, fontSize: '14px', color: '#f87171' }}>{summary.failed} failed</span>}
            <span style={{ ...MONO, fontSize: '14px', color: c.muted }}>{summary.total} total</span>
          </div>
          {totalTime && <span style={{ ...MONO, fontSize: '12px', color: c.muted }}>{totalTime}s</span>}
        </div>
      )}

      {/* Results table */}
      {results && results.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0', border: `1px solid ${c.border}`, borderRadius: '10px', overflow: 'hidden' }}>
          {results.map((r, i) => {
            const passed = r.outcome === 'passed'
            return (
              <div
                key={r.id}
                onMouseEnter={(e) => r.description && handleMouseEnter(e, r.id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '14px',
                  padding: '13px 18px',
                  borderTop: i > 0 ? `1px solid ${c.border}` : 'none',
                  background: hoveredId === r.id ? `${c.accent}0a` : 'transparent',
                  cursor: r.description ? 'default' : 'default',
                  transition: 'background 0.1s',
                }}
              >
                {/* Status dot */}
                <div style={{
                  width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                  background: passed ? '#4ade80' : '#f87171',
                  boxShadow: passed ? '0 0 6px rgba(74,222,128,0.5)' : '0 0 6px rgba(248,113,113,0.5)',
                }} />

                {/* Test name */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ ...MONO, fontSize: '14px', color: c.text }}>{r.name}</div>
                  {!passed && r.error && (
                    <div style={{ ...MONO, fontSize: '11px', color: '#f87171', marginTop: '4px', whiteSpace: 'pre-wrap', opacity: 0.85 }}>
                      {r.error.split('\n').slice(-3).join('\n')}
                    </div>
                  )}
                </div>

                {/* Duration */}
                <div style={{ ...MONO, fontSize: '12px', color: c.muted, flexShrink: 0 }}>
                  {r.duration}s
                </div>

                {/* Hover hint */}
                {r.description && (
                  <div style={{ ...MONO_U, fontSize: '8px', color: c.muted, flexShrink: 0, opacity: 0.5 }}>
                    ?
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Empty state */}
      {!running && !results && !error && (
        <div style={{ ...SERIF, fontSize: '15px', color: c.muted, fontStyle: 'italic', padding: '20px 0' }}>
          Run the tests to verify the knowledge library ingestion, retrieval, and API endpoints are all working correctly.
        </div>
      )}

      {/* Hover tooltip — rendered at fixed position to avoid clipping */}
      {hoveredId && (() => {
        const r = results.find(x => x.id === hoveredId)
        if (!r?.description) return null
        return (
          <div style={{
            position: 'fixed',
            left: Math.min(hoverPos.x, window.innerWidth - 380),
            top: hoverPos.y,
            zIndex: 2000,
            background: c.sidebar ?? '#1a1a2e',
            border: `1px solid ${c.border}`,
            borderRadius: '10px',
            padding: '14px 16px',
            maxWidth: '360px',
            pointerEvents: 'none',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          }}>
            <div style={{ ...MONO_U, fontSize: '8px', color: c.accent, marginBottom: '8px' }}>
              What this tests
            </div>
            <div style={{ ...SERIF, fontSize: '14px', color: c.text, lineHeight: 1.6 }}>
              {r.description}
            </div>
          </div>
        )
      })()}

    </div>
  )
}
