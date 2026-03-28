import { useEffect, useState, useRef, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import TaskCard from '../components/TaskCard'
import { Search, SlidersHorizontal, X, ChevronRight } from 'lucide-react'
import { haversineMeters } from '../lib/utils'
import { Button } from '../components/ui/button'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '../components/ui/select'

const CATEGORIES = [
  { id: 'All',                  emoji: '🔍' },
  { id: 'Errands & Pickup',     emoji: '🛍️' },
  { id: 'Tutoring & Academic',  emoji: '📚' },
  { id: 'Moving',               emoji: '📦' },
  { id: 'Tech Help',            emoji: '💻' },
  { id: 'Fitness & Wellness',   emoji: '🏋️' },
  { id: 'Other',                emoji: '✨' },
]

const DEFAULT_FILTERS = {
  search: '',
  category: 'All',
  minTokens: '',
  maxTokens: '',
  maxMinutes: '',
  maxDistanceKm: '',
  sortBy: 'newest',
}

const SORT_OPTIONS = [
  { id: 'newest',   label: 'Newest' },
  { id: 'deadline', label: 'Deadline' },
  { id: 'tokens',   label: 'Highest reward' },
  { id: 'quickest', label: 'Quickest' },
  { id: 'closest',  label: 'Closest' },
]

export default function Feed() {
  const { user } = useAuth()
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [showFilters, setShowFilters] = useState(false)
  const [userLat, setUserLat] = useState(null)
  const [userLng, setUserLng] = useState(null)

  const laneRefs = useRef({})

  const isFiltered =
    filters.search || filters.category !== 'All' || filters.minTokens ||
    filters.maxTokens || filters.maxMinutes || filters.maxDistanceKm ||
    filters.sortBy !== 'newest'

  useEffect(() => {
    fetchTasks()
    navigator.geolocation?.getCurrentPosition(
      ({ coords }) => { setUserLat(coords.latitude); setUserLng(coords.longitude) },
      () => {}
    )

    // polling fallback
    const poll = setInterval(fetchTasks, 30_000)

    // realtime for instant updates
    const sub = supabase
      .channel('feed-tasks')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, fetchTasks)
      .subscribe()

    return () => {
      clearInterval(poll)
      supabase.removeChannel(sub)
    }
  }, [filters.category]) // eslint-disable-line

  async function fetchTasks() {
    setLoading(true)
    let query = supabase.from('tasks_with_poster').select('*').eq('status', 'open')
    if (filters.category !== 'All') query = query.eq('category', filters.category)
    const { data } = await query
    if (data) setTasks(data)
    setLoading(false)
  }

  function set(key, val) {
    setFilters(f => ({ ...f, [key]: val }))
  }

  function clearFilters() {
    setFilters(DEFAULT_FILTERS)
  }

  const displayed = tasks
    .filter(t => {
      if (filters.search) {
        const q = filters.search.toLowerCase()
        if (!t.title.toLowerCase().includes(q) && !t.description?.toLowerCase().includes(q)) return false
      }
      if (filters.minTokens && t.token_offer < Number(filters.minTokens)) return false
      if (filters.maxTokens && t.token_offer > Number(filters.maxTokens)) return false
      if (filters.maxMinutes && t.est_minutes && t.est_minutes > Number(filters.maxMinutes)) return false
      if (filters.maxDistanceKm && userLat != null && t.location_lat != null) {
        const dist = haversineMeters(userLat, userLng, t.location_lat, t.location_lng)
        if (dist > Number(filters.maxDistanceKm) * 1000) return false
      }
      return true
    })
    .sort((a, b) => {
      if (a.boosted && !b.boosted) return -1
      if (!a.boosted && b.boosted) return 1
      switch (filters.sortBy) {
        case 'deadline':
          return new Date(a.deadline_at || '9999') - new Date(b.deadline_at || '9999')
        case 'tokens':
          return (b.token_offer + (b.cash_offer || 0)) - (a.token_offer + (a.cash_offer || 0))
        case 'quickest':
          return (a.est_minutes || 9999) - (b.est_minutes || 9999)
        case 'closest':
          if (userLat == null) return 0
          const da = a.location_lat ? haversineMeters(userLat, userLng, a.location_lat, a.location_lng) : Infinity
          const db = b.location_lat ? haversineMeters(userLat, userLng, b.location_lat, b.location_lng) : Infinity
          return da - db
        default: // newest
          return new Date(b.created_at) - new Date(a.created_at)
      }
    })

  // ── Dynamic lanes ────────────────────────────────────────────────────────────
  const lanes = useMemo(() => {
    if (displayed.length === 0) return []
    const result = []

    const boosted = displayed.filter(t => t.boosted)
    if (boosted.length >= 1)
      result.push({ id: 'boosted', emoji: '🚀', label: 'BOOSTED', tasks: boosted })

    if (userLat != null) {
      const nearby = displayed
        .filter(t => t.location_lat)
        .sort((a, b) =>
          haversineMeters(userLat, userLng, a.location_lat, a.location_lng) -
          haversineMeters(userLat, userLng, b.location_lat, b.location_lng)
        )
        .slice(0, 10)
      if (nearby.length >= 2)
        result.push({ id: 'nearby', emoji: '📍', label: 'HAPPENING NEARBY', tasks: nearby })
    }

    const now = Date.now()
    const soon = displayed
      .filter(t => t.deadline_at && new Date(t.deadline_at) - now < 48 * 3600 * 1000 && new Date(t.deadline_at) > now)
      .sort((a, b) => new Date(a.deadline_at) - new Date(b.deadline_at))
    if (soon.length >= 2)
      result.push({ id: 'soon', emoji: '⏰', label: 'CLOSING SOON', sublabel: 'deadline within 48h', tasks: soon })

    const quick = displayed
      .filter(t => t.est_minutes && t.est_minutes <= 30)
      .sort((a, b) => a.est_minutes - b.est_minutes)
    if (quick.length >= 2)
      result.push({ id: 'quick', emoji: '⚡', label: 'QUICK WINS', sublabel: 'under 30 min', tasks: quick })

    const topRewards = [...displayed]
      .sort((a, b) => (b.token_offer + (b.cash_offer || 0)) - (a.token_offer + (a.cash_offer || 0)))
      .slice(0, 10)
    if (topRewards.length >= 2)
      result.push({ id: 'top', emoji: '💰', label: 'TOP REWARDS', tasks: topRewards })

    CATEGORIES.filter(c => c.id !== 'All').forEach(cat => {
      const tasks = displayed.filter(t => t.category === cat.id)
      if (tasks.length > 0)
        result.push({ id: cat.id, emoji: cat.emoji, label: cat.id, tasks, isCategory: true })
    })

    return result
  }, [displayed, userLat, userLng])

  function scrollLane(id) {
    laneRefs.current[id]?.scrollBy({ left: 320, behavior: 'smooth' })
  }

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Page header */}
        <div className="mb-6">
          <h1 className="mb-2">Doum Feed</h1>
          <p className="text-muted-foreground">Browse open doums from students around campus</p>
        </div>

        {/* Search + filter toggle row */}
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search doums..."
              value={filters.search}
              onChange={e => set('search', e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white"
            />
          </div>
          <Button
            variant={showFilters ? 'default' : 'outline'}
            onClick={() => setShowFilters(f => !f)}
            className="gap-1.5"
          >
            <SlidersHorizontal size={15} />
            Filters
            {isFiltered && <span className="w-1.5 h-1.5 rounded-full bg-white/80" />}
          </Button>
          {isFiltered && (
            <Button variant="outline" onClick={clearFilters} className="gap-1">
              <X size={14} /> Clear
            </Button>
          )}
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Min tokens</label>
                <input type="number" min={0} placeholder="0"
                  value={filters.minTokens} onChange={e => set('minTokens', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Max tokens</label>
                <input type="number" min={0} placeholder="100"
                  value={filters.maxTokens} onChange={e => set('maxTokens', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">Max time (min)</label>
                <input type="number" min={0} placeholder="e.g. 60"
                  value={filters.maxMinutes} onChange={e => set('maxMinutes', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1">
                  Max distance (km) {!userLat && <span className="text-gray-400 font-normal">· needs location</span>}
                </label>
                <input type="number" min={0} placeholder="e.g. 2"
                  value={filters.maxDistanceKm} onChange={e => set('maxDistanceKm', e.target.value)}
                  disabled={!userLat}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50" />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-2">Sort by</label>
              <Select value={filters.sortBy} onValueChange={val => set('sortBy', val)}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Category pills */}
        <div className="flex gap-2 mb-5 overflow-x-auto pb-1 scrollbar-hide">
          {CATEGORIES.map(cat => (
            <Button
              key={cat.id}
              variant={filters.category === cat.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => set('category', cat.id)}
              className={`whitespace-nowrap gap-1.5 rounded-full ${
                filters.category === cat.id
                  ? 'bg-primary hover:bg-primary/90 text-primary-foreground'
                  : ''
              }`}
            >
              <span>{cat.emoji}</span>
              <span>{cat.id}</span>
            </Button>
          ))}
        </div>

        {/* Results count (filtered/single-category mode only) */}
        {!loading && filters.category !== 'All' && (
          <p className="text-xs text-muted-foreground mb-3">
            {displayed.length} doum{displayed.length !== 1 ? 's' : ''} found
          </p>
        )}

        {/* Task content */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary" />
          </div>
        ) : displayed.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">🔍</div>
            <h2 className="mb-2">No doums found</h2>
            <p className="text-muted-foreground mb-6">
              {isFiltered
                ? 'Try adjusting your filters or clear them to see all doums.'
                : 'Be the first to post a doum — nearby domi\'s are ready to help!'}
            </p>
            <div className="flex items-center justify-center gap-3">
              {isFiltered && (
                <Button variant="outline" onClick={clearFilters}>Clear filters</Button>
              )}
              <Button asChild className="bg-primary hover:bg-primary/90">
                <Link to="/post">Request Doum</Link>
              </Button>
            </div>
          </div>
        ) : filters.category === 'All' ? (
          /* ── Lane view ── */
          <div className="space-y-10">
            {lanes.map(lane => (
              <div key={lane.id}>
                {/* Lane header */}
                <div className="flex items-center gap-2 mb-3">
                  <h2 className="text-base font-semibold">{lane.label}</h2>
                  {lane.sublabel && (
                    <span className="text-xs text-muted-foreground">{lane.sublabel}</span>
                  )}
                  {lane.isCategory && (
                    <button
                      onClick={() => set('category', lane.id)}
                      className="text-xs text-primary font-medium hover:underline ml-1"
                    >
                      See all
                    </button>
                  )}
                  <span className="text-xs text-muted-foreground ml-0.5">· {lane.tasks.length}</span>
                  {/* Scroll button */}
                  <button
                    onClick={() => scrollLane(lane.id)}
                    className="ml-auto p-1.5 rounded-full border border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-colors flex-shrink-0"
                    title="Scroll right"
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>
                {/* Scrollable row */}
                <div
                  ref={el => { laneRefs.current[lane.id] = el }}
                  className="flex gap-4 overflow-x-auto pb-3 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                  {lane.tasks.map(task => (
                    <div key={task.id} className="flex-shrink-0 w-72">
                      <TaskCard task={task} currentUserId={user?.id} userLat={userLat} userLng={userLng} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* ── Grid view (single category selected) ── */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-fr">
            {displayed.map(task => (
              <TaskCard key={task.id} task={task} currentUserId={user?.id} userLat={userLat} userLng={userLng} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
