import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar"
import { Button } from "../ui/button"
import { Bell, User, LogOut } from "lucide-react"
import { useAuth } from "../../contexts/AuthContext"
import { useNavigate } from "react-router-dom"

export function TopBar() {
  const { logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate("/")
  }
  return (
    <header className="bg-white/5 backdrop-blur-md border-b border-white/10 p-4">
      <div className="flex items-center justify-end">
        {/* Right side - Notifications and User menu only */}
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
            <Bell size={20} />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center space-x-2 text-white">
                <Avatar className="w-8 h-8">
                  <AvatarImage src="/diverse-user-avatars.png" />
                  <AvatarFallback className="bg-blue-600 text-white text-sm">SA</AvatarFallback>
                </Avatar>
                <span className="hidden md:block">Security Admin</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-gray-900 border-white/10 text-white">
              <DropdownMenuItem className="hover:bg-white/10">
                <User className="mr-2" size={16} />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem className="hover:bg-white/10" onClick={handleLogout}>
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
