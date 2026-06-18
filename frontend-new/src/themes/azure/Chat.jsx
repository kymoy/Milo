import ThemedChat from '../../components/ThemedChat'

const DARK = {
  bg: 'linear-gradient(135deg, #0d1b35 0%, #162040 100%)',
  sidebar: '#0f1e38', border: 'rgba(96,165,250,0.25)', text: '#e8f0ff',
  muted: '#90b8f0', accent: '#60a5fa', input: 'rgba(96,165,250,0.08)',
  userBubble: 'linear-gradient(135deg,#60a5fa,#1d4ed8)', botBubble: 'rgba(59,130,246,0.14)', botText: '#bcd9ff',
}
const LIGHT = {
  bg: 'linear-gradient(135deg, #cce0ff 0%, #b3cdfa 100%)',
  sidebar: '#a8c8f5', border: 'rgba(29,78,216,0.3)', text: '#0b1d38',
  muted: '#1a4a8c', accent: '#1d4ed8', input: 'rgba(255,255,255,0.5)',
  userBubble: 'linear-gradient(135deg,#3b82f6,#1d4ed8)', botBubble: 'rgba(255,255,255,0.42)', botText: '#0b1d38',
}

const GLOWS = [
  { top: '5%',    left: '35%', size: '520px', color: 'rgba(59,130,246,0.11)',  blur: '110px' },
  { bottom: '12%', right: '18%', size: '400px', color: 'rgba(99,102,241,0.09)',  blur: '85px'  },
  { top: '58%',   left: '6%',  size: '300px', color: 'rgba(147,197,253,0.08)', blur: '65px'  },
]

export default function Chat() {
  return (
    <ThemedChat
      dark={DARK} light={LIGHT}
      greeting={u => `Hi ${u} — I'm Milo. How can I help you today?`}
      loginPath="/azure/login"
      glows={GLOWS}
    />
  )
}
