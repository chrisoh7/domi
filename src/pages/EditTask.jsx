import { useState, useRef, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Coins, Zap, MapPin, Navigation, Loader2, Plus, X, DollarSign, Package, Handshake, Users } from 'lucide-react'
import { geocodePittsburgh } from '../lib/utils'
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const CATEGORIES = [
  { id: 'Errands & Pickup', emoji: '🛍️', desc: 'Packages & pickup' },
  { id: 'Tutoring & Academic', emoji: '📚', desc: 'Study & homework' },
  { id: 'Moving', emoji: '📦', desc: 'Boxes & furniture' },
  { id: 'Tech Help', emoji: '💻', desc: 'Debugging & setup' },
  { id: 'Fitness & Wellness', emoji: '🏋️', desc: 'Gym & wellness' },
  { id: 'Other', emoji: '✨', desc: 'Anything else' },
]

const EST_OPTIONS = [
  { value: 15,  label: '15 min' },
  { value: 30,  label: '30 min' },
  { value: 45,  label: '45 min' },
  { value: 60,  label: '1 hr' },
  { value: 90,  label: '1.5 hrs' },
  { value: 120, label: '2 hrs' },
  { value: 180, label: '3 hrs' },
  { value: 240, label: '4+ hrs' },
]

const CMU_CENTER = [40.4432, -79.9428]

const DELIVERY_TYPES = [
  { id: 'in_person',     emoji: <Handshake size={20} />, label: 'In person',     desc: 'Meet face to face' },
  { id: 'leave_at_door', emoji: <Package size={20} />,   label: 'Leave at door', desc: 'Drop off, no meetup' },
  { id: 'pickup_only',   emoji: <Users size={20} />,     label: 'Pickup only',   desc: 'Runner picks up only' },
]

function makeStopIcon(num) {
  return L.divIcon({
    className: '',
    html: `<div style="width:28px;height:36px"><svg width="28" height="36" viewBox="0 0 28 36" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3))"><path d="M14 0C6.27 0 0 6.27 0 14C0 24.5 14 36 14 36C14 36 28 24.5 28 14C28 6.27 21.73 0 14 0Z" fill="#C41230"/><text x="14" y="15" text-anchor="middle" dominant-baseline="middle" fill="white" font-size="11" font-weight="bold" font-family="Arial,sans-serif">${num}</text></svg></div>`,
    iconSize: [28, 36],
    iconAnchor: [14, 36],
    popupAnchor: [0, -36],
  })
}

function MapFitStops({ positions }) {
  const map = useMap()
  const prev = useRef(null)
  useEffect(() => {
    const key = JSON.stringify(positions)
    if (key === prev.current) return
    prev.current = key
    if (positions.length >= 2) {
      map.fitBounds(positions, { padding: [40, 40], maxZoom: 16 })
    } else if (positions.length === 1) {
      map.flyTo(positions[0], 16, { animate: true, duration: 1 })
    }
  }, [JSON.stringify(positions)]) // eslint-disable-line
  return null
}

function newStop() {
  return { label: '', lat: null, lng: null, query: '', suggestions: [], showSuggestions: false }
}

export default function EditTask() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [loadingTask, setLoadingTask] = useState(true)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState(CATEGORIES[0].id)
  const [deadlineAt, setDeadlineAt] = useState('')
  const [estMinutes, setEstMinutes] = useState(null)
  const [tokenOffer, setTokenOffer] = useState(10)
  const [boost, setBoost] = useState(false)
  const [photoUrl, setPhotoUrl] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const [deliveryType, setDeliveryType] = useState('in_person')
  const [cashOffer, setCashOffer] = useState('')

  const [stops, setStops] = useState([newStop()])
  const [geoLoadingIdx, setGeoLoadingIdx] = useState(null)
  const [userPos, setUserPos] = useState(null)
  const debounceRefs = useRef({})

  useEffect(() => {
    async function loadTask() {
      const { data, error: err } = await supabase.from('tasks').select('*').eq('id', id).single()
      if (err || !data) { navigate(`/task/${id}`); return }
      if (data.poster_id !== user?.id) { navigate(`/task/${id}`); return }
      if (data.status !== 'open') { navigate(`/task/${id}`); return }

      setTitle(data.title)
      setDescription(data.description || '')
      setCategory(data.category)
      setTokenOffer(data.token_offer)
      setBoost(data.boosted)
      setPhotoUrl(data.photo_url || '')
      setEstMinutes(data.est_minutes || null)
      if (data.deadline_at) setDeadlineAt(new Date(data.deadline_at).toISOString().slice(0, 16))
      if (data.delivery_type) setDeliveryType(data.delivery_type)
      if (data.cash_offer) setCashOffer(String(data.cash_offer))

      // Load location stops
      if (Array.isArray(data.location_stops) && data.location_stops.length > 0) {
        setStops(data.location_stops.map(s => ({ ...newStop(), label: s.label || '', lat: s.lat, lng: s.lng, query: s.label || '' })))
      } else if (data.location_lat && data.location_lng) {
        setStops([{ ...newStop(), label: data.location_pickup || '', lat: data.location_lat, lng: data.location_lng, query: data.location_pickup || '' }])
      } else if (data.location_pickup) {
        setStops([{ ...newStop(), label: data.location_pickup, query: data.location_pickup }])
      }

      setLoadingTask(false)
    }
    loadTask()
  }, [id, user?.id]) // eslint-disable-line

  function updateStop(idx, fields) {
    setStops(prev => prev.map((s, i) => i === idx ? { ...s, ...fields } : s))
  }

  function addStop() {
    setStops(prev => [...prev, newStop()])
  }

  function removeStop(idx) {
    setStops(prev => prev.filter((_, i) => i !== idx))
  }

  function handleStopSearchChange(idx, val) {
    updateStop(idx, { query: val, label: val, lat: null, lng: null })
    clearTimeout(debounceRefs.current[idx])
    if (val.length < 2) { updateStop(idx, { suggestions: [], showSuggestions: false }); return }
    debounceRefs.current[idx] = setTimeout(async () => {
      try {
        const results = await geocodePittsburgh(val, userPos?.[0], userPos?.[1], 5)
        updateStop(idx, { suggestions: results, showSuggestions: results.length > 0 })
      } catch {}
    }, 350)
  }

  function selectStopSuggestion(idx, s) {
    updateStop(idx, {
      label: s.display_name,
      lat: parseFloat(s.lat),
      lng: parseFloat(s.lon),
      query: s.display_name,
      suggestions: [],
      showSuggestions: false,
    })
  }

  async function useCurrentLocationForStop(idx) {
    if (!navigator.geolocation) return
    setGeoLoadingIdx(idx)
    navigator.geolocation.getCurrentPosition(
      async ({ coords: { latitude: lat, longitude: lng } }) => {
        setUserPos([lat, lng])
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`)
          const data = await res.json()
          const label = data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`
          updateStop(idx, { label, lat, lng, query: label })
        } catch {
          const label = `${lat.toFixed(5)}, ${lng.toFixed(5)}`
          updateStop(idx, { label, lat, lng, query: label })
        }
        setGeoLoadingIdx(null)
      },
      () => setGeoLoadingIdx(null)
    )
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(''); setLoading(true)

    const locationStops = stops
      .filter(s => s.label || (s.lat && s.lng))
      .map(s => ({ label: s.label, lat: s.lat, lng: s.lng }))
    const firstStop = locationStops[0] ?? null

    const { error: updateError } = await supabase
      .from('tasks')
      .update({
        title,
        description,
        category,
        location_pickup: firstStop?.label || null,
        location_lat: firstStop?.lat || null,
        location_lng: firstStop?.lng || null,
        location_stops: locationStops.length > 0 ? locationStops : null,
        deadline_at: deadlineAt ? new Date(deadlineAt).toISOString() : null,
        est_minutes: estMinutes || null,
        token_offer: tokenOffer,
        cash_offer: cashOffer ? Number(cashOffer) : null,
        delivery_type: deliveryType,
        boosted: boost,
        photo_url: photoUrl || null,
      })
      .eq('id', id)

    if (updateError) { setError(updateError.message); setLoading(false); return }
    navigate(`/task/${id}`)
  }

  const minDateTime = new Date().toISOString().slice(0, 16)
  const positionedStops = stops.map((s, i) => ({ ...s, num: i + 1 })).filter(s => s.lat && s.lng)
  const stopPositions = positionedStops.map(s => [s.lat, s.lng])

  if (loadingTask) {
    return <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#C41230]" /></div>
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-[#1A1A2E] mb-6">Edit Task</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Basic info */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
          <div>
            <label className="text-sm font-semibold text-gray-700">Title *</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} required
              className="mt-1 w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#C41230]" />
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-700">Description *</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} required rows={3}
              placeholder="Full details — include any specific pickup instructions, access codes, what to bring, etc."
              className="mt-1 w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#C41230] resize-none" />
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-700">Deadline</label>
            <input type="datetime-local" value={deadlineAt} onChange={e => setDeadlineAt(e.target.value)} min={minDateTime}
              className="mt-1 w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#C41230]" />
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-1.5">⏱ Estimated Time to Complete</label>
            <div className="flex flex-wrap gap-1.5">
              {EST_OPTIONS.map(opt => (
                <button key={opt.value} type="button"
                  onClick={() => setEstMinutes(estMinutes === opt.value ? null : opt.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150 border ${estMinutes === opt.value ? 'bg-[#1A1A2E] text-white border-[#1A1A2E] scale-105' : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'}`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-700">Photo URL (optional)</label>
            <input type="url" value={photoUrl} onChange={e => setPhotoUrl(e.target.value)} placeholder="https://..."
              className="mt-1 w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#C41230]" />
          </div>
        </div>

        {/* Category */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <label className="text-sm font-semibold text-gray-700 block mb-3">Category *</label>
          <div className="grid grid-cols-3 gap-2">
            {CATEGORIES.map(cat => {
              const active = category === cat.id
              return (
                <button key={cat.id} type="button" onClick={() => setCategory(cat.id)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 cursor-pointer select-none transition-all duration-200 ease-out ${active ? 'border-[#C41230] bg-red-50 shadow-sm scale-[1.04]' : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50 hover:scale-[1.02]'}`}>
                  <span className="text-2xl transition-transform duration-200" style={{ transform: active ? 'scale(1.2)' : 'scale(1)' }}>{cat.emoji}</span>
                  <span className={`text-xs font-semibold text-center leading-tight ${active ? 'text-[#C41230]' : 'text-gray-700'}`}>{cat.id}</span>
                  <span className="text-[10px] text-gray-400 text-center hidden sm:block">{cat.desc}</span>
                  {active && <span className="w-1.5 h-1.5 rounded-full bg-[#C41230] mt-0.5" />}
                </button>
              )
            })}
          </div>
        </div>

        {/* Delivery type */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <label className="text-sm font-semibold text-gray-700 block mb-3">Delivery / Handoff Type *</label>
          <div className="grid grid-cols-3 gap-2">
            {DELIVERY_TYPES.map(dt => {
              const active = deliveryType === dt.id
              return (
                <button key={dt.id} type="button" onClick={() => setDeliveryType(dt.id)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 cursor-pointer select-none transition-all duration-200 ease-out ${active ? 'border-[#C41230] bg-red-50 shadow-sm scale-[1.04]' : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50 hover:scale-[1.02]'}`}>
                  <span className={`transition-colors ${active ? 'text-[#C41230]' : 'text-gray-500'}`}>{dt.emoji}</span>
                  <span className={`text-xs font-semibold text-center leading-tight ${active ? 'text-[#C41230]' : 'text-gray-700'}`}>{dt.label}</span>
                  <span className="text-[10px] text-gray-400 text-center hidden sm:block">{dt.desc}</span>
                  {active && <span className="w-1.5 h-1.5 rounded-full bg-[#C41230] mt-0.5" />}
                </button>
              )
            })}
          </div>
        </div>

        {/* Location — multi-stop */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <label className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
            <MapPin size={14} className="text-[#C41230]" />
            Locations
          </label>

          <div className="space-y-2 mb-3">
            {stops.map((stop, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <div className="flex flex-col items-center flex-shrink-0 pt-2.5">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${stop.lat ? 'bg-[#C41230]' : 'bg-gray-300'}`}>
                    {idx + 1}
                  </div>
                  {idx < stops.length - 1 && <div className="w-px h-4 bg-gray-300 mt-1" />}
                </div>
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={stop.query}
                    onChange={e => handleStopSearchChange(idx, e.target.value)}
                    onBlur={() => setTimeout(() => updateStop(idx, { showSuggestions: false }), 150)}
                    onFocus={() => stop.suggestions.length > 0 && updateStop(idx, { showSuggestions: true })}
                    onKeyDown={e => e.key === 'Enter' && e.preventDefault()}
                    placeholder={
                      stops.length === 1 ? 'Search address or building…'
                      : idx === 0 ? 'Start — search address or building…'
                      : idx === stops.length - 1 ? 'End — search address or building…'
                      : `Stop ${idx + 1} — search address or building…`
                    }
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#C41230]"
                  />
                  {stop.showSuggestions && (
                    <div className="absolute top-full left-0 right-0 z-20 bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-52 overflow-y-auto">
                      {stop.suggestions.map((s, i) => (
                        <button key={i} type="button" onMouseDown={() => selectStopSuggestion(idx, s)}
                          className="w-full text-left px-3 py-2.5 hover:bg-gray-50 border-b border-gray-100 last:border-0">
                          <div className="text-sm font-medium text-gray-800 truncate">{s.display_name.split(',')[0]}</div>
                          <div className="text-xs text-gray-400 truncate">{s.display_name.split(',').slice(1, 3).join(',')}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button type="button" onClick={() => useCurrentLocationForStop(idx)} disabled={geoLoadingIdx === idx}
                    className="p-2.5 bg-[#C41230] text-white rounded-lg hover:bg-[#a00f28] transition-colors disabled:opacity-60" title="Use my current location">
                    {geoLoadingIdx === idx ? <Loader2 size={14} className="animate-spin" /> : <Navigation size={14} />}
                  </button>
                  {stops.length > 1 && (
                    <button type="button" onClick={() => removeStop(idx)}
                      className="p-2.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors" title="Remove stop">
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <button type="button" onClick={addStop}
            className="flex items-center gap-1.5 text-sm text-[#C41230] font-medium hover:underline mb-4">
            <Plus size={14} />
            Add route
          </button>

          <div className="rounded-xl overflow-hidden" style={{ position: 'relative', zIndex: 0 }}>
            <MapContainer center={CMU_CENTER} zoom={15} style={{ height: 220, width: '100%' }} scrollWheelZoom={false}>
              <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <MapFitStops positions={stopPositions} />
              {positionedStops.map(stop => (
                <Marker key={stop.num} position={[stop.lat, stop.lng]} icon={makeStopIcon(stop.num)} />
              ))}
              {stopPositions.length >= 2 && (
                <Polyline positions={stopPositions} color="#C41230" weight={2.5} dashArray="8 5" />
              )}
            </MapContainer>
          </div>
        </div>

        {/* Token offer */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <label className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
            <Coins size={15} className="text-[#F5A623]" />
            Token Offer: <span className="text-[#F5A623] font-bold ml-1">{tokenOffer}</span>
          </label>
          <input type="range" min={1} max={100} value={tokenOffer} onChange={e => setTokenOffer(Number(e.target.value))}
            className="mt-2 w-full accent-[#C41230]" />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>1 (trivial)</span><span>30+ (high effort)</span><span>100</span>
          </div>

          <div className="mt-4">
            <label className="text-sm font-semibold text-gray-700 flex items-center gap-1.5 mb-1">
              <DollarSign size={14} className="text-green-600" />
              Cash offer (optional)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
              <input type="number" min={0} step={0.01} value={cashOffer} onChange={e => setCashOffer(e.target.value)}
                placeholder="0.00"
                className="w-full pl-7 pr-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#C41230]" />
            </div>
            <p className="text-xs text-gray-400 mt-1">Optional cash payment in addition to tokens</p>
          </div>

          <div className="mt-4 border-t border-gray-100 pt-4">
            <label className="flex items-center gap-3 cursor-pointer" onClick={() => setBoost(b => !b)}>
              <div className="relative flex-shrink-0">
                <div className={`w-10 h-5 rounded-full transition-colors duration-200 ${boost ? 'bg-[#F5A623]' : 'bg-gray-200'}`} />
                <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${boost ? 'translate-x-5' : ''}`} />
              </div>
              <div>
                <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-700">
                  <Zap size={14} className="text-[#F5A623]" />Boost listing (+10 tokens)
                </div>
                <p className="text-xs text-gray-500">Pins your task to the top of the feed</p>
              </div>
            </label>
          </div>
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

        <div className="flex gap-3">
          <button type="button" onClick={() => navigate(`/task/${id}`)}
            className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={loading}
            className="flex-1 py-3 bg-[#C41230] text-white rounded-xl font-semibold hover:bg-[#a00f28] transition-colors disabled:opacity-60">
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  )
}
