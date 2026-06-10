import { useState } from 'react'
import DiagnosticsPanel from './DiagnosticsPanel'

const SERIF  = { fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 300 }
const MONO_U = { fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 200, letterSpacing: '3px', textTransform: 'uppercase' }
const MONO   = { fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 300 }

const RECOMMENDED = [
  { model: 'llama3.2:3b',         vram: '2–3 GB',   dl: '2.0 GB',  tps: '80–120',  ctx: '128K', cut: 'mid-2024',   note: 'Fastest option, minimal hardware, weaker reasoning' },
  { model: 'mistral:7b',           vram: '4–5 GB',   dl: '4.1 GB',  tps: '50–70',   ctx: '32K',  cut: 'early 2023', note: 'Reliable, fast, good at following instructions' },
  { model: 'llama3.1:8b',          vram: '6–8 GB',   dl: '4.9 GB',  tps: '40–60',   ctx: '128K', cut: 'early 2023', note: 'Balanced, large context window' },
  { model: 'llama3.1:8b-q4_K_M',  vram: '4.5–5 GB', dl: '4.7 GB',  tps: '55–75',   ctx: '128K', cut: 'early 2023', note: 'Same model quantized — less VRAM, slightly faster' },
  { model: 'qwen2.5:7b',           vram: '4–5 GB',   dl: '4.7 GB',  tps: '50–70',   ctx: '128K', cut: 'late 2024',  note: 'Less VRAM, faster, most recent knowledge — best overall swap', best: true },
  { model: 'phi4:14b',             vram: '8–10 GB',  dl: '8.9 GB',  tps: '25–40',   ctx: '16K',  cut: 'early 2024', note: 'Noticeably better reasoning, needs 10 GB VRAM' },
  { model: 'llama3.3:70b-q4_K_M', vram: '35–42 GB', dl: '43 GB',   tps: '5–15',    ctx: '128K', cut: 'Dec 2023',   note: 'Near frontier-model quality, requires high-end GPU' },
]

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
    sources, loadingSources, loadSources, deleteSource,
  } = admin

  const [pullInput, setPullInput] = useState('')
  const [copied, setCopied] = useState(false)
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
                {s}
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
                  {['Model', 'VRAM', 'Download', '~Tok/s (GPU)', 'Context', 'Cutoff', 'Notes'].map(h => (
                    <th key={h} style={{ ...MONO_U, fontSize: '9px', color: c.muted, textAlign: 'left', padding: '6px 14px 10px 0', borderBottom: `1px solid ${c.border}`, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {RECOMMENDED.map(({ model, vram, dl, tps, ctx, cut, note, best }) => {
                  const isCurrent = model === activeModel
                  return (
                    <tr key={model} style={{ background: isCurrent ? `${c.accent}0d` : best ? 'rgba(74,222,128,0.04)' : 'transparent' }}>
                      <td style={{ padding: '10px 14px 10px 0', borderBottom: `1px solid ${c.border}`, whiteSpace: 'nowrap' }}>
                        <code style={{ ...MONO, fontSize: '13px', color: isCurrent ? c.accent : best ? '#4ade80' : c.text }}>{model}</code>
                        {isCurrent && <span style={{ ...MONO_U, fontSize: '8px', color: c.accent, marginLeft: '8px' }}>active</span>}
                        {best && !isCurrent && <span style={{ ...MONO_U, fontSize: '8px', color: '#4ade80', marginLeft: '8px' }}>recommended</span>}
                      </td>
                      <td style={{ padding: '10px 14px 10px 0', color: c.text, borderBottom: `1px solid ${c.border}`, whiteSpace: 'nowrap' }}>{vram}</td>
                      <td style={{ padding: '10px 14px 10px 0', color: c.text, borderBottom: `1px solid ${c.border}`, whiteSpace: 'nowrap' }}>{dl}</td>
                      <td style={{ padding: '10px 14px 10px 0', color: c.text, borderBottom: `1px solid ${c.border}`, whiteSpace: 'nowrap' }}>{tps}</td>
                      <td style={{ padding: '10px 14px 10px 0', color: c.text, borderBottom: `1px solid ${c.border}`, whiteSpace: 'nowrap' }}>{ctx}</td>
                      <td style={{ padding: '10px 14px 10px 0', color: cut.includes('2024') ? '#4ade80' : c.muted, borderBottom: `1px solid ${c.border}`, whiteSpace: 'nowrap' }}>{cut}</td>
                      <td style={{ padding: '10px 14px 10px 0', color: c.muted, fontStyle: 'italic', borderBottom: `1px solid ${c.border}` }}>{note}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div style={{ ...SERIF, fontSize: '13px', color: c.muted, fontStyle: 'italic', marginTop: '10px' }}>
              Tok/s on a mid-range GPU (e.g. RTX 3080). CPU-only is ~5–10× slower. Cutoff dates approximate.
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

    </div>
  )
}
