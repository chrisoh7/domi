import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Card } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs'

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
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: name || email.split('@')[0],
            year: year || null,
            major: major || null,
          }
        }
      })
      if (signUpError) { setError(signUpError.message); setLoading(false); return }

      navigate('/feed')
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) { setError(signInError.message); setLoading(false); return }
      navigate('/feed')
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <Card className="p-8">
          {/* Logo */}
          <div className="flex flex-col items-center mb-6">
            <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center text-2xl mb-3">
              👋
            </div>
            <h1 className="text-2xl font-bold text-center">Domi</h1>
            <p className="text-muted-foreground text-center text-sm mt-1">CMU's peer-to-peer errand marketplace</p>
          </div>

          {/* Mode toggle */}
          <Tabs value={mode} onValueChange={(v) => { setMode(v); setError('') }} className="mb-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>

            {/* Sign In */}
            <TabsContent value="login">
              <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                <div className="space-y-1">
                  <Label htmlFor="login-email">Andrew Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="andrewid@andrew.cmu.edu"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="login-password">Password</Label>
                  <Input
                    id="login-password"
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                  />
                </div>
                {error && (
                  <div className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm">
                    {error}
                  </div>
                )}
                <Button type="submit" disabled={loading} className="w-full bg-primary">
                  {loading ? 'Loading...' : 'Sign In'}
                </Button>
              </form>
            </TabsContent>

            {/* Sign Up */}
            <TabsContent value="signup">
              <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                <div className="space-y-1">
                  <Label htmlFor="signup-name">Full Name</Label>
                  <Input
                    id="signup-name"
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Alex Chen"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="signup-email">Andrew Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="andrewid@andrew.cmu.edu"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="signup-password">Password</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="signup-year">Year</Label>
                    <select
                      id="signup-year"
                      value={year}
                      onChange={e => setYear(e.target.value)}
                      className="mt-0 w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">Optional</option>
                      {['Freshman', 'Sophomore', 'Junior', 'Senior', 'Grad'].map(y => (
                        <option key={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="signup-major">Major</Label>
                    <Input
                      id="signup-major"
                      type="text"
                      value={major}
                      onChange={e => setMajor(e.target.value)}
                      placeholder="CS"
                    />
                  </div>
                </div>
                {error && (
                  <div className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm">
                    {error}
                  </div>
                )}
                <Button type="submit" disabled={loading} className="w-full bg-primary">
                  {loading ? 'Loading...' : 'Create Account (+10 tokens)'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-4">
          For demo: use any @andrew.cmu.edu email
        </p>
      </div>
    </div>
  )
}
