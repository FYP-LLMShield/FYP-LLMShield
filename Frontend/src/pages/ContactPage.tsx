import React from 'react';
import { motion } from 'framer-motion';
import { EnvelopeIcon, PhoneIcon } from '@heroicons/react/24/outline';

const ContactPage: React.FC = React.memo(() => {
  return (
    <div className="bg-light-primary dark:bg-dark-primary pt-28 pb-16 transition-colors duration-300 page-transition relative overflow-hidden">
      {/* Animated Background - Scattered Glow Lights */}
      <div className="absolute inset-0 overflow-hidden z-10">
        {/* Optimized: 20 lights total for better performance */}
        {Array.from({ length: 20 }).map((_, i) => {
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
              className={`absolute rounded-full animate-float-${animationDuration} hover:animate-pulse transition-all duration-300 cursor-pointer ${i >= 30 ? 'hidden lg:block' : ''}`}
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
      <div className="mx-auto max-w-7xl px-6 lg:px-8 relative z-20">
        <motion.div 
          className="text-center mb-24"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
        >
          <motion.div
            className="flex items-center justify-center mb-8"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <div className="w-16 h-16 bg-gradient-to-br from-teal-400 to-blue-500 rounded-2xl flex items-center justify-center mr-4 shadow-2xl">
              <svg className="w-8 h-8 text-gray-900 dark:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h1 className="text-5xl md:text-6xl font-bold text-gray-800 dark:text-white">
              Contact Us
            </h1>
          </motion.div>
          <motion.p 
            className="text-xl text-gray-600 dark:text-gray-300 max-w-4xl mx-auto leading-relaxed"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            Have questions about LLMShield? We're here to help you secure your AI infrastructure.
          </motion.p>
        </motion.div>

        <div className="mb-24">
          {/* First Row: Contact Form and Contact Information side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-8 mb-8 md:mb-12 px-4 md:px-0">
            {/* Contact Form */}
            <motion.div 
              className="relative bg-gradient-to-br from-black/50 via-black/30 to-black/10 dark:from-black/60 dark:via-black/40 dark:to-black/20 backdrop-blur-lg rounded-xl p-3 border border-white/20 shadow-xl overflow-hidden group/form"
              initial={{ opacity: 0, x: -30, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              whileHover={{ 
                scale: 1.02,
                boxShadow: "0 25px 50px -12px rgba(20, 184, 166, 0.25), 0 0 40px rgba(20, 184, 166, 0.3)",
                transition: { duration: 0.3 }
              }}
            >
            <div className="absolute inset-0 bg-gradient-to-r from-teal-500/5 to-blue-500/5 opacity-0 group-hover/form:opacity-100 transition-opacity duration-500"></div>
            <div className="absolute -inset-0.5 bg-gradient-to-r from-teal-400/15 via-blue-400/15 to-purple-400/15 rounded-2xl blur-xs opacity-0 group-hover/form:opacity-100 transition-opacity duration-500 -z-10" />
            <div className="relative z-10">
              <motion.div 
                className="flex items-center mb-8"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
              >
                <div className="w-10 h-10 bg-gradient-to-br from-teal-400 to-blue-500 rounded-xl flex items-center justify-center mr-3 shadow-lg">
                  <svg className="w-5 h-5 text-gray-900 dark:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white bg-gradient-to-r from-teal-400 to-blue-400 bg-clip-text text-transparent group-hover/form:from-teal-300 group-hover/form:to-blue-300 transition-all duration-300">
                  Send us a message
                </h2>
              </motion.div>
              <form className="space-y-3">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.5 }}
                >
                  <label htmlFor="name" className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">
                    Name
                  </label>
                  <input
                    type="text"
                    name="name"
                    id="name"
                    autoComplete="name"
                    className="w-full px-3 py-2 bg-white/5 backdrop-blur-sm border border-white/20 rounded-lg focus:ring-2 focus:ring-teal-400 focus:border-teal-400 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 transition-all duration-300 hover:bg-white/10 focus:bg-white/10"
                    placeholder="Your Name"
                  />
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.7 }}
                >
                  <label htmlFor="email" className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">
                    Email Address
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    className="w-full px-3 py-2 bg-white/5 backdrop-blur-sm border border-white/20 rounded-lg focus:ring-2 focus:ring-teal-400 focus:border-teal-400 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 transition-all duration-300 hover:bg-white/10 focus:bg-white/10"
                    placeholder="john@example.com"
                  />
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.9 }}
                >
                  <label htmlFor="message" className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">
                    Message
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    rows={6}
                    className="w-full px-3 py-2 bg-white/5 backdrop-blur-sm border border-white/20 rounded-lg focus:ring-2 focus:ring-teal-400 focus:border-teal-400 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 transition-all duration-300 hover:bg-white/10 focus:bg-white/10 resize-none"
                    placeholder="Tell us about your AI security needs..."
                  />
                </motion.div>
                <motion.button
                  type="submit"
                  className="w-full bg-accent-teal hover:bg-accent-teal/90 text-white font-semibold py-2 px-4 rounded-lg transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-offset-2 focus:ring-offset-transparent shadow-lg hover:shadow-xl transform hover:scale-105"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 1.0 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <span className="flex items-center justify-center">
                    Send Message
                    <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </span>
                </motion.button>
              </form>
            </div>
            </motion.div>

            {/* Contact Information */}
            <motion.div 
              className="relative bg-gradient-to-br from-purple-500/20 via-pink-500/15 to-violet-500/10 backdrop-blur-lg rounded-2xl p-8 border border-purple-400/30 shadow-2xl overflow-hidden group/contact"
              initial={{ opacity: 0, x: 30, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ duration: 0.7, delay: 0.4 }}
              whileHover={{ 
                scale: 1.02,
                boxShadow: "0 25px 50px -12px rgba(147, 51, 234, 0.25), 0 0 40px rgba(147, 51, 234, 0.3)",
                transition: { duration: 0.3 }
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 to-pink-500/5 opacity-0 group-hover/contact:opacity-100 transition-opacity duration-500"></div>
              <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-400/15 via-pink-400/15 to-violet-400/15 rounded-2xl blur-xs opacity-0 group-hover/contact:opacity-100 transition-opacity duration-500 -z-10" />
              <div className="relative z-10">
                <motion.div 
                  className="flex items-center mb-8"
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.6 }}
                >
                  <div className="w-10 h-10 bg-gradient-to-br from-teal-400 to-blue-500 rounded-xl flex items-center justify-center mr-3 shadow-lg">
                    <svg className="w-6 h-6 text-gray-900 dark:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent group-hover/contact:from-purple-300 group-hover/contact:to-pink-300 transition-all duration-300">
                    Contact Information
                  </h2>
                </motion.div>
                <div className="space-y-6">
                  <motion.div 
                    className="flex items-start p-4 bg-black/40 dark:bg-black/50 backdrop-blur-sm rounded-xl border border-white/10 hover:border-white/20 transition-all duration-300 group/item"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5, delay: 0.7 }}
                    whileHover={{ x: 5, transition: { duration: 0.2 } }}
                  >
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-purple-500 rounded-lg flex items-center justify-center shadow-lg group-hover/item:scale-110 transition-transform duration-300">
                        <EnvelopeIcon className="h-5 w-5 text-gray-900 dark:text-white" />
                      </div>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-semibold text-teal-600 dark:text-accent-teal mb-1">Email</p>
                      <p className="text-gray-900 dark:text-white font-medium">contact@llmshield.com</p>
                    </div>
                  </motion.div>
                  <motion.div 
                    className="flex items-start p-4 bg-black/40 dark:bg-black/50 backdrop-blur-sm rounded-xl border border-white/10 hover:border-white/20 transition-all duration-300 group/item"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5, delay: 0.8 }}
                    whileHover={{ x: 5, transition: { duration: 0.2 } }}
                  >
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-pink-500 rounded-lg flex items-center justify-center shadow-lg group-hover/item:scale-110 transition-transform duration-300">
                        <PhoneIcon className="h-5 w-5 text-gray-900 dark:text-white" />
                      </div>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-semibold text-teal-600 dark:text-accent-teal mb-1">Phone</p>
                      <p className="text-gray-900 dark:text-white font-medium">+1 (555) 123-4567</p>
                    </div>
                  </motion.div>
                  <motion.div 
                    className="flex items-start p-4 bg-black/40 dark:bg-black/50 backdrop-blur-sm rounded-xl border border-white/10 hover:border-white/20 transition-all duration-300 group/item"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.5, delay: 0.9 }}
                    whileHover={{ x: 5, transition: { duration: 0.2 } }}
                  >
                    <div className="flex-shrink-0">
                       <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-violet-500 rounded-lg flex items-center justify-center shadow-lg group-hover/item:scale-110 transition-transform duration-300">
                         <svg className="w-5 h-5 text-gray-900 dark:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                         </svg>
                       </div>
                     </div>
                    <div className="ml-4">
                      <p className="text-sm font-semibold text-teal-600 dark:text-accent-teal mb-1">Business Hours</p>
                      <p className="text-gray-900 dark:text-white font-medium">
                        Monday - Friday: 9:00 AM - 6:00 PM<br />
                        Saturday: 10:00 AM - 4:00 PM<br />
                        Sunday: Closed
                      </p>
                    </div>
                  </motion.div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Second Row: Enterprise Solutions centered below */}
          <div className="flex justify-center">
            <motion.div 
              className="relative bg-gradient-to-br from-black/40 via-black/30 to-black/20 dark:from-black/60 dark:via-black/50 dark:to-black/30 backdrop-blur-lg rounded-2xl p-8 border border-white/20 shadow-2xl overflow-hidden group/enterprise max-w-2xl w-full"
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.7, delay: 0.6 }}
              whileHover={{ 
                scale: 1.02,
                boxShadow: "0 25px 50px -12px rgba(20, 184, 166, 0.25), 0 0 40px rgba(20, 184, 166, 0.3)",
                transition: { duration: 0.3 }
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-teal-500/5 to-emerald-500/5 opacity-0 group-hover/enterprise:opacity-100 transition-opacity duration-500"></div>
              <div className="absolute -inset-1 bg-gradient-to-r from-teal-400/20 via-emerald-400/20 to-blue-400/20 rounded-2xl blur-sm opacity-0 group-hover/enterprise:opacity-100 transition-opacity duration-500 -z-10" />
              <div className="relative z-10">
                <motion.div 
                  className="flex items-center mb-6"
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.8 }}
                >
                  <div className="w-10 h-10 bg-gradient-to-br from-teal-400 to-emerald-500 rounded-xl flex items-center justify-center mr-3 shadow-lg">
                    <svg className="w-5 h-5 text-gray-900 dark:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white bg-gradient-to-r from-teal-400 to-emerald-400 bg-clip-text text-transparent group-hover/enterprise:from-teal-300 group-hover/enterprise:to-emerald-300 transition-all duration-300">
                    Enterprise Solutions
                  </h2>
                </motion.div>
                <motion.p 
                  className="text-gray-700 dark:text-gray-200 mb-8 text-lg leading-relaxed"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.9 }}
                >
                  Looking for enterprise-grade security for your AI systems? Our team of experts is ready to create a custom solution for your organization.
                </motion.p>
                <motion.button
                  className="relative bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white px-8 py-4 rounded-xl font-semibold transition-all duration-300 shadow-lg hover:shadow-xl group/btn overflow-hidden w-full"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, delay: 1.0 }}
                  whileHover={{ 
                    scale: 1.05,
                    boxShadow: "0 20px 40px -12px rgba(20, 184, 166, 0.4)",
                    transition: { duration: 0.2 }
                  }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300"></div>
                  <span className="relative z-10 flex items-center justify-center">
                    Schedule a Consultation
                    <svg className="w-5 h-5 ml-2 group-hover/btn:translate-x-1 transition-transform duration-300 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </span>
                </motion.button>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
});

export default ContactPage;
