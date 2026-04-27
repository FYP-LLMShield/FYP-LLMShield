import { Link, useLocation } from "react-router-dom"
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar"
import { Button } from "../ui/button"
import { Home, User, Shield, Database, Code, History, Settings, ChevronLeft, ChevronRight, MessageCircle } from "lucide-react"
import { useAuth } from "../../contexts/AuthContext"

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

const menuItems = [
  { label: "Main", href: "/dashboard", icon: Home, color: "#3B82F6" },
  { label: "User Profile", href: "/dashboard/profile", icon: User, color: "#14B8A6" },
  { label: "Prompt Injection", href: "/dashboard/prompt-injection", icon: Shield, color: "#8B5CF6" },
  { label: "Data Poisoning", href: "/dashboard/data-poisoning", icon: Database, color: "#EF4444" },
  { label: "Vector Security", href: "/dashboard/vector-security", icon: Shield, color: "#22C55E" },
  { label: "C or C++ Code Scanning", href: "/dashboard/code-scanning", icon: Code, color: "#EAB308" },
  { label: "Chatbot", href: "/dashboard/chatbot", icon: MessageCircle, color: "#A78BFA" },
  { label: "History", href: "/dashboard/history", icon: History, color: "#6B7280" },
  { label: "Settings", href: "/dashboard/settings", icon: Settings, color: "#22C55E" },
]

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const location = useLocation()
  const pathname = location.pathname
  const { user } = useAuth()

  const displayName = user?.username || user?.name || "User"
  const displayEmail = user?.email || ""
  const initials = (displayName || "U")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("") || "U"

  const handleMenuClick = () => {
    if (!collapsed) {
      onToggle()
    }
  }

  return (
    <div
      className={`bg-slate-100/90 dark:bg-white/10 backdrop-blur-md border-r border-slate-200/90 dark:border-white/20 transition-all duration-300 ${
        collapsed ? "w-16" : "w-64"
      } flex flex-col relative overflow-hidden shadow-sm dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)] dark:[box-shadow:0_8px_32px_rgba(0,0,0,0.3),inset_0_0_0_1px_rgba(255,255,255,0.1)]`}
    >
      <div
        className="absolute inset-0 opacity-30 dark:opacity-20 bg-[radial-gradient(circle_at_0%_50%,rgba(59,130,246,0.18),transparent_70%)] dark:bg-[radial-gradient(circle_at_0%_50%,rgba(59,130,246,0.2),transparent_70%)]"
      />
      
      {/* Header with toggle */}
      <div className="p-3 border-b border-slate-200/90 dark:border-white/20 relative z-10">
        <div className="flex items-center justify-between">
          {!collapsed && (
            <h2 className="text-slate-900 dark:text-white font-bold text-base drop-shadow-sm dark:drop-shadow-lg">
              Security Center
            </h2>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggle}
            className="text-slate-600 hover:text-slate-900 hover:bg-blue-500/15 dark:text-gray-300 dark:hover:text-white dark:hover:bg-blue-500/30 transition-all duration-200 p-1.5 dark:hover:shadow-lg"
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </Button>
        </div>
      </div>

      {/* User Avatar Section */}
      {!collapsed && (
        <div className="p-3 border-b border-slate-200/90 dark:border-white/20 relative z-10">
          <div className="flex items-center space-x-2">
            <div className="relative dark:[filter:drop-shadow(0_0_10px_rgba(59,130,246,0.4))]">
              <Avatar className="h-8 w-8 border-2 border-blue-400/60 dark:border-blue-400/50">
                <AvatarImage src={(user?.profile_picture as string) || "/diverse-user-avatars.png"} alt={displayName} />
                <AvatarFallback className="bg-blue-500/20 text-slate-800 dark:text-white text-xs">{initials}</AvatarFallback>
              </Avatar>
            </div>
            <div>
              <p className="text-slate-900 dark:text-white font-medium text-sm">{displayName}</p>
              <p className="text-slate-600 dark:text-gray-300 text-xs">{displayEmail}</p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Menu */}
      <nav className="flex-1 p-1 relative z-10">
        <div className="space-y-0.5">
          {menuItems.map((item) => {
            const isActive = pathname === item.href
            const Icon = item.icon
            
            return (
              <Link key={item.href} to={item.href} onClick={handleMenuClick}>
                <div
                  className={`flex items-center space-x-2 px-2 py-2 rounded-lg transition-all duration-300 group hover:scale-105 ${
                    isActive
                      ? "bg-slate-200/90 text-slate-900 shadow-md dark:bg-white/20 dark:text-white dark:shadow-lg"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 dark:text-gray-300 dark:hover:text-white dark:hover:bg-white/10"
                  }`}
                  style={{
                    background: isActive 
                      ? `linear-gradient(135deg, ${item.color}30, ${item.color}10)`
                      : undefined,
                    boxShadow: isActive 
                      ? `0 0 20px ${item.color}40, 0 4px 15px rgba(0,0,0,0.3)`
                      : undefined,
                    border: isActive 
                      ? `1px solid ${item.color}50`
                      : undefined,
                  }}
                >
                  <div 
                    className={`p-1.5 rounded-md transition-all duration-300 ${
                      isActive ? "shadow-lg" : "group-hover:shadow-md"
                    }`}
                    style={{
                      background: isActive ? `${item.color}20` : undefined,
                      boxShadow: isActive ? `0 0 15px ${item.color}40` : undefined,
                    }}
                  >
                    <Icon 
                      size={16} 
                      className={`transition-all duration-300 ${
                        isActive ? "drop-shadow-lg" : ""
                      }`}
                      style={{
                        filter: isActive ? `drop-shadow(0 0 8px ${item.color}60)` : undefined
                      }}
                    />
                  </div>
                  {!collapsed && (
                    <span 
                      className={`font-medium text-sm transition-all duration-300 ${
                        isActive ? "drop-shadow-lg" : ""
                      }`}
                      style={{
                        textShadow: isActive ? `0 0 10px ${item.color}50` : undefined
                      }}
                    >
                      {item.label}
                    </span>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
