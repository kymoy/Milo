const DOT = (delay) => ({
  animation: 'milo-blink 1.4s infinite ease-in-out',
  animationDelay: delay,
})

export default function LoadingDots({ text, style }) {
  const label = text ? text.replace(/\.+$/, '') : ''
  return (
    <span style={style}>
      {label}
      <span style={DOT('0s')}>.</span>
      <span style={DOT('0.2s')}>.</span>
      <span style={DOT('0.4s')}>.</span>
    </span>
  )
}
