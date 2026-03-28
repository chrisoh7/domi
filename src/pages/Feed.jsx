import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import TaskCard from '../components/TaskCard'
import { Search, SlidersHorizontal, X } from 'lucide-react'
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
  }, [filters.category])

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

        {/* Results count */}
        {!loading && (
          <p className="text-xs text-muted-foreground mb-3">
            {displayed.length} doum{displayed.length !== 1 ? 's' : ''} found
          </p>
        )}

        {/* Task grid / states */}
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
                <Button variant="outline" onClick={clearFilters}>
                  Clear filters
                </Button>
              )}
              <Button asChild className="bg-primary hover:bg-primary/90">
                <Link to="/post">Request Doum</Link>
              </Button>
            </div>
          </div>
        ) : (
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
