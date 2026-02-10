import { Rocket, Video, Mail, Clock } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface Activity {
  id: string
  type: 'post' | 'video' | 'email'
  action: string
  timestamp: Date
}

interface RecentActivityProps {
  activities?: Activity[]
}

export function RecentActivity({ activities = [] }: RecentActivityProps) {
  const getIcon = (type: Activity['type']) => {
    switch (type) {
      case 'post':
        return <Rocket className="h-4 w-4 text-muted-foreground" />
      case 'video':
        return <Video className="h-4 w-4 text-muted-foreground" />
      case 'email':
        return <Mail className="h-4 w-4 text-muted-foreground" />
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />
    }
  }

  const formatTimestamp = (timestamp: Date) => {
    const now = new Date()
    const diff = now.getTime() - timestamp.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    return `${days}d ago`
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
        <CardDescription>
          Your latest marketing activities
        </CardDescription>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Clock className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              No recent activity. Get started by creating your first post!
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {activities.slice(0, 5).map((activity) => (
              <div key={activity.id} className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  {getIcon(activity.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {activity.action}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatTimestamp(activity.timestamp)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}