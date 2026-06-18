export default function TokenEstimate({ estimate, color, borderColor, style }) {
  if (!estimate?.inputTokens) return null
  const parts = [`~${estimate.inputTokens.toLocaleString()} tokens`]
  if (estimate.estimatedCost != null) parts.push(`~$${estimate.estimatedCost.toFixed(4)}`)
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', ...style }}>
      <span style={{ fontSize: '9px', fontFamily: 'monospace', color: color || '#888', opacity: 0.55, textTransform: 'uppercase', letterSpacing: '1.5px' }}>
        This message
      </span>
      <span style={{
        display: 'inline-block',
        fontSize: '11px',
        fontFamily: 'monospace',
        color: color || '#888',
        background: 'rgba(128,128,128,0.08)',
        border: `1px solid ${borderColor || 'rgba(128,128,128,0.2)'}`,
        borderRadius: '4px',
        padding: '2px 7px',
      }}>
        {parts.join(' · ')}
      </span>
    </span>
  )
}
