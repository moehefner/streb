import { Rocket, Video, Mail } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"

interface UsageStatsCardsProps {
  postsUsed: number
  postsLimit: number
  videosUsed: number
  videosLimit: number
  emailsUsed: number
  emailsLimit: number
}

export function UsageStatsCards({ 
  postsUsed, 
  postsLimit, 
  videosUsed, 
  videosLimit, 
  emailsUsed, 
  emailsLimit 
}: UsageStatsCardsProps) {
  const postsPercentage = Math.round((postsUsed / postsLimit) * 100)
  const videosPercentage = Math.round((videosUsed / videosLimit) * 100)
  const emailsPercentage = Math.round((emailsUsed / emailsLimit) * 100)

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Posts</CardTitle>
          <Rocket className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{postsUsed} / {postsLimit}</div>
          <Progress value={postsPercentage} className="mt-2" />
          <p className="text-xs text-muted-foreground mt-2">
            {postsPercentage}% used this month
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Videos</CardTitle>
          <Video className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{videosUsed} / {videosLimit}</div>
          <Progress value={videosPercentage} className="mt-2" />
          <p className="text-xs text-muted-foreground mt-2">
            {videosPercentage}% used this month
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Outreach Emails</CardTitle>
          <Mail className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{emailsUsed} / {emailsLimit}</div>
          <Progress value={emailsPercentage} className="mt-2" />
          <p className="text-xs text-muted-foreground mt-2">
            {emailsPercentage}% used this month
          </p>
        </CardContent>
      </Card>
    </div>
  )
}