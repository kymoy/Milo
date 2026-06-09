import { useNavigate } from 'react-router-dom'
const PRESETS = [
  { id: 'crystals', label: 'Crystals', bg: '#000000', dot: '#ffffff' },
  { id: 'stiff',    label: 'Stiff',    bg: '#12121e', dot: '#cc2200' },
  { id: 'stokt',    label: 'Stōkt',    bg: '#0a0a0a', dot: '#ff6b2b' },
  { id: 'lavender', label: 'Lavender', bg: '#1a1228', dot: '#c4b5fd' },
  { id: 'azure',    label: 'Azure',    bg: '#070d1a', dot: '#60a5fa' },
]

const SERIF  = { fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 300 }
const MONO_U = { fontFamily: "'Inter', system-ui, sans-serif", fontWeight: 100, letterSpacing: '8px', textTransform: 'uppercase' }

export default function ThemePicker() {
  const navigate = useNavigate()

  return (
    <div style={{ background: '#060608', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 24px' }}>

      <div style={{ textAlign: 'center', marginBottom: '56px' }}>
        <div style={{ ...MONO_U, fontSize: '32px', color: '#e0e0f0', marginBottom: '16px' }}>Milo</div>
        <div style={{ ...SERIF, fontSize: '22px', color: '#aaaacc', fontStyle: 'italic' }}>Choose your theme</div>
      </div>

      <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
        {PRESETS.map(t => (
          <button key={t.id} onClick={() => navigate(`/${t.id}/login`)}
            style={{ background: t.bg, border: `1px solid ${t.dot}33`, borderRadius: '12px', padding: '28px 20px', cursor: 'pointer', textAlign: 'left', width: '140px', transition: 'border-color 0.2s, transform 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = t.dot; e.currentTarget.style.transform = 'translateY(-3px)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = `${t.dot}33`; e.currentTarget.style.transform = 'none' }}>
            <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: t.dot, marginBottom: '16px' }} />
            <div style={{ ...SERIF, fontSize: '17px', color: t.dot }}>{t.label}</div>
          </button>
        ))}
      </div>
    </div>
  )
}
