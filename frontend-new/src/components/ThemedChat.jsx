import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import SettingsPanel from './SettingsPanel'
import { useMiloChat } from '../hooks/useMiloChat'
import MiloMarkdown from './MiloMarkdown'
import LoadingDots from './LoadingDots'
import TokenEstimate from './TokenEstimate'
import SessionStats from './SessionStats'
import MessageMetrics from './MessageMetrics'

const SERIF = { fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 300 }

/**
 * Base chat component shared by all sidebar-based themes.
 *
 * Props:
 *   dark / light    — color objects: { bg, sidebar, border, text, muted, accent,
 *                      input, userBubble, botBubble, botText, userText? }
 *   greeting        — (username: string) => string
 *   loginPath       — e.g. '/azure/login'
 *   glows           — optional [{top,bottom,left,right,size,color,blur}] (azure only)
 *   layout          — optional style overrides (all have defaults):
 *     borderWidth         '1px'           stiff: '2px'
 *     bubbleRadius        '12px'          stiff: '4px', stokt: '10px', crystals: '2px'
 *     inputRadius         '10px'          stiff: '4px', stokt: '8px'
 *     inputGap            '10px'          stiff: '12px'
 *     inputBorderless     false           crystals: true
 *     sendFont            'serif'         crystals: 'mono'
 *     loadingText         'Thinking...'
 *     loadingFont         'serif'         crystals: 'mono'
 *     loadingItalic       true            stiff: false
 *     loadingColorKey     'muted'         stiff: 'accent'
 *     contentPadding      '28px 24px'     crystals: '40px 32px'
 *     messageGap          '14px'          stiff: '16px', crystals: '24px'
 *     messageFontSize     '15px'          crystals: '14px'
 *     messageLineHeight   1.65            crystals: 1.7
 *     monoWeight          200             crystals: 100
 *     monoLetterSpacing   '4px'           stiff: '3px', crystals: '6px'
 *     placeholder         'Type a message...'   stiff: 'Say something...'
 */
export default function ThemedChat({ dark, light, greeting, loginPath, glows, layout = {} }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState(() => localStorage.getItem('milo_mode') ?? 'dark')
  const [showSettings, setShowSettings] = useState(false)
  const [useLibrary, setUseLibrary] = useState(() => localStorage.getItem('milo_use_library') !== 'false')
  const c = mode === 'dark' ? dark : light

  const {
    borderWidth = '1px',
    bubbleRadius = '12px',
    inputRadius = '10px',
    inputGap = '10px',
    inputBorderless = false,
    sendFont = 'serif',
    loadingText = 'Thinking...',
    loadingFont = 'serif',
    loadingItalic = true,
    loadingColorKey = 'muted',
    contentPadding = '28px 24px',
    messageGap = '14px',
    messageFontSize = '15px',
    messageLineHeight = 1.65,
    monoWeight = 200,
    monoLetterSpacing = '4px',
    placeholder = 'Type a message...',
  } = layout

  const MONO_U = { fontFamily: "'Inter', system-ui, sans-serif", fontWeight: monoWeight, letterSpacing: monoLetterSpacing, textTransform: 'uppercase' }
  const sendFontStyle = sendFont === 'serif' ? SERIF : MONO_U
  const loadingFontStyle = loadingFont === 'serif' ? SERIF : MONO_U
  const loadingStyle = {
    ...loadingFontStyle,
    fontSize: loadingFont === 'mono' ? '10px' : messageFontSize,
    color: c[loadingColorKey],
    ...(loadingFont === 'mono' ? { letterSpacing: '3px' } : {}),
    ...(loadingItalic && loadingFont === 'serif' ? { fontStyle: 'italic' } : {}),
  }

  const greetingText = typeof greeting === 'function' ? greeting(user?.username) : greeting
  const { messages, input, setInput, loading, status, send, resetChat, sessionId, loadSession, estimate, sessionStats } = useMiloChat(greetingText, useLibrary)

  const bottomRef = useRef(null)
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  function handleLogout() { logout(); navigate(loginPath) }
  function toggleLibrary() {
    setUseLibrary(v => { const next = !v; localStorage.setItem('milo_use_library', String(next)); return next })
  }

  const disabled = loading || !input.trim()

  return (
    <div style={{ display: 'flex', height: '100vh', background: c.bg, position: 'relative', overflow: 'hidden' }}>
      {glows && mode === 'dark' && glows.map((g, i) => (
        <div key={i} style={{ position: 'absolute', borderRadius: '50%', background: g.color, filter: `blur(${g.blur})`, pointerEvents: 'none', width: g.size, height: g.size, top: g.top, bottom: g.bottom, left: g.left, right: g.right }} />
      ))}

      <Sidebar colors={c} user={user} onLogout={handleLogout} onSettings={() => setShowSettings(true)} onNewChat={resetChat} onLoadSession={loadSession} activeSessionId={sessionId} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, position: 'relative' }}>

        <header style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '12px', padding: '12px 24px', borderBottom: `${borderWidth} solid ${c.border}` }}>
          {estimate && <TokenEstimate estimate={estimate} color={c.muted} borderColor={c.border} />}
          <button
            onClick={() => setMode(m => { const next = m === 'dark' ? 'light' : 'dark'; localStorage.setItem('milo_mode', next); return next })}
            style={{ ...MONO_U, background: 'none', border: `${borderWidth} solid ${c.border}`, borderRadius: '4px', padding: '6px 14px', color: c.muted, fontSize: '11px', cursor: 'pointer' }}>
            {mode === 'dark' ? 'Light' : 'Dark'}
          </button>
        </header>

        {sessionStats.messageCount > 0 && (
          <div style={{ padding: '8px 24px', borderBottom: `${borderWidth} solid ${c.border}` }}>
            <SessionStats stats={sessionStats} color={c.muted} borderColor={c.border} />
          </div>
        )}

        <div style={{ flex: 1, overflowY: 'auto', padding: contentPadding, display: 'flex', flexDirection: 'column', gap: messageGap }}>
          {messages.map((m, i) => {
            const prevBot = messages.slice(0, i).reverse().find(msg => msg.role === 'bot' && msg.metrics?.model)
            const modelChanged = m.role === 'bot' && m.metrics?.model && prevBot?.metrics?.model && m.metrics.model !== prevBot.metrics.model
            return (
              <div key={i}>
                {modelChanged && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '4px 0 8px', opacity: 0.55 }}>
                    <div style={{ flex: 1, height: '1px', background: c.border }} />
                    <span style={{ fontSize: '10px', color: c.muted, fontFamily: 'monospace', letterSpacing: '0.5px' }}>↺ {m.metrics.model}</span>
                    <div style={{ flex: 1, height: '1px', background: c.border }} />
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    maxWidth: '68%',
                    fontSize: messageFontSize,
                    lineHeight: messageLineHeight,
                    fontFamily: 'system-ui',
                    color: m.role === 'user' ? (c.userText ?? '#fff') : c.botText,
                    background: m.role === 'user' ? c.userBubble : c.botBubble,
                    border: m.role === 'bot' ? `${borderWidth} solid ${c.border}` : 'none',
                    padding: '12px 16px',
                    borderRadius: bubbleRadius,
                  }}>
                    {m.role === 'user' ? m.text : <MiloMarkdown>{m.text}</MiloMarkdown>}
                  </div>
                  {m.role === 'user' && messages[i + 1]?.metrics?.input_tokens != null && (
                    <span style={{ fontSize: '11px', fontFamily: 'monospace', color: c.muted, opacity: 0.7, marginTop: '4px' }}>
                      {messages[i + 1].metrics.input_tokens.toLocaleString()} tokens in
                    </span>
                  )}
                  {m.role === 'bot' && m.metrics && (
                    <MessageMetrics metrics={m.metrics} color={c.muted} borderColor={c.border} style={{ marginTop: '6px' }} />
                  )}
                </div>
              </div>
            )
          })}
          {loading && messages[messages.length - 1]?.role === 'user' && (
            <LoadingDots text={status || loadingText} style={loadingStyle} />
          )}
          <div ref={bottomRef} />
        </div>

        {inputBorderless ? (
          <div style={{ borderTop: `${borderWidth} solid ${c.border}` }}>
            <div style={{ display: 'flex' }}>
              <input
                value={input} maxLength={2000}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && send()}
                placeholder={placeholder} autoComplete="off"
                style={{ flex: 1, background: 'transparent', border: 'none', padding: '20px 32px', color: c.text, fontSize: '14px', outline: 'none', fontFamily: 'system-ui' }}
              />
              <button onClick={send} disabled={disabled}
                style={{ ...sendFontStyle, background: 'none', border: 'none', borderLeft: `${borderWidth} solid ${c.border}`, padding: '20px 28px', color: disabled ? c.muted : c.text, fontSize: '10px', letterSpacing: '3px', cursor: 'pointer' }}>
                Send
              </button>
            </div>
          </div>
        ) : (
          <div style={{ borderTop: `${borderWidth} solid ${c.border}`, padding: '12px 24px 16px' }}>
            <div style={{ display: 'flex', gap: inputGap }}>
              <input
                value={input} maxLength={2000}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && send()}
                placeholder={placeholder} autoComplete="off"
                style={{ flex: 1, background: c.input, border: `${borderWidth} solid ${c.border}`, borderRadius: inputRadius, padding: '13px 16px', color: c.text, fontSize: messageFontSize, outline: 'none', fontFamily: 'system-ui' }}
              />
              <button onClick={send} disabled={disabled}
                style={{ ...sendFontStyle, background: disabled ? c.input : c.userBubble, border: `${borderWidth} solid ${c.border}`, borderRadius: inputRadius, padding: '12px 24px', color: disabled ? c.muted : '#fff', fontSize: '16px', cursor: 'pointer' }}>
                Send
              </button>
            </div>
          </div>
        )}
      </div>

      {showSettings && <SettingsPanel colors={c} user={user} onClose={() => setShowSettings(false)} onLogout={handleLogout} useLibrary={useLibrary} onToggleLibrary={toggleLibrary} />}
    </div>
  )
}
