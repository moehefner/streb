"use client"

import type React from "react"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Menu, X, ArrowUpRight, ArrowRight, CreditCard, LogOut, Settings } from "lucide-react"
import { useUser, useClerk } from "@clerk/nextjs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const primaryCtaClasses =
  "relative flex items-center gap-0 border border-zinc-700 rounded-full pl-5 pr-1 py-1 transition-all duration-300 group overflow-hidden"

export function Header() {
  const [isOpen, setIsOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)
  const { isSignedIn, user } = useUser()
  const { signOut } = useClerk()

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY
      const newIsScrolled = scrollY > 20
      
      // #region agent log
      fetch('http://127.0.0.1:7244/ingest/473a7591-1494-493f-ac42-170a2a3326a1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'header.tsx:14',message:'scroll event',data:{scrollY,newIsScrolled},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      
      setIsScrolled(newIsScrolled)
    }

    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const handleSmoothScroll = (e: React.MouseEvent<HTMLAnchorElement>, targetId: string) => {
    e.preventDefault()
    const element = document.getElementById(targetId)

    if (element) {
      const headerOffset = 100
      const elementPosition = element.getBoundingClientRect().top + window.scrollY
      const offsetPosition = elementPosition - headerOffset

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      })
      setIsOpen(false)
    }
  }

  const handleLogoClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    })
  }

  // #region agent log
  fetch('http://127.0.0.1:7244/ingest/473a7591-1494-493f-ac42-170a2a3326a1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'header.tsx:47',message:'header render',data:{isScrolled,isOpen},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'A'})}).catch(()=>{});
  // #endregion

  return (
    <header className="fixed top-0 left-0 right-0 z-50 px-4 pt-4 transition-all duration-300">
        <div
        className={`max-w-7xl mx-auto transition-all duration-300 header-bg px-6 py-4 rounded-2xl border border-zinc-800`}
        ref={(el) => {
          // #region agent log
          if (el) fetch('http://127.0.0.1:7244/ingest/473a7591-1494-493f-ac42-170a2a3326a1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'header.tsx:54',message:'header container styles',data:{isScrolled,computedBg:window.getComputedStyle(el).backgroundColor,className:el.className,zIndex:window.getComputedStyle(el).zIndex},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix-3',hypothesisId:'E'})}).catch(()=>{});
          // #endregion
        }}
      >
        <div className="flex items-center justify-between">
          <a href="#" onClick={handleLogoClick} className="flex items-center gap-2 cursor-pointer">
            <svg
              className="w-7 h-7 text-white header-text"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              ref={(el) => {
                // #region agent log
                if (el) fetch('http://127.0.0.1:7244/ingest/473a7591-1494-493f-ac42-170a2a3326a1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'header.tsx:63',message:'logo svg styles',data:{isScrolled,computedColor:window.getComputedStyle(el).color,className:el.className},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix-3',hypothesisId:'B'})}).catch(()=>{});
                // #endregion
              }}
            >
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
            <span
              className="text-xl font-bold tracking-tight text-white header-text"
              ref={(el) => {
                // #region agent log
                if (el) fetch('http://127.0.0.1:7244/ingest/473a7591-1494-493f-ac42-170a2a3326a1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'header.tsx:71',message:'logo text styles',data:{isScrolled,computedColor:window.getComputedStyle(el).color,className:el.className},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix-3',hypothesisId:'B'})}).catch(()=>{});
                // #endregion
              }}
            >
              Streb
            </span>
          </a>

          <nav 
            className="hidden md:flex items-center justify-center gap-16 flex-1 ml-32"
            ref={(el) => {
              // #region agent log
              if (el) fetch('http://127.0.0.1:7244/ingest/473a7591-1494-493f-ac42-170a2a3326a1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'header.tsx:78',message:'nav positioning',data:{offsetLeft:el.offsetLeft,offsetWidth:el.offsetWidth,parentWidth:el.parentElement?.offsetWidth,className:el.className},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix-2',hypothesisId:'D'})}).catch(()=>{});
              // #endregion
            }}
          >
            <a
              href="#services"
              onClick={(e) => handleSmoothScroll(e, "services")}
              className="text-base font-semibold text-gray-300 hover:text-white cursor-pointer header-text"
              ref={(el) => {
                // #region agent log
                if (el) fetch('http://127.0.0.1:7244/ingest/473a7591-1494-493f-ac42-170a2a3326a1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'header.tsx:84',message:'nav link styles',data:{isScrolled,computedColor:window.getComputedStyle(el).color,className:el.className,text:el.textContent},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix-3',hypothesisId:'C'})}).catch(()=>{});
                // #endregion
              }}
            >
              Services
            </a>
            <a
              href="#features"
              onClick={(e) => handleSmoothScroll(e, "features")}
              className="text-base font-semibold text-gray-300 hover:text-white cursor-pointer header-text"
            >
              Features
            </a>
            <a
              href="#pricing"
              onClick={(e) => handleSmoothScroll(e, "pricing")}
              className="text-base font-semibold text-gray-300 hover:text-white cursor-pointer header-text"
            >
              Pricing
            </a>
          </nav>

          <div className="hidden md:flex items-center gap-3 flex-shrink-0">
            {isSignedIn && (
              <Link href="/dashboard" className={primaryCtaClasses}>
                <span className="absolute inset-0 bg-white rounded-full scale-x-0 origin-right group-hover:scale-x-100 transition-transform duration-300" />
                <span className="text-base font-semibold pr-3 pl-1 relative z-10 transition-colors duration-300 text-white group-hover:text-black header-text">
                  Dashboard
                </span>
                <span className="w-8 h-8 rounded-full flex items-center justify-center relative z-10">
                  <ArrowRight className="w-4 h-4 group-hover:opacity-0 absolute transition-opacity duration-300 text-white header-text" />
                  <ArrowUpRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-all duration-300 text-black header-text" />
                </span>
              </Link>
            )}
            {isSignedIn ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="rounded-full focus:outline-none focus:ring-2 focus:ring-white/50"
                  >
                    <Avatar className="h-9 w-9 border-2 border-zinc-700">
                      <AvatarImage src={user?.imageUrl} alt={user?.fullName ?? "User"} />
                      <AvatarFallback className="bg-zinc-700 text-white text-sm">
                        {user?.fullName
                          ? user.fullName.split(" ").map((n) => n[0]).join("").toUpperCase()
                          : user?.emailAddresses[0]?.emailAddress?.charAt(0).toUpperCase() ?? "U"}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-56 !bg-black border-zinc-800 text-white"
                  style={{ backgroundColor: "black" }}
                >
                  <DropdownMenuLabel className="text-white">
                    <div className="flex flex-col gap-1">
                      <span className="font-semibold text-white [text-shadow:0_0_1px_rgba(255,255,255,0.6)]">{user?.fullName ?? "User"}</span>
                      <span className="text-xs text-white font-normal truncate opacity-80">
                        {user?.emailAddresses[0]?.emailAddress}
                      </span>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-zinc-800" />
                  <DropdownMenuGroup>
                    <DropdownMenuItem asChild>
                      <Link href="/dashboard/settings" className="text-white focus:text-white focus:bg-zinc-900 cursor-pointer [text-shadow:0_0_1px_rgba(255,255,255,0.6)]">
                        <Settings className="mr-2 h-4 w-4" />
                        Settings
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/dashboard/billing" className="text-white focus:text-white focus:bg-zinc-900 cursor-pointer [text-shadow:0_0_1px_rgba(255,255,255,0.6)]">
                        <CreditCard className="mr-2 h-4 w-4" />
                        Billing
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator className="bg-zinc-800" />
                  <DropdownMenuItem
                    onClick={() => signOut()}
                    className="text-white focus:text-white focus:bg-zinc-900 cursor-pointer [text-shadow:0_0_1px_rgba(255,255,255,0.6)]"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <>
                <Link
                  href="/sign-in"
                  className="px-5 py-2.5 text-base font-semibold text-white hover:text-gray-300 header-text"
                >
                  Login
                </Link>
                <Link
                  href="/sign-up"
                  className={primaryCtaClasses}
                >
                  <span className="absolute inset-0 bg-white rounded-full scale-x-0 origin-right group-hover:scale-x-100 transition-transform duration-300" />
                  <span className="text-base font-semibold pr-3 relative z-10 transition-colors duration-300 text-white group-hover:text-black header-text">
                    Get Started
                  </span>
                  <span className="w-8 h-8 rounded-full flex items-center justify-center relative z-10">
                    <ArrowRight className="w-4 h-4 group-hover:opacity-0 absolute transition-opacity duration-300 text-white header-text" />
                    <ArrowUpRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-all duration-300 text-black header-text" />
                  </span>
                </Link>
              </>
            )}
          </div>

          <button
            className="md:hidden text-white header-text"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {isOpen && (
          <nav
            className={`md:hidden mt-6 pb-6 flex flex-col gap-4 border-t pt-6 ${
              isScrolled ? "border-zinc-200" : "border-border"
            }`}
          >
            <a
              href="#services"
              onClick={(e) => handleSmoothScroll(e, "services")}
              className={`transition-colors cursor-pointer ${
                isScrolled ? "text-zinc-600 hover:text-black" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Services
            </a>
            <a
              href="#features"
              onClick={(e) => handleSmoothScroll(e, "features")}
              className={`transition-colors cursor-pointer ${
                isScrolled ? "text-zinc-600 hover:text-black" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Features
            </a>
            <a
              href="#pricing"
              onClick={(e) => handleSmoothScroll(e, "pricing")}
              className={`transition-colors cursor-pointer ${
                isScrolled ? "text-zinc-600 hover:text-black" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Pricing
            </a>
            <div
              className={`flex flex-col gap-3 mt-4 pt-4 border-t ${isScrolled ? "border-zinc-200" : "border-border"}`}
            >
              {isSignedIn && (
                <a href="/dashboard" className={isScrolled ? "text-black" : "text-foreground"}>
                  Dashboard
                </a>
              )}
              {isSignedIn ? (
                <>
                  <a href="/dashboard/settings" className={isScrolled ? "text-black" : "text-foreground"}>
                    Settings
                  </a>
                  <a href="/dashboard/billing" className={isScrolled ? "text-black" : "text-foreground"}>
                    Billing
                  </a>
                  <button
                    type="button"
                    onClick={() => signOut()}
                    className={`text-left ${isScrolled ? "text-black" : "text-foreground"}`}
                  >
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <a href="/sign-in" className={isScrolled ? "text-black" : "text-foreground"}>
                    Login
                  </a>
                  <a
                    href="/sign-up"
                    className={`relative flex items-center gap-0 border rounded-full pl-5 pr-1 py-1 w-fit transition-all duration-300 group overflow-hidden ${
                      isScrolled ? "border-zinc-300" : "border-border"
                    }`}
                  >
                    <span
                      className={`absolute inset-0 rounded-full scale-x-0 origin-right group-hover:scale-x-100 transition-transform duration-300 ${
                        isScrolled ? "bg-black" : "bg-foreground"
                      }`}
                    />
                    <span
                      className={`text-sm pr-3 relative z-10 transition-colors duration-300 ${
                        isScrolled ? "text-black group-hover:text-white" : "text-foreground group-hover:text-background"
                      }`}
                    >
                      Get Started
                    </span>
                    <span className="w-8 h-8 rounded-full flex items-center justify-center relative z-10">
                      <ArrowRight
                        className={`w-4 h-4 group-hover:opacity-0 absolute transition-opacity duration-300 ${
                          isScrolled ? "text-black" : "text-foreground"
                        }`}
                      />
                      <ArrowUpRight
                        className={`w-4 h-4 opacity-0 group-hover:opacity-100 transition-all duration-300 ${
                          isScrolled ? "text-black group-hover:text-white" : "text-foreground group-hover:text-background"
                        }`}
                      />
                    </span>
                  </a>
                </>
              )}
            </div>
          </nav>
        )}
      </div>
    </header>
  )
}
