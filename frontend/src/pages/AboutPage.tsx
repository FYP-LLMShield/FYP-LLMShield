import React from 'react';
import { motion } from 'framer-motion';

const AboutPage: React.FC = () => {
  return (
    <div className="relative min-h-screen bg-gradient-to-b from-[#0a0a0a] via-gray-900 to-[#0a0a0a] transition-colors duration-300 overflow-hidden pt-28 pb-16">
      {/* Animated Background - Scattered Glow Lights */}
      <div className="absolute inset-0 overflow-hidden z-10">
        {/* Desktop: 120 lights total, Mobile: 30 lights */}
        {Array.from({ length: 120 }).map((_, i) => {
          const size = [8, 12, 16, 20][Math.floor(Math.random() * 4)];
          const animationDuration = [4, 6, 8][Math.floor(Math.random() * 3)];
          const delay = Math.random() * 6;
          let x = Math.random() * 100;
          
          let y;
          // First 25 lights: Header area (0-12%)
          if (i < 25) {
            y = Math.random() * 12;
          }
          // Next 3 lights: Above title horizontal line (12-15%)
          else if (i < 28) {
            y = 12 + Math.random() * 3;
          }
          // Next 32 lights: Main content section (15-45%)
          else if (i < 60) {
            y = 15 + Math.random() * 30;
            // Move 3 lights to right side (85-100% x position)
            if (i >= 57) {
              x = 85 + Math.random() * 15;
            }
          }
          // Next 8 lights: Middle transition (45-50%)
          else if (i < 68) {
            y = 45 + Math.random() * 5;
          }
          // Next 35 lights: Middle area (50-75%)
          else if (i < 103) {
            y = 50 + Math.random() * 25;
          }
          // Next 8 lights: Lower transition (75-80%)
          else if (i < 111) {
            y = 75 + Math.random() * 5;
          }
          // Last 9 lights: Bottom area (80-100%)
          else {
            y = 80 + Math.random() * 20;
          }
          
          return (
            <div
              key={i}
              className={`absolute rounded-full animate-float-${animationDuration} hover:animate-pulse transition-all duration-300 cursor-pointer ${i >= 20 ? 'hidden lg:block' : ''}`}
              style={{
                width: `${size}px`,
                height: `${size}px`,
                left: `${x}%`,
                top: `${y}%`,
                animationDelay: `${delay}s`,
                transform: 'translate3d(0, 0, 0)',
                willChange: 'transform, opacity',
                background: 'radial-gradient(circle, rgba(20, 184, 166, 0.9) 0%, rgba(6, 182, 212, 0.7) 50%, rgba(20, 184, 166, 0.3) 100%)',
                boxShadow: `0 0 ${size * 2}px rgba(20, 184, 166, 1), 0 0 ${size * 4}px rgba(20, 184, 166, 0.8), 0 0 ${size * 6}px rgba(20, 184, 166, 0.6), 0 0 ${size * 8}px rgba(20, 184, 166, 0.4)`,
                filter: `drop-shadow(0 0 ${size}px rgba(20, 184, 166, 0.7))`,
                opacity: 1
              }}
              onMouseEnter={(e) => {
                 // Random movement on hover
                 const moveX = Math.random() * 30 - 15;
                 const moveY = Math.random() * 30 - 15;
                 e.currentTarget.style.transform = `translate3d(${moveX}px, ${moveY}px, 0) scale(1.3)`;
                 e.currentTarget.style.filter = `drop-shadow(0 0 ${size * 3}px rgba(20, 184, 166, 1)) brightness(1.8)`;
                 e.currentTarget.classList.add('light-flicker');
                 
                 // Stop original animation temporarily
                 e.currentTarget.style.animation = 'none';
                 
                 // Restart animation after flicker
                 setTimeout(() => {
                   e.currentTarget.style.animation = `float-${animationDuration} ${animationDuration}s ease-in-out infinite`;
                   e.currentTarget.classList.remove('light-flicker');
                 }, 300);
               }}
               onMouseLeave={(e) => {
                 e.currentTarget.style.transform = 'translate3d(0, 0, 0) scale(1)';
                 e.currentTarget.style.filter = `drop-shadow(0 0 ${size}px rgba(20, 184, 166, 0.7))`;
                 e.currentTarget.classList.remove('light-flicker');
               }}
            />
          );
        })}
      </div>
      
      {/* Content */}
      <div className="relative z-20 pt-10 pb-20 px-4">
        <div className="container mx-auto max-w-4xl">
          {/* Page Header */}
          <motion.div 
            className="text-center mb-24"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-gray-900 dark:text-white">About LLMShield</h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              A unified threat detection platform for mitigating prompt injection, model poisoning, and RAG embedding risks in LLM and AI systems
            </p>
          </motion.div>

          {/* Team — Supervisor & Developers */}
          <motion.div
            className="relative bg-gradient-to-br from-cyan-500/20 via-sky-500/15 to-indigo-500/10 backdrop-blur-lg rounded-2xl p-8 mb-12 border border-cyan-400/30 shadow-2xl overflow-hidden group"
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.05 }}
            whileHover={{
              scale: 1.02,
              boxShadow: '0 25px 50px -12px rgba(6, 182, 212, 0.25)',
              transition: { duration: 0.3 },
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 to-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative z-10">
              <motion.div
                className="flex items-center mb-8"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
              >
                <div className="w-12 h-12 bg-gradient-to-br from-cyan-400 to-indigo-500 rounded-xl flex items-center justify-center mr-4 shadow-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white bg-gradient-to-r from-cyan-400 to-indigo-400 bg-clip-text text-transparent">
                  Team
                </h2>
              </motion.div>

              <motion.h3
                className="text-sm font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-300 mb-4"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.15 }}
              >
                Supervisor
              </motion.h3>
              <motion.div
                className="rounded-3xl p-6 md:p-8 ring-1 ring-gray-200 dark:ring-gray-800 bg-gray-900/80 dark:bg-black/60 relative overflow-hidden group/supervisor transition-all duration-500 hover:ring-2 hover:ring-indigo-400/40 hover:shadow-2xl hover:shadow-indigo-500/10 mb-10"
                initial={{ opacity: 0, y: 20, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.6, delay: 0.2, type: 'spring', stiffness: 100 }}
                whileHover={{ scale: 1.01 }}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/15 to-violet-500/10 opacity-0 group-hover/supervisor:opacity-100 transition-opacity duration-500" />
                <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 shrink-0 bg-gradient-to-br from-indigo-400 to-violet-500 rounded-xl flex items-center justify-center shadow-lg">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Dr. Muhammad Arif Butt</h4>
                      <a
                        href="mailto:arif@pucit.edu.pk"
                        className="text-sm text-teal-600 dark:text-teal-300 hover:text-indigo-400 dark:hover:text-indigo-200 underline-offset-2 hover:underline transition-colors"
                      >
                        arif@pucit.edu.pk
                      </a>
                    </div>
                  </div>
                </div>
              </motion.div>

              <motion.h3
                className="text-sm font-semibold uppercase tracking-wider text-cyan-600 dark:text-cyan-300 mb-4"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.45 }}
              >
                Developers
              </motion.h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                {[
                  { name: 'Alisha Shahid', email: 'alishashahidkhan77@gmail.com', gradient: 'from-cyan-400 to-teal-400' },
                  { name: 'Um e Abeeha', email: 'umeabeeha4582@gmail.com', gradient: 'from-sky-400 to-blue-400' },
                  { name: 'Khalood Sami', email: 'khaloodsami070@gmail.com', gradient: 'from-indigo-400 to-violet-400' },
                ].map((dev, index) => (
                  <motion.div
                    key={dev.email}
                    className="rounded-3xl p-6 ring-1 ring-gray-200 dark:ring-gray-800 bg-gray-900/80 dark:bg-black/60 relative flex flex-col transition-all duration-500 hover:scale-[1.02] hover:shadow-2xl hover:ring-2 hover:ring-cyan-400/40 hover:shadow-cyan-500/10 cursor-default group/person overflow-hidden"
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.55, delay: 0.5 + index * 0.1, type: 'spring', stiffness: 100 }}
                    whileHover={{ y: -4, transition: { duration: 0.3 } }}
                  >
                    <div className={`absolute left-0 top-0 bottom-0 w-2 bg-gradient-to-b ${dev.gradient} rounded-l-xl group-hover/person:w-3 transition-all duration-300`} />
                    <div className="pl-2 relative z-10">
                      <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{dev.name}</h4>
                      <a
                        href={`mailto:${dev.email}`}
                        className="text-sm text-teal-600 dark:text-teal-300 hover:text-cyan-400 dark:hover:text-cyan-200 break-all underline-offset-2 hover:underline transition-colors"
                      >
                        {dev.email}
                      </a>
                    </div>
                    <div className="absolute top-2 right-2 w-2 h-2 bg-cyan-400 rounded-full opacity-0 group-hover/person:opacity-100 group-hover/person:animate-ping transition-opacity duration-300" />
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
          
          {/* Mission Section */}
          <motion.div 
            className="relative bg-gradient-to-br from-teal-500/20 via-blue-500/15 to-purple-500/10 backdrop-blur-lg rounded-2xl p-8 mb-12 border border-teal-400/30 shadow-2xl overflow-hidden group"
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            whileHover={{ 
              scale: 1.02,
              boxShadow: "0 25px 50px -12px rgba(20, 184, 166, 0.25)",
              transition: { duration: 0.3 }
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-teal-500/5 to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="relative z-10">
              <motion.div 
                className="flex items-center mb-6"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
              >
                <div className="w-12 h-12 bg-gradient-to-br from-teal-400 to-blue-500 rounded-xl flex items-center justify-center mr-4 shadow-lg">
                  <svg className="w-6 h-6 text-gray-900 dark:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.031 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white bg-gradient-to-r from-teal-400 to-blue-400 bg-clip-text text-transparent">Our Mission</h2>
              </motion.div>
              <motion.p 
                className="text-gray-700 dark:text-gray-200 mb-6 text-lg leading-relaxed"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
              >
                LLMShield helps security teams and developers test and harden AI applications. It detects prompt injection and jailbreaks, analyzes vector stores and document embeddings for poisoning, scans code for secrets and C/C++ vulnerabilities, and supports dataset/model poisoning evaluation—all from a single dashboard with optional MFA and email verification.
              </motion.p>
              <motion.p 
                className="text-gray-700 dark:text-gray-200 text-lg leading-relaxed"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.5 }}
              >
                Built with FastAPI, React, TypeScript, and MongoDB, LLMShield provides a production-ready platform for AI security testing. Optional integrations include Supabase for email/auth, Qdrant for vector stores, and Docker for deployment.
              </motion.p>
            </div>
          </motion.div>
          
          {/* Problems We Solve */}
          <motion.div 
            className="relative bg-gradient-to-br from-blue-500/20 via-teal-500/15 to-indigo-500/10 backdrop-blur-lg rounded-2xl p-8 mb-12 border border-blue-400/30 shadow-2xl overflow-hidden group"
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            whileHover={{ 
              scale: 1.02,
              boxShadow: "0 25px 50px -12px rgba(59, 130, 246, 0.25)",
              transition: { duration: 0.3 }
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-teal-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="relative z-10">
              <motion.div 
                className="flex items-center mb-8"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
              >
                <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-teal-500 rounded-xl flex items-center justify-center mr-4 shadow-lg">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white bg-gradient-to-r from-blue-400 to-teal-400 bg-clip-text text-transparent">Problems We Solve</h2>
              </motion.div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 px-4 md:px-0">
                {[
                  {
                    title: "Prompt Injection Attacks",
                    description: "We protect against malicious inputs designed to manipulate AI systems into performing unintended actions or revealing sensitive information.",
                    color: "from-teal-400 to-cyan-400",
                    icon: "⚡"
                  },
                  {
                    title: "Model Poisoning",
                    description: "We detect and prevent attempts to corrupt training data, which can lead to biased, harmful, or compromised AI behavior.",
                    color: "from-blue-400 to-indigo-400",
                    icon: "🛡️"
                  },
                  {
                    title: "RAG Embedding Vulnerabilities",
                    description: "We secure retrieval-augmented generation systems by ensuring the integrity of vector embeddings and preventing similarity-based attacks.",
                    color: "from-purple-400 to-pink-400",
                    icon: "🔍"
                  },
                  {
                    title: "Code Vulnerabilities",
                    description: "We identify security flaws in C/C++ code that could be exploited in AI-adjacent systems, preventing potential backdoors.",
                    color: "from-emerald-400 to-teal-400",
                    icon: "💻"
                  }
                ].map((problem, index) => (
                  <motion.div
                    key={problem.title}
                    className="rounded-3xl p-6 ring-1 ring-gray-200 dark:ring-gray-800 bg-gray-900/80 dark:bg-black/60 relative flex flex-col transition-all duration-500 hover:scale-105 hover:shadow-2xl hover:ring-2 hover:ring-accent-teal/50 hover:shadow-accent-teal/10 cursor-pointer group/card overflow-hidden"
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.6, delay: 0.5 + index * 0.15, type: "spring", stiffness: 100 }}
                    whileHover={{ 
                      y: -8,
                      scale: 1.02,
                      boxShadow: "0 20px 40px rgba(20, 184, 166, 0.3), 0 0 30px rgba(20, 184, 166, 0.2)",
                      transition: { duration: 0.4, type: "spring", stiffness: 200 }
                    }}
                  >
                    {/* Enhanced glow effect */}
                     <div className="absolute inset-0 bg-gradient-to-br from-purple-500/25 via-pink-500/20 to-violet-500/25 opacity-0 group-hover/card:opacity-100 transition-opacity duration-500" />
                     <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-400/20 via-pink-400/15 to-violet-400/20 rounded-xl blur-xs opacity-0 group-hover/card:opacity-100 transition-opacity duration-500 -z-10" />
                    
                    <div className={`absolute left-0 top-0 bottom-0 w-2 bg-gradient-to-b ${problem.color} rounded-l-xl group-hover/card:w-3 transition-all duration-300`}></div>
                    <div className="flex items-start space-x-4 relative z-10">
                      <motion.div 
                        className="text-6xl p-3 rounded-lg bg-white/10 group-hover/card:bg-white/20 transition-all duration-300"
                        whileHover={{ scale: 1.1, rotate: 5 }}
                        transition={{ duration: 0.3 }}
                      >
                        {problem.icon}
                      </motion.div>
                      <div>
                        <h3 className="text-xl font-bold mb-3 text-gray-900 dark:text-white group-hover/card:text-transparent group-hover/card:bg-gradient-to-r group-hover/card:from-teal-300 group-hover/card:to-cyan-300 group-hover/card:bg-clip-text transition-all duration-300">{problem.title}</h3>
                        <p className="text-gray-600 dark:text-gray-300 group-hover/card:text-gray-500 dark:group-hover/card:text-gray-200 leading-relaxed transition-colors duration-300">{problem.description}</p>
                      </div>
                    </div>
                    
                    {/* Animated particles */}
                    <div className="absolute top-2 right-2 w-2 h-2 bg-teal-400 rounded-full opacity-0 group-hover/card:opacity-100 group-hover/card:animate-ping transition-opacity duration-300" />
                    <div className="absolute bottom-2 right-4 w-1 h-1 bg-cyan-400 rounded-full opacity-0 group-hover/card:opacity-100 group-hover/card:animate-pulse transition-opacity duration-300 delay-100" />
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
          
          {/* Architecture Section */}
          <motion.div 
            className="relative bg-gradient-to-br from-purple-500/20 via-indigo-500/15 to-teal-500/10 backdrop-blur-lg rounded-2xl p-8 mb-12 border border-purple-400/30 shadow-2xl overflow-hidden group"
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            whileHover={{ 
              scale: 1.02,
              boxShadow: "0 25px 50px -12px rgba(139, 92, 246, 0.25)",
              transition: { duration: 0.3 }
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 to-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="relative z-10">
              <motion.div 
                className="flex items-center mb-8"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.5 }}
              >
                <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-indigo-500 rounded-xl flex items-center justify-center mr-4 shadow-lg">
                  <svg className="w-6 h-6 text-gray-900 dark:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">Our Architecture</h2>
              </motion.div>
              <div className="flex flex-col lg:flex-row items-center gap-8">
                <motion.div 
                  className="lg:w-1/2"
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.6, delay: 0.6 }}
                >
                  <p className="text-gray-700 dark:text-gray-200 mb-6 text-lg leading-relaxed">
                    LLMShield uses a modular backend (FastAPI) with dedicated routes for auth, MFA, prompt injection, model/dataset poisoning, vector security, code scanning, and chatbot. The React frontend provides a unified dashboard with protected routes, model configuration, and scan history.
                  </p>
                  <p className="text-gray-700 dark:text-gray-200 text-lg leading-relaxed">
                    MongoDB stores data; optional Supabase handles email verification and password reset. Qdrant can be used for RAG chatbot vector storage. Docker Compose supports full-stack deployment.
                  </p>
                  <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 px-2 md:px-0">
                    <motion.div 
                      className="rounded-3xl p-6 ring-1 ring-gray-200 dark:ring-gray-800 bg-gray-900/80 dark:bg-black/60 relative flex flex-col transition-all duration-500 hover:scale-105 hover:shadow-2xl hover:ring-2 hover:ring-accent-teal/50 hover:shadow-accent-teal/10 cursor-pointer group/feature overflow-hidden"
                      whileHover={{ scale: 1.05, y: -2 }}
                      transition={{ duration: 0.3 }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-teal-400/25 to-cyan-400/15 opacity-0 group-hover/feature:opacity-100 transition-opacity duration-300" />
                      <motion.div 
                        className="text-5xl mb-2 group-hover/feature:scale-110 transition-transform duration-300"
                        whileHover={{ rotate: 10 }}
                      >
                        ⚡
                      </motion.div>
                      <div className="text-sm text-teal-600 dark:text-teal-300 font-bold group-hover/feature:text-teal-500 dark:group-hover/feature:text-teal-200 transition-colors duration-300">Real-time</div>
                      <div className="text-xs text-gray-600 dark:text-gray-300 group-hover/feature:text-gray-500 dark:group-hover/feature:text-gray-200 transition-colors duration-300">Detection</div>
                      <div className="absolute top-1 right-1 w-1 h-1 bg-teal-400 rounded-full opacity-0 group-hover/feature:opacity-100 group-hover/feature:animate-pulse transition-opacity duration-300" />
                    </motion.div>
                    <motion.div 
                      className="rounded-3xl p-6 ring-1 ring-gray-200 dark:ring-gray-800 bg-gray-900/80 dark:bg-black/60 relative flex flex-col transition-all duration-500 hover:scale-105 hover:shadow-2xl hover:ring-2 hover:ring-accent-teal/50 hover:shadow-accent-teal/10 cursor-pointer group/feature overflow-hidden"
                      whileHover={{ scale: 1.05, y: -2 }}
                      transition={{ duration: 0.3 }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-blue-400/25 to-purple-400/15 opacity-0 group-hover/feature:opacity-100 transition-opacity duration-300" />
                      <motion.div 
                        className="text-5xl mb-2 group-hover/feature:scale-110 transition-transform duration-300"
                        whileHover={{ rotate: -10 }}
                      >
                        🔄
                      </motion.div>
                      <div className="text-sm text-teal-600 dark:text-teal-300 font-bold group-hover/feature:text-teal-500 dark:group-hover/feature:text-teal-200 transition-colors duration-300">Scalable</div>
                      <div className="text-xs text-gray-600 dark:text-gray-300 group-hover/feature:text-gray-500 dark:group-hover/feature:text-gray-200 transition-colors duration-300">Architecture</div>
                      <div className="absolute top-1 right-1 w-1 h-1 bg-teal-400 rounded-full opacity-0 group-hover/feature:opacity-100 group-hover/feature:animate-pulse transition-opacity duration-300" />
                    </motion.div>
                  </div>
                </motion.div>
                <motion.div 
                  className="lg:w-1/2 bg-gradient-to-br from-white/5 to-white/10 backdrop-blur-sm p-6 rounded-xl border border-white/20"
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.6, delay: 0.7 }}
                >
                  <svg className="w-full" viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg">
                    {/* Enhanced architecture diagram */}
                    <defs>
                      <linearGradient id="tealGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#14b8a6" />
                        <stop offset="100%" stopColor="#0d9488" />
                      </linearGradient>
                      <linearGradient id="blueGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#3b82f6" />
                        <stop offset="100%" stopColor="#1e40af" />
                      </linearGradient>
                      <linearGradient id="purpleGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#8b5cf6" />
                        <stop offset="100%" stopColor="#7c3aed" />
                      </linearGradient>
                    </defs>
                    
                    <rect x="50" y="20" width="300" height="60" rx="10" fill="url(#tealGrad)" opacity="0.9" />
                    <text x="200" y="55" textAnchor="middle" className="fill-gray-900 dark:fill-white" fontSize="16" fontWeight="bold">LLMShield Security Layer</text>
                    
                    <rect x="50" y="120" width="130" height="50" rx="8" fill="url(#blueGrad)" opacity="0.9" />
                    <text x="115" y="150" textAnchor="middle" className="fill-gray-900 dark:fill-white" fontSize="14" fontWeight="600">Threat Detection</text>
                    
                    <rect x="220" y="120" width="130" height="50" rx="8" fill="url(#blueGrad)" opacity="0.9" />
                    <text x="285" y="150" textAnchor="middle" className="fill-gray-900 dark:fill-white" fontSize="14" fontWeight="600">Risk Analysis</text>
                    
                    <rect x="50" y="210" width="60" height="40" rx="6" fill="url(#purpleGrad)" opacity="0.9" />
                    <text x="80" y="235" textAnchor="middle" className="fill-gray-900 dark:fill-white" fontSize="12">Scanner 1</text>
                    
                    <rect x="130" y="210" width="60" height="40" rx="6" fill="url(#purpleGrad)" opacity="0.9" />
                    <text x="160" y="235" textAnchor="middle" className="fill-gray-900 dark:fill-white" fontSize="12">Scanner 2</text>
                    
                    <rect x="210" y="210" width="60" height="40" rx="6" fill="url(#purpleGrad)" opacity="0.9" />
                    <text x="240" y="235" textAnchor="middle" className="fill-gray-900 dark:fill-white" fontSize="12">Scanner 3</text>
                    
                    <rect x="290" y="210" width="60" height="40" rx="6" fill="url(#purpleGrad)" opacity="0.9" />
                    <text x="320" y="235" textAnchor="middle" className="fill-gray-900 dark:fill-white" fontSize="12">Scanner 4</text>
                    
                    {/* Enhanced connecting lines with glow */}
                    <line x1="200" y1="80" x2="200" y2="120" stroke="#14b8a6" strokeWidth="3" opacity="0.8" />
                    <line x1="115" y1="170" x2="115" y2="210" stroke="#14b8a6" strokeWidth="3" opacity="0.8" />
                    <line x1="160" y1="170" x2="160" y2="210" stroke="#14b8a6" strokeWidth="3" opacity="0.8" />
                    <line x1="115" y1="170" x2="160" y2="170" stroke="#14b8a6" strokeWidth="3" opacity="0.8" />
                    <line x1="285" y1="170" x2="285" y2="210" stroke="#14b8a6" strokeWidth="3" opacity="0.8" />
                    <line x1="240" y1="170" x2="240" y2="210" stroke="#14b8a6" strokeWidth="3" opacity="0.8" />
                    <line x1="240" y1="170" x2="285" y2="170" stroke="#14b8a6" strokeWidth="3" opacity="0.8" />
                    
                    {/* Data flow indicators */}
                    <circle cx="200" cy="100" r="3" fill="#14b8a6" opacity="0.8">
                      <animate attributeName="r" values="3;6;3" dur="2s" repeatCount="indefinite" />
                    </circle>
                  </svg>
                </motion.div>
              </div>
            </div>
          </motion.div>
          
          {/* Trust Markers */}
          <motion.div 
            className="relative bg-gradient-to-br from-emerald-500/20 via-teal-500/15 to-cyan-500/10 backdrop-blur-lg rounded-2xl p-8 border border-emerald-400/30 shadow-2xl overflow-hidden group"
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.4 }}
            whileHover={{ 
              scale: 1.02,
              boxShadow: "0 25px 50px -12px rgba(16, 185, 129, 0.25)",
              transition: { duration: 0.3 }
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 to-teal-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="relative z-10">
              <motion.div 
                className="flex items-center justify-center mb-8"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.6 }}
              >
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-xl flex items-center justify-center mr-4 shadow-lg">
                  <svg className="w-6 h-6 text-gray-900 dark:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">Built With</h2>
              </motion.div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6 mb-6 md:mb-8 px-2 md:px-0">
                {[
                  { name: "FastAPI", icon: "⚡", color: "from-teal-400 to-cyan-400" },
                  { name: "React", icon: "⚛️", color: "from-purple-400 to-violet-400" },
                  { name: "MongoDB", icon: "🍃", color: "from-purple-400 to-pink-400" },
                  { name: "TypeScript", icon: "📘", color: "from-emerald-400 to-teal-400" }
                ].map((company, index) => (
                  <motion.div
                    key={company.name}
                    className="rounded-3xl p-6 ring-1 ring-gray-200 dark:ring-gray-800 bg-gray-800/80 dark:bg-dark-secondary/80 relative flex flex-col transition-all duration-500 hover:scale-105 hover:shadow-2xl hover:ring-2 hover:ring-accent-teal/50 hover:shadow-accent-teal/10 cursor-pointer group/company overflow-hidden"
                    initial={{ opacity: 0, y: 20, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.6, delay: 0.7 + index * 0.15, type: "spring", stiffness: 120 }}
                    whileHover={{ 
                      y: -8,
                      scale: 1.05,
                      boxShadow: `0 20px 40px rgba(20, 184, 166, 0.25), 0 0 30px rgba(20, 184, 166, 0.15)`,
                      transition: { duration: 0.4, type: "spring", stiffness: 200 }
                    }}
                  >
                    {/* Enhanced glow effects */}
                     <div className={`absolute inset-0 bg-gradient-to-br ${company.color.replace('from-', 'from-').replace('to-', 'to-')}/20 opacity-0 group-hover/company:opacity-100 transition-opacity duration-500`} />
                     <div className={`absolute -inset-0.5 bg-gradient-to-r ${company.color}/15 rounded-xl blur-xs opacity-0 group-hover/company:opacity-100 transition-opacity duration-500 -z-10`} />
                    
                    <div className="text-center relative z-10">
                      <motion.div 
                        className="text-7xl mb-3 p-3 rounded-lg bg-white/10 group-hover/company:bg-white/20 transition-all duration-300 inline-block"
                        whileHover={{ scale: 1.2, rotate: [0, -5, 5, 0] }}
                        transition={{ duration: 0.5 }}
                      >
                        {company.icon}
                      </motion.div>
                      <div className="text-lg font-bold text-gray-900 dark:text-white group-hover/company:scale-110 group-hover/company:drop-shadow-lg transition-all duration-300">
                        {company.name}
                      </div>
                    </div>
                    
                    {/* Floating particles */}
                    <div className="absolute top-2 right-2 w-2 h-2 bg-gradient-to-r from-teal-400 to-cyan-400 rounded-full opacity-0 group-hover/company:opacity-100 group-hover/company:animate-bounce transition-opacity duration-300" />
                    <div className="absolute bottom-2 left-2 w-1 h-1 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full opacity-0 group-hover/company:opacity-100 group-hover/company:animate-ping transition-opacity duration-300 delay-150" />
                  </motion.div>
                ))}
              </div>
              
              <motion.div 
                className="text-center rounded-3xl p-6 ring-1 ring-gray-200 dark:ring-gray-800 bg-gray-800/80 dark:bg-dark-secondary/80 relative flex flex-col transition-all duration-500 hover:scale-105 hover:shadow-2xl hover:ring-2 hover:ring-accent-teal/50 hover:shadow-accent-teal/10 cursor-pointer group/stats overflow-hidden"
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.6, delay: 1.1, type: "spring", stiffness: 100 }}
                whileHover={{ 
                  scale: 1.02,
                  boxShadow: "0 15px 30px rgba(20, 184, 166, 0.2), 0 0 20px rgba(20, 184, 166, 0.1)",
                  transition: { duration: 0.3 }
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-400/15 via-teal-400/20 to-cyan-400/15 opacity-0 group-hover/stats:opacity-100 transition-opacity duration-500" />
                 <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-400/10 via-teal-400/15 to-cyan-400/10 rounded-xl blur-xs opacity-0 group-hover/stats:opacity-100 transition-opacity duration-500 -z-10" />
                <div className="flex flex-wrap justify-center items-center gap-6 text-lg">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-emerald-400 rounded-full animate-pulse"></div>
                    <span className="text-emerald-600 dark:text-emerald-300 font-semibold">MIT</span>
                    <span className="text-gray-600 dark:text-gray-300">License</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-teal-400 rounded-full animate-pulse"></div>
                    <span className="text-teal-600 dark:text-teal-300 font-semibold">API</span>
                    <span className="text-gray-600 dark:text-gray-300">Docs at /docs</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-cyan-400 rounded-full animate-pulse"></div>
                    <span className="text-cyan-600 dark:text-cyan-300 font-semibold">Docker</span>
                    <span className="text-gray-600 dark:text-gray-300">Ready</span>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default AboutPage;
