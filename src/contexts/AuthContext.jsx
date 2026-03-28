import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [devMode, setDevMode] = useState(() => localStorage.getItem('devMode') === 'true')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else { setProfile(null); setLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId, attempt = 0) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    if (!data) {
      if (attempt < 5) {
        // Trigger may not have fired yet — retry with backoff
        await new Promise(r => setTimeout(r, 500 * (attempt + 1)))
        return fetchProfile(userId, attempt + 1)
      }
      // Still no profile after retries (DB wiped etc.) — sign out
      await supabase.auth.signOut()
      return
    }
    setProfile(data)
    setLoading(false)
  }

  async function refreshProfile() {
    if (user) await fetchProfile(user.id)
  }

  function toggleDevMode() {
    const next = !devMode
    setDevMode(next)
    localStorage.setItem('devMode', String(next))
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, refreshProfile, isDevMode: devMode, toggleDevMode, isAdmin: profile?.is_admin ?? false }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
