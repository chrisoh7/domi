import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Send, MessageSquare } from 'lucide-react'

export default function TaskChat({ taskId, posterId, runnerId }) {
  const { user, profile } = useAuth()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)

  const canChat = user?.id === posterId || user?.id === runnerId

  useEffect(() => {
    fetchMessages()

    const channel = supabase
      .channel(`chat-${taskId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `task_id=eq.${taskId}`,
      }, payload => {
        setMessages(prev => [...prev, payload.new])
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [taskId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function fetchMessages() {
    const { data } = await supabase
      .from('messages')
      .select('*, profiles(name, avatar_url)')
      .eq('task_id', taskId)
      .order('created_at')
    setMessages(data || [])
  }

  async function sendMessage(e) {
    e.preventDefault()
    if (!input.trim() || !canChat) return
    setSending(true)
    await supabase.from('messages').insert({
      task_id: taskId,
      sender_id: user.id,
      body: input.trim(),
    })
    setInput('')
    setSending(false)
  }

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200 flex items-center gap-2">
        <MessageSquare size={14} className="text-gray-500" />
        <span className="text-sm font-semibold text-gray-700">Chat</span>
        <span className="text-xs text-gray-400 ml-1">· poster & domi only</span>
      </div>

      <div className="h-56 overflow-y-auto p-3 space-y-2 bg-white">
        {messages.length === 0 && (
          <p className="text-center text-sm text-gray-400 py-8">No messages yet.</p>
        )}
        {messages.map(msg => {
          const isMe = msg.sender_id === user?.id
          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] rounded-2xl px-3 py-2 ${isMe ? 'bg-[#C41230] text-white' : 'bg-gray-100 text-gray-800'}`}>
                {!isMe && (
                  <p className="text-[10px] font-semibold mb-0.5 opacity-60">{msg.profiles?.name ?? 'User'}</p>
                )}
                <p className="text-sm leading-snug">{msg.body}</p>
                <p className={`text-[10px] mt-0.5 ${isMe ? 'opacity-50' : 'text-gray-400'}`}>
                  {new Date(msg.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                </p>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {canChat ? (
        <form onSubmit={sendMessage} className="border-t border-gray-200 p-2.5 flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Message..."
            className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#C41230]"
          />
          <button type="submit" disabled={sending || !input.trim()}
            className="p-2 bg-[#C41230] text-white rounded-lg hover:bg-[#a00f28] disabled:opacity-50 transition-colors">
            <Send size={14} />
          </button>
        </form>
      ) : (
        <p className="text-xs text-gray-400 text-center py-2.5 border-t border-gray-200">
          Chat is only available to the poster and domi.
        </p>
      )}
    </div>
  )
}
