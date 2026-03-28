import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { Plus, LayoutGrid, User, LogOut, Coins, Wrench, Shield } from 'lucide-react'
import NotificationBell from './NotificationBell'

export default function Navbar() {
  const { profile, isDevMode, toggleDevMode, isAdmin } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const navLink = (to, label, Icon) => (
    <Link
      to={to}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
        location.pathname === to
          ? 'bg-[#C41230] text-white'
          : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      <Icon size={16} />
      <span className="hidden sm:inline">{label}</span>
    </Link>
  )

  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/feed" className="flex items-center gap-2">
          <span className="text-[#C41230] font-bold text-xl tracking-tight">Domi</span>
          {isDevMode && (
            <span className="px-1.5 py-0.5 bg-amber-400 text-amber-900 text-[10px] font-bold rounded-full leading-none">
              DEV
            </span>
          )}
        </Link>

        <div className="flex items-center gap-1">
          {navLink('/feed', 'Browse', LayoutGrid)}
          {navLink('/post', 'Post Task', Plus)}
          {navLink('/profile', 'Profile', User)}
          {isAdmin && navLink('/admin', 'Admin', Shield)}

          {profile && (
            <Link
              to="/tokens"
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#F5A623]/10 text-[#F5A623] text-sm font-semibold hover:bg-[#F5A623]/20 transition-colors"
            >
              <Coins size={15} />
              <span>{isDevMode ? '∞' : (profile.token_balance ?? 0)}</span>
            </Link>
          )}

          <NotificationBell />

          <button
            onClick={toggleDevMode}
            className={`p-2 rounded-lg transition-colors ml-1 ${
              isDevMode
                ? 'text-amber-600 bg-amber-50 hover:bg-amber-100'
                : 'text-gray-400 hover:bg-gray-100'
            }`}
            title={isDevMode ? 'Disable Dev Mode' : 'Enable Dev Mode'}
          >
            <Wrench size={16} />
          </button>

          <button
            onClick={handleSignOut}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
            title="Sign out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </nav>
  )
}
