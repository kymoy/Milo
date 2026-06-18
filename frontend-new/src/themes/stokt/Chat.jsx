import ThemedChat from '../../components/ThemedChat'

const DARK = {
  bg: 'radial-gradient(ellipse at 70% 10%, #2a0e02 0%, #0a0a0a 55%)',
  sidebar: '#0a0604', border: 'rgba(255,107,43,0.2)', text: '#fff',
  muted: '#bbb', accent: '#ff6b2b', input: 'rgba(255,255,255,0.05)',
  userBubble: 'linear-gradient(135deg,#ff6b2b,#cc3300)', botBubble: 'rgba(255,255,255,0.05)', botText: '#fff',
}
const LIGHT = {
  bg: 'radial-gradient(ellipse at 70% 10%, #ff9966 0%, #fff8f4 70%)',
  sidebar: '#ffe8d8', border: 'rgba(204,51,0,0.25)', text: '#1a0800',
  muted: '#885533', accent: '#cc3300', input: 'rgba(255,255,255,0.6)',
  userBubble: 'linear-gradient(135deg,#ff6b2b,#cc3300)', botBubble: 'rgba(255,255,255,0.55)', botText: '#1a0800',
}

export default function Chat() {
  return (
    <ThemedChat
      dark={DARK} light={LIGHT}
      greeting={u => `Hey ${u}, I'm Milo. Ask me anything.`}
      loginPath="/stokt/login"
      layout={{ bubbleRadius: '10px', inputRadius: '8px' }}
    />
  )
}
