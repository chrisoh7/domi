import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import {
  MapPin, Clock, Coins, Star, AlertTriangle, CheckCircle, XCircle,
  Camera, Wrench, Timer, Navigation, Pencil, UserCheck, DollarSign,
  Package, Handshake, Users, Flag, Radio, Upload, ArrowLeft, Calendar,
} from 'lucide-react'
import { estimateCommute } from '../lib/utils'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { WheelPanAndCtrlZoom, MapRecenterControl } from '../components/LeafletMapControls'
import TaskChat from '../components/TaskChat'
import ReportUserModal from '../components/ReportUserModal'
import { Button } from '../components/ui/button'
import { Card } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Avatar, AvatarImage, AvatarFallback } from '../components/ui/avatar'
import { Textarea } from '../components/ui/textarea'
import { useChat } from '../contexts/ChatContext'

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
  in_person:     { icon: Handshake, label: 'In person',     color: 'text-blue-600 bg-blue-50 border-blue-200' },
  leave_at_door: { icon: Package,   label: 'Leave at door', color: 'text-green-600 bg-green-50 border-green-200' },
  pickup_only:   { icon: Users,     label: 'Pickup only',   color: 'text-purple-600 bg-purple-50 border-purple-200' },
}

const CATEGORY_EMOJIS = {
  'Errands & Pickup': '🛍️',
  'Tutoring & Academic': '📚',
  'Moving': '📦',
  'Tech Help': '💻',
  'Fitness & Wellness': '🏋️',
  'Other': '✨',
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
      <div className="h-40 bg-muted rounded-xl flex items-center justify-center text-sm text-muted-foreground">
        {rawStops.length > 0 ? 'Locating on map…' : 'No location specified'}
      </div>
    )
  }

  return (
    <div>
      <div className="rounded-xl overflow-hidden" style={{ position: 'relative', zIndex: 0 }}>
        <MapContainer center={stopPositions[0]} zoom={15} style={{ height: 220, width: '100%' }} scrollWheelZoom={false}>
          <WheelPanAndCtrlZoom />
          <MapRecenterControl positions={allPositions} focusPosition={stopPositions[0] ?? null} />
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
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
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
            <span className="text-xs text-muted-foreground ml-auto">{c.distLabel} away</span>
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
  const { open: openChat } = useChat()
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
      supabase.from('tasks').select('location_stops, delivery_type, cash_offer, marked_done_at, completion_photo_url, requires_approval, subtasks').eq('id', id).single(),
    ])
    if (data) {
      setTask({
        ...data,
        location_stops: extra?.location_stops ?? null,
        delivery_type: extra?.delivery_type ?? null,
        cash_offer: extra?.cash_offer ?? null,
        marked_done_at: extra?.marked_done_at ?? null,
        completion_photo_url: extra?.completion_photo_url ?? null,
        requires_approval: extra?.requires_approval ?? null,
        subtasks: extra?.subtasks ?? null,
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

  if (loading) return <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary" /></div>
  if (!task) return <div className="text-center py-16 text-muted-foreground">Task not found.</div>

  const isPoster = user?.id === task.poster_id
  const isRunner = user?.id === task.runner_id
  const deadlineStr = formatDeadline(task)
  const deadlineDate = task.deadline_at ? new Date(task.deadline_at) : task.deadline ? new Date(task.deadline) : null
  const isExpired = deadlineDate && deadlineDate < new Date()
  const hasLocation = task.location_pickup || (task.location_lat && task.location_lng)
  const deliveryMeta = task.delivery_type ? DELIVERY_LABELS[task.delivery_type] : null
  const categoryEmoji = CATEGORY_EMOJIS[task.category] ?? '✨'

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Back button */}
        <Button variant="ghost" onClick={() => navigate('/feed')} className="mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />Back to Feed
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── Main content ── */}
          <div className="lg:col-span-2 space-y-6">
            {/* Main task card */}
            <Card className="p-6">
              {task.photo_url && <img src={task.photo_url} alt="Task" className="w-full h-48 object-cover rounded-lg mb-4" />}

              {/* Boosted pill */}
              {task.boosted && (
                <span className="inline-flex items-center gap-1 text-xs text-amber-600 font-semibold bg-amber-50 px-2 py-0.5 rounded-full mb-3">
                  ⚡ Boosted
                </span>
              )}

              {/* Header: emoji + title + token chip + cash */}
              <div className="flex items-start gap-4 mb-4">
                <span className="text-4xl">{categoryEmoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h1 className="text-2xl font-bold leading-snug">{task.title}</h1>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      {isPoster && task.status === 'open' && (
                        <Link to={`/task/${id}/edit`} className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors" title="Edit task">
                          <Pencil size={15} />
                        </Link>
                      )}
                      <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 font-bold text-base px-3 py-1 rounded-full whitespace-nowrap">
                        <Coins size={16} />{task.token_offer}
                      </span>
                      {task.cash_offer > 0 && (
                        <span className="flex items-center gap-0.5 text-green-600 font-semibold text-sm whitespace-nowrap">
                          <DollarSign size={13} />{task.cash_offer} cash
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Status + delivery + category badges */}
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <Badge variant="secondary" className={
                  task.status === 'open' ? 'bg-green-100 text-green-700' :
                  task.status === 'accepted' ? 'bg-blue-100 text-blue-700' :
                  task.status === 'pending_confirmation' ? 'bg-yellow-100 text-yellow-700' :
                  task.status === 'pending_runner_approval' ? 'bg-purple-100 text-purple-700' :
                  task.status === 'completed' ? 'bg-gray-100 text-gray-600' :
                  'bg-red-100 text-red-700'
                }>
                  {task.status === 'pending_confirmation' ? 'Awaiting Confirmation'
                    : task.status === 'pending_runner_approval' ? 'Pending Approval'
                    : task.status.charAt(0).toUpperCase() + task.status.slice(1)}
                </Badge>
                {deliveryMeta && (() => {
                  const Icon = deliveryMeta.icon
                  return (
                    <Badge variant="outline" className={`flex items-center gap-1 ${deliveryMeta.color}`}>
                      <Icon size={11} />{deliveryMeta.label}
                    </Badge>
                  )
                })()}
                {task.category && (
                  <Badge variant="outline">{task.category}</Badge>
                )}
                {task.requires_approval && (
                  <Badge variant="outline" className="flex items-center gap-1 text-purple-600 bg-purple-50 border-purple-200">
                    <UserCheck size={11} />Approval required
                  </Badge>
                )}
              </div>

              {/* Description */}
              <p className="text-muted-foreground mb-6 leading-relaxed">{task.description}</p>

              {/* Completion photo */}
              {task.completion_photo_url && (
                <div className="mb-4">
                  <p className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1"><Camera size={11} />Completion photo</p>
                  <img src={task.completion_photo_url} alt="Completion" className="w-full h-36 object-cover rounded-xl border border-border" />
                </div>
              )}

              {/* Details grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4 border-y border-border mb-6">
                {/* Location */}
                {(task.location_pickup || (Array.isArray(task.location_stops) && task.location_stops.length > 0)) && (
                  <div className="flex items-start gap-3">
                    <MapPin size={16} className="text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Pickup</p>
                      {Array.isArray(task.location_stops) && task.location_stops.length > 1 ? (
                        <div className="space-y-1">
                          {task.location_stops.map((stop, idx) => (
                            <div key={idx} className="flex items-start gap-1.5">
                              <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 mt-0.5 ${stop.lat ? 'bg-[#C41230]' : 'bg-gray-300'}`}>{idx + 1}</div>
                              <span className="text-sm text-muted-foreground leading-tight">{stop.label || 'Unknown'}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm">{task.location_pickup}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Est time */}
                {task.est_minutes && (
                  <div className="flex items-start gap-3">
                    <Clock size={16} className="text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Estimated Time</p>
                      <p className="text-sm">{formatEst(task.est_minutes)}</p>
                    </div>
                  </div>
                )}

                {/* Deadline */}
                {deadlineStr && (
                  <div className="flex items-start gap-3">
                    <Calendar size={16} className={`mt-0.5 flex-shrink-0 ${isExpired ? 'text-red-400' : 'text-primary'}`} />
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Deadline</p>
                      <p className={`text-sm ${isExpired ? 'text-red-500' : ''}`}>{deadlineStr}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="space-y-3">
                {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

                {task.status === 'open' && !isPoster && (
                  <Button onClick={handleAccept} disabled={actionLoading} className="w-full bg-primary text-white hover:bg-primary/90">
                    {actionLoading ? 'Accepting...' : 'Accept Doum'}
                  </Button>
                )}

                {task.status === 'pending_runner_approval' && isPoster && (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground text-center"><span className="font-semibold text-foreground">{runner?.name ?? 'Someone'}</span> wants to be the domi for this doum. Approve them?</p>
                    <div className="flex gap-3">
                      <Button variant="outline" onClick={handleRejectRunner} disabled={actionLoading} className="flex-1 border-red-300 text-red-600 hover:bg-red-50">
                        <XCircle size={16} className="mr-2" />Reject
                      </Button>
                      <Button onClick={handleApproveRunner} disabled={actionLoading} className="flex-1 bg-primary text-white hover:bg-primary/90">
                        <UserCheck size={16} className="mr-2" />Approve
                      </Button>
                    </div>
                  </div>
                )}

                {task.status === 'pending_runner_approval' && isRunner && (
                  <div className="text-center py-2 text-sm text-purple-600 bg-purple-50 rounded-lg">Waiting for the poster to approve you...</div>
                )}

                {task.status === 'accepted' && isRunner && (
                  <>
                    {/* Live location toggle */}
                    <div className={`flex items-center justify-between p-3 rounded-xl border ${sharingLocation ? 'bg-emerald-50 border-emerald-200' : 'bg-muted border-border'}`}>
                      <div className="flex items-center gap-2">
                        <Radio size={14} className={sharingLocation ? 'text-emerald-600 animate-pulse' : 'text-muted-foreground'} />
                        <span className="text-sm font-medium">Share live location</span>
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
                        <Button variant="outline" onClick={handleBackOut} disabled={actionLoading} className="flex-1">
                          Back Out
                        </Button>
                        <Button onClick={() => setShowMarkDonePanel(true)} disabled={actionLoading} className="flex-1 bg-primary text-white hover:bg-primary/90">
                          <Camera size={16} className="mr-2" />Mark Done
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3 bg-muted rounded-xl p-4 border border-border">
                        <p className="text-sm font-semibold">
                          {task.delivery_type === 'leave_at_door' ? '📸 Completion photo required' : '📸 Upload completion photo (optional)'}
                        </p>
                        <label className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-dashed cursor-pointer transition-colors ${completionPhoto ? 'border-green-400 bg-green-50' : 'border-border hover:border-primary'}`}>
                          <Upload size={20} className={completionPhoto ? 'text-green-500' : 'text-muted-foreground'} />
                          <span className="text-sm text-muted-foreground">{completionPhoto ? completionPhoto.name : 'Tap to upload photo'}</span>
                          <input type="file" accept="image/*" className="hidden" onChange={e => { setError(''); setCompletionPhoto(e.target.files[0] || null) }} />
                        </label>
                        {error && <p className="text-xs text-red-500">{error}</p>}
                        <div className="flex gap-2">
                          <Button variant="outline" onClick={() => { setShowMarkDonePanel(false); setCompletionPhoto(null); setError('') }} className="flex-1">
                            Cancel
                          </Button>
                          <Button onClick={handleMarkDoneSubmit} disabled={actionLoading || photoUploading} className="flex-1 bg-primary text-white hover:bg-primary/90">
                            {photoUploading ? 'Uploading...' : actionLoading ? 'Submitting...' : 'Submit'}
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {task.status === 'pending_confirmation' && isPoster && (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground text-center">Your domi marked this doum as done.</p>
                    {escrowSecondsLeft !== null && (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2 mb-1">
                          <Clock size={14} className="text-amber-600" />
                          <p className="text-xs text-amber-600 font-medium">Auto-confirms in</p>
                        </div>
                        <p className="text-lg font-bold text-amber-700 font-mono">{formatCountdown(escrowSecondsLeft)}</p>
                        <p className="text-xs text-amber-500 mt-0.5">Domi receives {Math.floor(task.token_offer * 0.9)} tokens (10% platform fee)</p>
                      </div>
                    )}
                    <div className="flex gap-3">
                      <Button variant="outline" onClick={handleDispute} disabled={actionLoading} className="flex-1 border-red-300 text-red-600 hover:bg-red-50">
                        <XCircle size={16} className="mr-2" />Dispute
                      </Button>
                      <Button onClick={handleConfirm} disabled={actionLoading} className="flex-1 bg-primary text-white hover:bg-primary/90">
                        <CheckCircle size={16} className="mr-2" />Confirm (+{Math.floor(task.token_offer * 0.9)})
                      </Button>
                    </div>
                  </div>
                )}

                {task.status === 'pending_confirmation' && isRunner && (
                  <div className="text-center py-2 text-sm text-muted-foreground">Waiting for the poster to confirm...</div>
                )}

                {task.status === 'disputed' && (
                  <div className="text-center py-2 text-sm text-red-500 bg-red-50 rounded-lg">This doum is under admin review.</div>
                )}

                {isDevMode && task.status !== 'completed' && task.status !== 'disputed' && (
                  <div className="space-y-2">
                    {isPoster && task.status === 'open' && (
                      <Button onClick={handleDevSimulateRunner} disabled={actionLoading} className="w-full bg-amber-500 text-white hover:bg-amber-600">
                        <Wrench size={16} className="mr-2" />Dev: Simulate Another User Accepting
                      </Button>
                    )}
                    <Button onClick={handleDevComplete} disabled={actionLoading} className="w-full bg-amber-500 text-white hover:bg-amber-600">
                      <Wrench size={16} className="mr-2" />Dev: Force Complete Doum
                    </Button>
                  </div>
                )}

                {/* Chat button */}
                {(isPoster || isRunner) && task.runner_id && (
                  <Button variant="outline" className="w-full" onClick={() => openChat(id)}>
                    💬 Open Chat
                  </Button>
                )}

                {/* Report flag button */}
                {isRunner && poster?.id && poster.id !== user?.id && (
                  <Button variant="ghost" size="sm" onClick={() => setReportTarget({ id: poster.id, name: poster.name, taskId: id })} className="w-full text-muted-foreground hover:text-red-500">
                    <Flag size={14} className="mr-1" />Report Poster
                  </Button>
                )}
                {isPoster && runner?.id && runner.id !== user?.id && (
                  <Button variant="ghost" size="sm" onClick={() => setReportTarget({ id: runner.id, name: runner.name, taskId: id })} className="w-full text-muted-foreground hover:text-red-500">
                    <Flag size={14} className="mr-1" />Report Domi
                  </Button>
                )}

                {/* Rating form */}
                {showRating && !rated && (
                  <div className="pt-4 border-t border-border">
                    <h3 className="font-semibold mb-3">Rate your experience</h3>
                    <div className="flex gap-2 mb-3">
                      {[1,2,3,4,5].map(s => (
                        <button key={s} onClick={() => setRatingStars(s)}
                          className={`text-2xl transition-transform hover:scale-110 ${s <= ratingStars ? 'opacity-100' : 'opacity-30'}`}>⭐</button>
                      ))}
                    </div>
                    <Textarea value={ratingNote} onChange={e => setRatingNote(e.target.value)}
                      placeholder="Leave a short note (optional)" rows={2} className="mb-2" />
                    <Button onClick={() => submitRating(isPoster ? task.runner_id : task.poster_id)} className="w-full bg-primary text-white hover:bg-primary/90">
                      Submit Rating
                    </Button>
                  </div>
                )}
                {rated && <div className="mt-3 text-center text-sm text-green-600 font-medium">Rating submitted!</div>}
              </div>
            </Card>
          </div>

          {/* ── Sidebar ── */}
          <div className="space-y-4">
            {/* Posted by */}
            <Card className="p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Posted by</p>
              <div className="flex items-center gap-3">
                <Avatar className="w-12 h-12">
                  {poster?.avatar ? <AvatarImage src={poster.avatar} alt={poster.name} /> : null}
                  <AvatarFallback className="bg-primary text-white font-bold">{poster?.name?.[0]?.toUpperCase() ?? '?'}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold">{poster?.name ?? 'Unknown'}</p>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Star size={11} className="text-amber-400 fill-amber-400" />
                    {poster?.rating ? poster.rating.toFixed(1) : 'No ratings yet'}
                    {poster?.rating !== null && poster?.rating < 3.5 && (
                      <span className="flex items-center gap-0.5 text-amber-600 bg-amber-50 px-1.5 rounded-full ml-1"><AlertTriangle size={10} />Low</span>
                    )}
                  </div>
                </div>
              </div>
            </Card>

            {/* Runner */}
            {runner && (
              <Card className="p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Domi</p>
                <div className="flex items-center gap-3">
                  <Avatar className="w-12 h-12">
                    {runner.avatar_url ? <AvatarImage src={runner.avatar_url} alt={runner.name} /> : null}
                    <AvatarFallback className="bg-accent text-foreground font-bold">{runner.name?.[0]?.toUpperCase() ?? '?'}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold">{runner.name}</p>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Star size={11} className="text-amber-400 fill-amber-400" />
                      {runner.reputation_score ? runner.reputation_score.toFixed(1) : 'No ratings yet'}
                      {runner.strikes > 0 && <span className="text-red-500">{runner.strikes} strike{runner.strikes > 1 ? 's' : ''}</span>}
                    </div>
                    <Badge variant="outline" className="mt-1 text-xs">
                      {task.status === 'accepted' ? 'In progress' : task.status === 'pending_confirmation' ? 'Done — awaiting confirm' : task.status}
                    </Badge>
                  </div>
                </div>
              </Card>
            )}

            {/* Location */}
            <Card className="p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <Navigation size={12} className="text-primary" />Location
              </p>
              {hasLocation ? (
                <TaskMap task={task} runnerLivePos={runnerLivePos} />
              ) : (
                <div className="h-24 bg-muted rounded-xl flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <MapPin size={16} />No location specified
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>

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
