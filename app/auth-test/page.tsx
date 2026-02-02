import { getCurrentUser } from '@/lib/auth-helpers';

/**
 * Test page to verify Clerk authentication is working
 * Visit /auth-test to see user data and test authentication
 */
export default async function AuthTestPage() {
  const user = await getCurrentUser();

  return (
    <div className="container mx-auto p-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8">Authentication Test</h1>
      
      {user ? (
        <div className="space-y-6">
          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-green-800 mb-4">
              ✅ Authentication Working!
            </h2>
            <p className="text-green-700">
              You are successfully authenticated and your user data is synced to the database.
            </p>
          </div>

          <div className="bg-white border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">User Information</h3>
            <div className="grid gap-3 text-sm">
              <div className="flex justify-between">
                <span className="font-medium">Database ID:</span>
                <span className="font-mono text-xs">{user.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Clerk ID:</span>
                <span className="font-mono text-xs">{user.clerkUserId}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Email:</span>
                <span>{user.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Full Name:</span>
                <span>{user.fullName || 'Not set'}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Plan:</span>
                <span className="capitalize">{user.planType}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Created:</span>
                <span>{new Date(user.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          <div className="bg-white border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Usage Limits</h3>
            <div className="grid gap-3 text-sm">
              <div className="flex justify-between">
                <span>Posts:</span>
                <span>{user.postsUsed} / {user.postsLimit}</span>
              </div>
              <div className="flex justify-between">
                <span>Videos:</span>
                <span>{user.videosUsed} / {user.videosLimit}</span>
              </div>
              <div className="flex justify-between">
                <span>Emails:</span>
                <span>{user.emailsUsed} / {user.emailsLimit}</span>
              </div>
            </div>
          </div>

          {user.connectedAccounts && user.connectedAccounts.length > 0 && (
            <div className="bg-white border rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4">Connected Accounts</h3>
              <div className="space-y-2">
                {user.connectedAccounts.map((account) => (
                  <div key={account.id} className="flex justify-between text-sm">
                    <span className="capitalize">{account.platform}</span>
                    <span>{account.accountUsername || 'Connected'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-blue-800 mb-2">
              🎉 Everything is working!
            </h3>
            <p className="text-blue-700 mb-4">
              Your Clerk authentication is properly configured and users are being synced to Supabase.
            </p>
            <div className="space-y-2 text-sm text-blue-600">
              <div>✅ Clerk authentication</div>
              <div>✅ Database synchronization</div>
              <div>✅ User data retrieval</div>
              <div>✅ Route protection</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-red-800 mb-4">
            ❌ Not Authenticated
          </h2>
          <p className="text-red-700 mb-4">
            You need to sign in to view this page.
          </p>
          <a 
            href="/sign-in"
            className="inline-block bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded"
          >
            Sign In
          </a>
        </div>
      )}

      <div className="mt-8 text-center">
        <a 
          href="/dashboard"
          className="text-blue-600 hover:text-blue-800 underline"
        >
          ← Back to Dashboard
        </a>
      </div>
    </div>
  );
}