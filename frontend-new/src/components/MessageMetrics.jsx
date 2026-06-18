export default function MessageMetrics({ metrics, color, borderColor, style }) {
  if (!metrics) return null
  const items = [
    metrics.model,
    metrics.response_ms != null && `${(metrics.response_ms / 1000).toFixed(1)}s`,
    metrics.output_tokens != null && `${metrics.output_tokens.toLocaleString()} tokens out`,
    metrics.cost != null && `$${metrics.cost.toFixed(4)}`,
    metrics.gpu_percent != null && `GPU ${metrics.gpu_percent}%`,
    (metrics.input_tokens != null || metrics.output_tokens != null) && `${((metrics.input_tokens ?? 0) + (metrics.output_tokens ?? 0)).toLocaleString()} total`,
  ].filter(Boolean)

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', ...style }}>
      {items.map((item, i) => (
        <span key={i} style={{
          display: 'inline-block',
          fontSize: '11px',
          fontFamily: 'monospace',
          color: color || '#888',
          background: 'rgba(128,128,128,0.08)',
          border: `1px solid ${borderColor || 'rgba(128,128,128,0.2)'}`,
          borderRadius: '4px',
          padding: '2px 7px',
          lineHeight: 1.5,
        }}>
          {item}
        </span>
      ))}
    </div>
  )
}
