import { SignedIn, SignedOut, SignInButton, SignUpButton } from '@clerk/nextjs';
import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Navigation */}
      <nav className="flex items-center justify-between p-6">
        <div className="text-2xl font-bold text-gray-900">
          Streb
        </div>
        
        <div className="flex items-center gap-4">
          <SignedOut>
            <SignInButton mode="modal">
              <button className="text-gray-600 hover:text-gray-900 px-4 py-2">
                Sign In
              </button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg">
                Get Started
              </button>
            </SignUpButton>
          </SignedOut>
          
          <SignedIn>
            <Link 
              href="/dashboard"
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg"
            >
              Dashboard
            </Link>
          </SignedIn>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="container mx-auto px-6 py-20">
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
            Marketing Automation for{' '}
            <span className="text-blue-600">SaaS Builders</span>
          </h1>
          
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Automate your social media posts, generate videos, and run outreach campaigns. 
            All powered by AI and integrated with your favorite tools.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <SignedOut>
              <SignUpButton mode="modal">
                <button className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-lg text-lg font-semibold">
                  Start Free Trial
                </button>
              </SignUpButton>
              <Link 
                href="#features"
                className="border border-gray-300 hover:border-gray-400 text-gray-700 px-8 py-4 rounded-lg text-lg font-semibold"
              >
                Learn More
              </Link>
            </SignedOut>
            
            <SignedIn>
              <Link 
                href="/dashboard"
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-lg text-lg font-semibold"
              >
                Go to Dashboard
              </Link>
            </SignedIn>
          </div>

          {/* Features Grid */}
          <div id="features" className="grid md:grid-cols-3 gap-8 mt-20">
            <div className="bg-white rounded-xl p-8 shadow-lg">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                📱
              </div>
              <h3 className="text-xl font-semibold mb-3">Social Media Automation</h3>
              <p className="text-gray-600">
                Schedule posts across Twitter, LinkedIn, Reddit, and more. 
                AI-powered content generation and optimal timing.
              </p>
            </div>

            <div className="bg-white rounded-xl p-8 shadow-lg">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
                🎥
              </div>
              <h3 className="text-xl font-semibold mb-3">Video Generation</h3>
              <p className="text-gray-600">
                Create demo videos, tutorials, and ads automatically using Remotion. 
                From screenshots to polished videos in minutes.
              </p>
            </div>

            <div className="bg-white rounded-xl p-8 shadow-lg">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                📧
              </div>
              <h3 className="text-xl font-semibold mb-3">Email Outreach</h3>
              <p className="text-gray-600">
                Find leads, personalize emails with AI, and track engagement. 
                Automated follow-ups and response handling.
              </p>
            </div>
          </div>

          {/* Integration Logos */}
          <div className="mt-20">
            <p className="text-gray-500 mb-8">Powered by industry-leading tools</p>
            <div className="flex flex-wrap justify-center items-center gap-8 opacity-60">
              <div className="text-lg font-semibold">Next.js</div>
              <div className="text-lg font-semibold">Supabase</div>
              <div className="text-lg font-semibold">Clerk</div>
              <div className="text-lg font-semibold">Stripe</div>
              <div className="text-lg font-semibold">n8n</div>
              <div className="text-lg font-semibold">Remotion</div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t bg-white py-8">
        <div className="container mx-auto px-6 text-center text-gray-600">
          <p>&copy; 2026 Streb. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}