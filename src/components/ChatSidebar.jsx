import { useState, useEffect, useRef } from 'react'
import { X, ArrowLeft, Send, MessageSquare } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useChat } from '../contexts/ChatContext'
import { timeAgo } from '../lib/utils'

const CATEGORY_EMOJI = {
  'Errands & Pickup':    '🛍️',
  'Tutoring & Academic': '📚',
  'Moving':              '📦',
  'Tech Help':           '💻',
  'Fitness & Wellness':  '🏋️',
  'Other':               '✨',
}

function getLastRead(taskId) {
  return localStorage.getItem(`domi_read_${taskId}`) || '1970-01-01T00:00:00Z'
}

function markRead(taskId) {
  localStorage.setItem(`domi_read_${taskId}`, new Date().toISOString())
}

export default function ChatSidebar() {
  const { user } = useAuth()
  const { isOpen, close, activeTaskId, setActiveTaskId, setUnreadTotal } = useChat()
  const [conversations, setConversations] = useState([])
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)

  const activeConv = conversations.find(c => c.id === activeTaskId)
  const isClosed = activeConv && (activeConv.status === 'completed' || activeConv.status === 'disputed')

  // ── Fetch conversation list ────────────────────────────────────────────────
  async function fetchConversations() {
    if (!user) return
    const { data: tasks } = await supabase
      .from('tasks')
      .select('id, title, status, category, poster_id, runner_id')
      .or(`poster_id.eq.${user.id},runner_id.eq.${user.id}`)
      .not('runner_id', 'is', null)
      .order('created_at', { ascending: false })

    if (!tasks?.length) { setConversations([]); setUnreadTotal(0); return }

    const taskIds = tasks.map(t => t.id)
    const { data: msgs } = await supabase
      .from('messages')
      .select('task_id, body, created_at, sender_id')
      .in('task_id', taskIds)
      .order('created_at', { ascending: false })

    const lastMsgMap = {}
    const unreadMap = {}
    for (const msg of (msgs || [])) {
      if (!lastMsgMap[msg.task_id]) lastMsgMap[msg.task_id] = msg
      const lastRead = getLastRead(msg.task_id)
      if (msg.sender_id !== user.id && msg.created_at > lastRead) {
        unreadMap[msg.task_id] = (unreadMap[msg.task_id] || 0) + 1
      }
    }

    const convs = tasks.map(t => ({
      ...t,
      lastMessage: lastMsgMap[t.id] || null,
      unread: unreadMap[t.id] || 0,
    }))

    setConversations(convs)
    setUnreadTotal(Object.values(unreadMap).reduce((a, b) => a + b, 0))
  }

  useEffect(() => { fetchConversations() }, [user]) // eslint-disable-line

  // ── Realtime: re-fetch on any new message ──────────────────────────────────
  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel('chat-sidebar-' + user.id)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' },
        () => {
          fetchConversations()
          if (activeTaskId) fetchMessages(activeTaskId)
        })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [user, activeTaskId]) // eslint-disable-line

  // ── Fetch messages for active conversation ─────────────────────────────────
  async function fetchMessages(taskId) {
    const { data } = await supabase
      .from('messages')
      .select('*, profiles(name, avatar_url)')
      .eq('task_id', taskId)
      .order('created_at')
    setMessages(data || [])
  }

  useEffect(() => {
    if (!activeTaskId) return
    fetchMessages(activeTaskId)
    markRead(activeTaskId)
    setConversations(prev =>
      prev.map(c => c.id === activeTaskId ? { ...c, unread: 0 } : c)
    )
    setUnreadTotal(prev => {
      const conv = conversations.find(c => c.id === activeTaskId)
      return Math.max(0, prev - (conv?.unread || 0))
    })
  }, [activeTaskId]) // eslint-disable-line

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Send message ───────────────────────────────────────────────────────────
  async function sendMessage(e) {
    e.preventDefault()
    if (!input.trim() || !activeTaskId || isClosed) return
    setSending(true)
    await supabase.from('messages').insert({
      task_id: activeTaskId,
      sender_id: user.id,
      body: input.trim(),
    })
    setInput('')
    setSending(false)
    markRead(activeTaskId)
  }

  function goBack() {
    setActiveTaskId(null)
    setMessages([])
    setInput('')
  }

  // ── Sort: active first, closed last, within each group newest-last-message first ──
  const sorted = [...conversations].sort((a, b) => {
    const aClosed = a.status === 'completed' || a.status === 'disputed'
    const bClosed = b.status === 'completed' || b.status === 'disputed'
    if (aClosed !== bClosed) return aClosed ? 1 : -1
    const aTime = a.lastMessage?.created_at || ''
    const bTime = b.lastMessage?.created_at || ''
    return bTime > aTime ? 1 : -1
  })

  const hasClosedSection = sorted.some(c => c.status === 'completed' || c.status === 'disputed')
  const hasActiveSection = sorted.some(c => c.status !== 'completed' && c.status !== 'disputed')

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 md:hidden"
          onClick={close}
        />
      )}

      {/* Sidebar panel */}
      <div
        className={`fixed top-14 right-0 h-[calc(100vh-3.5rem)] w-80 bg-white border-l border-gray-200 shadow-2xl z-40 flex flex-col transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-4 h-14 border-b border-gray-100 flex-shrink-0">
          {activeTaskId ? (
            <button
              onClick={goBack}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors flex-shrink-0"
            >
              <ArrowLeft size={16} />
            </button>
          ) : null}

          <div className="flex-1 min-w-0">
            {activeTaskId ? (
              <>
                <p className="text-sm font-semibold truncate leading-tight">{activeConv?.title ?? 'Chat'}</p>
                <p className={`text-xs leading-tight ${isClosed ? 'text-red-400' : 'text-green-500'}`}>
                  {isClosed ? `Closed · ${activeConv?.status}` : 'Active'}
                </p>
              </>
            ) : (
              <span className="text-sm font-semibold">Messages</span>
            )}
          </div>

          <button
            onClick={close}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors flex-shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        {activeTaskId ? (
          // ── Conversation view ──────────────────────────────────────────────
          <>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {messages.length === 0 && (
                <p className="text-center text-sm text-gray-400 py-10">No messages yet.</p>
              )}
              {messages.map(msg => {
                const isMe = msg.sender_id === user?.id
                return (
                  <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-2xl px-3 py-2 ${isMe ? 'bg-primary text-white' : 'bg-gray-100 text-gray-800'}`}>
                      {!isMe && (
                        <p className="text-[10px] font-semibold mb-0.5 opacity-60">{msg.profiles?.name ?? 'User'}</p>
                      )}
                      <p className="text-sm leading-snug break-words">{msg.body}</p>
                      <p className={`text-[10px] mt-0.5 ${isMe ? 'opacity-50' : 'text-gray-400'}`}>
                        {new Date(msg.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                )
              })}
              <div ref={bottomRef} />
            </div>

            {isClosed ? (
              <div className="border-t border-gray-100 px-4 py-3 text-xs text-gray-400 text-center flex-shrink-0 bg-gray-50">
                Chat closed — this doum is {activeConv?.status}.
              </div>
            ) : (
              <form onSubmit={sendMessage} className="border-t border-gray-100 p-2.5 flex gap-2 flex-shrink-0">
                <input
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder="Message..."
                  className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-gray-50"
                />
                <button
                  type="submit"
                  disabled={sending || !input.trim()}
                  className="p-2 bg-primary text-white rounded-xl hover:bg-primary/90 disabled:opacity-50 transition-colors flex-shrink-0"
                >
                  <Send size={14} />
                </button>
              </form>
            )}
          </>
        ) : (
          // ── Conversation list ──────────────────────────────────────────────
          <div className="flex-1 overflow-y-auto">
            {sorted.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-6 py-16">
                <MessageSquare size={32} className="text-gray-200 mb-3" />
                <p className="text-sm font-medium text-gray-500">No conversations yet</p>
                <p className="text-xs text-gray-400 mt-1">Accept or post a doum to start chatting</p>
              </div>
            ) : (
              <>
                {hasActiveSection && (
                  <div className="px-4 pt-3 pb-1">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Active</p>
                  </div>
                )}
                {sorted.map((conv, i) => {
                  const closed = conv.status === 'completed' || conv.status === 'disputed'
                  const prevClosed = i > 0 && (sorted[i - 1].status === 'completed' || sorted[i - 1].status === 'disputed')
                  const showClosedHeader = closed && !prevClosed

                  return (
                    <div key={conv.id}>
                      {showClosedHeader && (
                        <div className="px-4 pt-4 pb-1 border-t border-gray-100 mt-1">
                          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Closed</p>
                        </div>
                      )}
                      <button
                        onClick={() => setActiveTaskId(conv.id)}
                        className={`w-full flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left border-b border-gray-50 ${closed ? 'opacity-50' : ''}`}
                      >
                        <span className="text-xl flex-shrink-0 mt-0.5">
                          {CATEGORY_EMOJI[conv.category] || '✨'}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline justify-between gap-1 mb-0.5">
                            <p className={`text-sm truncate ${conv.unread > 0 ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                              {conv.title}
                            </p>
                            {conv.lastMessage && (
                              <span className="text-[10px] text-gray-400 flex-shrink-0">
                                {timeAgo(conv.lastMessage.created_at)}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs text-gray-400 truncate">
                              {conv.lastMessage ? conv.lastMessage.body : 'No messages yet'}
                            </p>
                            {conv.unread > 0 && (
                              <span className="flex-shrink-0 min-w-[18px] h-[18px] bg-primary text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
                                {conv.unread > 9 ? '9+' : conv.unread}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    </div>
                  )
                })}
              </>
            )}
          </div>
        )}
      </div>
    </>
  )
}
