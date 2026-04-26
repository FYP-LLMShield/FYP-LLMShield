
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar"
import { Button } from "../ui/button"
import { Bell, User, LogOut, Sun, Moon } from "lucide-react"
import { useAuth } from "../../contexts/AuthContext"
import { useNavigate } from "react-router-dom"
import { useTheme } from "../../contexts/ThemeContext"

export function TopBar() {
  const { logout } = useAuth()
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()

  const handleLogout = () => {
    logout()
    navigate("/")
  }
  return (
    <header className="bg-white/80 dark:bg-white/5 backdrop-blur-md border-b border-slate-200/90 dark:border-white/10 p-4">
      <div className="flex items-center justify-end">
        <div className="flex items-center space-x-2 sm:space-x-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={toggleTheme}
            className="text-slate-600 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white rounded-full"
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? <Sun size={20} className="text-amber-400" /> : <Moon size={20} className="text-slate-700" />}
          </Button>

          <Button variant="ghost" size="sm" className="text-slate-600 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white">
            <Bell size={20} />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center space-x-2 text-slate-800 dark:text-white">
                <Avatar className="w-8 h-8">
                  <AvatarImage src="/diverse-user-avatars.png" />
                  <AvatarFallback className="bg-blue-600 text-white text-sm">SA</AvatarFallback>
                </Avatar>
                <span className="hidden md:block">Security Admin</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-popover text-popover-foreground border border-border shadow-lg">
              <DropdownMenuItem className="focus:bg-accent cursor-pointer">
                <User className="mr-2" size={16} />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem className="focus:bg-accent cursor-pointer" onClick={handleLogout}>
                <LogOut className="mr-2" size={16} />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
