"use client"

import * as React from "react"
import { 
  Home, 
  Rocket, 
  Video, 
  Mail, 
  Bot, 
  BarChart3, 
  Settings,
  Plus
} from "lucide-react"

import { NavMain } from '@/components/nav-main'
import { NavUser } from '@/components/nav-user'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'

const data = {
  navMain: [
    {
      title: "Overview",
      url: "/dashboard",
      icon: Home,
    },
    {
      title: "Posts",
      url: "/dashboard/posts",
      icon: Rocket,
    },
    {
      title: "Videos",
      url: "/dashboard/videos",
      icon: Video,
    },
    {
      title: "Outreach",
      url: "/dashboard/outreach",
      icon: Mail,
    },
    {
      title: "AutoPilot",
      url: "/dashboard/autopilot",
      icon: Bot,
    },
    {
      title: "Analytics",
      url: "/dashboard/analytics",
      icon: BarChart3,
    },
    {
      title: "Settings",
      url: "/dashboard/settings",
      icon: Settings,
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <a href="/dashboard">
                <div className="flex items-center justify-center w-8 h-8 bg-primary rounded-lg">
                  <span className="text-primary-foreground font-bold text-sm">S</span>
                </div>
                <span className="text-base font-semibold text-foreground">STREB</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  )
}