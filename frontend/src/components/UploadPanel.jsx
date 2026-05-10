import { useState, useRef } from 'react'

export default function UploadPanel() {
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef()

  const apiUrl = import.meta.env.VITE_API_URL || ''

  const handleFile = (f) => {
    if (f.size > 10 * 1024 * 1024) {
      setError('File too large (max 10 MB)')
      return
    }
    setFile(f)
    setResult(null)
    setError(null)
  }

  const upload = async () => {
    if (!file) return
    setUploading(true)
    setError(null)
    setResult(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`${apiUrl}/api/upload`, { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Upload failed')
      setResult(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <aside className="w-72 flex-shrink-0 bg-[#161b22] p-4 overflow-y-auto">
      <h2 className="text-sm font-semibold text-[#8b949e] uppercase tracking-wider mb-3">Document</h2>

      {/* Drop zone */}
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors mb-3 ${
          dragging ? 'border-[#58a6ff] bg-[#58a6ff]/5' : 'border-[#30363d] hover:border-[#484f58]'
        }`}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => {
          e.preventDefault()
          setDragging(false)
          const f = e.dataTransfer.files[0]
          if (f) handleFile(f)
        }}
        onClick={() => inputRef.current.click()}
      >
        <p className="text-sm text-[#8b949e]">
          {file ? file.name : 'Drop PDF or TXT here'}
        </p>
        <p className="text-xs text-[#484f58] mt-1">max 10 MB</p>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.txt"
          className="hidden"
          onChange={e => { const f = e.target.files[0]; if (f) handleFile(f) }}
        />
      </div>

      {file && (
        <button
          onClick={upload}
          disabled={uploading}
          className="w-full py-2 rounded-md text-sm font-medium bg-[#238636] hover:bg-[#2ea043] disabled:opacity-50 transition-colors mb-3"
        >
          {uploading ? 'Indexing…' : 'Index Document'}
        </button>
      )}

      {error && (
        <div className="text-xs text-[#f85149] bg-[#f85149]/10 border border-[#f85149]/30 rounded p-2 mb-3">
          {error}
        </div>
      )}

      {result && (
        <div className="text-xs bg-[#238636]/10 border border-[#238636]/30 rounded p-2">
          <p className="text-[#3fb950] font-medium">Indexed!</p>
          <p className="text-[#8b949e] mt-1">
            {result.filename} — {result.chunks} chunks
          </p>
        </div>
      )}

      {/* Sample prompt hints */}
      <div className="mt-6">
        <h3 className="text-xs font-semibold text-[#8b949e] uppercase tracking-wider mb-2">Try asking</h3>
        <ul className="space-y-1 text-xs text-[#58a6ff]">
          {['What is this document about?', 'Summarize key points', 'Find specific details'].map(q => (
            <li key={q} className="cursor-default hover:underline">→ {q}</li>
          ))}
        </ul>
      </div>
    </aside>
  )
}