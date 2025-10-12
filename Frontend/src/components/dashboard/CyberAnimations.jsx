
import { motion } from "framer-motion"
import { useEffect, useState } from "react"

// Scanning Line Animation Component
export const ScanningLine = ({ isActive = false, color = "red" }) => {
  return (
    <div className="relative overflow-hidden">
      {isActive && (
        <motion.div
          className={`absolute top-0 left-0 h-0.5 w-full bg-gradient-to-r from-transparent via-${color}-500 to-transparent`}
          initial={{ x: "-100%" }}
          animate={{ x: "100%" }}
          transition={{
            duration: 2,
            repeat: Number.POSITIVE_INFINITY,
            ease: "linear",
          }}
        />
      )}
    </div>
  )
}

// Radar Pulse Animation
export const RadarPulse = ({ size = "w-16 h-16", color = "purple" }) => {
  return (
    <div className={`relative ${size} rounded-full border-2 border-${color}-500/30`}>
      <motion.div
        className={`absolute inset-0 rounded-full border-2 border-${color}-500`}
        animate={{
          scale: [1, 1.5, 1],
          opacity: [1, 0, 1],
        }}
        transition={{
          duration: 2,
          repeat: Number.POSITIVE_INFINITY,
          ease: "easeInOut",
        }}
      />
      <motion.div
        className={`absolute inset-2 rounded-full bg-${color}-500/20`}
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.5, 0.8, 0.5],
        }}
        transition={{
          duration: 2,
          repeat: Number.POSITIVE_INFINITY,
          ease: "easeInOut",
          delay: 0.5,
        }}
      />
    </div>
  )
}

// Glitch Effect
export const GlitchText = ({ children, isActive = false }) => {
  return (
    <motion.div
      className="relative"
      animate={
        isActive
          ? {
              x: [0, -2, 2, 0],
              textShadow: ["0 0 0 transparent", "2px 0 0 #ff0000, -2px 0 0 #00ffff", "0 0 0 transparent"],
            }
          : {}
      }
      transition={{
        duration: 0.3,
        repeat: isActive ? Number.POSITIVE_INFINITY : 0,
        repeatDelay: 2,
      }}
    >
      {children}
    </motion.div>
  )
}

// Terminal Cursor Animation
export const TerminalCursor = () => {
  return (
    <motion.span
      className="inline-block w-2 h-5 bg-green-400 ml-1"
      animate={{ opacity: [1, 0, 1] }}
      transition={{
        duration: 1,
        repeat: Number.POSITIVE_INFINITY,
        ease: "linear",
      }}
    />
  )
}

// Floating Particles Background
export const FloatingParticles = ({ count = 20 }) => {
  const [particles, setParticles] = useState([])

  useEffect(() => {
    const newParticles = Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 3 + 1,
      duration: Math.random() * 10 + 10,
    }))
    setParticles(newParticles)
  }, [count])

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className="absolute rounded-full bg-purple-400/20"
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            width: `${particle.size}px`,
            height: `${particle.size}px`,
          }}
          animate={{
            y: [0, -20, 0],
            x: [0, 10, -10, 0],
            opacity: [0.2, 0.8, 0.2],
          }}
          transition={{
            duration: particle.duration,
            repeat: Number.POSITIVE_INFINITY,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  )
}

// Matrix Rain Effect
export const MatrixRain = ({ columns = 10 }) => {
  const [drops, setDrops] = useState([])

  useEffect(() => {
    const newDrops = Array.from({ length: columns }, (_, i) => ({
      id: i,
      x: (i * 100) / columns,
      chars: Array.from({ length: 20 }, () => String.fromCharCode(0x30a0 + Math.random() * 96)),
    }))
    setDrops(newDrops)
  }, [columns])

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-10">
      {drops.map((drop) => (
        <motion.div
          key={drop.id}
          className="absolute text-green-400 text-xs font-mono"
          style={{ left: `${drop.x}%` }}
          animate={{
            y: ["-100%", "100%"],
          }}
          transition={{
            duration: Math.random() * 3 + 2,
            repeat: Number.POSITIVE_INFINITY,
            ease: "linear",
            delay: Math.random() * 2,
          }}
        >
          {drop.chars.map((char, index) => (
            <div key={index} className="opacity-80">
              {char}
            </div>
          ))}
        </motion.div>
      ))}
    </div>
  )
}

// Default export for backward compatibility
const CyberAnimations = {
  ScanningLine,
  RadarPulse,
  TerminalCursor,
  FloatingParticles,
  MatrixRain,
  GlitchText
}

export default CyberAnimations
