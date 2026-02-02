import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Welcome back to Streb</h1>
          <p className="mt-2 text-gray-600">
            Sign in to your marketing automation dashboard
          </p>
        </div>
        
        <div className="bg-white shadow-lg rounded-lg p-8">
          <SignIn 
            appearance={{
              elements: {
                formButtonPrimary: 
                  "bg-blue-600 hover:bg-blue-700 text-sm normal-case",
                card: "shadow-none",
                headerTitle: "hidden",
                headerSubtitle: "hidden",
              },
            }}
            redirectUrl="/dashboard"
          />
        </div>
        
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            New to Streb?{' '}
            <a 
              href="/sign-up" 
              className="font-medium text-blue-600 hover:text-blue-500"
            >
              Create an account
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}