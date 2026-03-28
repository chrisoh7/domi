import { useEffect, useState, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Coins, Star, AlertTriangle, CheckCircle, Clock, ListTodo, TrendingUp, ShieldCheck, Camera, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { timeAgo } from '../lib/utils'

const CAT_META = {
  'Errands & Pickup':    { emoji: '🛍️', color: 'bg-orange-400' },
  'Tutoring & Academic': { emoji: '📚', color: 'bg-blue-500' },
  'Moving':              { emoji: '📦', color: 'bg-yellow-500' },
  'Tech Help':           { emoji: '💻', color: 'bg-purple-500' },
  'Fitness & Wellness':  { emoji: '🏋️', color: 'bg-green-500' },
  'Other':               { emoji: '✨', color: 'bg-gray-400' },
}
const ALL_CATS = Object.keys(CAT_META)

const BADGES = [
  { id: 'heavy_lifter',  emoji: '💪', label: 'Heavy Lifter',  desc: '3+ Moving tasks',           check: tasks => tasks.filter(t => t.category === 'Moving').length >= 3 },
  { id: 'tutor_pro',     emoji: '📚', label: 'Tutor Pro',      desc: '3+ Tutoring tasks',          check: tasks => tasks.filter(t => t.category === 'Tutoring & Academic').length >= 3 },
  { id: 'tech_wizard',   emoji: '💻', label: 'Tech Wizard',    desc: '3+ Tech Help tasks',         check: tasks => tasks.filter(t => t.category === 'Tech Help').length >= 3 },
  { id: 'errand_runner', emoji: '🏃', label: 'Errand Runner',  desc: '3+ Errands completed',       check: tasks => tasks.filter(t => t.category === 'Errands & Pickup').length >= 3 },
  { id: 'fitness_buddy', emoji: '🏋️', label: 'Fitness Buddy',  desc: '3+ Fitness tasks',           check: tasks => tasks.filter(t => t.category === 'Fitness & Wellness').length >= 3 },
  { id: 'speed_runner',  emoji: '⚡', label: 'Speed Runner',   desc: '5+ tasks completed',         check: tasks => tasks.length >= 5 },
  { id: 'reliable',      emoji: '🏅', label: 'Reliable',       desc: '10+ tasks completed',        check: tasks => tasks.length >= 10 },
]

export default function Profile() {
  const { id } = useParams()
  const { user, profile: myProfile, refreshProfile } = useAuth()
  const [profile, setProfile] = useState(null)
  const [postedTasks, setPostedTasks] = useState([])
  const [completedTasks, setCompletedTasks] = useState([])
  const [ratings, setRatings] = useState([])
  const [ledger, setLedger] = useState([])
  const [tab, setTab] = useState('posted')
  const [loading, setLoading] = useState(true)
  const [avatarSaving, setAvatarSaving] = useState(false)
  const fileInputRef = useRef(null)

  const profileId = id || user?.id

  useEffect(() => {
    if (profileId) loadProfile()
  }, [profileId])

  async function loadProfile() {
    const [profileRes, postedRes, completedRes, ratingsRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', profileId).single(),
      supabase.from('tasks').select('*').eq('poster_id', profileId).order('created_at', { ascending: false }),
      supabase.from('tasks').select('*').eq('runner_id', profileId).eq('status', 'completed').order('created_at', { ascending: false }),
      supabase.from('ratings').select('*').eq('ratee_id', profileId).order('created_at', { ascending: false }),
    ])

    setProfile(profileRes.data)
    setPostedTasks(postedRes.data || [])
    setCompletedTasks(completedRes.data || [])
    setRatings(ratingsRes.data || [])

    if (!id || id === user?.id) {
      const { data } = await supabase
        .from('token_ledger')
        .select('*')
        .eq('user_id', profileId)
        .order('created_at', { ascending: false })
        .limit(20)
      setLedger(data || [])
    }

    setLoading(false)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#C41230]" />
      </div>
    )
  }

  if (!profile) return <div className="text-center py-16 text-gray-400">Profile not found.</div>

  const isOwn = !id || id === user?.id

  async function handleAvatarFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarSaving(true)
    const ext = file.name.split('.').pop()
    const path = `${user.id}/avatar.${ext}`
    const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (!uploadError) {
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
      await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id)
      setProfile(p => ({ ...p, avatar_url: publicUrl }))
    }
    setAvatarSaving(false)
    e.target.value = ''
  }

  async function removeAvatar() {
    await supabase.from('profiles').update({ avatar_url: null }).eq('id', user.id)
    setProfile(p => ({ ...p, avatar_url: null }))
  }

  async function toggleAdmin() {
    const newVal = !profile.is_admin
    await supabase.from('profiles').update({ is_admin: newVal }).eq('id', user.id)
    setProfile(p => ({ ...p, is_admin: newVal }))
    await refreshProfile()
  }

  const tabs = [
    { key: 'posted',    label: 'Posted',    icon: ListTodo },
    { key: 'completed', label: 'Completed', icon: CheckCircle },
    { key: 'ratings',   label: 'Ratings',   icon: Star },
    { key: 'trends',    label: 'Trends',    icon: TrendingUp },
    ...(isOwn ? [{ key: 'wallet', label: 'Wallet', icon: Coins }] : []),
  ]

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Header card */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-5">
        <div className="flex items-start gap-4">
          <div className="relative flex-shrink-0">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.name} className={`w-16 h-16 rounded-full object-cover border border-gray-200 ${avatarSaving ? 'opacity-50' : ''}`} />
            ) : (
              <div className={`w-16 h-16 rounded-full bg-[#C41230] flex items-center justify-center text-white text-2xl font-bold ${avatarSaving ? 'opacity-50' : ''}`}>
                {avatarSaving ? '…' : (profile.name?.[0]?.toUpperCase() ?? '?')}
              </div>
            )}
            {isOwn && (
              <>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarFile} />
                <button
                  onClick={() => fileInputRef.current.click()}
                  className="absolute -bottom-1 -right-1 w-6 h-6 bg-white border border-gray-300 rounded-full flex items-center justify-center text-gray-500 hover:text-gray-700 shadow-sm"
                  title="Change photo"
                >
                  <Camera size={11} />
                </button>
                {profile.avatar_url && (
                  <button
                    onClick={removeAvatar}
                    className="absolute -top-1 -right-1 w-5 h-5 bg-white border border-gray-300 rounded-full flex items-center justify-center text-gray-400 hover:text-red-500 shadow-sm"
                    title="Remove photo"
                  >
                    <X size={9} />
                  </button>
                )}
              </>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-[#1A1A2E]">{profile.name}</h1>
              {profile.suspended && (
                <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">Suspended</span>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-0.5">{profile.email}</p>
            {(profile.year || profile.major) && (
              <p className="text-sm text-gray-500">{[profile.year, profile.major].filter(Boolean).join(' · ')}</p>
            )}

            <div className="flex items-center gap-4 mt-3">
              <div className="flex items-center gap-1.5">
                <Star size={15} className="text-[#F5A623]" fill="currentColor" />
                <span className="font-semibold text-gray-900">
                  {profile.reputation_score ? profile.reputation_score.toFixed(1) : '—'}
                </span>
                <span className="text-sm text-gray-500">({ratings.length} ratings)</span>
              </div>

              {profile.reputation_score !== null && profile.reputation_score < 3.5 && (
                <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                  <AlertTriangle size={10} />
                  Low rating
                </span>
              )}
            </div>

            {profile.strikes > 0 && (
              <p className="text-sm text-red-500 mt-1">{profile.strikes} strike{profile.strikes > 1 ? 's' : ''}</p>
            )}

            {/* Badges */}
            {(() => {
              const earned = BADGES.filter(b => b.check(completedTasks))
              if (earned.length === 0) return null
              return (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {earned.map(b => (
                    <span
                      key={b.id}
                      title={b.desc}
                      className="inline-flex items-center gap-1 text-xs bg-[#1A1A2E] text-white px-2 py-0.5 rounded-full font-medium"
                    >
                      {b.emoji} {b.label}
                    </span>
                  ))}
                </div>
              )
            })()}
          </div>

          {isOwn && (
            <div className="text-right flex flex-col items-end gap-2">
              <div>
                <p className="text-xs text-gray-500">Balance</p>
                <p className="flex items-center gap-1 text-xl font-bold text-[#F5A623]">
                  <Coins size={18} />
                  {profile.token_balance}
                </p>
              </div>
              <button
                onClick={toggleAdmin}
                className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                  profile.is_admin
                    ? 'bg-[#1A1A2E] text-white'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                <ShieldCheck size={12} />
                {profile.is_admin ? 'Admin' : 'Set Admin'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-4 overflow-x-auto">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              tab === key ? 'bg-white shadow text-gray-900' : 'text-gray-500'
            }`}
          >
            <Icon size={14} />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {tab === 'posted' && <TaskList tasks={postedTasks} empty="No posted tasks yet." />}
      {tab === 'completed' && <TaskList tasks={completedTasks} empty="No completed tasks yet." />}

      {tab === 'ratings' && (
        <div className="space-y-3">
          {ratings.length === 0 ? (
            <p className="text-center text-gray-400 py-8">No ratings yet.</p>
          ) : ratings.map(r => (
            <div key={r.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-2">
                {'⭐'.repeat(r.stars)}
                <span className="text-xs text-gray-400">{new Date(r.created_at).toLocaleDateString()}</span>
              </div>
              {r.note && <p className="text-sm text-gray-600 mt-1">{r.note}</p>}
            </div>
          ))}
        </div>
      )}

      {tab === 'trends' && (
        <TrendsTab postedTasks={postedTasks} completedTasks={completedTasks} />
      )}

      {tab === 'wallet' && (
        <div className="space-y-2">
          {ledger.length === 0 ? (
            <p className="text-center text-gray-400 py-8">No transactions yet.</p>
          ) : ledger.map(entry => (
            <div key={entry.id} className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center justify-between">
              <p className="text-sm text-gray-700">{entry.reason}</p>
              <span className={`font-bold text-sm ${entry.amount > 0 ? 'text-green-600' : 'text-red-500'}`}>
                {entry.amount > 0 ? '+' : ''}{entry.amount}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function TrendsTab({ postedTasks, completedTasks }) {
  const postedCounts = {}
  const runCounts = {}

  postedTasks.forEach(t => {
    const cat = t.category || 'Other'
    postedCounts[cat] = (postedCounts[cat] || 0) + 1
  })
  completedTasks.forEach(t => {
    const cat = t.category || 'Other'
    runCounts[cat] = (runCounts[cat] || 0) + 1
  })

  const maxPosted = Math.max(...Object.values(postedCounts), 1)
  const maxRun = Math.max(...Object.values(runCounts), 1)

  const topPostedCat = ALL_CATS.reduce((a, b) => (postedCounts[a] || 0) >= (postedCounts[b] || 0) ? a : b)
  const topRunCat = ALL_CATS.reduce((a, b) => (runCounts[a] || 0) >= (runCounts[b] || 0) ? a : b)

  const hasPosted = postedTasks.length > 0
  const hasRun = completedTasks.length > 0

  if (!hasPosted && !hasRun) {
    return <p className="text-center text-gray-400 py-8">No activity yet to show trends.</p>
  }

  return (
    <div className="space-y-4">
      {/* Summary stat cards */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard value={postedTasks.length} label="Tasks Posted" />
        <StatCard value={completedTasks.length} label="Tasks Run" />
        <StatCard
          value={postedTasks.length >= completedTasks.length ? 'Poster' : 'Runner'}
          label="Usual Role"
        />
      </div>

      {/* Posted task trends */}
      {hasPosted && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-800">Tasks You Posted</h3>
            <span className="text-xs text-gray-400">Top: {CAT_META[topPostedCat]?.emoji} {topPostedCat}</span>
          </div>
          <div className="space-y-2.5">
            {ALL_CATS
              .filter(c => postedCounts[c])
              .sort((a, b) => (postedCounts[b] || 0) - (postedCounts[a] || 0))
              .map(cat => (
                <div key={cat}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-gray-700">{CAT_META[cat]?.emoji} {cat}</span>
                    <span className="font-semibold text-gray-900">{postedCounts[cat]}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-2 rounded-full transition-all duration-700 ${CAT_META[cat]?.color || 'bg-gray-400'}`}
                      style={{ width: `${((postedCounts[cat] || 0) / maxPosted) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Run task trends */}
      {hasRun && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-800">Tasks You Ran</h3>
            <span className="text-xs text-gray-400">Top: {CAT_META[topRunCat]?.emoji} {topRunCat}</span>
          </div>
          <div className="space-y-2.5">
            {ALL_CATS
              .filter(c => runCounts[c])
              .sort((a, b) => (runCounts[b] || 0) - (runCounts[a] || 0))
              .map(cat => (
                <div key={cat}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-gray-700">{CAT_META[cat]?.emoji} {cat}</span>
                    <span className="font-semibold text-gray-900">{runCounts[cat]}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-2 rounded-full transition-all duration-700 ${CAT_META[cat]?.color || 'bg-gray-400'}`}
                      style={{ width: `${((runCounts[cat] || 0) / maxRun) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ value, label }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
      <p className="text-xl font-bold text-[#1A1A2E] leading-tight">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5 leading-tight">{label}</p>
    </div>
  )
}

function TaskList({ tasks, empty }) {
  if (tasks.length === 0) {
    return <p className="text-center text-gray-400 py-8">{empty}</p>
  }
  return (
    <div className="space-y-2">
      {tasks.map(task => (
        <Link
          key={task.id}
          to={`/task/${task.id}`}
          className="block bg-white rounded-xl border border-gray-200 px-4 py-3 hover:shadow-sm transition-shadow"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-gray-900 truncate">{task.title}</p>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${
              task.status === 'open' ? 'bg-green-100 text-green-700' :
              task.status === 'completed' ? 'bg-gray-100 text-gray-600' :
              'bg-blue-100 text-blue-700'
            }`}>{task.status}</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="flex items-center gap-1 text-xs text-[#F5A623]">
              <Coins size={11} />{task.token_offer}
            </span>
            {(task.deadline_at || task.deadline) && (
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <Clock size={11} />
                {task.deadline_at
                  ? new Date(task.deadline_at).toLocaleString('en-US', { month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' })
                  : new Date(task.deadline).toLocaleDateString()}
              </span>
            )}
            <span className="text-xs text-gray-400">{timeAgo(task.created_at)}</span>
          </div>
        </Link>
      ))}
    </div>
  )
}
