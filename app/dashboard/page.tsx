import { getCurrentUser } from '@/lib/auth-helpers';
import { UserButton } from '@clerk/nextjs';

export default async function DashboardPage() {
  const user = await getCurrentUser();
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Streb Dashboard</h1>
          <div className="flex items-center gap-4">
            {user && (
              <div className="text-sm text-muted-foreground">
                Welcome back, {user.fullName || user.email}!
              </div>
            )}
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      </header>
      
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="grid gap-6">
          <div className="rounded-lg border bg-card p-6">
            <h2 className="text-xl font-semibold mb-4">Welcome to Streb</h2>
            <p className="text-muted-foreground mb-4">
              Your all-in-one marketing automation platform for SaaS/app builders.
            </p>
            
            {user && (
              <div className="space-y-4">
                <div className="grid gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Plan:</span>
                    <span className="capitalize font-medium">{user.planType}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Posts used:</span>
                    <span>{user.postsUsed} / {user.postsLimit}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Videos used:</span>
                    <span>{user.videosUsed} / {user.videosLimit}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Emails used:</span>
                    <span>{user.emailsUsed} / {user.emailsLimit}</span>
                  </div>
                </div>
                
                {user.planType === 'free' && (
                  <div className="pt-4 border-t">
                    <a
                      href="/pricing"
                      className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-medium"
                    >
                      Upgrade Plan
                    </a>
                  </div>
                )}
                
                {user.planType !== 'free' && (
                  <div className="pt-4 border-t">
                    <a
                      href="/settings/billing"
                      className="text-sm text-blue-600 hover:text-blue-700"
                    >
                      Manage Subscription →
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
          
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-lg border bg-card p-6">
              <h3 className="font-semibold mb-2">Workflows</h3>
              <p className="text-sm text-muted-foreground">
                Automate your marketing with n8n workflows
              </p>
            </div>
            
            <div className="rounded-lg border bg-card p-6">
              <h3 className="font-semibold mb-2">Video Generation</h3>
              <p className="text-sm text-muted-foreground">
                Create videos with Remotion
              </p>
            </div>
            
            <div className="rounded-lg border bg-card p-6">
              <h3 className="font-semibold mb-2">Analytics</h3>
              <p className="text-sm text-muted-foreground">
                Track your marketing performance
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
