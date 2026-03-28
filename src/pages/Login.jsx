import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [year, setYear] = useState('')
  const [major, setMajor] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  function validateEmail(e) {
    return e.toLowerCase().endsWith('@andrew.cmu.edu')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!validateEmail(email)) {
      setError('Only @andrew.cmu.edu email addresses are allowed.')
      return
    }

    setLoading(true)

    if (mode === 'signup') {
      const { data, error: signUpError } = await supabase.auth.signUp({ email, password })
      if (signUpError) { setError(signUpError.message); setLoading(false); return }

      if (data.user) {
        const { error: profileError } = await supabase.from('profiles').insert({
          id: data.user.id,
          email,
          name: name || email.split('@')[0],
          year: year || null,
          major: major || null,
          token_balance: 10,
          reputation_score: null,
          strikes: 0,
          suspended: false,
        })
        if (profileError) { setError(profileError.message); setLoading(false); return }
      }
      navigate('/feed')
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) { setError(signInError.message); setLoading(false); return }
      navigate('/feed')
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">
            <span className="text-[#C41230]">Domi</span>
          </h1>
          <p className="text-gray-500 mt-1 text-sm">CMU's peer-to-peer errand marketplace</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <div className="flex rounded-lg bg-gray-100 p-1 mb-6">
            {['login', 'signup'].map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError('') }}
                className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${
                  mode === m ? 'bg-white shadow text-gray-900' : 'text-gray-500'
                }`}
              >
                {m === 'login' ? 'Sign In' : 'Sign Up'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="text-sm font-medium text-gray-700">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Alex Chen"
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#C41230] focus:border-transparent"
                />
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-gray-700">Andrew Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="andrewid@andrew.cmu.edu"
                required
                className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#C41230] focus:border-transparent"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#C41230] focus:border-transparent"
              />
            </div>

            {mode === 'signup' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700">Year</label>
                  <select
                    value={year}
                    onChange={e => setYear(e.target.value)}
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#C41230] bg-white"
                  >
                    <option value="">Optional</option>
                    {['Freshman', 'Sophomore', 'Junior', 'Senior', 'Grad'].map(y => (
                      <option key={y}>{y}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Major</label>
                  <input
                    type="text"
                    value={major}
                    onChange={e => setMajor(e.target.value)}
                    placeholder="CS"
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#C41230]"
                  />
                </div>
              </div>
            )}

            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-[#C41230] text-white rounded-lg font-semibold text-sm hover:bg-[#a00f28] transition-colors disabled:opacity-60"
            >
              {loading ? 'Loading...' : mode === 'login' ? 'Sign In' : 'Create Account (+10 tokens)'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          For demo: use any @andrew.cmu.edu email
        </p>
      </div>
    </div>
  )
}
