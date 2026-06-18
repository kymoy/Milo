import { useRef, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { useMiloChat } from '../../hooks/useMiloChat'
import MiloMarkdown from '../../components/MiloMarkdown'
import LoadingDots from '../../components/LoadingDots'
import TokenEstimate from '../../components/TokenEstimate'
import SessionStats from '../../components/SessionStats'
import MessageMetrics from '../../components/MessageMetrics'

export default function Chat() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const greeting = `${user?.username} — session active.`
  const { messages, input, setInput, loading, status, send, estimate, sessionStats } = useMiloChat(greeting)

  const bottomRef = useRef(null)
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  return (
    <div style={{ background: '#080c10', minHeight: '100vh', display: 'flex', flexDirection: 'column', maxWidth: '860px', margin: '0 auto', fontFamily: "'Inter', system-ui, sans-serif" }}>

      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 32px', borderBottom: '1px solid #0d1520' }}>
        <span style={{ fontSize: '10px', letterSpacing: '3px', color: '#c8d8e8', textTransform: 'uppercase' }}>MILO</span>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          {estimate && <TokenEstimate estimate={estimate} color='#4a6a8a' borderColor='#1a2a3a' />}
          {user?.role === 'admin' && <button onClick={() => navigate('/firstframe/admin')} style={{ background: 'none', border: 'none', color: '#6a9abb', fontSize: '9px', letterSpacing: '2px', cursor: 'pointer', fontFamily: 'inherit', textTransform: 'uppercase' }}>Admin</button>}
          <span style={{ color: '#5a7a9a', fontSize: '10px', letterSpacing: '1px' }}>{user?.username}</span>
          <button onClick={() => { logout(); navigate('/firstframe/login') }} style={{ background: 'none', border: 'none', color: '#5a7a9a', fontSize: '9px', letterSpacing: '2px', cursor: 'pointer', fontFamily: 'inherit', textTransform: 'uppercase' }}>Exit</button>
        </div>
      </header>

      {sessionStats.messageCount > 0 && (
        <div style={{ padding: '8px 32px', borderBottom: '1px solid #0d1520' }}>
          <SessionStats stats={sessionStats} color='#4a6a8a' borderColor='#1a2a3a' />
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', padding: '40px 32px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {messages.map((m, i) => {
          const prevBot = messages.slice(0, i).reverse().find(msg => msg.role === 'bot' && msg.metrics?.model)
          const modelChanged = m.role === 'bot' && m.metrics?.model && prevBot?.metrics?.model && m.metrics.model !== prevBot.metrics.model
          return (
            <div key={i}>
              {modelChanged && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '4px 0 8px', opacity: 0.45 }}>
                  <div style={{ flex: 1, height: '1px', background: '#1a2a3a' }} />
                  <span style={{ fontSize: '9px', color: '#4a6a8a', fontFamily: 'monospace', letterSpacing: '1px', textTransform: 'uppercase' }}>↺ {m.metrics.model}</span>
                  <div style={{ flex: 1, height: '1px', background: '#1a2a3a' }} />
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{ maxWidth: '65%' }}>
                  {m.role === 'bot' && <div style={{ fontSize: '8px', letterSpacing: '2px', color: '#6a9abb', textTransform: 'uppercase', marginBottom: '6px' }}>MILO</div>}
                  <div style={{ fontSize: '13px', lineHeight: 1.7, color: m.role === 'user' ? '#c8d8e8' : '#7a9ab5', letterSpacing: '0.2px' }}>{m.role === 'user' ? m.text : <MiloMarkdown>{m.text}</MiloMarkdown>}</div>
                  {m.role === 'user' && <div style={{ fontSize: '8px', color: '#5a7a9a', letterSpacing: '2px', textTransform: 'uppercase', marginTop: '6px', textAlign: 'right' }}>{user?.username}</div>}
                  {m.role === 'user' && messages[i + 1]?.metrics?.input_tokens != null && (
                    <div style={{ fontSize: '10px', fontFamily: 'monospace', color: '#4a6a8a', opacity: 0.7, marginTop: '3px', textAlign: 'right' }}>{messages[i + 1].metrics.input_tokens.toLocaleString()} tokens in</div>
                  )}
                  {m.role === 'bot' && m.metrics && (
                    <MessageMetrics metrics={m.metrics} color='#4a6a8a' borderColor='#1a2a3a' style={{ marginTop: '8px' }} />
                  )}
                </div>
              </div>
            </div>
          )
        })}
        {loading && messages[messages.length - 1]?.role === 'user' && <LoadingDots text={status || 'Processing...'} style={{ fontSize: '9px', color: '#6a9abb', letterSpacing: '3px', textTransform: 'uppercase' }} />}
        <div ref={bottomRef} />
      </div>

      <div style={{ borderTop: '1px solid #0d1520' }}>
        <div style={{ display: 'flex' }}>
          <input value={input} maxLength={2000} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="Type a message..." style={{ flex: 1, background: 'transparent', border: 'none', padding: '20px 32px', color: '#c8d8e8', fontSize: '13px', outline: 'none', fontFamily: 'inherit', letterSpacing: '0.2px' }} />
          <button onClick={send} disabled={loading || !input.trim()} style={{ background: 'none', border: 'none', borderLeft: '1px solid #0d1520', padding: '20px 28px', color: loading || !input.trim() ? '#1a2a3a' : '#c8d8e8', fontSize: '9px', letterSpacing: '3px', textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'inherit' }}>Send</button>
        </div>
      </div>

    </div>
  )
}
