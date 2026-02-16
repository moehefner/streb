import { TrendingUp } from "lucide-react"

import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

interface SectionCardsProps {
  postsUsed: number
  postsLimit: number
  videosUsed: number
  videosLimit: number
  emailsUsed: number
  emailsLimit: number
}

export function SectionCards({ postsUsed, postsLimit, videosUsed, videosLimit, emailsUsed, emailsLimit }: SectionCardsProps) {
  const postsPercentage = Math.round((postsUsed / postsLimit) * 100)
  const videosPercentage = Math.round((videosUsed / videosLimit) * 100)
  const emailsPercentage = Math.round((emailsUsed / emailsLimit) * 100)

  return (
    <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader>
          <CardDescription>Posts Used</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums">
            {postsUsed} / {postsLimit}
          </CardTitle>
          <div>
            <Badge variant="outline">
              <TrendingUp className="h-3 w-3" />
              {postsPercentage}%
            </Badge>
          </div>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Usage this month <TrendingUp className="size-4" />
          </div>
          <div className="text-muted-foreground">
            Posts created this billing period
          </div>
        </CardFooter>
      </Card>
      
      <Card>
        <CardHeader>
          <CardDescription>Videos Generated</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums">
            {videosUsed} / {videosLimit}
          </CardTitle>
          <div>
            <Badge variant="outline">
              <TrendingUp className="h-3 w-3" />
              {videosPercentage}%
            </Badge>
          </div>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Video generation active <TrendingUp className="size-4" />
          </div>
          <div className="text-muted-foreground">Videos created with Remotion</div>
        </CardFooter>
      </Card>
      
      <Card>
        <CardHeader>
          <CardDescription>Outreach Emails</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums">
            {emailsUsed} / {emailsLimit}
          </CardTitle>
          <div>
            <Badge variant="outline">
              <TrendingUp className="h-3 w-3" />
              {emailsPercentage}%
            </Badge>
          </div>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            Strong email performance <TrendingUp className="size-4" />
          </div>
          <div className="text-muted-foreground">Emails sent this month</div>
        </CardFooter>
      </Card>
      
      <Card>
        <CardHeader>
          <CardDescription>Automation Rate</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums">
            94.5%
          </CardTitle>
          <div>
            <Badge variant="outline">
              <TrendingUp className="h-3 w-3" />
              +4.5%
            </Badge>
          </div>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          <div className="line-clamp-1 flex gap-2 font-medium">
            AutoPilot efficiency <TrendingUp className="size-4" />
          </div>
          <div className="text-muted-foreground">Tasks automated successfully</div>
        </CardFooter>
      </Card>
    </div>
  )
}
