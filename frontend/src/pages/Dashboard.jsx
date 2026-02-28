
import { useState } from "react"
import { motion } from "framer-motion"
import { useNavigate } from "react-router-dom"
import { Shield, Lock, Eye, Code, BarChart3, Clock, CheckCircle, AlertTriangle } from "lucide-react"
import { useAuth } from "../contexts/AuthContext"
import { FloatingParticles, RadarPulse } from "../components/dashboard/CyberAnimations"

const Dashboard = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState({
    totalScans: 12,
    highRisk: 3,
    mediumRisk: 5,
    lowRisk: 4,
  })

  const quickActions = [
    {
      title: "Prompt Injection Scan",
      description: "Quick security scan for prompt injections",
      icon: Shield,
      color: "red-500",
      path: "/dashboard/prompt-injection",
    },
    {
      title: "Model Poisoning Check",
      description: "Analyze model for poisoning attacks",
      icon: Lock,
      color: "green-500",
      path: "/dashboard/model-poisoning",
    },
    {
      title: "Vector Analysis",
      description: "Check embedding vulnerabilities",
      icon: Eye,
      color: "purple-600",
      path: "/dashboard/vector-embeddings",
    },
    {
      title: "Code Scanner",
      description: "Scan C/C++ code for security issues",
      icon: Code,
      color: "green-600",
      path: "/dashboard/code-scanner",
    },
  ]

  return (
    <div className="space-y-6 relative">
      <FloatingParticles count={25} />

      {/* Welcome Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-purple-900/80 to-pink-900/60 rounded-lg p-6 border border-purple-700/60 relative overflow-hidden"
      >
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-purple-600/10 via-transparent to-green-600/10"
          animate={{
            x: ["-100%", "100%"],
          }}
          transition={{
            duration: 8,
            repeat: Number.POSITIVE_INFINITY,
            ease: "linear",
          }}
        />

        <div className="relative z-10">
          <h1 className="text-3xl font-bold text-white mb-2">
            Welcome back, <span className="text-purple-400">{user?.name}</span>
          </h1>
          <p className="text-gray-300">Monitor your AI security and run comprehensive scans</p>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { icon: BarChart3, value: stats.totalScans, label: "Total Scans", color: "purple-600", delay: 0.1 },
          { icon: AlertTriangle, value: stats.highRisk, label: "High Risk", color: "red-600", delay: 0.2 },
          { icon: Clock, value: stats.mediumRisk, label: "Medium Risk", color: "yellow-600", delay: 0.3 },
          { icon: CheckCircle, value: stats.lowRisk, label: "Low Risk", color: "green-600", delay: 0.4 },
        ].map((stat, index) => {
          const IconComponent = stat.icon
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: stat.delay }}
              className="bg-gradient-to-br from-purple-900/80 to-pink-900/60 rounded-lg p-6 border border-purple-700/60 relative overflow-hidden group"
              whileHover={{
                scale: 1.05,
                borderColor: `rgb(${stat.color === "red-600" ? "220 38 38" : stat.color === "yellow-600" ? "202 138 4" : stat.color === "green-600" ? "22 163 74" : "37 99 235"})`,
                boxShadow: `0 10px 25px -5px rgba(${stat.color === "red-600" ? "220, 38, 38" : stat.color === "yellow-600" ? "202, 138, 4" : stat.color === "green-600" ? "22, 163, 74" : "37, 99, 235"}, 0.3)`,
              }}
            >
              <motion.div
                className={`absolute inset-0 bg-gradient-to-br from-${stat.color}/10 to-transparent opacity-0 group-hover:opacity-100`}
                transition={{ duration: 0.3 }}
              />

              <div className="flex items-center space-x-3 relative z-10">
                <motion.div
                  className={`p-3 bg-${stat.color} rounded-lg`}
                  whileHover={{ rotate: 360 }}
                  transition={{ duration: 0.6 }}
                >
                  <IconComponent className="h-6 w-6 text-white" />
                </motion.div>
                <div>
                  <motion.p
                    className="text-2xl font-bold text-white"
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
                  >
                    {stat.value}
                  </motion.p>
                  <p className="text-gray-400">{stat.label}</p>
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Quick Actions */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
        <h2 className="text-2xl font-bold text-white mb-6 flex items-center">
          Quick Actions
          <motion.div className="ml-3">
            <RadarPulse size="w-6 h-6" color="purple" />
          </motion.div>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {quickActions.map((action, index) => {
            const IconComponent = action.icon
            return (
              <motion.div
                key={action.title}
                className={`bg-gradient-to-br from-purple-900/80 to-pink-900/60 rounded-lg p-6 border border-purple-700/60 cursor-pointer hover:border-${action.color} transition-all duration-300 group relative overflow-hidden`}
                whileHover={{ scale: 1.02, y: -2 }}
                onClick={() => navigate(action.path)}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 + index * 0.1 }}
              >
                <motion.div
                  className={`absolute inset-0 bg-gradient-to-br from-${action.color}/20 to-transparent opacity-0 group-hover:opacity-100`}
                  transition={{ duration: 0.3 }}
                />

                <motion.div
                  className={`absolute top-0 left-0 h-0.5 w-full bg-gradient-to-r from-transparent via-${action.color} to-transparent opacity-0 group-hover:opacity-100`}
                  initial={{ x: "-100%" }}
                  whileHover={{ x: "100%" }}
                  transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY }}
                />

                <div className="relative z-10">
                  <motion.div
                    className={`p-3 bg-${action.color}/20 rounded-lg mb-4 group-hover:bg-${action.color}/30 transition-colors`}
                    whileHover={{ rotate: [0, -10, 10, 0] }}
                    transition={{ duration: 0.5 }}
                  >
                    <IconComponent className={`h-6 w-6 text-${action.color}`} />
                  </motion.div>
                  <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-purple-400 transition-colors">
                    {action.title}
                  </h3>
                  <p className="text-gray-400 text-sm">{action.description}</p>
                </div>
              </motion.div>
            )
          })}
        </div>
      </motion.div>
    </div>
  )
}

export default Dashboard