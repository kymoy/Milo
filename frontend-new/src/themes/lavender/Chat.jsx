import ThemedChat from '../../components/ThemedChat'

const DARK = {
  bg: 'linear-gradient(135deg, #1a1228 0%, #0f0a1e 100%)',
  sidebar: '#110c1c', border: 'rgba(196,181,253,0.15)', text: '#ede9fe',
  muted: '#b8a8e0', accent: '#c4b5fd', input: 'rgba(196,181,253,0.06)',
  userBubble: 'linear-gradient(135deg,#c4b5fd,#7c3aed)', botBubble: 'rgba(196,181,253,0.07)', botText: '#c4b5fd',
}
const LIGHT = {
  bg: 'linear-gradient(135deg, #f0ecff 0%, #e8e0ff 100%)',
  sidebar: '#e0d8f8', border: 'rgba(124,58,237,0.2)', text: '#1a0a40',
  muted: '#7755bb', accent: '#6d28d9', input: 'rgba(124,58,237,0.05)',
  userBubble: 'linear-gradient(135deg,#a78bfa,#6d28d9)', botBubble: 'rgba(124,58,237,0.06)', botText: '#1a0a40',
}

export default function Chat() {
  return (
    <ThemedChat
      dark={DARK} light={LIGHT}
      greeting={u => `Hi ${u} — I'm Milo. How can I help you today?`}
      loginPath="/lavender/login"
    />
  )
}
