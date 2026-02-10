import { Rocket, Video, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"

export function QuickActions() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
        <CardDescription>
          Get started with creating content for your marketing campaigns
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col sm:flex-row gap-4">
        <Button asChild className="flex-1">
          <Link href="/dashboard/posts">
            <Rocket className="mr-2 h-4 w-4" />
            Create Post
          </Link>
        </Button>
        <Button asChild className="flex-1" variant="secondary">
          <Link href="/dashboard/videos">
            <Video className="mr-2 h-4 w-4" />
            Create Video
          </Link>
        </Button>
        <Button asChild className="flex-1" variant="secondary">
          <Link href="/dashboard/outreach">
            <Mail className="mr-2 h-4 w-4" />
            Start Campaign
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}