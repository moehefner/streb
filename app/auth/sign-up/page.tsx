export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md space-y-8 rounded-lg border bg-card p-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold">Create Your Account</h2>
          <p className="mt-2 text-muted-foreground">
            Get started with Streb today
          </p>
        </div>
        
        {/* Clerk SignUp component will be added here */}
        <div className="rounded-md bg-muted p-4 text-center text-sm">
          Clerk authentication will be integrated here
        </div>
      </div>
    </div>
  );
}
