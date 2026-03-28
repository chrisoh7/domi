import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Flag, CheckCircle, XCircle, Bot, Users, AlertTriangle, ShieldOff } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Card } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Avatar, AvatarFallback } from '../components/ui/avatar'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs'

function FlagBadge({ reason, reportCount }) {
  const isAI = !!reason
  const isCommunity = reportCount > 0
  return (
    <div className="flex flex-col gap-1.5 mt-2">
      {isAI && (
        <div className="flex items-start gap-1.5">
          <Bot size={13} className="text-purple-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-purple-700 break-words min-w-0">
            <span className="font-semibold">AI flagged:</span> {reason}
          </p>
        </div>
      )}
      {isCommunity && (
        <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-200 w-fit">
          <Users size={11} className="mr-1" />
          {reportCount} community report{reportCount !== 1 ? 's' : ''}
        </Badge>
      )}
    </div>
  )
}

export default function AdminQueue() {
  const { isAdmin } = useAuth()
  const [tasks, setTasks] = useState([])
  const [userReports, setUserReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('all') // 'all' | 'ai' | 'community' | 'users'

  useEffect(() => {
    Promise.all([
      supabase
        .from('tasks')
        .select('*')
        .or('moderation_status.eq.flagged,report_count.gt.0')
        .order('created_at', { ascending: false }),
      supabase
        .from('user_reports')
        .select('*, reporter:profiles!reporter_id(name), reported:profiles!reported_id(name)')
        .order('created_at', { ascending: false }),
    ]).then(([{ data: taskData }, { data: reportData }]) => {
      setTasks(taskData || [])
      setUserReports(reportData || [])
      setLoading(false)
    })
  }, [])

  async function approve(id) {
    await supabase.from('tasks').update({ moderation_status: 'approved', flagged: false }).eq('id', id)
    setTasks(t => t.filter(x => x.id !== id))
  }

  async function remove(id) {
    await supabase.from('tasks').update({ moderation_status: 'removed', status: 'removed', flagged: false }).eq('id', id)
    setTasks(t => t.filter(x => x.id !== id))
  }

  const filtered = tasks.filter(t => {
    if (tab === 'ai') return !!t.flag_reason
    if (tab === 'community') return t.report_count > 0
    return true
  })

  async function dismissUserReport(reportId) {
    await supabase.from('user_reports').update({ reviewed: true }).eq('id', reportId)
    setUserReports(r => r.filter(x => x.id !== reportId))
  }

  const aiCount = tasks.filter(t => !!t.flag_reason).length
  const communityCount = tasks.filter(t => t.report_count > 0).length
  const pendingUserReports = userReports.filter(r => !r.reviewed)

  if (!isAdmin) {
    return (
      <div className="min-h-screen py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
            <ShieldOff size={40} className="mb-3 opacity-30" />
            <p className="font-medium">Admin access required</p>
            <p className="text-sm mt-1">Enable admin on your profile to access this page.</p>
            <Link to="/profile" className="mt-4 text-sm text-primary hover:underline">Go to Profile</Link>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen py-8 flex justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary mt-16" />
      </div>
    )
  }

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <Flag size={20} className="text-red-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Moderation Queue</h1>
            <p className="text-sm text-muted-foreground">Review flagged content and user reports</p>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <Card className="p-4 bg-red-50 border-red-200">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle size={16} className="text-red-600" />
              <p className="text-sm font-medium text-red-800">AI Flagged</p>
            </div>
            <p className="text-2xl font-bold text-red-700">{aiCount}</p>
          </Card>
          <Card className="p-4 bg-amber-50 border-amber-200">
            <div className="flex items-center gap-2 mb-1">
              <Flag size={16} className="text-amber-600" />
              <p className="text-sm font-medium text-amber-800">Task Reports</p>
            </div>
            <p className="text-2xl font-bold text-amber-700">{communityCount}</p>
          </Card>
          <Card className="p-4 bg-purple-50 border-purple-200">
            <div className="flex items-center gap-2 mb-1">
              <Flag size={16} className="text-purple-600" />
              <p className="text-sm font-medium text-purple-800">User Reports</p>
            </div>
            <p className="text-2xl font-bold text-purple-700">{pendingUserReports.length}</p>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="all">
              All ({tasks.length})
            </TabsTrigger>
            <TabsTrigger value="ai" className="flex items-center gap-1.5">
              <Bot size={13} />
              AI ({aiCount})
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-1.5">
              <Flag size={13} />
              Users ({pendingUserReports.length})
            </TabsTrigger>
          </TabsList>

          {/* AI Flagged / All tasks tabs */}
          <TabsContent value="all">
            <TaskFlagList tasks={filtered} onApprove={approve} onRemove={remove} />
          </TabsContent>

          <TabsContent value="ai">
            <TaskFlagList tasks={filtered} onApprove={approve} onRemove={remove} />
          </TabsContent>

          {/* User Reports tab */}
          <TabsContent value="users">
            {pendingUserReports.length === 0 ? (
              <Card className="p-12">
                <div className="text-center text-muted-foreground">
                  <CheckCircle size={40} className="mx-auto mb-3 opacity-30" />
                  <h3 className="font-medium mb-1">All clear</h3>
                  <p className="text-sm">No pending user reports</p>
                </div>
              </Card>
            ) : (
              <div className="space-y-3">
                {pendingUserReports.map(r => (
                  <Card key={r.id} className="p-5">
                    <div className="flex items-start gap-4">
                      <Avatar className="w-12 h-12 flex-shrink-0">
                        <AvatarFallback className="bg-orange-100 text-orange-700 font-semibold">
                          {r.reporter?.name?.[0]?.toUpperCase() ?? '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold">
                          {r.reporter?.name ?? 'Unknown'} <span className="text-muted-foreground">reported</span>{' '}
                          <span className="text-destructive">{r.reported?.name ?? 'Unknown'}</span>
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">{r.reason}</p>
                        {r.task_id && (
                          <Link to={`/task/${r.task_id}`} className="text-xs text-primary hover:underline mt-1 inline-block">View task</Link>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">{new Date(r.created_at).toLocaleDateString()}</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => dismissUserReport(r.id)}
                        className="flex-shrink-0 border-green-300 text-green-700 hover:bg-green-50"
                      >
                        <CheckCircle size={13} className="mr-1" />
                        Dismiss
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

      </div>
    </div>
  )
}

function TaskFlagList({ tasks, onApprove, onRemove }) {
  if (tasks.length === 0) {
    return (
      <Card className="p-12">
        <div className="text-center text-muted-foreground">
          <CheckCircle size={40} className="mx-auto mb-3 opacity-30" />
          <h3 className="font-medium mb-1">All clear</h3>
          <p className="text-sm">No flagged tasks in this category</p>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {tasks.map(task => (
        <Card key={task.id} className="p-5">
          <div className="flex items-start gap-4">
            <Avatar className="w-12 h-12 flex-shrink-0">
              <AvatarFallback className="bg-red-100 text-red-700 font-semibold text-sm">
                {task.category?.[0] ?? '?'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Link to={`/task/${task.id}`} className="font-semibold hover:text-primary leading-snug">
                  {task.title}
                </Link>
                {task.report_count >= 3 && (
                  <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs">
                    <AlertTriangle size={10} className="mr-1" />
                    High severity
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground line-clamp-2">{task.description}</p>
              <p className="text-xs text-muted-foreground mt-1">{task.category} · {new Date(task.created_at).toLocaleDateString()}</p>
              <FlagBadge reason={task.flag_reason} reportCount={task.report_count} />
            </div>
            <div className="flex flex-col gap-2 flex-shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onApprove(task.id)}
                className="border-green-300 text-green-700 hover:bg-green-50"
              >
                <CheckCircle size={13} className="mr-1" />
                Approve
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onRemove(task.id)}
                className="border-red-300 text-destructive hover:bg-red-50"
              >
                <XCircle size={13} className="mr-1" />
                Remove
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}
