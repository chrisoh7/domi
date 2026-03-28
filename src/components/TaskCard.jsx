import { Link } from 'react-router-dom'
import { MapPin, Clock, Star, Flag, DollarSign, Package, Users, Handshake, Coins } from 'lucide-react'
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { timeAgo } from '../lib/utils'
import { Card } from './ui/card'
import { Badge } from './ui/badge'
import { Avatar, AvatarImage, AvatarFallback } from './ui/avatar'

const CATEGORY_EMOJI = {
  'Errands & Pickup':    '🛍️',
  'Tutoring & Academic': '📚',
  'Moving':              '📦',
  'Tech Help':           '💻',
  'Fitness & Wellness':  '🏋️',
  'Other':               '✨',
}

const DELIVERY_LABELS = {
  leave_at_door: { label: 'Leave at Door', color: 'bg-green-100 text-green-800 border-green-200' },
  in_person:     { label: 'In Person',     color: 'bg-blue-100 text-blue-800 border-blue-200' },
  pickup_only:   { label: 'Pickup Only',   color: 'bg-purple-100 text-purple-800 border-purple-200' },
}

function formatDeadline(task) {
  const val = task.deadline_at || task.deadline
  if (!val) return null
  const d = new Date(val)
  if (isNaN(d)) return null
  const now = new Date()
  const diff = d - now
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const days = Math.floor(hours / 24)
  if (diff < 0) return 'Expired'
  if (hours < 1) return 'in <1h'
  if (hours < 24) return `in ${hours}h`
  return `in ${days}d`
}

export default function TaskCard({ task, currentUserId }) {
  const [reporting, setReporting] = useState(false)
  const [reported, setReported] = useState(false)

  const deadlineStr = formatDeadline(task)
  const deliveryMeta = task.delivery_type ? DELIVERY_LABELS[task.delivery_type] : null
  const categoryEmoji = CATEGORY_EMOJI[task.category] || '✨'

  async function handleReport(e) {
    e.preventDefault()
    e.stopPropagation()
    setReporting(true)
    const { error } = await supabase.from('reports').insert({ task_id: task.id, reporter_id: currentUserId })
    if (!error || error.code === '23505') setReported(true)
    setReporting(false)
  }

  return (
    <Link to={`/task/${task.id}`} className="block h-full">
      <Card className="p-4 hover:shadow-lg transition-all cursor-pointer border-2 hover:border-primary/50 h-full flex flex-col gap-0">
        {/* Category emoji + token reward */}
        <div className="flex items-start justify-between mb-3">
          <div className="text-3xl">{categoryEmoji}</div>
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-1 px-2.5 py-1 bg-amber-50 border border-amber-200 rounded-full">
              <Coins size={15} className="text-amber-600" />
              <span className="font-semibold text-amber-900">{task.token_offer}</span>
            </div>
            {task.cash_offer > 0 && (
              <div className="text-xs font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
                +${task.cash_offer}
              </div>
            )}
          </div>
        </div>

        {/* Title */}
        <h3 className="mb-2 line-clamp-2 text-[15px]">{task.title}</h3>

        {/* Delivery type badge */}
        {deliveryMeta && (
          <div className="mb-3">
            <Badge variant="outline" className={`${deliveryMeta.color} text-xs`}>
              {deliveryMeta.label}
            </Badge>
          </div>
        )}

        {/* Location */}
        {task.location_pickup && (
          <div className="flex items-start gap-2 mb-3 text-sm text-muted-foreground">
            <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span className="line-clamp-1">{task.location_pickup}</span>
          </div>
        )}

        {/* Time & Deadline */}
        {(task.est_minutes || deadlineStr) && (
          <div className="flex items-center gap-3 mb-3 text-xs text-muted-foreground">
            {task.est_minutes && (
              <div className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                <span>{task.est_minutes} min</span>
              </div>
            )}
            {task.est_minutes && deadlineStr && <div>•</div>}
            {deadlineStr && <div>Due {deadlineStr}</div>}
          </div>
        )}

        {/* Poster info */}
        <div className="flex items-center gap-2 pt-3 border-t mt-auto">
          <Avatar className="w-7 h-7">
            <AvatarImage src={task.poster_avatar_url} alt={task.poster_name} />
            <AvatarFallback className="text-xs">{task.poster_name?.[0] ?? '?'}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm truncate">{task.poster_name ?? 'Unknown'}</p>
          </div>
          <div className="flex items-center gap-1 text-xs">
            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            <span className="font-medium">{task.poster_rating ? task.poster_rating.toFixed(1) : 'New'}</span>
          </div>
        </div>
      </Card>
    </Link>
  )
}
