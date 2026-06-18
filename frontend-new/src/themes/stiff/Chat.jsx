import ThemedChat from '../../components/ThemedChat'

const DARK = {
  bg: '#12121e', sidebar: '#0d0d18', border: '#2a2a40', text: '#f5f0e8',
  muted: '#999', accent: '#cc2200', input: '#1c1c2e',
  userBubble: '#cc2200', botBubble: '#1c1c2e', botText: '#c8c0b0',
}
const LIGHT = {
  bg: '#f5f0e8', sidebar: '#ece8e0', border: '#c8c0b8', text: '#12121e',
  muted: '#777', accent: '#cc2200', input: '#ece8e0',
  userBubble: '#cc2200', botBubble: '#e8e0d8', botText: '#12121e',
}

export default function Chat() {
  return (
    <ThemedChat
      dark={DARK} light={LIGHT}
      greeting={u => `What's good, ${u}? I'm Milo.`}
      loginPath="/stiff/login"
      layout={{
        borderWidth: '2px',
        bubbleRadius: '4px',
        inputRadius: '4px',
        inputGap: '12px',
        loadingItalic: false,
        loadingColorKey: 'accent',
        messageGap: '16px',
        monoLetterSpacing: '3px',
        placeholder: 'Say something...',
      }}
    />
  )
}
