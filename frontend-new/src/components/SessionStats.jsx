function StatCell({ label, value, color }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'center' }}>
      <span style={{ fontSize: '9px', fontFamily: 'monospace', color, opacity: 0.55, textTransform: 'uppercase', letterSpacing: '1.5px' }}>{label}</span>
      <span style={{ fontSize: '13px', fontFamily: 'monospace', color, fontWeight: 500 }}>{value}</span>
    </div>
  )
}

export default function SessionStats({ stats, color, borderColor, style }) {
  if (!stats?.messageCount) return null
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '24px',
        padding: '8px 14px',
        background: 'rgba(128,128,128,0.06)',
        border: `1px solid ${borderColor || 'rgba(128,128,128,0.15)'}`,
        borderRadius: '8px',
        ...style
      }}>
        <span style={{ fontSize: '9px', fontFamily: 'monospace', color, opacity: 0.4, textTransform: 'uppercase', letterSpacing: '2px', marginRight: '4px' }}>Session Total</span>
        <StatCell label="Msgs" value={stats.messageCount} color={color} />
        <StatCell label="Tokens In" value={stats.totalInputTokens > 0 ? stats.totalInputTokens.toLocaleString() : '0'} color={color} />
        <StatCell label="Tokens Out" value={stats.totalOutputTokens > 0 ? stats.totalOutputTokens.toLocaleString() : '0'} color={color} />
        <StatCell label="Total Tokens" value={(stats.totalInputTokens + stats.totalOutputTokens).toLocaleString()} color={color} />
        {stats.totalCost > 0 && <StatCell label="Cost" value={`$${stats.totalCost.toFixed(4)}`} color={color} />}
      </div>
    </div>
  )
}
