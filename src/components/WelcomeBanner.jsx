import { useEffect, useState } from 'react'
import { X, BookOpen } from 'lucide-react'
import { Button } from './ui/button'
const STORAGE_KEY = 'domi_intro_count'
const MAX_SHOWS = 3

export default function WelcomeBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const count = parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10)
    if (count < MAX_SHOWS) {
      setVisible(true)
      localStorage.setItem(STORAGE_KEY, String(count + 1))
    }
  }, [])

  function dismiss() {
    setVisible(false)
  }

  function dismissForever() {
    localStorage.setItem(STORAGE_KEY, String(MAX_SHOWS))
    setVisible(false)
  }

  if (!visible) {
    return (
      <button
        onClick={() => setVisible(true)}
        className="fixed bottom-20 md:bottom-6 right-4 z-50 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-sky-500 text-white text-xs font-semibold shadow-lg hover:bg-sky-600 transition-colors"
        title="Show intro banner"
      >
        <BookOpen size={13} />
        What is domi?
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={dismiss}
      />

      {/* Panel */}
      <div className="relative w-full max-w-md rounded-3xl overflow-hidden shadow-2xl">

        {/* Top: Korean word showcase */}
        <div className="bg-gradient-to-br from-sky-400 to-sky-500 px-8 pt-10 pb-8 text-white text-center">
          <button
            onClick={dismiss}
            className="absolute top-4 right-4 p-1.5 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={16} />
          </button>

          <div className="flex items-start justify-center gap-10">
            {/* Doum */}
            <div className="flex flex-col items-center gap-1">
              <span
                className="text-5xl font-bold leading-none tracking-tight"
                style={{ fontFamily: "'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif", letterSpacing: '-0.02em' }}
              >
                도움
              </span>
              <span className="text-sky-100 text-xs tracking-widest uppercase mt-1">[do·eum]</span>
              <span className="text-white/80 text-sm font-medium mt-0.5">Doum</span>
            </div>

            <div className="text-white/30 text-3xl font-light self-center">·</div>

            {/* Domi */}
            <div className="flex flex-col items-center gap-1">
              <span
                className="text-5xl font-bold leading-none tracking-tight"
                style={{ fontFamily: "'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif", letterSpacing: '-0.02em' }}
              >
                도우미
              </span>
              <span className="text-sky-100 text-xs tracking-widest uppercase mt-1">[do·umi]</span>
              <span className="text-white/80 text-sm font-medium mt-0.5">Domi</span>
            </div>
          </div>
        </div>

        {/* Bottom: description */}
        <div className="bg-white px-8 py-7">
          <div className="space-y-4 mb-7">
            <div className="flex gap-3">
              <span className="text-xl mt-0.5">🙋</span>
              <div>
                <p className="text-sm font-semibold text-gray-900">Doum — a call for help</p>
                <p className="text-sm text-gray-500 mt-0.5">Post a doum when you need a hand. A quick task, a favor, anything.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <span className="text-xl mt-0.5">🤝</span>
              <div>
                <p className="text-sm font-semibold text-gray-900">Domi — a helper</p>
                <p className="text-sm text-gray-500 mt-0.5">Answer doums, earn tokens, build your reputation as a domi.</p>
              </div>
            </div>
          </div>

          <Button
            onClick={dismiss}
            className="w-full bg-sky-500 hover:bg-sky-600 text-white rounded-xl h-11 text-sm font-semibold"
          >
            Got it →
          </Button>
          <button
            onClick={dismissForever}
            className="w-full mt-3 text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            Don't show again
          </button>
        </div>
      </div>
    </div>
  )
}
