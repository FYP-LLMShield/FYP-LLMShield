import { Link, useLocation } from "react-router-dom"
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar"
import { Button } from "../ui/button"
import { Home, User, Shield, Database, Layers3, Code, History, Settings, ChevronLeft, ChevronRight } from "lucide-react"

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

const menuItems = [
  { label: "Main", href: "/dashboard", icon: Home, color: "#3B82F6" },
  { label: "User Profile", href: "/dashboard/profile", icon: User, color: "#14B8A6" },
  { label: "Prompt Injection", href: "/dashboard/prompt-injection", icon: Shield, color: "#8B5CF6" },
  { label: "Data Poisoning", href: "/dashboard/data-poisoning", icon: Database, color: "#EF4444" },
  { label: "Vector Embedding", href: "/dashboard/vector-embedding", icon: Layers3, color: "#14B8A6" },
  { label: "C or C++ Code Scanning", href: "/dashboard/code-scanning", icon: Code, color: "#EAB308" },
  { label: "History", href: "/dashboard/history", icon: History, color: "#6B7280" },
  { label: "Settings", href: "/dashboard/settings", icon: Settings, color: "#22C55E" },
]

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const location = useLocation()
  const pathname = location.pathname

  const handleMenuClick = () => {
    if (!collapsed) {
      onToggle()
    }
  }

  return (
    <div
      className={`bg-white/10 backdrop-blur-md border-r border-white/20 transition-all duration-300 ${
        collapsed ? "w-16" : "w-64"
      } flex flex-col relative overflow-hidden`}
      style={{
        background: `linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)`,
        boxShadow: `0 8px 32px rgba(0,0,0,0.3), inset 0 0 0 1px rgba(255,255,255,0.1)`,
      }}
    >
      {/* Enhanced glow overlay */}
      <div 
        className="absolute inset-0 opacity-20"
        style={{
          background: `radial-gradient(circle at 0% 50%, rgba(59,130,246,0.2), transparent 70%)`
        }}
      />
      
      {/* Header with toggle */}
      <div className="p-3 border-b border-white/20 relative z-10">
        <div className="flex items-center justify-between">
          {!collapsed && (
            <h2 
              className="text-white font-bold text-base drop-shadow-lg"
              style={{
                textShadow: `0 0 10px rgba(59,130,246,0.5)`
              }}
            >
              Security Center
            </h2>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggle}
            className="text-gray-300 hover:text-white hover:bg-blue-500/30 transition-all duration-200 hover:shadow-lg p-1.5"
            style={{
              boxShadow: `0 0 15px rgba(59,130,246,0.3)`
            }}
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </Button>
        </div>
      </div>

      {/* User Avatar Section */}
      {!collapsed && (
        <div className="p-3 border-b border-white/20 relative z-10">
          <div className="flex items-center space-x-2">
            <div 
              className="relative"
              style={{
                filter: `drop-shadow(0 0 10px rgba(59,130,246,0.4))`
              }}
            >
              <Avatar className="h-8 w-8 border-2 border-blue-400/50">
                <AvatarImage src="/security-admin-avatar.png" alt="Security Admin" />
                <AvatarFallback className="bg-blue-500/20 text-white text-xs">SA</AvatarFallback>
              </Avatar>
            </div>
            <div>
              <p className="text-white font-medium text-sm drop-shadow-lg">Security Admin</p>
              <p className="text-gray-300 text-xs">admin@company.com</p>
            </div>
          </div>
        </div>
      )}
