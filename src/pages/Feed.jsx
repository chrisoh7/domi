import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import TaskCard from '../components/TaskCard'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { haversineMeters } from '../lib/utils'

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
    <div className="max-w-2xl mx-auto px-4 py-6">

      {/* Search + filter toggle */}
      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search tasks..."
            value={filters.search}
            onChange={e => set('search', e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#C41230] bg-white"
          />
        </div>
        <button
          onClick={() => setShowFilters(f => !f)}
          className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors ${showFilters ? 'bg-[#1A1A2E] text-white border-[#1A1A2E]' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'}`}
        >
          <SlidersHorizontal size={15} />
          Filters
          {isFiltered && <span className="w-1.5 h-1.5 rounded-full bg-[#C41230]" />}
        </button>
        {isFiltered && (
          <button onClick={clearFilters}
            className="flex items-center gap-1 px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-500 hover:text-red-500 hover:border-red-200 transition-colors">
            <X size={14} /> Clear
          </button>
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
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#C41230]" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">Max tokens</label>
              <input type="number" min={0} placeholder="100"
                value={filters.maxTokens} onChange={e => set('maxTokens', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#C41230]" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">Max time (min)</label>
              <input type="number" min={0} placeholder="e.g. 60"
                value={filters.maxMinutes} onChange={e => set('maxMinutes', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#C41230]" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 block mb-1">
                Max distance (km) {!userLat && <span className="text-gray-400 font-normal">· needs location</span>}
              </label>
              <input type="number" min={0} placeholder="e.g. 2"
                value={filters.maxDistanceKm} onChange={e => set('maxDistanceKm', e.target.value)}
                disabled={!userLat}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#C41230] disabled:opacity-50" />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-2">Sort by</label>
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: 'newest',   label: 'Newest' },
                { id: 'deadline', label: 'Deadline' },
                { id: 'tokens',   label: 'Highest reward' },
                { id: 'quickest', label: 'Quickest' },
                { id: 'closest',  label: 'Closest' },
              ].map(s => (
                <button key={s.id} type="button" onClick={() => set('sortBy', s.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${filters.sortBy === s.id ? 'bg-[#1A1A2E] text-white border-[#1A1A2E]' : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'}`}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Category pills */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1 scrollbar-hide">
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => set('category', cat.id)}
            className={`whitespace-nowrap flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filters.category === cat.id
                ? 'bg-[#C41230] text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
          >
            <span>{cat.emoji}</span>
            <span>{cat.id}</span>
          </button>
        ))}
      </div>

      {/* Results count */}
      {!loading && (
        <p className="text-xs text-gray-400 mb-3">
          {displayed.length} task{displayed.length !== 1 ? 's' : ''} found
        </p>
      )}

      {/* Task list */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#C41230]" />
        </div>
      ) : displayed.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg font-medium">No tasks found</p>
          <p className="text-sm mt-1">Try adjusting filters or
            {isFiltered && <button onClick={clearFilters} className="text-[#C41230] ml-1 hover:underline">clear filters</button>}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {displayed.map(task => (
            <TaskCard key={task.id} task={task} currentUserId={user?.id} userLat={userLat} userLng={userLng} />
          ))}
        </div>
      )}
    </div>
  )
}
