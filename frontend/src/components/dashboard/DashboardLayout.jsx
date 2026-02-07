
import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useNavigate, useLocation, Outlet } from "react-router-dom"
import { User, Shield, Lock, Eye, Code, Settings, LogOut, Menu, X, Bell, Search } from "lucide-react"
import { useAuth } from "../../contexts/AuthContext"

const DashboardLayout = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    document.body.classList.add("dashboard-theme")
    return () => {
      document.body.classList.remove("dashboard-theme")
    }
  }, [])

  const sidebarItems = [
    {
      id: "profile",
      label: "User Profile",
      icon: User,
      path: "/dashboard/profile",
      color: "teal-500",
    },
    {
      id: "prompt-injection",
      label: "Prompt Injection",
      icon: Shield,
      path: "/dashboard/prompt-injection",
      color: "red-500",
    },
    {
      id: "model-poisoning",
      label: "Model Poisoning",
      icon: Lock,
      path: "/dashboard/model-poisoning",
      color: "purple-500",
    },
    {
      id: "vector-embeddings",
      label: "Vector & Embedding Weaknesses",
      icon: Eye,
      path: "/dashboard/vector-embeddings",
      color: "teal-600",
    },
    {
      id: "code-scanner",
      label: "C/C++ Code Scanner",
      icon: Code,
      path: "/dashboard/code-scanner",
      color: "yellow-500",
    },
    {
      id: "settings",
      label: "Settings",
      icon: Settings,
      path: "/dashboard/settings",
      color: "green-500",
    },
  ]

  const handleLogout = () => {
    logout()
    navigate("/")
  }

  const isActive = (path) => location.pathname === path

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 flex animated-gradient">
      {/* Sidebar */}
      <motion.div
        className={`bg-gradient-to-b from-slate-800 via-slate-700 to-slate-800 border-r border-slate-600/50 flex flex-col transition-all duration-300 shadow-2xl backdrop-blur-sm ${
          sidebarCollapsed ? "w-16" : "w-64"
        }`}
        initial={false}
        animate={{ width: sidebarCollapsed ? 64 : 256 }}
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b border-slate-600/50">
          <div className="flex items-center justify-between">
            {!sidebarCollapsed && (
              <motion.h2
                className="text-xl font-bold bg-gradient-to-r from-teal-400 via-blue-400 to-purple-400 bg-clip-text text-transparent"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                LLMShield
              </motion.h2>
            )}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-2 rounded-lg hover:bg-slate-700/50 text-slate-300 hover:text-white transition-all duration-300 hover:shadow-lg"
            >
              {sidebarCollapsed ? <Menu className="h-5 w-5" /> : <X className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Sidebar Navigation */}
        <nav className="flex-1 p-4">
          <div className="space-y-2">
            {sidebarItems.map((item) => {
              const IconComponent = item.icon
              const active = isActive(item.path)

              return (
                <motion.button
                  key={item.id}
                  onClick={() => navigate(item.path)}
                  className={`flex items-center px-4 py-3 text-sm font-medium rounded-xl mx-2 transition-all duration-300 hover:shadow-lg w-full ${
                    active
                      ? "bg-gradient-to-r from-teal-400/80 via-purple-500/80 to-red-500/80 text-white shadow-lg transform scale-105 backdrop-blur-sm"
                      : "text-slate-300 hover:bg-gradient-to-r hover:from-slate-700/60 hover:via-slate-600/60 hover:to-slate-700/60 hover:text-white hover:transform hover:scale-105 hover:backdrop-blur-sm"
                  }`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <IconComponent className={`h-5 w-5 ${sidebarCollapsed ? "" : "mr-3"} ${active ? "text-white" : "text-slate-400"}`} />
                  <AnimatePresence>
                    {!sidebarCollapsed && (
                      <motion.span
                        className={`font-medium ${active ? "text-white font-semibold" : "text-slate-300"}`}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ duration: 0.2 }}
                      >
                        {item.label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.button>
              )
            })}
          </div>
        </nav>
      </motion.div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Navigation */}
        <header className="bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 border-b border-slate-600/50 px-6 py-4 shadow-xl backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-3xl font-bold bg-gradient-to-r from-white via-teal-200 to-purple-300 bg-clip-text text-transparent">Dashboard</h1>
            </div>

            <div className="flex items-center space-x-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                <input 
                  type="text" 
                  placeholder="Search..." 
                  className="bg-slate-700/50 border border-slate-600/50 rounded-xl pl-10 pr-4 py-3 w-64 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500/50 transition-all duration-300 backdrop-blur-sm" 
                />
              </div>

              {/* Notifications */}
              <button className="p-3 rounded-xl hover:bg-slate-700/50 text-slate-300 hover:text-white transition-all duration-300 relative hover:shadow-lg">
                <Bell className="h-5 w-5" />
                <span className="absolute -top-1 -right-1 bg-gradient-to-r from-red-500 to-red-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center animate-pulse shadow-lg">
                  3
                </span>
              </button>

              {/* User Menu */}
              <div className="flex items-center space-x-3">
                <div className="text-right">
                  <p className="text-white font-semibold">{user?.name}</p>
                  <p className="text-slate-400 text-sm">{user?.email}</p>
                </div>
                <div className="w-12 h-12 bg-gradient-to-br from-teal-500 via-blue-600 to-purple-600 rounded-full flex items-center justify-center shadow-lg animate-pulse">
                  <User className="h-6 w-6 text-white" />
                </div>
                <button
                  onClick={handleLogout}
                  className="p-3 rounded-xl hover:bg-red-600/80 text-slate-300 hover:text-white transition-all duration-300 hover:shadow-lg"
                  title="Logout"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-8 bg-gradient-to-br from-slate-900/50 via-slate-800/50 to-indigo-900/50 backdrop-blur-sm">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default DashboardLayout