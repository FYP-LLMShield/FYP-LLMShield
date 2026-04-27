
import { useMemo, useRef, useState } from "react"
import { motion } from "framer-motion"
import { User, Edit3, Save, X, Camera, Mail, Phone, MapPin, Building2, Briefcase } from "lucide-react"
import { useAuth } from "../../contexts/AuthContext"

const UserProfilePage = () => {
  const { user, updateUser } = useAuth()
  const [isEditing, setIsEditing] = useState(false)
  const fileRef = useRef(null)
  const fallbackInitials = useMemo(() => {
    const n = (user?.name || user?.username || user?.email || "U").trim()
    const parts = n.split(/\s+/).filter(Boolean)
    const a = (parts[0]?.[0] || "U").toUpperCase()
    const b = (parts[1]?.[0] || "").toUpperCase()
    return (a + b).slice(0, 2)
  }, [user])
  const [formData, setFormData] = useState({
    email: user?.email || "",
    username: user?.username || user?.email?.split("@")[0] || "",
    profile_picture: user?.profile_picture || "",
    phone_number: user?.phone_number || "",
    location: user?.location || "",
    company: user?.company || "",
    job_role: user?.job_role || "",
    bio: user?.bio || "",
  })

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handlePickPhoto = () => fileRef.current?.click?.()

  const handlePhotoSelected = async (file) => {
    if (!file) return
    // basic guard: images only, keep small enough to store in DB as text
    if (!file.type?.startsWith("image/")) return
    if (file.size > 2 * 1024 * 1024) {
      // 2MB max (data URL will be larger, but keeps it reasonable)
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : ""
      if (result) handleInputChange("profile_picture", result)
    }
    reader.readAsDataURL(file)
  }

  const handleSave = async () => {
    await updateUser({
      username: formData.username,
      profile_picture: formData.profile_picture || null,
      phone_number: formData.phone_number || null,
      location: formData.location || null,
      company: formData.company || null,
      job_role: formData.job_role || null,
      bio: formData.bio || null,
    })
    setIsEditing(false)
  }

  const handleCancel = () => {
    setFormData({
      email: user?.email || "",
      username: user?.username || user?.email?.split("@")[0] || "",
      profile_picture: user?.profile_picture || "",
      phone_number: user?.phone_number || "",
      location: user?.location || "",
      company: user?.company || "",
      job_role: user?.job_role || "",
      bio: user?.bio || "",
    })
    setIsEditing(false)
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl p-6 border border-border bg-card shadow-sm dark:shadow-[0_12px_40px_rgba(0,0,0,0.35)]"
      >
        <div className="pointer-events-none absolute inset-0 opacity-[0.06] dark:opacity-[0.14] bg-[radial-gradient(circle_at_20%_10%,hsl(var(--primary))_0%,transparent_55%)]" />
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-3 rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
              <User className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">User Profile</h1>
              <p className="text-muted-foreground">Manage your account information and preferences</p>
            </div>
          </div>
          <div className="flex space-x-3">
            {isEditing ? (
              <>
                <button
                  onClick={handleSave}
                  className="!bg-emerald-400 hover:!bg-emerald-500 text-black dark:text-white px-4 py-2 rounded-xl flex items-center space-x-2 transition-colors shadow-sm ring-1 ring-emerald-600/20"
                >
                  <Save className="h-4 w-4" />
                  <span>Save</span>
                </button>
                <button
                  onClick={handleCancel}
                  className="!bg-rose-300 hover:!bg-rose-400 text-black dark:text-white px-4 py-2 rounded-xl flex items-center space-x-2 transition-colors shadow-sm ring-1 ring-rose-600/20"
                >
                  <X className="h-4 w-4" />
                  <span>Cancel</span>
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="!bg-primary text-primary-foreground hover:!bg-primary/90 px-4 py-2 rounded-xl flex items-center space-x-2 transition-all shadow-sm ring-1 ring-primary/15"
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
          className="rounded-2xl p-6 border border-border bg-card shadow-sm dark:shadow-[0_12px_40px_rgba(0,0,0,0.35)]"
        >
          <div className="text-center">
            <div className="relative inline-block mb-4">
              <div className="w-24 h-24 rounded-full overflow-hidden bg-muted flex items-center justify-center mx-auto border border-border ring-4 ring-primary/10">
                {formData.profile_picture ? (
                  <img src={formData.profile_picture} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl font-semibold text-foreground/70">{fallbackInitials}</span>
                )}
              </div>
              {isEditing && (
                <button
                  onClick={handlePickPhoto}
                  type="button"
                  className="absolute bottom-0 right-0 bg-primary rounded-full p-2 hover:bg-primary/90 transition-colors border border-border shadow-sm"
                  aria-label="Change profile photo"
                >
                  <Camera className="h-4 w-4 text-white" />
                </button>
              )}
            </div>
            <h2 className="text-xl font-bold mb-1">{formData.username || "—"}</h2>
            <p className="text-muted-foreground">{formData.job_role || "—"}</p>
          </div>

          <div className="mt-6 space-y-3">
            <div className="flex items-center space-x-3 text-muted-foreground">
              <Mail className="h-4 w-4" />
              <span className="text-sm break-all">{formData.email}</span>
            </div>
            <div className="flex items-center space-x-3 text-muted-foreground">
              <Phone className="h-4 w-4" />
              <span className="text-sm">{formData.phone_number || "—"}</span>
            </div>
            <div className="flex items-center space-x-3 text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span className="text-sm">{formData.location || "—"}</span>
            </div>
            <div className="flex items-center space-x-3 text-muted-foreground">
              <Building2 className="h-4 w-4" />
              <span className="text-sm">{formData.company || "—"}</span>
            </div>
          </div>
        </motion.div>

        {/* Profile Details */}
        <div className="lg:col-span-2 space-y-6">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-2xl p-6 border border-border bg-card shadow-sm dark:shadow-[0_12px_40px_rgba(0,0,0,0.35)]"
          >
            <h3 className="text-lg font-bold mb-6">Personal Information</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-muted-foreground text-sm font-medium mb-2">Email Address (view-only)</label>
                <p className="rounded-xl p-3 bg-muted/40 dark:bg-muted/25 border border-border text-sm break-all">{formData.email}</p>
              </div>

              <div>
                <label className="block text-muted-foreground text-sm font-medium mb-2">Username</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => handleInputChange("username", e.target.value)}
                    className="w-full rounded-xl p-3 appearance-none bg-white text-black border border-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 dark:!bg-white dark:!text-black dark:!border-slate-200 dark:placeholder:text-slate-500 caret-black"
                  />
                ) : (
                  <p className="rounded-xl p-3 bg-muted/40 dark:bg-muted/25 border border-border">{formData.username || "—"}</p>
                )}
              </div>

              <div>
                <label className="block text-muted-foreground text-sm font-medium mb-2">Phone Number</label>
                {isEditing ? (
                  <input
                    type="tel"
                    value={formData.phone_number}
                    onChange={(e) => handleInputChange("phone_number", e.target.value)}
                    className="w-full rounded-xl p-3 appearance-none bg-white text-black border border-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 dark:!bg-white dark:!text-black dark:!border-slate-200 dark:placeholder:text-slate-500 caret-black"
                  />
                ) : (
                  <p className="rounded-xl p-3 bg-muted/40 dark:bg-muted/25 border border-border">{formData.phone_number || "—"}</p>
                )}
              </div>

              <div>
                <label className="block text-muted-foreground text-sm font-medium mb-2">Location</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => handleInputChange("location", e.target.value)}
                    className="w-full rounded-xl p-3 appearance-none bg-white text-black border border-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 dark:!bg-white dark:!text-black dark:!border-slate-200 dark:placeholder:text-slate-500 caret-black"
                  />
                ) : (
                  <p className="rounded-xl p-3 bg-muted/40 dark:bg-muted/25 border border-border">{formData.location || "—"}</p>
                )}
              </div>

              <div>
                <label className="block text-muted-foreground text-sm font-medium mb-2">Company</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={formData.company}
                    onChange={(e) => handleInputChange("company", e.target.value)}
                    className="w-full rounded-xl p-3 appearance-none bg-white text-black border border-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 dark:!bg-white dark:!text-black dark:!border-slate-200 dark:placeholder:text-slate-500 caret-black"
                  />
                ) : (
                  <p className="rounded-xl p-3 bg-muted/40 dark:bg-muted/25 border border-border">{formData.company || "—"}</p>
                )}
              </div>

              <div>
                <label className="block text-muted-foreground text-sm font-medium mb-2">Job Role</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={formData.job_role}
                    onChange={(e) => handleInputChange("job_role", e.target.value)}
                    className="w-full rounded-xl p-3 appearance-none bg-white text-black border border-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 dark:!bg-white dark:!text-black dark:!border-slate-200 dark:placeholder:text-slate-500 caret-black"
                  />
                ) : (
                  <p className="rounded-xl p-3 bg-muted/40 dark:bg-muted/25 border border-border flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-muted-foreground" />
                    <span>{formData.job_role || "—"}</span>
                  </p>
                )}
              </div>
            </div>

            <div className="mt-6">
              <label className="block text-muted-foreground text-sm font-medium mb-2">Bio</label>
              {isEditing ? (
                <textarea
                  value={formData.bio}
                  onChange={(e) => handleInputChange("bio", e.target.value)}
                  rows={4}
                  className="w-full rounded-xl p-3 appearance-none bg-white text-black border border-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 dark:!bg-white dark:!text-black dark:!border-slate-200 dark:placeholder:text-slate-500 caret-black"
                />
              ) : (
                <p className="rounded-xl p-3 bg-muted/40 dark:bg-muted/25 border border-border whitespace-pre-wrap">{formData.bio || "—"}</p>
              )}
            </div>
          </motion.div>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handlePhotoSelected(e.target.files?.[0])}
          />
        </div>
      </div>
      </div>
    </div>
  )
}

export default UserProfilePage