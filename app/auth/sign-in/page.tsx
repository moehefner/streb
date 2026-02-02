export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md space-y-8 rounded-lg border bg-card p-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold">Sign In to Streb</h2>
          <p className="mt-2 text-muted-foreground">
            Sign in to access your dashboard
          </p>
        </div>
        
        {/* Clerk SignIn component will be added here */}
        <div className="rounded-md bg-muted p-4 text-center text-sm">
          Clerk authentication will be integrated here
        </div>
      </div>
    </div>
  );
}
