import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export default function MiloMarkdown({ children }) {
  return (
    <div className="milo-md">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  )
}
