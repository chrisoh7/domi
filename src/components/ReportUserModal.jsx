import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { X, Flag, CheckCircle } from 'lucide-react'

const REASONS = [
  'No-show / ghosted',
  'Fraudulent doum or listing',
  'Harassment or threats',
  'Trying to game the token system',
  'Fake profile',
  'Other',
]

export default function ReportUserModal({ reportedId, reportedName, taskId, onClose }) {
  const { user } = useAuth()
  const [reason, setReason] = useState('')
  const [custom, setCustom] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    if (!reason) return
    setLoading(true)
    setError('')
    const { error: err } = await supabase.from('user_reports').insert({
      reporter_id: user.id,
      reported_id: reportedId,
      reason: reason === 'Other' ? (custom || 'Other') : reason,
      task_id: taskId ?? null,
    })
    if (err?.code === '23505') {
      setError('You have already reported this user for this task.')
    } else if (err) {
      setError(err.message)
    } else {
      setSubmitted(true)
    }
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-5 w-full max-w-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Flag size={16} className="text-red-500" />
            <h3 className="font-semibold text-gray-900">Report {reportedName}</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        {submitted ? (
          <div className="text-center py-4">
            <CheckCircle size={36} className="text-green-500 mx-auto mb-2" />
            <p className="font-medium text-gray-900">Report submitted</p>
            <p className="text-sm text-gray-500 mt-1">Our admin team will review this.</p>
            <button onClick={onClose}
              className="mt-4 px-4 py-2 bg-[#1A1A2E] text-white rounded-lg text-sm font-medium">
              Done
            </button>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-500 mb-3">Why are you reporting this user?</p>
            <div className="space-y-2 mb-4">
              {REASONS.map(r => (
                <label key={r} className="flex items-center gap-3 cursor-pointer group">
                  <input type="radio" name="reason" value={r} checked={reason === r}
                    onChange={() => setReason(r)} className="accent-[#C41230]" />
                  <span className="text-sm text-gray-700 group-hover:text-gray-900">{r}</span>
                </label>
              ))}
            </div>

            {reason === 'Other' && (
              <textarea value={custom} onChange={e => setCustom(e.target.value)}
                placeholder="Please describe the issue..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#C41230] resize-none mb-3" />
            )}

            {error && <p className="text-sm text-red-500 mb-3">{error}</p>}

            <button onClick={submit} disabled={!reason || loading}
              className="w-full py-2.5 bg-[#C41230] text-white rounded-xl font-semibold text-sm hover:bg-[#a00f28] disabled:opacity-50 transition-colors">
              {loading ? 'Submitting…' : 'Submit Report'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
