import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { MapContainer, TileLayer, Marker, Polyline, CircleMarker, useMap } from 'react-leaflet'
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, CheckCircle2, Circle } from 'lucide-react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const CMU_CENTER = [40.4432, -79.9428]

function makeStepIcon(num, completed) {
  const fill = completed ? '#9ca3af' : '#C41230'
  return L.divIcon({
    className: '',
    html: `<div style="width:22px;height:28px"><svg width="22" height="28" viewBox="0 0 28 36" xmlns="http://www.w3.org/2000/svg"><path d="M14 0C6.27 0 0 6.27 0 14C0 24.5 14 36 14 36C14 36 28 24.5 28 14C28 6.27 21.73 0 14 0Z" fill="${fill}"/><text x="14" y="15" text-anchor="middle" dominant-baseline="middle" fill="white" font-size="11" font-weight="bold" font-family="Arial,sans-serif">${num}</text></svg></div>`,
    iconSize: [22, 28],
    iconAnchor: [11, 28],
  })
}

function MapFitBounds({ positions }) {
  const map = useMap()
  const prev = useRef('')
  useEffect(() => {
    const key = JSON.stringify(positions)
    if (key === prev.current || positions.length === 0) return
    prev.current = key
    if (positions.length === 1) {
      map.flyTo(positions[0], 15, { duration: 0.5 })
    } else {
      map.fitBounds(positions, { padding: [28, 28], maxZoom: 16 })
    }
  }, [JSON.stringify(positions)]) // eslint-disable-line
  return null
}

export default function ActiveDoumWidget() {
  const { user } = useAuth()

  const [tasks, setTasks] = useState([])
  // role: 'receiving' (I'm poster) | 'serving' (I'm domi)
  const [role, setRole] = useState('serving')
  const [indices, setIndices] = useState({ receiving: 0, serving: 0 })
  const [collapsed, setCollapsed] = useState(false)

  const [myPos, setMyPos] = useState(null)
  const [otherPos, setOtherPos] = useState(null)

  const channelRef = useRef(null)
  const watchIdRef = useRef(null)
  const touchStartX = useRef(null)

  // ── derived ─────────────────────────────────────────────────────────────
  const receiving = tasks.filter(t => t.poster_id === user?.id)
  const serving   = tasks.filter(t => t.runner_id  === user?.id)

  // auto-correct role if current bucket is empty
  const effectiveRole = (role === 'receiving' && receiving.length === 0 && serving.length > 0)
    ? 'serving'
    : (role === 'serving' && serving.length === 0 && receiving.length > 0)
      ? 'receiving'
      : role

  const list = effectiveRole === 'receiving' ? receiving : serving
  const idx  = Math.min(indices[effectiveRole], Math.max(0, list.length - 1))
  const task = list[idx] ?? null
  const isDomi = task?.runner_id === user?.id

  const steps    = task?.location_stops ?? []
  const subtasks = task?.subtasks ?? []
  const stepPositions = steps.filter(s => s.lat && s.lng).map(s => [s.lat, s.lng])
  const completedCount = subtasks.filter(s => s.completed).length

  // all positions for map bounds: steps + live dots
  const allPositions = [
    ...stepPositions,
    ...(myPos    ? [myPos]    : []),
    ...(otherPos ? [otherPos] : []),
  ]

  // ── load active tasks ────────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) return

    async function load() {
      const { data } = await supabase
        .from('tasks')
        .select('id, title, status, poster_id, runner_id, location_stops, subtasks')
        .eq('status', 'in_progress')
        .or(`poster_id.eq.${user.id},runner_id.eq.${user.id}`)
      const loaded = data ?? []
      setTasks(loaded)
      // default to 'serving' if I have active serving tasks, else 'receiving'
      if (loaded.some(t => t.runner_id === user.id)) setRole('serving')
      else if (loaded.some(t => t.poster_id === user.id)) setRole('receiving')
    }
    load()

    // subscribe to changes on tasks I'm involved in
    const subPoster = supabase
      .channel(`widget-poster-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks',
        filter: `poster_id=eq.${user.id}` }, load)
      .subscribe()
    const subRunner = supabase
      .channel(`widget-runner-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks',
        filter: `runner_id=eq.${user.id}` }, load)
      .subscribe()

    return () => {
      supabase.removeChannel(subPoster)
      supabase.removeChannel(subRunner)
    }
  }, [user?.id])

  // ── geolocation watch ────────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id || tasks.length === 0 || !navigator.geolocation) return
    watchIdRef.current = navigator.geolocation.watchPosition(
      ({ coords }) => setMyPos([coords.latitude, coords.longitude]),
      null,
      { enableHighAccuracy: true, maximumAge: 5000 }
    )
    return () => {
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current)
    }
  }, [user?.id, tasks.length > 0]) // eslint-disable-line

  // ── presence channel (per active task) ───────────────────────────────────
  useEffect(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
      setOtherPos(null)
    }
    if (!task || !user?.id) return

    const otherUserId = task.poster_id === user.id ? task.runner_id : task.poster_id

    const ch = supabase.channel(`task-loc-${task.id}`, {
      config: { presence: { key: user.id } },
    })
    ch.on('presence', { event: 'sync' }, () => {
      const state = ch.presenceState()
      const other = state[otherUserId]?.[0]
      if (other?.lat != null && other?.lng != null) {
        setOtherPos([other.lat, other.lng])
      }
    })
    ch.subscribe(async status => {
      if (status === 'SUBSCRIBED' && myPos) {
        await ch.track({ lat: myPos[0], lng: myPos[1] })
      }
    })
    channelRef.current = ch
    return () => {
      supabase.removeChannel(ch)
      channelRef.current = null
    }
  }, [task?.id, user?.id]) // eslint-disable-line

  // re-broadcast whenever myPos updates
  useEffect(() => {
    if (!channelRef.current || !myPos) return
    channelRef.current.track({ lat: myPos[0], lng: myPos[1] }).catch(() => {})
  }, [myPos])

  // ── step completion toggle (domi only) ───────────────────────────────────
  async function toggleStep(stepIdx) {
    if (!isDomi || !task) return
    const updated = subtasks.map((s, i) =>
      i === stepIdx ? { ...s, completed: !s.completed } : s
    )
    // optimistic
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, subtasks: updated } : t))
    await supabase.from('tasks').update({ subtasks: updated }).eq('id', task.id)
  }

  // ── swipe ────────────────────────────────────────────────────────────────
  function onTouchStart(e) { touchStartX.current = e.touches[0].clientX }
  function onTouchEnd(e) {
    if (touchStartX.current == null || list.length <= 1) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    touchStartX.current = null
    if (Math.abs(dx) < 50) return
    const next = dx < 0
      ? Math.min(idx + 1, list.length - 1)
      : Math.max(idx - 1, 0)
    setIndices(p => ({ ...p, [effectiveRole]: next }))
  }

  // ── nothing active ────────────────────────────────────────────────────────
  if (tasks.length === 0) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[1000] flex justify-center pointer-events-none">
      <div
        className="w-full max-w-lg pointer-events-auto"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {/* ── Collapsed pill ─────────────────────────────────────────── */}
        {collapsed ? (
          <button
            onClick={() => setCollapsed(false)}
            className="mx-3 mb-3 w-[calc(100%-1.5rem)] bg-[#1A1A2E] text-white rounded-2xl px-4 py-3 flex items-center justify-between shadow-2xl"
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
              <span className="text-sm font-semibold">
                {tasks.length} active doum{tasks.length !== 1 ? 's' : ''}
              </span>
            </div>
            <ChevronUp size={16} className="text-gray-400" />
          </button>
        ) : (
          /* ── Expanded widget ─────────────────────────────────────── */
          <div className="mx-3 mb-3 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">

            {/* Header row */}
            <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-gray-100">
              {/* Role tabs */}
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
                {receiving.length > 0 && (
                  <button
                    onClick={() => setRole('receiving')}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                      effectiveRole === 'receiving'
                        ? 'bg-white text-[#1A1A2E] shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Receiving{receiving.length > 1 ? ` (${receiving.length})` : ''}
                  </button>
                )}
                {serving.length > 0 && (
                  <button
                    onClick={() => setRole('serving')}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                      effectiveRole === 'serving'
                        ? 'bg-white text-primary shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Serving{serving.length > 1 ? ` (${serving.length})` : ''}
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1">
                {/* Pagination arrows */}
                {list.length > 1 && (
                  <>
                    <button
                      onClick={() => setIndices(p => ({ ...p, [effectiveRole]: Math.max(0, idx - 1) }))}
                      disabled={idx === 0}
                      className="p-1 text-gray-400 disabled:opacity-30 hover:text-gray-600 transition-colors"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <span className="text-xs text-gray-400 w-8 text-center">{idx + 1}/{list.length}</span>
                    <button
                      onClick={() => setIndices(p => ({ ...p, [effectiveRole]: Math.min(list.length - 1, idx + 1) }))}
                      disabled={idx === list.length - 1}
                      className="p-1 text-gray-400 disabled:opacity-30 hover:text-gray-600 transition-colors"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </>
                )}
                <button onClick={() => setCollapsed(true)} className="p-1 text-gray-400 hover:text-gray-600 transition-colors ml-1">
                  <ChevronDown size={16} />
                </button>
              </div>
            </div>

            {task && (
              <>
                {/* Title + live badge */}
                <div className="px-4 pt-2.5 pb-1 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#1A1A2E] truncate">{task.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {isDomi ? 'You are the domi' : 'Domi on the way'}
                      {subtasks.length > 0 && ` · ${completedCount}/${subtasks.length} steps`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-xs text-green-600 font-medium">Live</span>
                  </div>
                </div>

                {/* Step progress bar */}
                {subtasks.length > 0 && (
                  <div className="px-4 pb-2 flex gap-0.5">
                    {subtasks.map((s, i) => (
                      <div
                        key={i}
                        className={`flex-1 h-1.5 rounded-full transition-colors duration-300 ${
                          s.completed ? 'bg-primary' : 'bg-gray-200'
                        }`}
                      />
                    ))}
                  </div>
                )}

                {/* Map */}
                {stepPositions.length > 0 && (
                  <div className="mx-3 mb-2 rounded-xl overflow-hidden border border-gray-100"
                    style={{ height: 160, position: 'relative', zIndex: 0 }}>
                    <MapContainer
                      center={CMU_CENTER}
                      zoom={15}
                      style={{ height: '100%', width: '100%' }}
                      scrollWheelZoom={false}
                      zoomControl={false}
                      attributionControl={false}
                    >
                      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                      <MapFitBounds positions={allPositions.length > 0 ? allPositions : stepPositions} />

                      {/* Step markers */}
                      {steps.filter(s => s.lat && s.lng).map((s, i) => (
                        <Marker
                          key={i}
                          position={[s.lat, s.lng]}
                          icon={makeStepIcon(i + 1, subtasks[i]?.completed ?? false)}
                        />
                      ))}

                      {/* Route polyline */}
                      {stepPositions.length >= 2 && (
                        <Polyline positions={stepPositions} color="#C41230" weight={2} dashArray="6 4" />
                      )}

                      {/* My live position — blue */}
                      {myPos && (
                        <CircleMarker
                          center={myPos}
                          radius={7}
                          pathOptions={{ color: '#fff', fillColor: '#3b82f6', fillOpacity: 1, weight: 2 }}
                        />
                      )}
                      {/* Other party position — amber */}
                      {otherPos && (
                        <CircleMarker
                          center={otherPos}
                          radius={7}
                          pathOptions={{ color: '#fff', fillColor: '#f59e0b', fillOpacity: 1, weight: 2 }}
                        />
                      )}
                    </MapContainer>

                    {/* Map legend */}
                    {(myPos || otherPos) && (
                      <div className="absolute bottom-2 right-2 z-[400] bg-white/90 backdrop-blur-sm rounded-lg px-2 py-1 flex items-center gap-2.5 text-[10px] text-gray-600 shadow-sm">
                        {myPos && (
                          <span className="flex items-center gap-1">
                            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
                            You
                          </span>
                        )}
                        {otherPos && (
                          <span className="flex items-center gap-1">
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
                            {isDomi ? 'Poster' : 'Domi'}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Steps list */}
                {subtasks.length > 0 && (
                  <div className="px-4 pb-3 space-y-1.5 max-h-28 overflow-y-auto">
                    {subtasks.map((s, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => toggleStep(i)}
                        disabled={!isDomi}
                        className={`w-full flex items-center gap-2.5 text-left py-0.5 ${
                          isDomi ? 'hover:opacity-70 transition-opacity' : 'cursor-default'
                        }`}
                      >
                        {s.completed
                          ? <CheckCircle2 size={14} className="text-primary flex-shrink-0" />
                          : <Circle      size={14} className="text-gray-300 flex-shrink-0" />
                        }
                        <span className={`text-xs flex-1 truncate ${s.completed ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                          {s.text}
                        </span>
                        {s.location && (
                          <span className="text-[10px] text-gray-400 truncate max-w-[90px] flex-shrink-0">
                            {s.location.split(',')[0]}
                          </span>
                        )}
                      </button>
                    ))}
                    {isDomi && (
                      <p className="text-[10px] text-gray-400 pt-0.5">Tap a step to mark it complete</p>
                    )}
                  </div>
                )}

                {/* Swipe hint for multi-doum */}
                {list.length > 1 && (
                  <div className="flex justify-center gap-1 pb-2.5">
                    {list.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setIndices(p => ({ ...p, [effectiveRole]: i }))}
                        className={`rounded-full transition-all ${
                          i === idx ? 'w-3 h-1.5 bg-primary' : 'w-1.5 h-1.5 bg-gray-300'
                        }`}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
