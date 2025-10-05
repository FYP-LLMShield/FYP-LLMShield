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
