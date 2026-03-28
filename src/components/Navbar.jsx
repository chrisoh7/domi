import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { useState, useEffect } from 'react'
import { Plus, LayoutGrid, User, LogOut, Coins, Wrench, Shield, Bell, MessageSquare, Heart } from 'lucide-react'
import { Button } from './ui/button'
import { Avatar, AvatarImage, AvatarFallback } from './ui/avatar'
import { useChat } from '../contexts/ChatContext'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from './ui/dropdown-menu'

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function Navbar() {
  const { profile, user, isDevMode, toggleDevMode, isAdmin } = useAuth()
  const { toggle: toggleChat, unreadTotal } = useChat()
  const navigate = useNavigate()
  const location = useLocation()

  // Notification state (inlined from NotificationBell)
  const [notifications, setNotifications] = useState([])

  async function fetchNotifications() {
    if (!user) return
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(25)
    if (data) setNotifications(data)
  }

  useEffect(() => {
    if (!user) return
    fetchNotifications()
    const channel = supabase
      .channel('notifs-' + user.id)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, () => fetchNotifications())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [user])

  const unread = notifications.filter(n => !n.read).length

  async function handleNotifClick(n) {
    if (!n.read) {
      await supabase.from('notifications').update({ read: true }).eq('id', n.id)
      setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x))
    }
    if (n.task_id) navigate(`/task/${n.task_id}`)
  }

  async function markAllRead() {
    await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false)
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const isActive = (to) => location.pathname === to

  const navLink = (to, label, Icon) => (
    <Link
      key={to}
      to={to}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
        isActive(to)
          ? 'bg-accent text-primary'
          : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      <Icon size={16} />
      <span className="hidden sm:inline">{label}</span>
    </Link>
  )

  return (
    <>
      {/* Desktop / top navbar */}
      <nav className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4">

          {/* Left: Logo */}
          <Link to="/feed" className="flex items-center gap-2 flex-shrink-0">
            <div className="w-8 h-8 bg-sky-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
              <Heart size={16} className="fill-white text-white" />
            </div>
            <span className="text-2xl tracking-tight font-semibold">Domi</span>
            {isDevMode && (
              <span className="px-1.5 py-0.5 bg-amber-400 text-amber-900 text-[10px] font-bold rounded-full leading-none">
                DEV
              </span>
            )}
          </Link>

          {/* Right: nav links + actions */}
          <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
            {/* Nav links */}
            <div className="hidden md:flex items-center gap-1 mr-1">
              {navLink('/feed', 'Browse Doums', LayoutGrid)}
              {isAdmin && navLink('/admin', 'Admin', Shield)}
            </div>

            {/* Post Task button */}
            <Button
              size="sm"
              className="hidden sm:inline-flex bg-primary hover:bg-primary/90 text-primary-foreground"
              onClick={() => navigate('/post')}
            >
              <Plus size={15} />
              Request Doum
            </Button>

            {/* Token balance chip */}
            {profile && (
              <Link
                to="/tokens"
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-sm font-semibold hover:bg-amber-100 transition-colors"
              >
                <Coins size={14} />
                <span>{isDevMode ? '∞' : (profile.token_balance ?? 0)}</span>
              </Link>
            )}

            {/* Notification Bell Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="relative p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
                  title="Notifications"
                >
                  <Bell size={16} />
                  {unread > 0 && (
                    <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 bg-primary text-primary-foreground text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
                      {unread > 9 ? '9+' : unread}
                    </span>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 p-0 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                  <DropdownMenuLabel className="p-0 text-sm font-semibold text-gray-900">
                    Notifications
                  </DropdownMenuLabel>
                  {unread > 0 && (
                    <button
                      onClick={markAllRead}
                      className="text-xs text-primary hover:underline font-medium"
                    >
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="max-h-[360px] overflow-y-auto divide-y divide-gray-50">
                  {notifications.length === 0 ? (
                    <div className="py-10 text-center">
                      <Bell size={24} className="mx-auto text-gray-300 mb-2" />
                      <p className="text-sm text-muted-foreground">No notifications yet</p>
                    </div>
                  ) : (
                    notifications.map(n => (
                      <DropdownMenuItem
                        key={n.id}
                        onClick={() => handleNotifClick(n)}
                        className={`flex flex-col items-start gap-0.5 px-4 py-3 cursor-pointer rounded-none ${
                          !n.read ? 'bg-sky-50/40' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 w-full">
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm truncate ${!n.read ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                              {n.title}
                            </p>
                            {n.body && (
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-1 flex-shrink-0">
                            {!n.read && (
                              <span className="w-2 h-2 rounded-full bg-primary mt-1" />
                            )}
                            <span className="text-[10px] text-gray-400 whitespace-nowrap">{timeAgo(n.created_at)}</span>
                          </div>
                        </div>
                      </DropdownMenuItem>
                    ))
                  )}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Chat button */}
            <button
              onClick={toggleChat}
              className="relative p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
              title="Messages"
            >
              <MessageSquare size={16} />
              {unreadTotal > 0 && (
                <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 bg-primary text-primary-foreground text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
                  {unreadTotal > 9 ? '9+' : unreadTotal}
                </span>
              )}
            </button>

            {/* Dev mode toggle */}
            <button
              onClick={toggleDevMode}
              className={`p-2 rounded-lg transition-colors ${
                isDevMode
                  ? 'text-amber-600 bg-amber-50 hover:bg-amber-100'
                  : 'text-gray-400 hover:bg-gray-100'
              }`}
              title={isDevMode ? 'Disable Dev Mode' : 'Enable Dev Mode'}
            >
              <Wrench size={16} />
            </button>

            {/* Avatar + sign out dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                  <Avatar className="w-8 h-8 ring-2 ring-primary ring-offset-1">
                    <AvatarImage src={profile?.avatar_url} alt={profile?.full_name ?? 'User'} />
                    <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">
                      {profile?.name?.[0]?.toUpperCase() ?? '?'}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={() => navigate('/profile')}>
                  <User size={14} />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-red-600 focus:text-red-600">
                  <LogOut size={14} />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </nav>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 flex justify-around py-2 px-2">
        <Link
          to="/feed"
          className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
            isActive('/feed') ? 'text-primary' : 'text-gray-500'
          }`}
        >
          <LayoutGrid size={20} />
          <span>Browse</span>
        </Link>
        <Link
          to="/post"
          className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
            isActive('/post') ? 'text-primary' : 'text-gray-500'
          }`}
        >
          <Plus size={20} />
          <span>Request Doum</span>
        </Link>
        {profile && (
          <Link
            to="/tokens"
            className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
              isActive('/tokens') ? 'text-primary' : 'text-gray-500'
            }`}
          >
            <Coins size={20} />
            <span>{isDevMode ? '∞' : (profile.token_balance ?? 0)}</span>
          </Link>
        )}
        <Link
          to="/profile"
          className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
            isActive('/profile') ? 'text-primary' : 'text-gray-500'
          }`}
        >
          <User size={20} />
          <span>Profile</span>
        </Link>
        {isAdmin && (
          <Link
            to="/admin"
            className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
              isActive('/admin') ? 'text-primary' : 'text-gray-500'
            }`}
          >
            <Shield size={20} />
            <span>Admin</span>
          </Link>
        )}
      </nav>
    </>
  )
}
