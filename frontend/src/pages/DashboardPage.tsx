import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Shield, Activity, AlertTriangle, CheckCircle, Zap, Search, Code, Database, Clock, Lock, Eye } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

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
      color: "purple-500",
      path: "/dashboard/model-poisoning",
    },
    {
      title: "Vector Analysis",
      description: "Check embedding vulnerabilities",
      icon: Eye,
      color: "teal-500",
      path: "/dashboard/vector-embeddings",
    },
    {
      title: "Code Scanner",
      description: "Scan C/C++ code for security issues",
      icon: Code,
      color: "yellow-500",
      path: "/dashboard/code-scanner",
    },
  ]

  return (
    <div className="space-y-6 relative">
      {/* Welcome Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-gradient-to-r from-slate-800/80 via-slate-700/80 to-purple-800/80 rounded-xl p-8 border border-purple-500/40 shadow-2xl backdrop-blur-sm"
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-white via-teal-100 to-purple-200 bg-clip-text text-transparent mb-3">
              Welcome back, {user?.name || 'User'}!
            </h1>
            <p className="text-slate-300 text-lg">
              Your security dashboard is ready. Monitor threats and run scans.
            </p>
          </div>
          <div className="hidden md:block">
            <div className="w-20 h-20 bg-gradient-to-br from-teal-400/80 via-purple-500/80 to-red-500/80 rounded-full flex items-center justify-center shadow-lg animate-pulse backdrop-blur-sm">
              <Shield className="w-10 h-10 text-white" />
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { icon: Activity, value: stats.totalScans, label: "Total Scans", bgColor: "from-teal-400/60 to-teal-600/80", textColor: "text-teal-300", iconBg: "bg-teal-500/30", borderColor: "border-teal-400/50", delay: 0.1 },
          { icon: AlertTriangle, value: stats.highRisk, label: "High Risk", bgColor: "from-red-400/60 to-red-600/80", textColor: "text-red-300", iconBg: "bg-red-500/30", borderColor: "border-red-400/50", delay: 0.2 },
          { icon: Clock, value: stats.mediumRisk, label: "Medium Risk", bgColor: "from-green-400/60 to-green-600/80", textColor: "text-green-300", iconBg: "bg-green-500/30", borderColor: "border-green-400/50", delay: 0.3 },
          { icon: CheckCircle, value: stats.lowRisk, label: "Low Risk", bgColor: "from-yellow-400/60 to-yellow-600/80", textColor: "text-yellow-300", iconBg: "bg-yellow-500/30", borderColor: "border-yellow-400/50", delay: 0.4 },
        ].map((stat, index) => {
          const IconComponent = stat.icon
          return (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: stat.delay }}
              className={`bg-gradient-to-br ${stat.bgColor} rounded-xl p-6 border ${stat.borderColor} hover:shadow-xl transition-all duration-300 transform hover:scale-105`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-200 text-sm font-semibold uppercase tracking-wide">{stat.label}</p>
                  <p className={`text-3xl font-bold ${stat.textColor} mt-2`}>{stat.value}</p>
                </div>
                <div className={`p-4 ${stat.iconBg} rounded-xl backdrop-blur-sm`}>
                  <IconComponent className={`w-8 h-8 ${stat.textColor}`} />
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.5 }}
        className="bg-gradient-to-br from-slate-800 via-slate-700 to-slate-800 rounded-xl p-8 border border-slate-600/50 shadow-2xl backdrop-blur-sm"
      >
        <h2 className="text-2xl font-bold bg-gradient-to-r from-white via-teal-200 to-purple-300 bg-clip-text text-transparent mb-8 flex items-center">
          Quick Actions
          <motion.div className="ml-4">
            <div className="w-8 h-8 rounded-full border-3 border-teal-400/40 animate-pulse shadow-lg" />
          </motion.div>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { ...quickActions[0], bgGradient: "from-red-400/70 to-red-600/80", hoverGradient: "from-red-300/80 to-red-500/90", iconColor: "text-red-200", borderColor: "border-red-400/60" },
            { ...quickActions[1], bgGradient: "from-purple-400/70 to-purple-600/80", hoverGradient: "from-purple-300/80 to-purple-500/90", iconColor: "text-purple-200", borderColor: "border-purple-400/60" },
            { ...quickActions[2], bgGradient: "from-teal-400/70 to-teal-600/80", hoverGradient: "from-teal-300/80 to-teal-500/90", iconColor: "text-teal-200", borderColor: "border-teal-400/60" },
            { ...quickActions[3], bgGradient: "from-yellow-400/70 to-yellow-600/80", hoverGradient: "from-yellow-300/80 to-yellow-500/90", iconColor: "text-yellow-200", borderColor: "border-yellow-400/60" },
          ].map((action, index) => {
            const IconComponent = action.icon
            return (
              <motion.button
                key={index}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: 0.6 + index * 0.1 }}
                whileHover={{ scale: 1.08, y: -5 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => navigate(action.path)}
                className={`bg-gradient-to-br ${action.bgGradient} hover:bg-gradient-to-br hover:${action.hoverGradient} rounded-xl p-6 border ${action.borderColor} hover:shadow-2xl transition-all duration-300 text-left group transform hover:rotate-1`}
              >
                <div className={`p-4 bg-white/10 rounded-xl w-fit mb-4 group-hover:bg-white/20 transition-all duration-300 backdrop-blur-sm`}>
                  <IconComponent className={`w-8 h-8 ${action.iconColor} group-hover:scale-110 transition-transform duration-300`} />
                </div>
                <h3 className="text-white font-bold mb-3 text-lg group-hover:text-slate-100">{action.title}</h3>
                <p className="text-slate-300 text-sm group-hover:text-slate-200">{action.description}</p>
              </motion.button>
            )
          })}
        </div>
      </motion.div>
    </div>
  )
}

export default Dashboard
