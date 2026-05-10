import { useState, useRef, useEffect } from 'react'
import './index.css'
import ChatPanel from './components/ChatPanel'
import UploadPanel from './components/UploadPanel'

export default function App() {
  const [connected, setConnected] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const apiUrl = import.meta.env.VITE_API_URL || ''
    fetch(`${apiUrl}/api/health`, { signal: AbortSignal.timeout(3000) })
      .then(r => r.ok ? setConnected(true) : setConnected(false))
      .catch(() => setConnected(false))
      .finally(() => setChecking(false))
  }, [])

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-[#30363d] bg-[#161b22]">
        <div className="flex items-center gap-3">
          <span className="font-bold text-lg">MiMo RAG Chat</span>
          <span className="text-xs text-[#8b949e]">Powered by Xiaomi MiMo</span>
        </div>
        <div className="flex items-center gap-2">
          {!checking && (
            <span className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border ${
              connected
                ? 'border-[#238636] text-[#3fb950] bg-[#238636]/10'
                : 'border-[#da3633] text-[#f85149] bg-[#da3633]/10'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-[#3fb950]' : 'bg-[#f85149]'}`} />
              {connected ? 'Connected' : 'Disconnected'}
            </span>
          )}
        </div>
      </header>

      {/* Main layout */}
      <main className="flex-1 flex overflow-hidden">
        {/* Upload panel */}
        <UploadPanel />

        {/* Divider */}
        <div className="w-px bg-[#30363d]" />

        {/* Chat panel */}
        <ChatPanel connected={connected} />
      </main>
    </div>
  )
}