import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-black">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white">Welcome back to Streb</h1>
          <p className="mt-2 text-gray-300">
            Sign in to your marketing automation dashboard
          </p>
        </div>
        
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-8">
          <SignIn 
            appearance={{
              variables: {
                colorText: '#ffffff',
                colorTextSecondary: 'rgba(255,255,255,0.85)',
                colorInputText: '#ffffff',
                colorInputBackground: '#27272a',
                colorBackground: 'transparent',
              },
              elements: {
                formButtonPrimary: 
                  "bg-blue-600 hover:bg-blue-700 text-sm normal-case text-white",
                card: "shadow-none bg-transparent",
                headerTitle: "hidden",
                headerSubtitle: "hidden",
                formFieldInput: "bg-zinc-800 text-white border-zinc-700",
                formFieldLabel: "text-white",
                formFieldInputShowPasswordButton: "text-white",
                identityPreviewEditButton: "text-white",
                footerActionLink: "text-white",
                formResendCodeLink: "text-white",
                otpCodeFieldInput: "bg-zinc-800 text-white border-zinc-700",
                formFieldSuccessText: "text-white",
                formFieldErrorText: "text-red-400",
                socialButtonsBlockButton: "text-white border-zinc-600",
                dividerLine: "bg-zinc-700",
                dividerText: "text-gray-400",
              },
            }}
            redirectUrl="/dashboard"
          />
        </div>
        
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-400">
            New to Streb?{' '}
            <a 
              href="/sign-up" 
              className="font-medium text-white hover:text-gray-300"
            >
              Create an account
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
