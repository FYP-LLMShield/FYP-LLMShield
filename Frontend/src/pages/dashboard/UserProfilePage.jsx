
import { useState } from "react"
import { motion } from "framer-motion"
import { User, Edit3, Save, X, Camera, Mail, Phone, MapPin, Calendar, Shield } from "lucide-react"
import { useAuth } from "../../contexts/AuthContext"

const UserProfilePage = () => {
  const { user, updateUser } = useAuth()
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState({
    name: user?.name || "John Doe",
    email: user?.email || "john.doe@example.com",
    phone: "+1 (555) 123-4567",
    location: "San Francisco, CA",
    company: "TechCorp Inc.",
    role: "Security Engineer",
    bio: "Cybersecurity professional with 5+ years of experience in AI security and threat detection.",
    plan: "Plus Plan",
  })

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSave = () => {
    // Update user context
    updateUser({ name: formData.name, email: formData.email })
    setIsEditing(false)
  }

  const handleCancel = () => {
    setFormData({
      name: user?.name || "John Doe",
      email: user?.email || "john.doe@example.com",
      phone: "+1 (555) 123-4567",
      location: "San Francisco, CA",
      company: "TechCorp Inc.",
      role: "Security Engineer",
      bio: "Cybersecurity professional with 5+ years of experience in AI security and threat detection.",
      plan: "Plus Plan",
    })
    setIsEditing(false)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-purple-900/80 to-pink-900/60 rounded-lg p-6 border border-purple-700/60"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg">
              <User className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">User Profile</h1>
              <p className="text-gray-300">Manage your account information and preferences</p>
            </div>
          </div>
          <div className="flex space-x-3">
            {isEditing ? (
              <>
                <button
                  onClick={handleSave}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
                >
                  <Save className="h-4 w-4" />
                  <span>Save</span>
                </button>
                <button
                  onClick={handleCancel}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
                >
                  <X className="h-4 w-4" />
                  <span>Cancel</span>
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-all"
              >
                <Edit3 className="h-4 w-4" />
                <span>Edit Profile</span>
              </button>
            )}
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Card */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-purple-900/80 to-pink-900/60 rounded-lg p-6 border border-purple-700/60"
        >
          <div className="text-center">
            <div className="relative inline-block mb-4">
              <div className="w-24 h-24 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full flex items-center justify-center mx-auto">
                <User className="h-12 w-12 text-white" />
              </div>
              {isEditing && (
                <button className="absolute bottom-0 right-0 bg-green-600 rounded-full p-2 hover:bg-green-700 transition-colors">
                  <Camera className="h-4 w-4 text-white" />
                </button>
              )}
            </div>
            <h2 className="text-xl font-bold text-white mb-1">{formData.name}</h2>
            <p className="text-gray-400 mb-2">{formData.role}</p>
            <div className="inline-flex items-center px-3 py-1 bg-green-600/20 text-green-400 rounded-full text-sm">
              <Shield className="h-3 w-3 mr-1" />
              {formData.plan}
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <div className="flex items-center space-x-3 text-gray-300">
              <Mail className="h-4 w-4" />
              <span className="text-sm">{formData.email}</span>
            </div>
            <div className="flex items-center space-x-3 text-gray-300">
              <Phone className="h-4 w-4" />
              <span className="text-sm">{formData.phone}</span>
            </div>
            <div className="flex items-center space-x-3 text-gray-300">
              <MapPin className="h-4 w-4" />
              <span className="text-sm">{formData.location}</span>
            </div>
            <div className="flex items-center space-x-3 text-gray-300">
              <Calendar className="h-4 w-4" />
              <span className="text-sm">Joined March 2024</span>
            </div>
          </div>
        </motion.div>

        {/* Profile Details */}
        <div className="lg:col-span-2 space-y-6">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-gradient-to-br from-purple-900/80 to-pink-900/60 rounded-lg p-6 border border-purple-700/60"
          >
            <h3 className="text-lg font-bold text-white mb-6">Personal Information</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">Full Name</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleInputChange("name", e.target.value)}
                    className="w-full bg-gradient-to-r from-purple-700/80 to-pink-700/60 border border-purple-500/70 rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-400"
                  />
                ) : (
                  <p className="text-white bg-gradient-to-r from-purple-800/80 to-pink-800/60 rounded-lg p-3">{formData.name}</p>
                )}
              </div>

              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">Email Address</label>
                {isEditing ? (
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                    className="w-full bg-gradient-to-r from-purple-700/80 to-pink-700/60 border border-purple-500/70 rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-400"
                  />
                ) : (
                  <p className="text-white bg-gradient-to-r from-purple-800/80 to-pink-800/60 rounded-lg p-3">{formData.email}</p>
                )}
              </div>

              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">Phone Number</label>
                {isEditing ? (
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleInputChange("phone", e.target.value)}
                    className="w-full bg-gradient-to-r from-purple-700/80 to-pink-700/60 border border-purple-500/70 rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-400"
                  />
                ) : (
                  <p className="text-white bg-gradient-to-r from-purple-800/80 to-pink-800/60 rounded-lg p-3">{formData.phone}</p>
                )}
              </div>

              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">Location</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => handleInputChange("location", e.target.value)}
                    className="w-full bg-gradient-to-r from-purple-700/80 to-pink-700/60 border border-purple-500/70 rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-400"
                  />
                ) : (
                  <p className="text-white bg-gradient-to-r from-purple-800/80 to-pink-800/60 rounded-lg p-3">{formData.location}</p>
                )}
              </div>

              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">Company</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={formData.company}
                    onChange={(e) => handleInputChange("company", e.target.value)}
                    className="w-full bg-gradient-to-r from-purple-700/80 to-pink-700/60 border border-purple-500/70 rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-400"
                  />
                ) : (
                  <p className="text-white bg-gradient-to-r from-purple-800/80 to-pink-800/60 rounded-lg p-3">{formData.company}</p>
                )}
              </div>

              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">Job Role</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={formData.role}
                    onChange={(e) => handleInputChange("role", e.target.value)}
                    className="w-full bg-gradient-to-r from-purple-700/80 to-pink-700/60 border border-purple-500/70 rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-400"
                  />
                ) : (
                  <p className="text-white bg-gradient-to-r from-purple-800/80 to-pink-800/60 rounded-lg p-3">{formData.role}</p>
                )}
              </div>
            </div>

            <div className="mt-6">
              <label className="block text-gray-300 text-sm font-medium mb-2">Bio</label>
              {isEditing ? (
                <textarea
                  value={formData.bio}
                  onChange={(e) => handleInputChange("bio", e.target.value)}
                  rows={4}
                  className="w-full bg-gradient-to-r from-purple-700/80 to-pink-700/60 border border-purple-500/70 rounded-lg p-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-400"
                />
              ) : (
                <p className="text-white bg-gradient-to-r from-purple-800/80 to-pink-800/60 rounded-lg p-3">{formData.bio}</p>
              )}
            </div>
          </motion.div>

          {/* Account Statistics */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-gradient-to-br from-purple-900/80 to-pink-900/60 rounded-lg p-6 border border-purple-700/60"
          >
            <h3 className="text-lg font-bold text-white mb-6">Account Statistics</h3>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-400">24</div>
                <div className="text-gray-400 text-sm">Total Scans</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-400">8</div>
                <div className="text-gray-400 text-sm">High Risk</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-400">12</div>
                <div className="text-gray-400 text-sm">Medium Risk</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-400">4</div>
                <div className="text-gray-400 text-sm">Low Risk</div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

export default UserProfilePage
