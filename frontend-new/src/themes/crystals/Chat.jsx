import ThemedChat from '../../components/ThemedChat'

const DARK = {
  bg: '#000', sidebar: '#080808', border: '#333', text: '#fff',
  muted: '#ccc', accent: '#fff', input: 'transparent',
  userBubble: '#fff', botBubble: 'transparent', botText: '#e8e8e8',
  userText: '#000',
}
const LIGHT = {
  bg: '#fff', sidebar: '#f5f5f5', border: '#bbb', text: '#000',
  muted: '#444', accent: '#000', input: 'transparent',
  userBubble: '#000', botBubble: 'transparent', botText: '#222',
  userText: '#fff',
}

export default function Chat() {
  return (
    <ThemedChat
      dark={DARK} light={LIGHT}
      greeting={u => `${u} — ready.`}
      loginPath="/crystals/login"
      layout={{
        bubbleRadius: '2px',
        inputBorderless: true,
        sendFont: 'mono',
        loadingFont: 'mono',
        loadingItalic: false,
        contentPadding: '40px 32px',
        messageGap: '24px',
        messageFontSize: '14px',
        messageLineHeight: 1.7,
        monoWeight: 100,
        monoLetterSpacing: '6px',
      }}
    />
  )
}
