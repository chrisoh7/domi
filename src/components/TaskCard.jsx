import { Link } from 'react-router-dom'
import { MapPin, Clock, Coins, Flag, Zap, Star, AlertTriangle, Timer, Footprints, Car, DollarSign, Package, Users, Handshake } from 'lucide-react'
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { timeAgo, estimateCommute, haversineMeters } from '../lib/utils'

const CATEGORY_COLORS = {
  'Errands & Pickup':    'bg-blue-100 text-blue-700',
  'Tutoring & Academic': 'bg-purple-100 text-purple-700',
  'Moving':              'bg-orange-100 text-orange-700',
  'Tech Help':           'bg-green-100 text-green-700',
  'Fitness & Wellness':  'bg-pink-100 text-pink-700',
  'Other':               'bg-gray-100 text-gray-700',
}

const DELIVERY_LABELS = {
  leave_at_door: { icon: Package,    label: 'Leave at door' },
  in_person:     { icon: Handshake,  label: 'In person' },
  pickup_only:   { icon: Users,      label: 'Pickup only' },
}

function formatDeadline(task) {
  const val = task.deadline_at || task.deadline
  if (!val) return null
  const d = new Date(val)
  if (isNaN(d)) return null
  if (task.deadline_at) {
    return d.toLocaleString('en-US', { month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  }
  return d.toLocaleDateString()
}

function formatEst(mins) {
  if (!mins) return null
  if (mins < 60) return `~${mins}m`
  const h = mins / 60
  return `~${h % 1 === 0 ? h : h.toFixed(1)}h`
}

export default function TaskCard({ task, currentUserId, userLat, userLng }) {
  const [reporting, setReporting] = useState(false)
  const [reported, setReported] = useState(false)

  const deadlineStr = formatDeadline(task)
  const deadline = task.deadline_at ? new Date(task.deadline_at) : task.deadline ? new Date(task.deadline) : null
  const isExpired = deadline && deadline < new Date()

  const commute = (userLat != null && userLng != null && task.location_lat != null && task.location_lng != null)
    ? estimateCommute(task.location_lat, task.location_lng, userLat, userLng)
    : null
  const isWalkable = commute && haversineMeters(userLat, userLng, task.location_lat, task.location_lng) < 2000

  const deliveryMeta = task.delivery_type ? DELIVERY_LABELS[task.delivery_type] : null

  async function handleReport(e) {
    e.preventDefault()
    e.stopPropagation()
    setReporting(true)
    const { error } = await supabase.from('reports').insert({
      task_id: task.id,
      reporter_id: currentUserId,
    })
    if (!error || error.code === '23505') setReported(true)
    setReporting(false)
  }

  return (
    <Link
      to={`/task/${task.id}`}
      className={`block bg-white rounded-xl border overflow-hidden transition-shadow hover:shadow-md ${
        task.boosted ? 'border-[#F5A623] shadow-sm' : 'border-gray-200'
      }`}
    >
      {/* Photo */}
      {task.photo_url && (
        <div className="relative">
          <img src={task.photo_url} alt={task.title} className="w-full h-40 object-cover" />
          {task.boosted && (
            <span className="absolute top-2 left-2 flex items-center gap-1 text-xs text-[#F5A623] font-semibold bg-white/90 backdrop-blur-sm px-2 py-0.5 rounded-full">
              <Zap size={11} fill="currentColor" /> Boosted
            </span>
          )}
        </div>
      )}

      <div className="p-4">
        {!task.photo_url && task.boosted && (
          <div className="flex items-center gap-1 text-xs text-[#F5A623] font-semibold mb-2">
            <Zap size={12} fill="currentColor" /> Boosted
          </div>
        )}

        {/* Title + reward */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-gray-900 leading-snug line-clamp-2">{task.title}</h3>
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <span className="flex items-center gap-1 text-[#F5A623] font-bold text-sm whitespace-nowrap">
              <Coins size={14} />{task.token_offer}
            </span>
            {task.cash_offer > 0 && (
              <span className="flex items-center gap-0.5 text-green-600 font-semibold text-xs whitespace-nowrap">
                <DollarSign size={11} />{task.cash_offer} cash
              </span>
            )}
          </div>
        </div>

        <p className="text-gray-500 text-sm mt-1 line-clamp-2">{task.description}</p>

        {/* Tags row */}
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[task.category] || 'bg-gray-100 text-gray-700'}`}>
            {task.category}
          </span>

          {deliveryMeta && deliveryMeta.label !== 'In person' && (() => {
            const Icon = deliveryMeta.icon
            return (
              <span className="flex items-center gap-1 text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded-full">
                <Icon size={11} />{deliveryMeta.label}
              </span>
            )
          })()}

          {task.est_minutes && (
            <span className="flex items-center gap-1 text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded-full">
              <Timer size={11} />{formatEst(task.est_minutes)}
            </span>
          )}

          {commute && (
            <>
              <span className="flex items-center gap-1 text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded-full">
                <Footprints size={11} />{commute.walkLabel}
              </span>
              <span className="flex items-center gap-1 text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded-full">
                <Car size={11} />{commute.driveLabel} · {commute.distLabel}
              </span>
            </>
          )}

          {task.location_pickup && !commute && (
            <span className="flex items-center gap-1 text-xs text-gray-500 max-w-[140px] truncate">
              <MapPin size={11} className="flex-shrink-0" />
              <span className="truncate">{task.location_pickup}</span>
            </span>
          )}

          {deadlineStr && (
            <span className={`flex items-center gap-1 text-xs ${isExpired ? 'text-red-500' : 'text-gray-500'}`}>
              <Clock size={11} />{deadlineStr}
            </span>
          )}
        </div>

        {/* Footer: poster + report */}
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-2">
            {task.poster_avatar_url ? (
              <img src={task.poster_avatar_url} alt={task.poster_name} className="w-6 h-6 rounded-full object-cover" />
            ) : (
              <div className="w-6 h-6 rounded-full bg-[#C41230] flex items-center justify-center text-white text-xs font-bold">
                {task.poster_name?.[0]?.toUpperCase() ?? '?'}
              </div>
            )}
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <Star size={11} className="text-[#F5A623]" fill="currentColor" />
              {task.poster_rating ? task.poster_rating.toFixed(1) : 'New'}
            </div>
            <span className="text-xs text-gray-400">{timeAgo(task.created_at)}</span>
            {task.poster_rating !== null && task.poster_rating < 3.5 && (
              <span className="flex items-center gap-0.5 text-xs text-amber-600 bg-amber-50 px-1.5 rounded-full">
                <AlertTriangle size={10} />Low rating
              </span>
            )}
          </div>

          {currentUserId && task.poster_id !== currentUserId && (
            <button
              onClick={handleReport}
              disabled={reporting || reported}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
            >
              <Flag size={11} />
              {reported ? 'Reported' : 'Report'}
            </button>
          )}
        </div>
      </div>
    </Link>
  )
}
