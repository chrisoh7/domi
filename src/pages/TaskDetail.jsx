import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import {
  MapPin, Clock, Coins, Star, AlertTriangle, CheckCircle, XCircle,
  Camera, Wrench, Timer, Navigation, Pencil, UserCheck, DollarSign,
  Package, Handshake, Users, Flag, Radio, Upload,
} from 'lucide-react'
import { estimateCommute } from '../lib/utils'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import TaskChat from '../components/TaskChat'
import ReportUserModal from '../components/ReportUserModal'

// ── icons ──────────────────────────────────────────────────────────────────
const userPinIcon = L.divIcon({
  className: '',
  html: `<div style="width:24px;height:32px"><svg width="24" height="32" viewBox="0 0 28 36" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 0C6.27 0 0 6.27 0 14C0 24.5 14 36 14 36C14 36 28 24.5 28 14C28 6.27 21.73 0 14 0Z" fill="#2563EB"/><circle cx="14" cy="14" r="5" fill="white"/></svg></div>`,
  iconSize: [24, 32], iconAnchor: [12, 32], popupAnchor: [0, -32],
})

const runnerPinIcon = L.divIcon({
  className: '',
  html: `<div style="width:24px;height:32px"><svg width="24" height="32" viewBox="0 0 28 36" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 0C6.27 0 0 6.27 0 14C0 24.5 14 36 14 36C14 36 28 24.5 28 14C28 6.27 21.73 0 14 0Z" fill="#10B981"/><circle cx="14" cy="14" r="5" fill="white"/></svg></div>`,
  iconSize: [24, 32], iconAnchor: [12, 32], popupAnchor: [0, -32],
})

function makeStopIcon(num, showNumber) {
  return L.divIcon({
    className: '',
    html: showNumber
      ? `<div style="width:28px;height:36px"><svg width="28" height="36" viewBox="0 0 28 36" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3))"><path d="M14 0C6.27 0 0 6.27 0 14C0 24.5 14 36 14 36C14 36 28 24.5 28 14C28 6.27 21.73 0 14 0Z" fill="#C41230"/><text x="14" y="15" text-anchor="middle" dominant-baseline="middle" fill="white" font-size="11" font-weight="bold" font-family="Arial,sans-serif">${num}</text></svg></div>`
      : `<div style="width:28px;height:36px"><svg width="28" height="36" viewBox="0 0 28 36" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14 0C6.27 0 0 6.27 0 14C0 24.5 14 36 14 36C14 36 28 24.5 28 14C28 6.27 21.73 0 14 0Z" fill="#C41230"/><circle cx="14" cy="14" r="5" fill="white"/></svg></div>`,
    iconSize: [28, 36], iconAnchor: [14, 36], popupAnchor: [0, -36],
  })
}

// ── helpers ────────────────────────────────────────────────────────────────
const DELIVERY_LABELS = {
  in_person:     { icon: Handshake, label: 'In person' },
  leave_at_door: { icon: Package,   label: 'Leave at door' },
  pickup_only:   { icon: Users,     label: 'Pickup only' },
}

function MapBoundsFitter({ positions }) {
  const map = useMap()
  useEffect(() => {
    if (positions.length >= 2) map.fitBounds(positions, { padding: [40, 40], maxZoom: 16 })
    else if (positions.length === 1) map.setView(positions[0], 15)
  }, [positions.map(p => p.join(',')).join('|')]) // eslint-disable-line
  return null
}

function formatDeadline(task) {
  const val = task.deadline_at || task.deadline
  if (!val) return null
  const d = new Date(val)
  if (isNaN(d)) return null
  if (task.deadline_at) return d.toLocaleString('en-US', { month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  return d.toLocaleDateString()
}

function formatEst(mins) {
  if (!mins) return null
  if (mins < 60) return `~${mins} min`
  const h = mins / 60
  return `~${h % 1 === 0 ? h : h.toFixed(1)} hr${h !== 1 ? 's' : ''}`
}

function formatCountdown(secs) {
  if (secs <= 0) return '0h 00m 00s'
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  return `${h}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`
}

function TaskMap({ task, runnerLivePos }) {
  const rawStops = Array.isArray(task.location_stops) && task.location_stops.length > 0
    ? task.location_stops
    : task.location_lat && task.location_lng
      ? [{ label: task.location_pickup, lat: task.location_lat, lng: task.location_lng }]
      : task.location_pickup
        ? [{ label: task.location_pickup, lat: null, lng: null }]
        : []

  const [stops, setStops] = useState(rawStops)
  const [userPos, setUserPos] = useState(null)
  const [geoLoading, setGeoLoading] = useState(false)

  useEffect(() => {
    rawStops.forEach((stop, idx) => {
      if (!stop.lat && stop.label) {
        fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(stop.label)}&format=json&limit=1`)
          .then(r => r.json())
          .then(d => {
            if (d[0]) setStops(prev => prev.map((s, i) => i === idx ? { ...s, lat: parseFloat(d[0].lat), lng: parseFloat(d[0].lon) } : s))
          }).catch(() => {})
      }
    })
  }, []) // eslint-disable-line

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      ({ coords }) => setUserPos([coords.latitude, coords.longitude]),
      () => {}
    )
  }, [])

  const positionedStops = stops.filter(s => s.lat && s.lng)
  const stopPositions = positionedStops.map(s => [s.lat, s.lng])
  const allPositions = [
    ...stopPositions,
    ...(userPos ? [userPos] : []),
    ...(runnerLivePos ? [runnerLivePos] : []),
  ]
  const multiStop = stops.length > 1

  if (positionedStops.length === 0) {
    return (
      <div className="h-40 bg-gray-100 rounded-xl flex items-center justify-center text-sm text-gray-400">
        {rawStops.length > 0 ? 'Locating on map…' : 'No location specified'}
      </div>
    )
  }

  return (
    <div>
      <div className="rounded-xl overflow-hidden" style={{ position: 'relative', zIndex: 0 }}>
        <MapContainer center={stopPositions[0]} zoom={15} style={{ height: 220, width: '100%' }} scrollWheelZoom={false}>
          <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {positionedStops.map((stop, idx) => (
            <Marker key={idx} position={[stop.lat, stop.lng]} icon={makeStopIcon(idx + 1, multiStop)}>
              <Popup>{multiStop ? `${idx + 1}. ` : ''}{stop.label || 'Location'}</Popup>
            </Marker>
          ))}
          {stopPositions.length >= 2 && <Polyline positions={stopPositions} color="#C41230" weight={3} />}
          {userPos && <Marker position={userPos} icon={userPinIcon}><Popup>🔵 You are here</Popup></Marker>}
          {runnerLivePos && <Marker position={runnerLivePos} icon={runnerPinIcon}><Popup>🟢 Runner (live)</Popup></Marker>}
          <MapBoundsFitter positions={allPositions} />
        </MapContainer>
      </div>

      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-[#C41230] inline-block" />{multiStop ? `Route (${stops.length} stops)` : 'Task location'}</span>
          {userPos && <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" />You</span>}
          {runnerLivePos && <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />Runner (live)</span>}
        </div>
        {!userPos && (
          <button onClick={() => {
            setGeoLoading(true)
            navigator.geolocation?.getCurrentPosition(
              ({ coords }) => { setUserPos([coords.latitude, coords.longitude]); setGeoLoading(false) },
              () => setGeoLoading(false)
            )
          }} disabled={geoLoading} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50">
            <Navigation size={12} />{geoLoading ? 'Locating…' : 'Show my location'}
          </button>
        )}
      </div>

      {userPos && stopPositions.length > 0 && (() => {
        const c = estimateCommute(stopPositions[0][0], stopPositions[0][1], userPos[0], userPos[1])
        return (
          <div className="flex items-center gap-4 mt-2 bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5 text-sm">
            <span className="font-medium text-gray-800">🚶 ~{c.walkLabel} walk</span>
            <span className="text-gray-300">|</span>
            <span className="font-medium text-gray-800">🚗 ~{c.driveLabel} drive</span>
            <span className="text-xs text-gray-400 ml-auto">{c.distLabel} away</span>
          </div>
        )
      })()}
    </div>
  )
}

// ── main component ─────────────────────────────────────────────────────────
export default function TaskDetail() {
  const { id } = useParams()
  const { user, profile, refreshProfile, isDevMode } = useAuth()
  const navigate = useNavigate()

  const [task, setTask] = useState(null)
  const [poster, setPoster] = useState(null)
  const [runner, setRunner] = useState(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')

  const [showRating, setShowRating] = useState(false)
  const [ratingStars, setRatingStars] = useState(5)
  const [ratingNote, setRatingNote] = useState('')
  const [rated, setRated] = useState(false)

  // Completion photo
  const [showMarkDonePanel, setShowMarkDonePanel] = useState(false)
  const [completionPhoto, setCompletionPhoto] = useState(null)
  const [photoUploading, setPhotoUploading] = useState(false)

  // Escrow countdown
  const [escrowSecondsLeft, setEscrowSecondsLeft] = useState(null)
  const autoConfirmedRef = useRef(false)

  // Live runner tracking
  const [sharingLocation, setSharingLocation] = useState(false)
  const [runnerLivePos, setRunnerLivePos] = useState(null)
  const watchIdRef = useRef(null)
  const locChannelRef = useRef(null)

  // Report modal
  const [reportTarget, setReportTarget] = useState(null)

  useEffect(() => {
    fetchTask()
    const channel = supabase.channel(`task-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tasks', filter: `id=eq.${id}` }, () => fetchTask())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [id]) // eslint-disable-line

  // Cleanup geo watch on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current)
      if (locChannelRef.current) supabase.removeChannel(locChannelRef.current)
    }
  }, [])

  // Poster subscribes to runner's live location
  useEffect(() => {
    if (!task || !user) return
    const isPoster = user.id === task.poster_id
    if (!isPoster) return
    if (task.status !== 'accepted' && task.status !== 'pending_confirmation') return
    const ch = supabase.channel(`runner-loc-${id}`)
      .on('broadcast', { event: 'location' }, ({ payload }) => {
        setRunnerLivePos(payload?.lat ? [payload.lat, payload.lng] : null)
      })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [task?.status, task?.poster_id, user?.id, id]) // eslint-disable-line

  // Escrow countdown + auto-confirm
  useEffect(() => {
    if (!task || task.status !== 'pending_confirmation' || !task.marked_done_at) return
    const deadline = new Date(task.marked_done_at).getTime() + 48 * 3600 * 1000
    const tick = async () => {
      const left = Math.max(0, Math.floor((deadline - Date.now()) / 1000))
      setEscrowSecondsLeft(left)
      if (left === 0 && !autoConfirmedRef.current && user?.id === task.poster_id) {
        autoConfirmedRef.current = true
        await doConfirm(false)
      }
    }
    tick()
    const tid = setInterval(tick, 1000)
    return () => clearInterval(tid)
  }, [task?.status, task?.marked_done_at]) // eslint-disable-line

  async function fetchTask() {
    const [{ data }, { data: extra }] = await Promise.all([
      supabase.from('tasks_with_poster').select('*').eq('id', id).single(),
      supabase.from('tasks').select('location_stops, delivery_type, cash_offer, marked_done_at, completion_photo_url').eq('id', id).single(),
    ])
    if (data) {
      setTask({
        ...data,
        location_stops: extra?.location_stops ?? null,
        delivery_type: extra?.delivery_type ?? null,
        cash_offer: extra?.cash_offer ?? null,
        marked_done_at: extra?.marked_done_at ?? null,
        completion_photo_url: extra?.completion_photo_url ?? null,
      })
      setPoster({ name: data.poster_name, rating: data.poster_rating, id: data.poster_id, avatar: data.poster_avatar_url })
      if (data.runner_id) {
        const { data: runnerData } = await supabase.from('profiles')
          .select('id, name, reputation_score, strikes, avatar_url')
          .eq('id', data.runner_id).single()
        setRunner(runnerData)
      } else {
        setRunner(null)
      }
    }
    setLoading(false)
  }

  async function handleAccept() {
    setActionLoading(true); setError('')
    const newStatus = task.requires_approval ? 'pending_runner_approval' : 'accepted'
    const { error: err } = await supabase.from('tasks').update({ runner_id: user.id, status: newStatus }).eq('id', id).eq('status', 'open')
    if (err) { setError(err.message); setActionLoading(false); return }
    await fetchTask(); setActionLoading(false)
  }

  async function handleApproveRunner() {
    setActionLoading(true)
    await supabase.from('tasks').update({ status: 'accepted' }).eq('id', id)
    await fetchTask(); setActionLoading(false)
  }

  async function handleRejectRunner() {
    setActionLoading(true)
    await supabase.from('tasks').update({ runner_id: null, status: 'open' }).eq('id', id)
    await fetchTask(); setActionLoading(false)
  }

  async function handleBackOut() {
    setActionLoading(true)
    await supabase.from('tasks').update({ runner_id: null, status: 'open' }).eq('id', id)
    await supabase.from('profiles').update({ strikes: (runner?.strikes ?? 0) + 1 }).eq('id', user.id)
    await fetchTask(); setActionLoading(false)
  }

  async function uploadCompletionPhoto(file) {
    setPhotoUploading(true)
    const ext = file.name.split('.').pop()
    const path = `${id}/${Date.now()}.${ext}`
    const { error: uploadErr } = await supabase.storage.from('completion_photos').upload(path, file, { upsert: true })
    setPhotoUploading(false)
    if (uploadErr) { setError(uploadErr.message); return null }
    const { data: { publicUrl } } = supabase.storage.from('completion_photos').getPublicUrl(path)
    return publicUrl
  }

  async function handleMarkDoneSubmit() {
    if (task.delivery_type === 'leave_at_door' && !completionPhoto) {
      setError('Completion photo is required for Leave at Door tasks.')
      return
    }
    setActionLoading(true); setError('')
    let photoUrl = null
    if (completionPhoto) {
      photoUrl = await uploadCompletionPhoto(completionPhoto)
      if (!photoUrl) { setActionLoading(false); return }
    }
    await supabase.from('tasks').update({
      status: 'pending_confirmation',
      marked_done_at: new Date().toISOString(),
      ...(photoUrl ? { completion_photo_url: photoUrl } : {}),
    }).eq('id', id)
    setShowMarkDonePanel(false)
    setCompletionPhoto(null)
    await fetchTask(); setActionLoading(false)
  }

  // Shared confirm logic (called by poster confirm button + auto-escrow)
  async function doConfirm(showRatingAfter = true) {
    const payout = Math.floor(task.token_offer * 0.9) // 10% platform fee
    const { data: runnerProfile } = await supabase.from('profiles').select('token_balance').eq('id', task.runner_id).single()
    await supabase.from('profiles').update({ token_balance: (runnerProfile?.token_balance ?? 0) + payout }).eq('id', task.runner_id)
    await supabase.from('token_ledger').insert({
      user_id: task.runner_id,
      amount: payout,
      reason: `Completed: "${task.title}" (10% platform fee deducted)`,
      task_id: task.id,
    })
    await supabase.from('tasks').update({ status: 'completed' }).eq('id', id)
    await refreshProfile(); await fetchTask()
    if (showRatingAfter) setShowRating(true)
  }

  async function handleConfirm() {
    setActionLoading(true)
    await doConfirm(true)
    setActionLoading(false)
  }

  async function handleDispute() {
    setActionLoading(true)
    await supabase.from('tasks').update({ status: 'disputed', flagged: true }).eq('id', id)
    await fetchTask(); setActionLoading(false)
  }

  async function handleDevSimulateRunner() {
    setActionLoading(true); setError('')
    // Find any profile that isn't the current user to act as the "other user"
    const { data: other } = await supabase
      .from('profiles')
      .select('id, name')
      .neq('id', user.id)
      .limit(1)
      .single()
    if (!other) { setError('No other user found in DB to simulate runner.'); setActionLoading(false); return }
    const newStatus = task.requires_approval ? 'pending_runner_approval' : 'accepted'
    const { error: err } = await supabase
      .from('tasks')
      .update({ runner_id: other.id, status: newStatus })
      .eq('id', id)
    if (err) { setError(err.message); setActionLoading(false); return }
    console.log(`[Dev] Simulated runner: ${other.name} (${other.id}), status → ${newStatus}`)
    await fetchTask(); setActionLoading(false)
  }

  async function handleDevComplete() {
    setActionLoading(true); setError('')
    const runnerId = task.runner_id || user.id
    if (!task.runner_id) await supabase.from('tasks').update({ runner_id: runnerId }).eq('id', id)
    const { data: rp } = await supabase.from('profiles').select('token_balance').eq('id', runnerId).single()
    await supabase.from('profiles').update({ token_balance: (rp?.token_balance ?? 0) + task.token_offer }).eq('id', runnerId)
    await supabase.from('token_ledger').insert({ user_id: runnerId, amount: task.token_offer, reason: `[Dev] Completed: "${task.title}"`, task_id: task.id })
    await supabase.from('tasks').update({ status: 'completed' }).eq('id', id)
    await refreshProfile(); await fetchTask(); setActionLoading(false)
  }

  async function submitRating(rateeId) {
    await supabase.from('ratings').insert({ task_id: task.id, rater_id: user.id, ratee_id: rateeId, stars: ratingStars, note: ratingNote })
    const { data: allRatings } = await supabase.from('ratings').select('stars').eq('ratee_id', rateeId)
    if (allRatings?.length) {
      const avg = allRatings.reduce((s, r) => s + r.stars, 0) / allRatings.length
      await supabase.from('profiles').update({ reputation_score: avg }).eq('id', rateeId)
    }
    setRated(true)
  }

  function toggleShareLocation() {
    if (sharingLocation) {
      if (watchIdRef.current != null) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null }
      locChannelRef.current?.send({ type: 'broadcast', event: 'location', payload: { lat: null, lng: null } })
      setSharingLocation(false)
    } else {
      if (!navigator.geolocation) return
      const ch = supabase.channel(`runner-loc-${id}`).subscribe()
      locChannelRef.current = ch
      watchIdRef.current = navigator.geolocation.watchPosition(
        ({ coords }) => {
          ch.send({ type: 'broadcast', event: 'location', payload: { lat: coords.latitude, lng: coords.longitude } })
        },
        () => setSharingLocation(false),
        { enableHighAccuracy: true, maximumAge: 5000 }
      )
      setSharingLocation(true)
    }
  }

  if (loading) return <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#C41230]" /></div>
  if (!task) return <div className="text-center py-16 text-gray-400">Task not found.</div>

  const isPoster = user?.id === task.poster_id
  const isRunner = user?.id === task.runner_id
  const deadlineStr = formatDeadline(task)
  const deadlineDate = task.deadline_at ? new Date(task.deadline_at) : task.deadline ? new Date(task.deadline) : null
  const isExpired = deadlineDate && deadlineDate < new Date()
  const hasLocation = task.location_pickup || (task.location_lat && task.location_lng)
  const deliveryMeta = task.delivery_type ? DELIVERY_LABELS[task.delivery_type] : null

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-4">
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {task.photo_url && <img src={task.photo_url} alt="Task" className="w-full h-48 object-cover" />}

        <div className="p-5">
          {task.boosted && (
            <span className="inline-flex items-center gap-1 text-xs text-[#F5A623] font-semibold bg-yellow-50 px-2 py-0.5 rounded-full mb-2">
              ⚡ Boosted
            </span>
          )}

          {/* Title + offers */}
          <div className="flex items-start justify-between gap-2">
            <h1 className="text-xl font-bold text-[#1A1A2E] leading-snug">{task.title}</h1>
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              {isPoster && task.status === 'open' && (
                <Link to={`/task/${id}/edit`} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors" title="Edit task">
                  <Pencil size={15} />
                </Link>
              )}
              <span className="flex items-center gap-1 text-[#F5A623] font-bold text-lg whitespace-nowrap">
                <Coins size={18} />{task.token_offer}
              </span>
              {task.cash_offer > 0 && (
                <span className="flex items-center gap-0.5 text-green-600 font-semibold text-sm whitespace-nowrap">
                  <DollarSign size={13} />{task.cash_offer} cash
                </span>
              )}
            </div>
          </div>

          {/* Status + delivery type badges */}
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
              task.status === 'open' ? 'bg-green-100 text-green-700' :
              task.status === 'accepted' ? 'bg-blue-100 text-blue-700' :
              task.status === 'pending_confirmation' ? 'bg-yellow-100 text-yellow-700' :
              task.status === 'completed' ? 'bg-gray-100 text-gray-600' :
              'bg-red-100 text-red-700'
            }`}>
              {task.status === 'pending_confirmation' ? 'Awaiting Confirmation' : task.status.charAt(0).toUpperCase() + task.status.slice(1)}
            </span>
            {deliveryMeta && (() => {
              const Icon = deliveryMeta.icon
              return (
                <span className="flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full font-medium">
                  <Icon size={11} />{deliveryMeta.label}
                </span>
              )
            })()}
          </div>

          <p className="mt-3 text-gray-600 text-sm leading-relaxed">{task.description}</p>

          {/* Completion photo (if any) */}
          {task.completion_photo_url && (
            <div className="mt-3">
              <p className="text-xs font-semibold text-gray-500 mb-1 flex items-center gap-1"><Camera size={11} />Completion photo</p>
              <img src={task.completion_photo_url} alt="Completion" className="w-full h-36 object-cover rounded-xl border border-gray-200" />
            </div>
          )}

          {/* Location list */}
          <div className="mt-4 space-y-2">
            {Array.isArray(task.location_stops) && task.location_stops.length > 1 ? (
              <div>
                {task.location_stops.map((stop, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <div className="flex flex-col items-center flex-shrink-0 pt-0.5">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white ${stop.lat ? 'bg-[#C41230]' : 'bg-gray-300'}`}>{idx + 1}</div>
                      {idx < task.location_stops.length - 1 && <div className="w-px h-4 bg-gray-300 mt-0.5" />}
                    </div>
                    <p className="text-sm text-gray-500 pb-1 leading-relaxed">{stop.label || 'Unknown location'}</p>
                  </div>
                ))}
              </div>
            ) : task.location_pickup ? (
              <div className="flex items-start gap-2 text-sm text-gray-500">
                <MapPin size={14} className="text-[#C41230] mt-0.5 flex-shrink-0" />
                <span>{task.location_pickup}</span>
              </div>
            ) : null}
            {task.est_minutes && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Timer size={14} className="text-[#C41230]" />
                <span>{formatEst(task.est_minutes)} estimated</span>
              </div>
            )}
            {deadlineStr && (
              <div className={`flex items-center gap-2 text-sm ${isExpired ? 'text-red-500' : 'text-gray-500'}`}>
                <Clock size={14} className={isExpired ? 'text-red-400' : 'text-[#C41230]'} />
                <span>Due {deadlineStr}</span>
              </div>
            )}
          </div>

          {/* Map */}
          {hasLocation && (
            <div className="mt-4">
              <TaskMap task={task} runnerLivePos={runnerLivePos} />
            </div>
          )}

          {/* People */}
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Posted by</p>
              {isRunner && poster?.id && poster.id !== user?.id && (
                <button onClick={() => setReportTarget({ id: poster.id, name: poster.name, taskId: id })}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors">
                  <Flag size={11} />Report
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              {poster?.avatar
                ? <img src={poster.avatar} alt={poster.name} className="w-9 h-9 rounded-full object-cover" />
                : <div className="w-9 h-9 rounded-full bg-[#C41230] flex items-center justify-center text-white font-bold">{poster?.name?.[0]?.toUpperCase() ?? '?'}</div>
              }
              <div>
                <p className="text-sm font-semibold text-gray-900">{poster?.name ?? 'Unknown'}</p>
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <Star size={11} className="text-[#F5A623]" fill="currentColor" />
                  {poster?.rating ? poster.rating.toFixed(1) : 'No ratings yet'}
                  {poster?.rating !== null && poster?.rating < 3.5 && (
                    <span className="flex items-center gap-0.5 text-amber-600 bg-amber-50 px-1.5 rounded-full ml-1"><AlertTriangle size={10} />Low rating</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {runner && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Runner</p>
                {isPoster && runner.id !== user?.id && (
                  <button onClick={() => setReportTarget({ id: runner.id, name: runner.name, taskId: id })}
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors">
                    <Flag size={11} />Report
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3">
                {runner.avatar_url
                  ? <img src={runner.avatar_url} alt={runner.name} className="w-9 h-9 rounded-full object-cover" />
                  : <div className="w-9 h-9 rounded-full bg-[#1A1A2E] flex items-center justify-center text-white font-bold">{runner.name?.[0]?.toUpperCase() ?? '?'}</div>
                }
                <div>
                  <p className="text-sm font-semibold text-gray-900">{runner.name}</p>
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <Star size={11} className="text-[#F5A623]" fill="currentColor" />
                    {runner.reputation_score ? runner.reputation_score.toFixed(1) : 'No ratings yet'}
                    {runner.strikes > 0 && <span className="text-red-500">{runner.strikes} strike{runner.strikes > 1 ? 's' : ''}</span>}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-5 pb-5">
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3">{error}</p>}

          {task.status === 'open' && !isPoster && (
            <button onClick={handleAccept} disabled={actionLoading}
              className="w-full py-3 bg-[#C41230] text-white rounded-xl font-semibold hover:bg-[#a00f28] transition-colors disabled:opacity-60">
              {actionLoading ? 'Accepting...' : 'Accept Task'}
            </button>
          )}

          {task.status === 'pending_runner_approval' && isPoster && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600 text-center"><span className="font-semibold">{runner?.name ?? 'Someone'}</span> wants to run this task. Approve them?</p>
              <div className="flex gap-3">
                <button onClick={handleRejectRunner} disabled={actionLoading}
                  className="flex-1 py-3 border border-red-300 text-red-600 rounded-xl font-semibold hover:bg-red-50 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                  <XCircle size={16} />Reject
                </button>
                <button onClick={handleApproveRunner} disabled={actionLoading}
                  className="flex-1 py-3 bg-[#1A1A2E] text-white rounded-xl font-semibold hover:bg-[#0f0f1a] transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                  <UserCheck size={16} />Approve
                </button>
              </div>
            </div>
          )}

          {task.status === 'pending_runner_approval' && isRunner && (
            <div className="text-center py-2 text-sm text-purple-600 bg-purple-50 rounded-lg">Waiting for the poster to approve you...</div>
          )}

          {task.status === 'accepted' && isRunner && (
            <>
              {/* Live location toggle */}
              <div className={`flex items-center justify-between p-3 rounded-xl border mb-3 ${sharingLocation ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-200'}`}>
                <div className="flex items-center gap-2">
                  <Radio size={14} className={sharingLocation ? 'text-emerald-600 animate-pulse' : 'text-gray-400'} />
                  <span className="text-sm font-medium text-gray-700">Share live location</span>
                  {sharingLocation && <span className="text-xs text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded-full">Live</span>}
                </div>
                <button type="button" onClick={toggleShareLocation}
                  className={`relative w-10 h-5 rounded-full transition-colors duration-200 focus:outline-none ${sharingLocation ? 'bg-emerald-500' : 'bg-gray-300'}`}>
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${sharingLocation ? 'translate-x-5' : ''}`} />
                </button>
              </div>

              {/* Mark done / back out */}
              {!showMarkDonePanel ? (
                <div className="flex gap-3">
                  <button onClick={handleBackOut} disabled={actionLoading}
                    className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors disabled:opacity-60">
                    Back Out
                  </button>
                  <button onClick={() => setShowMarkDonePanel(true)} disabled={actionLoading}
                    className="flex-1 py-3 bg-[#C41230] text-white rounded-xl font-semibold hover:bg-[#a00f28] transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                    <Camera size={16} />Mark Done
                  </button>
                </div>
              ) : (
                <div className="space-y-3 bg-gray-50 rounded-xl p-4 border border-gray-200">
                  <p className="text-sm font-semibold text-gray-700">
                    {task.delivery_type === 'leave_at_door' ? '📸 Completion photo required' : '📸 Upload completion photo (optional)'}
                  </p>
                  <label className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-dashed cursor-pointer transition-colors ${completionPhoto ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-[#C41230]'}`}>
                    <Upload size={20} className={completionPhoto ? 'text-green-500' : 'text-gray-400'} />
                    <span className="text-sm text-gray-600">{completionPhoto ? completionPhoto.name : 'Tap to upload photo'}</span>
                    <input type="file" accept="image/*" className="hidden" onChange={e => { setError(''); setCompletionPhoto(e.target.files[0] || null) }} />
                  </label>
                  {error && <p className="text-xs text-red-500">{error}</p>}
                  <div className="flex gap-2">
                    <button onClick={() => { setShowMarkDonePanel(false); setCompletionPhoto(null); setError('') }}
                      className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-100 transition-colors">
                      Cancel
                    </button>
                    <button onClick={handleMarkDoneSubmit} disabled={actionLoading || photoUploading}
                      className="flex-1 py-2.5 bg-[#C41230] text-white rounded-xl text-sm font-semibold hover:bg-[#a00f28] transition-colors disabled:opacity-60">
                      {photoUploading ? 'Uploading...' : actionLoading ? 'Submitting...' : 'Submit'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {task.status === 'pending_confirmation' && isPoster && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600 text-center">Your runner marked this task as done.</p>
              {escrowSecondsLeft !== null && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-center">
                  <p className="text-xs text-amber-600 font-medium mb-0.5">Auto-confirms in</p>
                  <p className="text-lg font-bold text-amber-700 font-mono">{formatCountdown(escrowSecondsLeft)}</p>
                  <p className="text-xs text-amber-500 mt-0.5">Runner receives {Math.floor(task.token_offer * 0.9)} tokens (10% platform fee)</p>
                </div>
              )}
              <div className="flex gap-3">
                <button onClick={handleDispute} disabled={actionLoading}
                  className="flex-1 py-3 border border-red-300 text-red-600 rounded-xl font-semibold hover:bg-red-50 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                  <XCircle size={16} />Dispute
                </button>
                <button onClick={handleConfirm} disabled={actionLoading}
                  className="flex-1 py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                  <CheckCircle size={16} />Confirm (+{Math.floor(task.token_offer * 0.9)})
                </button>
              </div>
            </div>
          )}

          {task.status === 'pending_confirmation' && isRunner && (
            <div className="text-center py-2 text-sm text-gray-500">Waiting for the poster to confirm...</div>
          )}

          {task.status === 'disputed' && (
            <div className="text-center py-2 text-sm text-red-500 bg-red-50 rounded-lg">This task is under admin review.</div>
          )}

          {isDevMode && task.status !== 'completed' && task.status !== 'disputed' && (
            <div className="mt-3 space-y-2">
              {isPoster && task.status === 'open' && (
                <button onClick={handleDevSimulateRunner} disabled={actionLoading}
                  className="w-full py-3 bg-amber-500 text-white rounded-xl font-semibold hover:bg-amber-600 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                  <Wrench size={16} />Dev: Simulate Another User Accepting
                </button>
              )}
              <button onClick={handleDevComplete} disabled={actionLoading}
                className="w-full py-3 bg-amber-500 text-white rounded-xl font-semibold hover:bg-amber-600 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
                <Wrench size={16} />Dev: Force Complete Task
              </button>
            </div>
          )}

          {showRating && !rated && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <h3 className="font-semibold text-gray-900 mb-3">Rate your experience</h3>
              <div className="flex gap-2 mb-3">
                {[1,2,3,4,5].map(s => (
                  <button key={s} onClick={() => setRatingStars(s)}
                    className={`text-2xl transition-transform hover:scale-110 ${s <= ratingStars ? 'opacity-100' : 'opacity-30'}`}>⭐</button>
                ))}
              </div>
              <textarea value={ratingNote} onChange={e => setRatingNote(e.target.value)}
                placeholder="Leave a short note (optional)" rows={2}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#C41230] resize-none" />
              <button onClick={() => submitRating(isPoster ? task.runner_id : task.poster_id)}
                className="mt-2 w-full py-2.5 bg-[#1A1A2E] text-white rounded-xl font-semibold text-sm hover:bg-[#0f0f1a] transition-colors">
                Submit Rating
              </button>
            </div>
          )}
          {rated && <div className="mt-3 text-center text-sm text-green-600 font-medium">Rating submitted!</div>}
        </div>
      </div>

      {/* Chat */}
      {(isPoster || isRunner) && task.runner_id && (
        <TaskChat taskId={id} posterId={task.poster_id} runnerId={task.runner_id} />
      )}

      {/* Report modal */}
      {reportTarget && (
        <ReportUserModal
          reportedId={reportTarget.id}
          reportedName={reportTarget.name}
          taskId={reportTarget.taskId}
          onClose={() => setReportTarget(null)}
        />
      )}
    </div>
  )
}
