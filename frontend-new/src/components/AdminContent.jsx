import DiagnosticsPanel from './DiagnosticsPanel'

const SERIF  = { fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 300 }
const MONO_U = { fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 200, letterSpacing: '3px', textTransform: 'uppercase' }

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
  const {
    uploadFile, setUploadFile, uploading, uploadStatus, dragOver, setDragOver, fileInputRef, handleDrop, handleUpload,
    sourceName, setSourceName, content, setContent, docType, setDocType, creating, createStatus, handleCreate,
    rulesContent, setRulesContent, savingRules, rulesStatus, handleSaveRules,
    models, activeModel, switchingModel, modelStatus, handleSwitchModel,
    sources, loadingSources, loadSources, deleteSource,
  } = admin

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Model selector */}
      <div style={{ background: c.botBubble ?? c.input, border: `1px solid ${c.border}`, borderRadius: '12px', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '160px' }}>
          <div style={{ ...MONO_U, fontSize: '11px', color: c.accent, marginBottom: '4px' }}>Active model</div>
          <div style={{ ...SERIF, fontSize: '13px', color: c.muted }}>Changes take effect on the next message sent</div>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            value={activeModel}
            onChange={e => handleSwitchModel(e.target.value)}
            disabled={switchingModel || models.length === 0}
            style={{
              background: c.input, border: `1px solid ${c.border}`, borderRadius: '8px',
              padding: '10px 14px', color: c.text, fontSize: '15px', outline: 'none',
              cursor: 'pointer', ...SERIF, minWidth: '220px',
            }}
          >
            {models.length === 0 && <option value="">No models found</option>}
            {models.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          {modelStatus && (
            <div style={{
              ...SERIF, fontSize: '14px', padding: '8px 14px', borderRadius: '8px',
              color: modelStatus.type === 'success' ? '#4ade80' : '#f87171',
              background: modelStatus.type === 'success' ? 'rgba(74,222,128,0.08)' : 'rgba(248,113,113,0.08)',
              border: `1px solid ${modelStatus.type === 'success' ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)'}`,
            }}>
              {modelStatus.message}
            </div>
          )}
          {models.length === 0 && (
            <div style={{ ...SERIF, fontSize: '14px', color: c.muted, fontStyle: 'italic' }}>
              Make sure Ollama is running
            </div>
          )}
        </div>
      </div>

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

      <DiagnosticsPanel c={c} />

    </div>
  )
}
