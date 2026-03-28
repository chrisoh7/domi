import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Flag, CheckCircle, XCircle, Bot, Users, AlertTriangle, ShieldOff } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

function FlagBadge({ reason, reportCount }) {
  const isAI = !!reason
  const isCommunity = reportCount > 0
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {isAI && (
        <span className="flex items-center gap-1 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
          <Bot size={11} />
          AI: {reason}
        </span>
      )}
      {isCommunity && (
        <span className="flex items-center gap-1 text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">
          <Users size={11} />
          {reportCount} community report{reportCount !== 1 ? 's' : ''}
        </span>
      )}
    </div>
  )
}

export default function AdminQueue() {
  const { isAdmin } = useAuth()
  const [tasks, setTasks] = useState([])
  const [userReports, setUserReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('all') // 'all' | 'ai' | 'community' | 'users'

  useEffect(() => {
    Promise.all([
      supabase
        .from('tasks')
        .select('*')
        .or('moderation_status.eq.flagged,report_count.gt.0')
        .order('created_at', { ascending: false }),
      supabase
        .from('user_reports')
        .select('*, reporter:profiles!reporter_id(name), reported:profiles!reported_id(name)')
        .order('created_at', { ascending: false }),
    ]).then(([{ data: taskData }, { data: reportData }]) => {
      setTasks(taskData || [])
      setUserReports(reportData || [])
      setLoading(false)
    })
  }, [])

  async function approve(id) {
    await supabase.from('tasks').update({ moderation_status: 'approved', flagged: false }).eq('id', id)
    setTasks(t => t.filter(x => x.id !== id))
  }

  async function remove(id) {
    await supabase.from('tasks').update({ moderation_status: 'removed', status: 'removed', flagged: false }).eq('id', id)
    setTasks(t => t.filter(x => x.id !== id))
  }

  const filtered = tasks.filter(t => {
    if (tab === 'ai') return !!t.flag_reason
    if (tab === 'community') return t.report_count > 0
    return true
  })

  async function dismissUserReport(reportId) {
    await supabase.from('user_reports').update({ reviewed: true }).eq('id', reportId)
    setUserReports(r => r.filter(x => x.id !== reportId))
  }

  const aiCount = tasks.filter(t => !!t.flag_reason).length
  const communityCount = tasks.filter(t => t.report_count > 0).length
  const pendingUserReports = userReports.filter(r => !r.reviewed)

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-gray-400">
        <ShieldOff size={40} className="mb-3 opacity-30" />
        <p className="font-medium">Admin access required</p>
        <p className="text-sm mt-1">Enable admin on your profile to access this page.</p>
        <Link to="/profile" className="mt-4 text-sm text-[#C41230] hover:underline">Go to Profile</Link>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#C41230]" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center gap-2 mb-4">
        <Flag size={20} className="text-[#C41230]" />
        <h1 className="text-2xl font-bold text-[#1A1A2E]">Admin Queue</h1>
        {tasks.length > 0 && (
          <span className="bg-red-100 text-red-600 text-sm font-semibold px-2 py-0.5 rounded-full">{tasks.length}</span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-5 flex-wrap">
        {[
          { id: 'all', label: `All (${tasks.length})` },
          { id: 'ai', label: `AI (${aiCount})`, icon: Bot },
          { id: 'community', label: `Community (${communityCount})`, icon: Users },
          { id: 'users', label: `Users (${pendingUserReports.length})`, icon: Flag },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === id ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {Icon && <Icon size={13} />}
            {label}
          </button>
        ))}
      </div>

      {tab === 'users' ? (
        pendingUserReports.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <CheckCircle size={40} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No pending user reports</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingUserReports.map(r => (
              <div key={r.id} className="bg-white rounded-xl border border-orange-200 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900">
                      {r.reporter?.name ?? 'Unknown'} → <span className="text-red-600">{r.reported?.name ?? 'Unknown'}</span>
                    </p>
                    <p className="text-sm text-gray-600 mt-1">{r.reason}</p>
                    {r.task_id && (
                      <Link to={`/task/${r.task_id}`} className="text-xs text-[#C41230] hover:underline mt-1 inline-block">View task</Link>
                    )}
                    <p className="text-xs text-gray-400 mt-1">{new Date(r.created_at).toLocaleDateString()}</p>
                  </div>
                  <button onClick={() => dismissUserReport(r.id)}
                    className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors flex-shrink-0">
                    <CheckCircle size={13} />Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <CheckCircle size={40} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">No flagged tasks in this category</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(task => (
            <div key={task.id} className="bg-white rounded-xl border border-red-200 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Link to={`/task/${task.id}`} className="font-semibold text-gray-900 hover:text-[#C41230] leading-snug">
                      {task.title}
                    </Link>
                    {task.report_count >= 3 && (
                      <AlertTriangle size={14} className="text-orange-500 flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{task.description}</p>
                  <p className="text-xs text-gray-400 mt-1">{task.category} · {new Date(task.created_at).toLocaleDateString()}</p>
                  <FlagBadge reason={task.flag_reason} reportCount={task.report_count} />
                </div>
                <div className="flex flex-col gap-2 flex-shrink-0">
                  <button
                    onClick={() => approve(task.id)}
                    className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-green-300 text-green-700 hover:bg-green-50 transition-colors"
                  >
                    <CheckCircle size={13} />
                    Approve
                  </button>
                  <button
                    onClick={() => remove(task.id)}
                    className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-red-300 text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <XCircle size={13} />
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
