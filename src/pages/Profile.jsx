import { useEffect, useState, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Coins, Star, AlertTriangle, CheckCircle, Clock, ListTodo, TrendingUp, ShieldCheck, Camera, X, Award, MapPin, Plus, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { timeAgo } from '../lib/utils'
import { Card, CardContent } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Avatar, AvatarImage, AvatarFallback } from '../components/ui/avatar'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs'
import { useSavedPlaces, PRESET_DEFS } from '../hooks/useSavedPlaces'

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
  const isOwn = !id || id === user?.id

  // Saved places — must be called unconditionally (Rules of Hooks)
  const { presets: savedPresets, custom: savedCustom, savePreset, clearPreset, addCustom, removeCustom } = useSavedPlaces(isOwn ? user?.id : null)
  const [editingPreset, setEditingPreset] = useState(null)
  const [presetQuery, setPresetQuery] = useState('')
  const [presetResults, setPresetResults] = useState([])
  const [newCustomName, setNewCustomName] = useState('')
  const [newCustomEmoji, setNewCustomEmoji] = useState('📍')
  const [newCustomQuery, setNewCustomQuery] = useState('')
  const [newCustomResults, setNewCustomResults] = useState([])
  const [newCustomCoords, setNewCustomCoords] = useState(null)
  const [showPlaces, setShowPlaces] = useState(false)

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

  async function searchLocation(query, setResults) {
    if (!query.trim()) { setResults([]); return }
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`)
    const data = await res.json()
    setResults(data.map(r => ({ label: r.display_name, lat: parseFloat(r.lat), lng: parseFloat(r.lon) })))
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary" />
      </div>
    )
  }

  if (!profile) return <div className="text-center py-16 text-muted-foreground">Profile not found.</div>

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
      await refreshProfile()
    }
    setAvatarSaving(false)
    e.target.value = ''
  }

  async function removeAvatar() {
    await supabase.from('profiles').update({ avatar_url: null }).eq('id', user.id)
    setProfile(p => ({ ...p, avatar_url: null }))
    await refreshProfile()
  }

  async function toggleAdmin() {
    const newVal = !profile.is_admin
    await supabase.from('profiles').update({ is_admin: newVal }).eq('id', user.id)
    setProfile(p => ({ ...p, is_admin: newVal }))
    await refreshProfile()
  }

  const earnedBadges = BADGES.filter(b => b.check(completedTasks))

  const tabs = [
    { key: 'posted',    label: 'Posted',    icon: ListTodo },
    { key: 'completed', label: 'Completed', icon: CheckCircle },
    { key: 'ratings',   label: 'Ratings',   icon: Star },
    { key: 'trends',    label: 'Trends',    icon: TrendingUp },
    ...(isOwn ? [{ key: 'wallet', label: 'Wallet', icon: Coins }] : []),
  ]

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Profile header */}
        <Card className="p-6 mb-6">
          <div className="flex items-start gap-6">
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <Avatar className="w-24 h-24 ring-4 ring-primary/20">
                <AvatarImage
                  src={profile.avatar_url}
                  alt={profile.name}
                  className={avatarSaving ? 'opacity-50' : ''}
                />
                <AvatarFallback className="text-2xl bg-primary text-white font-bold">
                  {avatarSaving ? '…' : (profile.name?.[0]?.toUpperCase() ?? '?')}
                </AvatarFallback>
              </Avatar>
              {isOwn && (
                <>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarFile} />
                  <button
                    onClick={() => fileInputRef.current.click()}
                    className="absolute -bottom-1 -right-1 w-7 h-7 bg-background border border-border rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground shadow-sm"
                    title="Change photo"
                  >
                    <Camera size={13} />
                  </button>
                  {profile.avatar_url && (
                    <button
                      onClick={removeAvatar}
                      className="absolute -top-1 -right-1 w-6 h-6 bg-background border border-border rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive shadow-sm"
                      title="Remove photo"
                    >
                      <X size={10} />
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <h1 className="text-2xl font-bold">{profile.name}</h1>
                {profile.suspended && (
                  <Badge variant="destructive">Suspended</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{profile.email}</p>
              {(profile.year || profile.major) && (
                <p className="text-sm text-muted-foreground">{[profile.year, profile.major].filter(Boolean).join(' · ')}</p>
              )}

              <div className="flex items-center gap-4 mt-3">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Star size={15} className="text-amber-400" fill="currentColor" />
                  <span className="font-semibold text-foreground">
                    {profile.reputation_score ? profile.reputation_score.toFixed(1) : '—'}
                  </span>
                  <span className="text-sm">({ratings.length} ratings)</span>
                </div>
                <span className="text-sm text-muted-foreground">{completedTasks.length} doums completed</span>

                {profile.reputation_score !== null && profile.reputation_score < 3.5 && (
                  <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                    <AlertTriangle size={10} />
                    Low rating
                  </span>
                )}
              </div>

              {profile.strikes > 0 && (
                <p className="text-sm text-destructive mt-1">{profile.strikes} strike{profile.strikes > 1 ? 's' : ''}</p>
              )}

              {earnedBadges.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {earnedBadges.map(b => (
                    <Badge
                      key={b.id}
                      variant="outline"
                      className="bg-primary/10 text-primary border-primary/20"
                      title={b.desc}
                    >
                      <Award size={11} className="mr-1" />
                      {b.emoji} {b.label}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {isOwn && (
              <div className="text-right flex flex-col items-end gap-2 flex-shrink-0">
                <div>
                  <p className="text-xs text-muted-foreground">Balance</p>
                  <p className="flex items-center gap-1 text-xl font-bold text-amber-500">
                    <Coins size={18} />
                    {profile.token_balance}
                  </p>
                </div>
                <button
                  onClick={toggleAdmin}
                  className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                    profile.is_admin
                      ? 'bg-foreground text-background'
                      : 'bg-muted text-muted-foreground hover:bg-accent'
                  }`}
                >
                  <ShieldCheck size={12} />
                  {profile.is_admin ? 'Admin' : 'Set Admin'}
                </button>
              </div>
            )}
          </div>

          {/* Set Locations */}
          {isOwn && (
            <div className="mt-4 border-t border-gray-100 pt-4">
              <button
                type="button"
                onClick={() => setShowPlaces(v => !v)}
                className="flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
              >
                <MapPin size={14} />
                Set Locations
                <span className="text-gray-400 text-xs">{showPlaces ? '▲' : '▼'}</span>
              </button>

              {showPlaces && (
                <div className="mt-4 space-y-6">
                  {/* Preset places */}
                  <div>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Preset Locations</h3>
                    <div className="space-y-2">
                      {savedPresets.map(p => (
                        <div key={p.key} className="border border-gray-200 rounded-xl p-3">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-base">{p.emoji}</span>
                              <span className="font-medium text-sm">{p.name}</span>
                              {p.isSet && <span className="text-xs text-muted-foreground truncate max-w-[200px]">{p.label}</span>}
                            </div>
                            <div className="flex gap-1.5 flex-shrink-0 ml-2">
                              <button
                                type="button"
                                onClick={() => { setEditingPreset(editingPreset === p.key ? null : p.key); setPresetQuery(''); setPresetResults([]) }}
                                className="text-xs px-2.5 py-1 rounded-full border border-primary text-primary hover:bg-primary/10 font-medium"
                              >
                                {p.isSet ? 'Change' : 'Set'}
                              </button>
                              {p.isSet && (
                                <button
                                  type="button"
                                  onClick={() => clearPreset(p.key)}
                                  className="text-xs px-2.5 py-1 rounded-full border border-red-200 text-red-500 hover:bg-red-50 font-medium"
                                >
                                  Clear
                                </button>
                              )}
                            </div>
                          </div>
                          {editingPreset === p.key && (
                            <div className="space-y-2 mt-2">
                              <input
                                type="text"
                                value={presetQuery}
                                onChange={e => { setPresetQuery(e.target.value); searchLocation(e.target.value, setPresetResults) }}
                                placeholder="Search address..."
                                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/30"
                              />
                              {presetResults.length > 0 && (
                                <div className="border border-gray-200 rounded-lg overflow-hidden divide-y divide-gray-100">
                                  {presetResults.map((r, i) => (
                                    <button
                                      key={i}
                                      type="button"
                                      onClick={() => { savePreset(p.key, r); setEditingPreset(null); setPresetResults([]) }}
                                      className="w-full text-left px-3 py-2 hover:bg-gray-50 text-xs text-gray-700"
                                    >
                                      {r.label}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Custom places */}
                  <div>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Custom Places</h3>
                    {savedCustom.length > 0 && (
                      <div className="space-y-2 mb-3">
                        {savedCustom.map(c => (
                          <div key={c.id} className="flex items-center justify-between border border-gray-200 rounded-xl px-3 py-2.5">
                            <div className="flex items-center gap-2 min-w-0">
                              <span>{c.emoji}</span>
                              <span className="text-sm font-medium">{c.name}</span>
                              <span className="text-xs text-muted-foreground truncate max-w-[180px]">{c.label}</span>
                            </div>
                            <button type="button" onClick={() => removeCustom(c.id)} className="text-red-400 hover:text-red-600 p-1 flex-shrink-0">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="border border-dashed border-gray-300 rounded-xl p-3 space-y-2">
                      <p className="text-xs font-medium text-gray-500">Add new place</p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newCustomEmoji}
                          onChange={e => setNewCustomEmoji(e.target.value)}
                          maxLength={2}
                          placeholder="📍"
                          className="w-12 text-center text-lg border border-gray-300 rounded-lg py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                        <input
                          type="text"
                          value={newCustomName}
                          onChange={e => setNewCustomName(e.target.value)}
                          placeholder="Name (e.g. Gym)"
                          className="flex-1 text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                      </div>
                      <input
                        type="text"
                        value={newCustomQuery}
                        onChange={e => { setNewCustomQuery(e.target.value); setNewCustomCoords(null); searchLocation(e.target.value, setNewCustomResults) }}
                        placeholder="Search address..."
                        className="w-full text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                      {newCustomResults.length > 0 && (
                        <div className="border border-gray-200 rounded-lg overflow-hidden divide-y divide-gray-100">
                          {newCustomResults.map((r, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => { setNewCustomCoords(r); setNewCustomQuery(r.label); setNewCustomResults([]) }}
                              className="w-full text-left px-3 py-2 hover:bg-gray-50 text-xs text-gray-700"
                            >
                              {r.label}
                            </button>
                          ))}
                        </div>
                      )}
                      {newCustomCoords && <p className="text-xs text-green-600">✓ Location selected</p>}
                      <button
                        type="button"
                        disabled={!newCustomName.trim() || !newCustomCoords}
                        onClick={() => {
                          addCustom({ name: newCustomName.trim(), emoji: newCustomEmoji || '📍', label: newCustomCoords.label, lat: newCustomCoords.lat, lng: newCustomCoords.lng })
                          setNewCustomName(''); setNewCustomEmoji('📍'); setNewCustomQuery(''); setNewCustomCoords(null); setNewCustomResults([])
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary text-white text-xs font-semibold disabled:opacity-40"
                      >
                        <Plus size={12} /> Add Place
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Stats grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <Card className="p-4 border-2 border-amber-200">
            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5">
              <Coins size={13} className="text-amber-500" />
              Token Balance
            </p>
            <p className="text-2xl font-bold text-amber-500">{profile.token_balance ?? 0}</p>
          </Card>
          <Card className="p-4 border-2 border-blue-200">
            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5">
              <Star size={13} className="text-blue-500" />
              Reputation
            </p>
            <p className="text-2xl font-bold text-blue-500">
              {profile.reputation_score ? profile.reputation_score.toFixed(1) : '—'}
            </p>
          </Card>
          <Card className="p-4 border-2 border-green-200">
            <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5">
              <CheckCircle size={13} className="text-green-500" />
              Doums Completed
            </p>
            <p className="text-2xl font-bold text-green-500">{completedTasks.length}</p>
          </Card>
        </div>

        {/* Doum History with Tabs */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-6">Doum History</h2>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className={`grid w-full mb-6 ${isOwn ? 'grid-cols-5' : 'grid-cols-4'}`}>
              {tabs.map(({ key, label, icon: Icon }) => (
                <TabsTrigger key={key} value={key} className="flex items-center gap-1.5">
                  <Icon size={13} />
                  <span className="hidden sm:inline">{label}</span>
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="posted">
              <TaskList tasks={postedTasks} empty="No posted tasks yet." />
            </TabsContent>

            <TabsContent value="completed">
              <TaskList tasks={completedTasks} empty="No completed tasks yet." />
            </TabsContent>

            <TabsContent value="ratings">
              <div className="space-y-3">
                {ratings.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No ratings yet.</p>
                ) : ratings.map(r => (
                  <div key={r.id} className="flex items-start justify-between p-4 border rounded-lg hover:bg-accent transition-colors">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        {'⭐'.repeat(r.stars)}
                        <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</span>
                      </div>
                      {r.note && <p className="text-sm text-foreground">{r.note}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="trends">
              <TrendsTab postedTasks={postedTasks} completedTasks={completedTasks} />
            </TabsContent>

            {isOwn && (
              <TabsContent value="wallet">
                <div className="space-y-2">
                  {ledger.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No transactions yet.</p>
                  ) : ledger.map(entry => (
                    <div key={entry.id} className="flex items-start justify-between p-4 border rounded-lg hover:bg-accent transition-colors">
                      <p className="text-sm text-foreground">{entry.reason}</p>
                      <span className={`font-bold text-sm ${entry.amount > 0 ? 'text-green-600' : 'text-destructive'}`}>
                        {entry.amount > 0 ? '+' : ''}{entry.amount}
                      </span>
                    </div>
                  ))}
                </div>
              </TabsContent>
            )}
          </Tabs>
        </Card>

      </div>
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
    return <p className="text-center text-muted-foreground py-8">No activity yet to show trends.</p>
  }

  return (
    <div className="space-y-4">
      {/* Summary stat cards */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard value={postedTasks.length} label="Doums Posted" />
        <StatCard value={completedTasks.length} label="Doums Run" />
        <StatCard
          value={postedTasks.length >= completedTasks.length ? 'Poster' : 'Domi'}
          label="Usual Role"
        />
      </div>

      {/* Posted task trends */}
      {hasPosted && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">Doums You Posted</h3>
            <span className="text-xs text-muted-foreground">Top: {CAT_META[topPostedCat]?.emoji} {topPostedCat}</span>
          </div>
          <div className="space-y-2.5">
            {ALL_CATS
              .filter(c => postedCounts[c])
              .sort((a, b) => (postedCounts[b] || 0) - (postedCounts[a] || 0))
              .map(cat => (
                <div key={cat}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-foreground">{CAT_META[cat]?.emoji} {cat}</span>
                    <span className="font-semibold">{postedCounts[cat]}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-2 rounded-full transition-all duration-700 ${CAT_META[cat]?.color || 'bg-gray-400'}`}
                      style={{ width: `${((postedCounts[cat] || 0) / maxPosted) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
          </div>
        </Card>
      )}

      {/* Run task trends */}
      {hasRun && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">Doums You Ran</h3>
            <span className="text-xs text-muted-foreground">Top: {CAT_META[topRunCat]?.emoji} {topRunCat}</span>
          </div>
          <div className="space-y-2.5">
            {ALL_CATS
              .filter(c => runCounts[c])
              .sort((a, b) => (runCounts[b] || 0) - (runCounts[a] || 0))
              .map(cat => (
                <div key={cat}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-foreground">{CAT_META[cat]?.emoji} {cat}</span>
                    <span className="font-semibold">{runCounts[cat]}</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-2 rounded-full transition-all duration-700 ${CAT_META[cat]?.color || 'bg-gray-400'}`}
                      style={{ width: `${((runCounts[cat] || 0) / maxRun) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
          </div>
        </Card>
      )}
    </div>
  )
}

function StatCard({ value, label }) {
  return (
    <Card className="p-3 text-center">
      <p className="text-xl font-bold leading-tight">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{label}</p>
    </Card>
  )
}

function TaskList({ tasks, empty }) {
  if (tasks.length === 0) {
    return <p className="text-center text-muted-foreground py-8">{empty}</p>
  }
  return (
    <div className="space-y-2">
      {tasks.map(task => (
        <Link
          key={task.id}
          to={`/task/${task.id}`}
          className="flex items-start justify-between p-4 border rounded-lg hover:bg-accent transition-colors"
        >
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <span className="text-lg flex-shrink-0">{CAT_META[task.category]?.emoji ?? '✨'}</span>
            <div className="min-w-0 flex-1">
              <h4 className="text-sm font-medium truncate">{task.title}</h4>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge
                  variant="outline"
                  className={`text-xs ${
                    task.status === 'open'
                      ? 'bg-green-50 text-green-700 border-green-200'
                      : task.status === 'completed'
                      ? 'bg-muted text-muted-foreground'
                      : 'bg-blue-50 text-blue-700 border-blue-200'
                  }`}
                >
                  {task.status}
                </Badge>
                {(task.deadline_at || task.deadline) && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock size={11} />
                    {task.deadline_at
                      ? new Date(task.deadline_at).toLocaleString('en-US', { month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' })
                      : new Date(task.deadline).toLocaleDateString()}
                  </span>
                )}
                <span className="text-xs text-muted-foreground">{timeAgo(task.created_at)}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 text-sm font-semibold text-amber-500 flex-shrink-0 ml-3">
            <Coins size={14} /> {task.token_offer}
          </div>
        </Link>
      ))}
    </div>
  )
}
