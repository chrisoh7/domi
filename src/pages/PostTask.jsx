import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { geocodePittsburgh } from '../lib/utils'
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet'
import { Coins, Zap, MapPin, Navigation, Loader2, UserCheck, ShieldAlert, Plus, X, DollarSign, Package, Handshake, Users, ArrowLeft, ArrowRight, Check } from 'lucide-react'
import { moderateContent } from '../lib/moderateContent'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Button } from '../components/ui/button'
import { Card } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Textarea } from '../components/ui/textarea'
import { Label } from '../components/ui/label'
import { Slider } from '../components/ui/slider'
import { Switch } from '../components/ui/switch'

const CATEGORIES = [
  { id: 'Errands & Pickup', emoji: '🛍️', desc: 'Packages & pickup' },
  { id: 'Tutoring & Academic', emoji: '📚', desc: 'Study & homework' },
  { id: 'Moving', emoji: '📦', desc: 'Boxes & furniture' },
  { id: 'Tech Help', emoji: '💻', desc: 'Debugging & setup' },
  { id: 'Fitness & Wellness', emoji: '🏋️', desc: 'Gym & wellness' },
  { id: 'Other', emoji: '✨', desc: 'Anything else' },
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

const STEPS = [
  { label: 'Details' },
  { label: 'Location' },
  { label: 'Settings' },
]

export default function PostTask() {
  const { profile, refreshProfile, isDevMode } = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState(0)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState(CATEGORIES[0].id)
  const [deadlineAt, setDeadlineAt] = useState('')
  const [estMinutes, setEstMinutes] = useState(null)
  const [tokenOffer, setTokenOffer] = useState(10)
  const [boost, setBoost] = useState(false)
  const [requiresApproval, setRequiresApproval] = useState(false)
  const [photoUrl, setPhotoUrl] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [moderating, setModerating] = useState(false)

  const [deliveryType, setDeliveryType] = useState('in_person')
  const [cashOffer, setCashOffer] = useState('')

  // Location — multi-stop
  const [stops, setStops] = useState([newStop()])
  const [geoLoadingIdx, setGeoLoadingIdx] = useState(null)
  const [userPos, setUserPos] = useState(null)
  const debounceRefs = useRef({})

  const totalCost = tokenOffer + (boost ? 10 : 0)
  const canAfford = isDevMode || (profile?.token_balance ?? 0) >= totalCost

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
    setError('')
    setLoading(true)

    let moderationStatus = 'approved'
    let flagReason = null
    if (!isDevMode) {
      setModerating(true)
      const { result, reason } = await moderateContent(`${title}\n${description}`)
      setModerating(false)
      if (result === 'blocked') {
        setError(`Your task was blocked by content moderation. Reason: ${reason}`)
        setLoading(false)
        return
      }
      if (result === 'borderline') {
        moderationStatus = 'flagged'
        flagReason = reason
      }
    }

    const locationStops = stops
      .filter(s => s.label || (s.lat && s.lng))
      .map(s => ({ label: s.label, lat: s.lat, lng: s.lng }))
    const firstStop = locationStops[0] ?? null

    const { data: task, error: taskError } = await supabase
      .from('tasks')
      .insert({
        poster_id: profile.id,
        title,
        description,
        category,
        location_pickup: firstStop?.label || null,
        location_dropoff: null,
        location_lat: firstStop?.lat || null,
        location_lng: firstStop?.lng || null,
        location_stops: locationStops.length > 0 ? locationStops : null,
        deadline_at: deadlineAt ? new Date(deadlineAt).toISOString() : null,
        est_minutes: estMinutes || null,
        token_offer: tokenOffer,
        cash_offer: cashOffer ? Number(cashOffer) : null,
        delivery_type: deliveryType,
        boosted: boost,
        requires_approval: requiresApproval,
        photo_url: photoUrl || null,
        status: 'open',
        flagged: false,
        moderation_status: moderationStatus,
        flag_reason: flagReason,
      })
      .select()
      .single()

    if (taskError) { setError(taskError.message); setLoading(false); return }

    if (!isDevMode) {
      const { error: deductError } = await supabase
        .from('profiles')
        .update({ token_balance: profile.token_balance - totalCost })
        .eq('id', profile.id)
      if (deductError) { setError(deductError.message); setLoading(false); return }

      await supabase.from('token_ledger').insert({
        user_id: profile.id,
        amount: -totalCost,
        reason: boost ? `Posted task "${title}" (+ boost)` : `Posted task "${title}"`,
        task_id: task.id,
      })
    }

    await refreshProfile()
    navigate(`/task/${task.id}`)
  }

  const minDateTime = new Date().toISOString().slice(0, 16)

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

  const positionedStops = stops.map((s, i) => ({ ...s, num: i + 1 })).filter(s => s.lat && s.lng)
  const stopPositions = positionedStops.map(s => [s.lat, s.lng])

  function goNext() {
    setError('')
    if (step === 0 && !title.trim()) { setError('Please enter a title.'); return }
    if (step === 0 && !description.trim()) { setError('Please enter a description.'); return }
    setStep(s => s + 1)
  }

  function goBack() {
    setError('')
    if (step === 0) { navigate('/feed'); return }
    setStep(s => s - 1)
  }

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Button variant="ghost" onClick={goBack} className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            {step === 0 ? 'Back to Doum' : 'Back'}
          </Button>
          <h1 className="text-2xl font-bold">Ask for Doum</h1>
          <p className="text-muted-foreground mt-2">Get help from fellow students</p>
        </div>

        {/* Step progress indicator */}
        <div className="flex items-center mb-8">
          {STEPS.map((s, idx) => (
            <div key={idx} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors
                  ${idx < step ? 'bg-primary text-white' : idx === step ? 'bg-primary text-white' : 'bg-gray-200 text-gray-500'}`}>
                  {idx < step ? <Check className="w-4 h-4" /> : idx + 1}
                </div>
                <span className={`text-xs font-medium whitespace-nowrap ${idx <= step ? 'text-primary' : 'text-gray-400'}`}>
                  {s.label}
                </span>
              </div>
              {idx < STEPS.length - 1 && (
                <div className={`flex-1 h-1 mx-2 mb-5 rounded transition-colors ${idx < step ? 'bg-primary' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          {/* ── Step 1: Details ── */}
          {step === 0 && (
            <Card className="p-6 space-y-5">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. Pick up my Amazon package from Cohon"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description *</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={3}
                  placeholder="Full details — include any specific pickup instructions, access codes, what to bring, etc."
                />
              </div>

              <div className="space-y-2">
                <Label>Category *</Label>
                <div className="grid grid-cols-3 gap-2">
                  {CATEGORIES.map(cat => {
                    const active = category === cat.id
                    return (
                      <Button
                        key={cat.id}
                        type="button"
                        variant={active ? 'default' : 'outline'}
                        onClick={() => setCategory(cat.id)}
                        className={`flex flex-col items-center gap-1.5 h-auto py-3 ${active ? 'bg-primary text-white hover:bg-primary/90' : ''}`}
                      >
                        <span className="text-2xl">{cat.emoji}</span>
                        <span className="text-xs font-semibold text-center leading-tight">{cat.id}</span>
                        <span className="text-[10px] opacity-70 text-center leading-tight hidden sm:block">{cat.desc}</span>
                      </Button>
                    )
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <Label>⏱ Estimated Time to Complete</Label>
                <div className="flex flex-wrap gap-1.5">
                  {EST_OPTIONS.map(opt => (
                    <Button
                      key={opt.value}
                      type="button"
                      variant={estMinutes === opt.value ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setEstMinutes(estMinutes === opt.value ? null : opt.value)}
                      className={`rounded-full ${estMinutes === opt.value ? 'bg-primary text-white hover:bg-primary/90' : ''}`}
                    >
                      {opt.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="photoUrl">Photo URL (optional)</Label>
                <Input
                  id="photoUrl"
                  type="url"
                  value={photoUrl}
                  onChange={e => setPhotoUrl(e.target.value)}
                  placeholder="https://..."
                />
              </div>
            </Card>
          )}

          {/* ── Step 2: Location ── */}
          {step === 1 && (
            <Card className="p-6 space-y-5">
              {/* Delivery type */}
              <div className="space-y-2">
                <Label>Delivery / Handoff Type *</Label>
                <div className="grid grid-cols-3 gap-2">
                  {DELIVERY_TYPES.map(dt => {
                    const active = deliveryType === dt.id
                    return (
                      <Button
                        key={dt.id}
                        type="button"
                        variant={active ? 'default' : 'outline'}
                        onClick={() => setDeliveryType(dt.id)}
                        className={`flex flex-col h-auto py-3 items-center gap-1.5 ${active ? 'bg-primary text-white hover:bg-primary/90' : ''}`}
                      >
                        <span className={active ? 'text-white' : 'text-muted-foreground'}>{dt.emoji}</span>
                        <span className="text-xs font-semibold text-center leading-tight">{dt.label}</span>
                        <span className="text-[10px] opacity-70 text-center leading-tight hidden sm:block">{dt.desc}</span>
                      </Button>
                    )
                  })}
                </div>
              </div>

              {/* Location — multi-stop */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <MapPin size={14} className="text-primary" />
                  Locations
                </Label>

                {/* Stop list */}
                <div className="space-y-2">
                  {stops.map((stop, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      {/* Number badge + connector line */}
                      <div className="flex flex-col items-center flex-shrink-0 pt-2.5">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${stop.lat ? 'bg-primary' : 'bg-gray-300'}`}>
                          {idx + 1}
                        </div>
                        {idx < stops.length - 1 && (
                          <div className="w-px h-4 bg-gray-300 mt-1" />
                        )}
                      </div>

                      {/* Search input with autocomplete */}
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
                          className="w-full px-3 py-2.5 rounded-lg border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-background"
                        />
                        {stop.showSuggestions && (
                          <div className="absolute top-full left-0 right-0 z-20 bg-background border border-border rounded-lg shadow-lg mt-1 max-h-52 overflow-y-auto">
                            {stop.suggestions.map((s, i) => (
                              <button
                                key={i}
                                type="button"
                                onMouseDown={() => selectStopSuggestion(idx, s)}
                                className="w-full text-left px-3 py-2.5 hover:bg-accent border-b border-border last:border-0"
                              >
                                <div className="text-sm font-medium truncate">{s.display_name.split(',')[0]}</div>
                                <div className="text-xs text-muted-foreground truncate">{s.display_name.split(',').slice(1, 3).join(',')}</div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* GPS + Remove */}
                      <div className="flex gap-1 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => useCurrentLocationForStop(idx)}
                          disabled={geoLoadingIdx === idx}
                          className="p-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60"
                          title="Use my current location"
                        >
                          {geoLoadingIdx === idx ? <Loader2 size={14} className="animate-spin" /> : <Navigation size={14} />}
                        </button>
                        {stops.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeStop(idx)}
                            className="p-2.5 text-muted-foreground hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                            title="Remove stop"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add route */}
                <button
                  type="button"
                  onClick={addStop}
                  className="flex items-center gap-1.5 text-sm text-primary font-medium hover:underline"
                >
                  <Plus size={14} />
                  Add route
                </button>

                {/* Map */}
                <div className="rounded-xl overflow-hidden" style={{ position: 'relative', zIndex: 0 }}>
                  <MapContainer
                    center={CMU_CENTER}
                    zoom={15}
                    style={{ height: 220, width: '100%' }}
                    scrollWheelZoom={false}
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <MapFitStops positions={stopPositions} />
                    {positionedStops.map(stop => (
                      <Marker key={stop.num} position={[stop.lat, stop.lng]} icon={makeStopIcon(stop.num)} />
                    ))}
                    {stopPositions.length >= 2 && (
                      <Polyline positions={stopPositions} color="#38bdf8" weight={2.5} dashArray="8 5" />
                    )}
                  </MapContainer>
                </div>

                {positionedStops.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Search an address above or tap <Navigation size={10} className="inline" /> to use your current location.
                  </p>
                )}
              </div>

              {/* Deadline */}
              <div className="space-y-2">
                <Label htmlFor="deadline">Deadline</Label>
                <Input
                  id="deadline"
                  type="datetime-local"
                  value={deadlineAt}
                  onChange={e => setDeadlineAt(e.target.value)}
                  min={minDateTime}
                />
              </div>
            </Card>
          )}

          {/* ── Step 3: Settings ── */}
          {step === 2 && (
            <Card className="p-6 space-y-6">
              {/* Token offer slider */}
              <div className="space-y-3">
                <Label className="flex items-center gap-1.5">
                  <Coins size={15} className="text-amber-500" />
                  Token Offer: <span className="text-amber-500 font-bold ml-1">{tokenOffer}</span>
                </Label>
                <Slider
                  min={1}
                  max={100}
                  step={1}
                  value={[tokenOffer]}
                  onValueChange={([v]) => setTokenOffer(v)}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>1 (trivial)</span>
                  <span>30+ (high effort)</span>
                  <span>100</span>
                </div>
              </div>

              {/* Cash offer */}
              <div className="space-y-2">
                <Label htmlFor="cashOffer" className="flex items-center gap-1.5">
                  <DollarSign size={14} className="text-green-600" />
                  Cash offer (optional)
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                  <Input
                    id="cashOffer"
                    type="number"
                    min={0}
                    step={0.01}
                    value={cashOffer}
                    onChange={e => setCashOffer(e.target.value)}
                    placeholder="0.00"
                    className="pl-7"
                  />
                </div>
                <p className="text-xs text-muted-foreground">Optional cash payment in addition to tokens</p>
              </div>

              {/* Require approval */}
              <div className="bg-accent rounded-lg p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Label htmlFor="requiresApproval" className="flex items-center gap-1.5 cursor-pointer">
                      <UserCheck size={14} />
                      Require runner approval
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5">You confirm the runner before they start</p>
                  </div>
                  <Switch
                    id="requiresApproval"
                    checked={requiresApproval}
                    onCheckedChange={setRequiresApproval}
                  />
                </div>
              </div>

              {/* Boost */}
              <div className="bg-accent rounded-lg p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Label htmlFor="boost" className="flex items-center gap-1.5 cursor-pointer">
                      <Zap size={14} className="text-amber-500" />
                      Boost listing (+10 tokens)
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5">Pins your doum to the top</p>
                  </div>
                  <Switch
                    id="boost"
                    checked={boost}
                    onCheckedChange={setBoost}
                  />
                </div>
              </div>

              {/* Summary box */}
              <div className="bg-primary/5 rounded-lg border border-primary/20 p-4">
                <p className="text-sm font-semibold mb-3">Summary</p>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-muted-foreground">Token offer</span>
                  <span className="text-sm font-medium flex items-center gap-1"><Coins size={14} className="text-amber-500" />{tokenOffer}</span>
                </div>
                {boost && (
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-muted-foreground">Boost</span>
                    <span className="text-sm font-medium flex items-center gap-1"><Zap size={14} className="text-amber-500" />+10</span>
                  </div>
                )}
                <div className="flex items-center justify-between border-t border-primary/20 pt-2 mt-2">
                  <span className="text-sm font-semibold">Total cost</span>
                  <span className="text-sm font-bold flex items-center gap-1">
                    <Coins size={14} className="text-amber-500" />
                    {isDevMode ? 'Free (Dev)' : `${totalCost} tokens`}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-muted-foreground">Your balance</span>
                  <span className={`text-xs font-bold ${isDevMode ? 'text-amber-500' : canAfford ? 'text-green-600' : 'text-red-600'}`}>
                    {isDevMode ? '∞' : (profile?.token_balance ?? 0)}
                  </span>
                </div>
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
              )}
            </Card>
          )}

          {/* Navigation buttons */}
          <div className="flex gap-3 mt-6">
            {step > 0 && (
              <Button type="button" variant="outline" onClick={goBack} className="flex-1">
                <ArrowLeft className="w-4 h-4 mr-2" />Back
              </Button>
            )}

            {step < STEPS.length - 1 ? (
              <Button type="button" onClick={goNext} className="flex-1 bg-primary text-white hover:bg-primary/90">
                Next<ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={loading || (!canAfford && !isDevMode)}
                className="flex-1 bg-primary text-white hover:bg-primary/90"
              >
                {moderating
                  ? <span className="flex items-center justify-center gap-2"><ShieldAlert size={15} className="animate-pulse" /> Checking content...</span>
                  : loading
                    ? 'Posting...'
                    : isDevMode
                      ? 'Request Doum (Dev — no tokens deducted)'
                      : !canAfford
                        ? 'Insufficient tokens'
                        : `Request Doum (−${totalCost} tokens)`}
              </Button>
            )}
          </div>

          {step === STEPS.length - 1 && !canAfford && !isDevMode && (
            <p className="text-center text-sm text-muted-foreground mt-3">
              <a href="/tokens" className="text-primary font-medium hover:underline">Buy tokens</a> to post this task.
            </p>
          )}

          {step < STEPS.length - 1 && error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mt-3">{error}</p>
          )}
        </form>
      </div>
    </div>
  )
}
