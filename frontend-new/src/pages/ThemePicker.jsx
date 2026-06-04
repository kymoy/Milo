import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const PRESETS = [
  { id: 'crystals', label: 'Crystals', bg: '#000000', dot: '#ffffff' },
  { id: 'stiff',    label: 'Stiff',    bg: '#12121e', dot: '#cc2200' },
  { id: 'stokt',    label: 'Stōkt',    bg: '#0a0a0a', dot: '#ff6b2b' },
  { id: 'combined', label: 'Combined', bg: '#050508', dot: '#ff7c45' },
  { id: 'lavender', label: 'Lavender', bg: '#1a1228', dot: '#c4b5fd' },
]

const SERIF  = { fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 300 }
const MONO_U = { fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 100, letterSpacing: '8px', textTransform: 'uppercase' }
const LABEL  = { fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 200, letterSpacing: '3px', textTransform: 'uppercase' }

export default function ThemePicker() {
  const navigate = useNavigate()
  const [showCustom, setShowCustom] = useState(false)
  const [accent, setAccent] = useState('#7c3aed')

  function applyCustom(mode) {
    const theme = {
      bg:         mode === 'dark' ? '#0a0a0f' : '#f5f5fb',
      accent,
      text:       mode === 'dark' ? '#e8e8f0' : '#111118',
      userBubble: accent,
      botBubble:  mode === 'dark' ? '#16161e' : '#ebebf5',
      botText:    mode === 'dark' ? '#e8e8f0' : '#111118',
      mode,
    }
    localStorage.setItem('milo_custom_theme', JSON.stringify(theme))
    navigate('/custom/login')
  }

  return (
    <div style={{ background: '#060608', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '64px 24px 80px' }}>

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '64px' }}>
        <div style={{ ...MONO_U, fontSize: '32px', color: '#e0e0f0', marginBottom: '16px' }}>Milo</div>
        <div style={{ ...SERIF, fontSize: '22px', color: '#aaaacc', fontStyle: 'italic' }}>Choose your theme</div>
      </div>

      <div style={{ width: '100%', maxWidth: '640px' }}>

        <div style={{ ...SERIF, fontSize: '18px', color: '#8888bb', letterSpacing: '1px', marginBottom: '16px', fontStyle: 'italic' }}>Presets</div>

        {/* Preset grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px', marginBottom: '10px' }}>
          {PRESETS.map(t => (
            <button key={t.id} onClick={() => navigate(`/${t.id}/login`)}
              style={{ background: t.bg, border: `1px solid ${t.dot}33`, borderRadius: '10px', padding: '22px 14px', cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.2s, transform 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = t.dot; e.currentTarget.style.transform = 'translateY(-2px)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = `${t.dot}33`; e.currentTarget.style.transform = 'none' }}>
              <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: t.dot, marginBottom: '14px' }} />
              <div style={{ ...SERIF, fontSize: '16px', color: t.dot }}>{t.label}</div>
            </button>
          ))}
        </div>

        {/* Custom card */}
        <button onClick={() => setShowCustom(s => !s)}
          style={{ width: '100%', background: showCustom ? '#0e0e14' : 'transparent', border: '1px solid #252535', borderRadius: '10px', padding: '22px 20px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: accent, flexShrink: 0 }} />
              <div>
                <div style={{ ...SERIF, fontSize: '18px', color: '#d0d0e8' }}>Custom</div>
                <div style={{ ...SERIF, fontSize: '15px', color: '#9090bb', fontStyle: 'italic', marginTop: '3px' }}>Pick your color</div>
              </div>
            </div>
            <div style={{ fontFamily: 'Inter', fontWeight: 100, fontSize: '22px', color: '#9090bb', transition: 'transform 0.2s', transform: showCustom ? 'rotate(45deg)' : 'none' }}>+</div>
          </div>
        </button>

        {/* Custom expanded */}
        {showCustom && (
          <div style={{ background: '#0e0e14', border: '1px solid #252535', borderTop: 'none', borderRadius: '0 0 10px 10px', padding: '28px 20px' }}>

            <div style={{ display: 'flex', alignItems: 'center', gap: '18px', marginBottom: '28px' }}>
              <input type="color" value={accent} onChange={e => setAccent(e.target.value)}
                style={{ width: '64px', height: '64px', border: '1px solid #252535', borderRadius: '10px', cursor: 'pointer', background: 'none', padding: '3px', flexShrink: 0 }} />
              <div>
                <div style={{ ...SERIF, fontSize: '16px', color: '#aaaacc', fontStyle: 'italic', marginBottom: '6px' }}>Accent color</div>
                <div style={{ ...LABEL, fontSize: '14px', color: '#d0d0e8' }}>{accent.toUpperCase()}</div>
              </div>
            </div>

            <div style={{ ...SERIF, fontSize: '16px', color: '#8888bb', fontStyle: 'italic', marginBottom: '12px' }}>Preview</div>
            <div style={{ background: '#0a0a0f', borderRadius: '8px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px', border: '1px solid #252535' }}>
              <div style={{ ...MONO_U, fontSize: '12px', color: accent }}>Milo</div>
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{ background: '#16161e', color: '#e8e8f0', fontSize: '14px', padding: '9px 13px', borderRadius: '8px', fontFamily: 'system-ui', maxWidth: '75%' }}>
                  Hey, I'm Milo. How can I help?
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <div style={{ background: accent, color: '#fff', fontSize: '14px', padding: '9px 13px', borderRadius: '8px', fontFamily: 'system-ui', maxWidth: '75%' }}>
                  Tell me about vulnerabilities.
                </div>
              </div>
            </div>

            <div style={{ ...SERIF, fontSize: '16px', color: '#8888bb', fontStyle: 'italic', marginBottom: '12px' }}>Select mode</div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => applyCustom('dark')}
                style={{ flex: 1, background: accent, border: 'none', borderRadius: '8px', padding: '14px', color: '#fff', ...SERIF, fontSize: '18px', letterSpacing: '1px', cursor: 'pointer' }}>
                Dark
              </button>
              <button onClick={() => applyCustom('light')}
                style={{ flex: 1, background: '#f5f5fb', border: `2px solid ${accent}`, borderRadius: '8px', padding: '14px', color: accent, ...SERIF, fontSize: '18px', letterSpacing: '1px', cursor: 'pointer' }}>
                Light
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
