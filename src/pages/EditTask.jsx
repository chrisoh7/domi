import { useState, useRef, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Coins, Zap, MapPin, Navigation, Loader2, Plus, X, DollarSign, Package, Handshake, Users, Sparkles, GripVertical } from 'lucide-react'
import { geocodePittsburgh } from '../lib/utils'
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { generateSubtasks, hasAiKey } from '../lib/aiSubtasks'
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
  { id: 'pickup_only',   emoji: <Users size={20} />,     label: 'Pickup only',   desc: 'Domi picks up only' },
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

function SortableStepRow({ step, idx, total, geoLoadingIdx, onDescriptionChange, onLocationChange, onBlurLocation, onFocusLocation, onSelectSuggestion, onUseCurrentLocation, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: step.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }
  return (
    <div ref={setNodeRef} style={style} className="flex items-start gap-2">
      <button type="button" {...attributes} {...listeners}
        className="flex-shrink-0 mt-3 p-1 text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing touch-none" tabIndex={-1}>
        <GripVertical size={15} />
      </button>

      <div className="flex flex-col items-center flex-shrink-0 pt-2.5">
        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${step.lat ? 'bg-primary' : 'bg-gray-300'}`}>
          {idx + 1}
        </div>
        {idx < total - 1 && <div className="w-px h-8 bg-gray-300 mt-1" />}
      </div>

      <div className="flex-1 space-y-1.5">
        <input
          type="text"
          value={step.description}
          onChange={e => onDescriptionChange(e.target.value)}
          placeholder="What to do here…"
          className="w-full px-3 py-2 rounded-lg border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-background"
        />
        <div className="relative">
          <input
            type="text"
            value={step.query}
            onChange={e => onLocationChange(e.target.value)}
            onBlur={onBlurLocation}
            onFocus={onFocusLocation}
            onKeyDown={e => e.key === 'Enter' && e.preventDefault()}
            placeholder="Search address or building…"
            className="w-full px-3 py-2 rounded-lg border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-background"
          />
          {step.showSuggestions && (
            <div className="absolute top-full left-0 right-0 z-20 bg-background border border-border rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
              {step.suggestions.map((s, i) => (
                <button key={i} type="button" onMouseDown={() => onSelectSuggestion(s)}
                  className="w-full text-left px-3 py-2.5 hover:bg-accent border-b border-border last:border-0">
                  <div className="text-sm font-medium truncate">{s.display_name.split(',')[0]}</div>
                  <div className="text-xs text-muted-foreground truncate">{s.display_name.split(',').slice(1, 3).join(',')}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1 flex-shrink-0">
        <button type="button" onClick={onUseCurrentLocation} disabled={geoLoadingIdx === idx}
          className="p-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60" title="Use my current location">
          {geoLoadingIdx === idx ? <Loader2 size={13} className="animate-spin" /> : <Navigation size={13} />}
        </button>
        {total > 1 && (
          <button type="button" onClick={onRemove}
            className="p-2 text-muted-foreground hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors" title="Remove step">
            <X size={13} />
          </button>
        )}
      </div>
    </div>
  )
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

function newStep() {
  return { id: crypto.randomUUID(), description: '', label: '', lat: null, lng: null, query: '', suggestions: [], showSuggestions: false }
}

export default function EditTask() {
  const { id } = useParams()
  const { user, profile } = useAuth()
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

  const [aiPreview, setAiPreview] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)

  const [steps, setSteps] = useState([newStep()])
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

      // Merge location_stops + subtasks into unified steps
      const locStops = Array.isArray(data.location_stops) && data.location_stops.length > 0
        ? data.location_stops
        : data.location_lat && data.location_lng
          ? [{ label: data.location_pickup || '', lat: data.location_lat, lng: data.location_lng }]
          : data.location_pickup
            ? [{ label: data.location_pickup }]
            : []

      const subs = Array.isArray(data.subtasks) ? data.subtasks : []

      if (locStops.length > 0) {
        setSteps(locStops.map((s, i) => ({
          ...newStep(),
          description: subs[i]?.text || s.description || '',
          label: s.label || '',
          lat: s.lat ?? null,
          lng: s.lng ?? null,
          query: s.label || '',
        })))
      } else if (subs.length > 0) {
        setSteps(subs.map(s => ({ ...newStep(), description: s.text || '' })))
      }

      setLoadingTask(false)
    }
    loadTask()
  }, [id, user?.id]) // eslint-disable-line

  function updateStep(idx, fields) {
    setSteps(prev => prev.map((s, i) => i === idx ? { ...s, ...fields } : s))
  }

  function addStep() {
    setSteps(prev => [...prev, newStep()])
  }

  function removeStep(idx) {
    setSteps(prev => prev.filter((_, i) => i !== idx))
  }

  const stepSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  function handleStepDragEnd({ active, over }) {
    if (!over || active.id === over.id) return
    setSteps(prev => {
      const oldIdx = prev.findIndex(s => s.id === active.id)
      const newIdx = prev.findIndex(s => s.id === over.id)
      return arrayMove(prev, oldIdx, newIdx)
    })
  }

  function handleStepLocationChange(idx, val) {
    updateStep(idx, { query: val, label: val, lat: null, lng: null })
    clearTimeout(debounceRefs.current[idx])
    if (val.length < 2) { updateStep(idx, { suggestions: [], showSuggestions: false }); return }
    debounceRefs.current[idx] = setTimeout(async () => {
      try {
        const results = await geocodePittsburgh(val, userPos?.[0], userPos?.[1], 5)
        updateStep(idx, { suggestions: results, showSuggestions: results.length > 0 })
      } catch {}
    }, 350)
  }

  function selectStepSuggestion(idx, s) {
    updateStep(idx, {
      label: s.display_name,
      lat: parseFloat(s.lat),
      lng: parseFloat(s.lon),
      query: s.display_name,
      suggestions: [],
      showSuggestions: false,
    })
  }

  async function useCurrentLocationForStep(idx) {
    if (!navigator.geolocation) return
    setGeoLoadingIdx(idx)
    navigator.geolocation.getCurrentPosition(
      async ({ coords: { latitude: lat, longitude: lng } }) => {
        setUserPos([lat, lng])
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`)
          const data = await res.json()
          const label = data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`
          updateStep(idx, { label, lat, lng, query: label })
        } catch {
          updateStep(idx, { label: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, lat, lng, query: `${lat.toFixed(5)}, ${lng.toFixed(5)}` })
        }
        setGeoLoadingIdx(null)
      },
      () => setGeoLoadingIdx(null)
    )
  }

  async function geocodeStepByLabel(idx, label) {
    try {
      const results = await geocodePittsburgh(label, userPos?.[0], userPos?.[1], 1)
      if (results[0]) updateStep(idx, { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) })
    } catch {}
  }

  async function handleGenerateAI() {
    if (!title.trim()) return
    setAiLoading(true)
    const result = await generateSubtasks(title, description, profile?.home_location ?? null)
    setAiPreview(result)
    setAiLoading(false)
  }

  function acceptAiSuggestion() {
    if (aiPreview?.steps?.length > 0) {
      const newSteps = aiPreview.steps.map(s => ({ ...newStep(), description: s.description, label: s.location, query: s.location }))
      setSteps(newSteps)
      newSteps.forEach((_, i) => geocodeStepByLabel(i, aiPreview.steps[i].location))
    }
    setAiPreview(null)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(''); setLoading(true)

    const locationStops = steps
      .filter(s => s.label || (s.lat && s.lng))
      .map(s => ({ label: s.label, lat: s.lat, lng: s.lng, description: s.description }))
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
        subtasks: steps.filter(s => s.description.trim()).map(s => ({ text: s.description.trim(), completed: false, location: s.label || null })),
      })
      .eq('id', id)

    if (updateError) { setError(updateError.message); setLoading(false); return }
    navigate(`/task/${id}`)
  }

  const minDateTime = new Date().toISOString().slice(0, 16)
  const positionedSteps = steps.map((s, i) => ({ ...s, num: i + 1 })).filter(s => s.lat && s.lng)
  const stepPositions = positionedSteps.map(s => [s.lat, s.lng])

  if (loadingTask) {
    return <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary" /></div>
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-6">Edit Doum</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Basic info */}
        <Card className="p-5 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input id="title" type="text" value={title} onChange={e => setTitle(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea id="description" value={description} onChange={e => setDescription(e.target.value)} required rows={3}
              placeholder="Full details — include any specific pickup instructions, access codes, what to bring, etc." />
          </div>
          <div className="space-y-2">
            <Label htmlFor="deadline">Deadline</Label>
            <Input id="deadline" type="datetime-local" value={deadlineAt} onChange={e => setDeadlineAt(e.target.value)} min={minDateTime} />
          </div>
          <div className="space-y-2">
            <Label>⏱ Estimated Time to Complete</Label>
            <div className="flex flex-wrap gap-1.5">
              {EST_OPTIONS.map(opt => (
                <Button key={opt.value} type="button"
                  variant={estMinutes === opt.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setEstMinutes(estMinutes === opt.value ? null : opt.value)}
                  className={`rounded-full ${estMinutes === opt.value ? 'bg-primary text-white hover:bg-primary/90' : ''}`}>
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="photoUrl">Photo URL (optional)</Label>
            <Input id="photoUrl" type="url" value={photoUrl} onChange={e => setPhotoUrl(e.target.value)} placeholder="https://..." />
          </div>
        </Card>

        {/* Category */}
        <Card className="p-5">
          <div className="space-y-3">
            <Label>Category *</Label>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIES.map(cat => {
                const active = category === cat.id
                return (
                  <Button key={cat.id} type="button"
                    variant={active ? 'default' : 'outline'}
                    onClick={() => setCategory(cat.id)}
                    className={`flex flex-col items-center gap-1.5 h-auto py-3 ${active ? 'bg-primary text-white hover:bg-primary/90' : ''}`}>
                    <span className="text-2xl">{cat.emoji}</span>
                    <span className="text-xs font-semibold text-center leading-tight">{cat.id}</span>
                    <span className="text-[10px] opacity-70 text-center leading-tight hidden sm:block">{cat.desc}</span>
                  </Button>
                )
              })}
            </div>
          </div>
        </Card>

        {/* Delivery type */}
        <Card className="p-5">
          <div className="space-y-3">
            <Label>Delivery / Handoff Type *</Label>
            <div className="grid grid-cols-3 gap-2">
              {DELIVERY_TYPES.map(dt => {
                const active = deliveryType === dt.id
                return (
                  <Button key={dt.id} type="button"
                    variant={active ? 'default' : 'outline'}
                    onClick={() => setDeliveryType(dt.id)}
                    className={`flex flex-col h-auto py-3 items-center gap-1.5 ${active ? 'bg-primary text-white hover:bg-primary/90' : ''}`}>
                    <span className={active ? 'text-white' : 'text-muted-foreground'}>{dt.emoji}</span>
                    <span className="text-xs font-semibold text-center leading-tight">{dt.label}</span>
                    <span className="text-[10px] opacity-70 text-center leading-tight hidden sm:block">{dt.desc}</span>
                  </Button>
                )
              })}
            </div>
          </div>
        </Card>

        {/* Steps — unified description + location per row */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <Label className="flex items-center gap-1.5">
              <MapPin size={14} className="text-primary" />
              Steps
            </Label>
            <button
              type="button"
              onClick={handleGenerateAI}
              disabled={!title.trim() || aiLoading || !hasAiKey}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-violet-50 text-violet-600 hover:bg-violet-100 disabled:opacity-40 transition-colors"
              title={!hasAiKey ? 'Add VITE_ANTHROPIC_API_KEY to enable AI suggestions' : ''}
            >
              {aiLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              {aiLoading ? 'Thinking…' : 'AI suggest'}
            </button>
          </div>

          {/* AI preview card */}
          {aiPreview && (
            <div className="mb-3 bg-violet-50 border border-violet-100 rounded-xl p-3.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-violet-600 mb-2.5">
                <Sparkles size={11} /> AI suggestion
              </div>
              <ol className="space-y-2 mb-3">
                {aiPreview.steps?.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="w-4 h-4 rounded-full bg-violet-200 text-violet-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <span className="flex-1">{s.description}</span>
                    <span className="text-xs text-violet-400 flex items-center gap-1 flex-shrink-0">
                      <MapPin size={9} />{s.location.split(',')[0]}
                    </span>
                  </li>
                ))}
              </ol>
              <div className="flex gap-2">
                <button type="button" onClick={acceptAiSuggestion}
                  className="flex-1 py-1.5 bg-violet-600 text-white rounded-lg text-xs font-semibold hover:bg-violet-700 transition-colors">
                  Use these
                </button>
                <button type="button" onClick={() => setAiPreview(null)}
                  className="flex-1 py-1.5 border border-violet-200 text-violet-600 rounded-lg text-xs font-semibold hover:bg-violet-50 transition-colors">
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* Step list */}
          <DndContext sensors={stepSensors} collisionDetection={closestCenter} onDragEnd={handleStepDragEnd}>
            <SortableContext items={steps.map(s => s.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-3 mb-3">
                {steps.map((step, idx) => (
                  <SortableStepRow
                    key={step.id}
                    step={step}
                    idx={idx}
                    total={steps.length}
                    geoLoadingIdx={geoLoadingIdx}
                    onDescriptionChange={val => updateStep(idx, { description: val })}
                    onLocationChange={val => handleStepLocationChange(idx, val)}
                    onBlurLocation={() => setTimeout(() => updateStep(idx, { showSuggestions: false }), 150)}
                    onFocusLocation={() => step.suggestions.length > 0 && updateStep(idx, { showSuggestions: true })}
                    onSelectSuggestion={s => selectStepSuggestion(idx, s)}
                    onUseCurrentLocation={() => useCurrentLocationForStep(idx)}
                    onRemove={() => removeStep(idx)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          <button type="button" onClick={addStep}
            className="flex items-center gap-1.5 text-sm text-primary font-medium hover:underline mb-4">
            <Plus size={14} />
            Add step
          </button>

          <div className="rounded-xl overflow-hidden" style={{ position: 'relative', zIndex: 0 }}>
            <MapContainer center={CMU_CENTER} zoom={15} style={{ height: 220, width: '100%' }} scrollWheelZoom={false}>
              <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <MapFitStops positions={stepPositions} />
              {positionedSteps.map(ps => (
                <Marker key={ps.num} position={[ps.lat, ps.lng]} icon={makeStopIcon(ps.num)} />
              ))}
              {stepPositions.length >= 2 && (
                <Polyline positions={stepPositions} color="#38bdf8" weight={2.5} dashArray="8 5" />
              )}
            </MapContainer>
          </div>

          {positionedSteps.length === 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              Search an address above or tap <Navigation size={10} className="inline" /> to use your current location.
            </p>
          )}
        </Card>

        {/* Token offer */}
        <Card className="p-5 space-y-4">
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
              <span>1 (trivial)</span><span>30+ (high effort)</span><span>100</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cashOffer" className="flex items-center gap-1.5">
              <DollarSign size={14} className="text-green-600" />
              Cash offer (optional)
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
              <Input id="cashOffer" type="number" min={0} step={0.01} value={cashOffer}
                onChange={e => setCashOffer(e.target.value)} placeholder="0.00" className="pl-7" />
            </div>
            <p className="text-xs text-muted-foreground">Optional cash payment in addition to tokens</p>
          </div>

          <div className="bg-accent rounded-lg p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label htmlFor="boost" className="flex items-center gap-1.5 cursor-pointer">
                  <Zap size={14} className="text-amber-500" />
                  Boost listing (+10 tokens)
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">Pins your doum to the top of the feed</p>
              </div>
              <Switch id="boost" checked={boost} onCheckedChange={setBoost} />
            </div>
          </div>
        </Card>

        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={() => navigate(`/task/${id}`)} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" disabled={loading} className="flex-1 bg-primary text-white hover:bg-primary/90">
            {loading ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </div>
  )
}
