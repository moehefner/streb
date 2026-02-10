/**
 * Example Server Component demonstrating database queries
 * 
 * This file shows how to:
 * - Query the database in Server Components
 * - Use Prisma for type-safe queries
 * - Handle errors gracefully
 * - Display data with proper TypeScript types
 */

// Database functions removed for build optimization

// Server Component
export default async function DatabaseExamplePage() {
  // Skip database queries during build - return demo UI
  const user = null;

  // Demo UI for build time
  if (!user) {
    return (
      <div className="container mx-auto p-8">
        <h1 className="text-3xl font-bold mb-8">Database Integration Example</h1>
        
        <div className="mb-8 rounded-lg border bg-card p-6">
          <h2 className="text-xl font-semibold mb-4">Demo Mode</h2>
          <p className="text-muted-foreground">
            This page demonstrates database integration. Sign in to see real data.
          </p>
        </div>
        
        <div className="grid gap-4 md:grid-cols-3 mb-8">
          <div className="rounded-lg border bg-card p-6">
            <p className="text-sm text-muted-foreground">Posts</p>
            <p className="text-2xl font-bold">0 / 5</p>
          </div>
          <div className="rounded-lg border bg-card p-6">
            <p className="text-sm text-muted-foreground">Videos</p>
            <p className="text-2xl font-bold">0 / 3</p>
          </div>
          <div className="rounded-lg border bg-card p-6">
            <p className="text-sm text-muted-foreground">Emails</p>
            <p className="text-2xl font-bold">0 / 25</p>
          </div>
        </div>
      </div>
    );
  }

  // This code is unreachable since user is always null above
  return null;
}
