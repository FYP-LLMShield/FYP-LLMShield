
import { type ReactNode, useState } from "react"
import { Sidebar } from "./navigation/sidebar"
import { TopBar } from "./navigation/top-bar"


interface DashboardLayoutProps {
  children: ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)


  return (
    <div className="min-h-screen relative" style={{backgroundColor: '#1d2736'}}>
      {/* Background effects with performance optimization - subtly toned down for consistency */}
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.05),transparent_60%)] will-change-auto" />
      <div className="fixed inset-0 opacity-[0.01] bg-[url('data:image/svg+xml,%3Csvg width=60 height=60 viewBox=0 0 60 60 xmlns=http://www.w3.org/2000/svg%3E%3Cg fill=none fillRule=evenodd%3E%3Cg fill=%23ffffff fillOpacity=1%3E%3Ccircle cx=7 cy=7 r=1/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] will-change-auto" />

      {/* Layout structure with sidebar, topbar, and chat panel */}
      <div className="relative z-10 flex min-h-screen">
        <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />

        <div className="flex-1 flex flex-col min-w-0">
          <TopBar />

          <div className="flex-1 flex">
            <main className="flex-1 overflow-y-auto overflow-x-hidden min-w-0 smooth-scroll scroll-container" style={{backgroundColor: '#1d2736'}}>{children}</main>

          </div>
        </div>
      </div>
    </div>
  )
}








