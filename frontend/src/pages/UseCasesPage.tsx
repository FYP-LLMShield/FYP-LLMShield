import React from 'react';
import { motion } from 'framer-motion';

const UseCasesPage: React.FC = () => {
  const useCases = [
    {
      id: 'prompt-injection',
      title: 'Prompt Injection Scanner',
      description: 'Detect and prevent malicious prompt injection attacks that can manipulate AI systems.',
      steps: [
        { title: 'Upload Document', description: 'Upload your prompt templates or input data for analysis.' },
        { title: 'Automated Scanning', description: 'Our system analyzes your content for potential injection vulnerabilities.' },
        { title: 'Review Results', description: 'Get detailed reports on identified risks with severity ratings.' },
        { title: 'Implement Fixes', description: 'Follow our recommended mitigations to secure your prompts.' },
      ],
      image: '/images/prompt-injection.svg',
      color: 'from-accent-teal to-purple-500',
    },
    {
      id: 'model-poisoning',
      title: 'Model Poisoning Detection',
      description: 'Identify potential poisoning in your training data that could compromise model integrity.',
      steps: [
        { title: 'Connect Training Data', description: 'Link your training datasets or upload sample data.' },
        { title: 'Deep Analysis', description: 'Our system performs statistical analysis to detect anomalies.' },
        { title: 'Poisoning Report', description: 'Receive a comprehensive report highlighting suspicious data points.' },
        { title: 'Clean Your Data', description: 'Use our tools to sanitize your training data.' },
      ],
      image: '/images/model-poisoning.svg',
      color: 'from-accent-purple to-pink-500',
    },
    {
      id: 'vector-embedding',
      title: 'Vector Embedding Security',
      description: 'Secure your RAG systems against embedding attacks and vulnerabilities.',
      steps: [
        { title: 'Upload Vectors', description: 'Upload your vector embeddings or connect to your vector database.' },
        { title: 'Vulnerability Scan', description: 'Our system analyzes embedding patterns for security issues.' },
        { title: 'Risk Assessment', description: 'Get a detailed risk assessment of your vector space.' },
        { title: 'Secure Your Vectors', description: 'Implement our recommendations to secure your embeddings.' },
      ],
      image: '/images/vector-embedding.svg',
      color: 'from-purple-500 to-accent-purple',
    },
    {
      id: 'cpp-scanner',
      title: 'C/C++ Code Scanner',
      description: 'Detect vulnerabilities in C/C++ code that could lead to security breaches.',
      steps: [
        { title: 'Upload Code', description: 'Upload your C/C++ source files for analysis.' },
        { title: 'Static Analysis', description: 'Our system performs static code analysis to identify vulnerabilities.' },
        { title: 'Vulnerability Report', description: 'Receive a detailed report of potential security issues.' },
        { title: 'Fix Recommendations', description: 'Get specific code recommendations to address each vulnerability.' },
      ],
      image: '/images/cpp-scanner.svg',
      color: 'from-accent-teal to-accent-purple',
    },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
      },
    },
  };

  return (
    <div className="bg-light-primary dark:bg-dark-primary pt-36 pb-16 transition-colors duration-300 page-transition relative overflow-hidden">
      {/* Animated Background - Scattered Glow Lights */}
      <div className="absolute inset-0 overflow-hidden z-10">
        {/* Desktop: 120 lights total (25 header + 3 above title + 32 middle + 8 vector + 35 bottom + 8 cpp + 9 scanner), Mobile: 30 lights */}
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
          // Next 3 lights: Above Use Cases title horizontal line (12-15%)
          else if (i < 28) {
            y = 12 + Math.random() * 3;
          }
          // Next 32 lights: Use cases section (15-45%) - 3 moved to right side
          else if (i < 60) {
            y = 15 + Math.random() * 30;
            // Move 3 lights to right side (85-100% x position)
            if (i >= 57) {
              x = 85 + Math.random() * 15;
            }
          }
          // Next 8 lights: Above Vector Embedding Security (45-50%)
          else if (i < 68) {
            y = 45 + Math.random() * 5;
          }
          // Next 35 lights: Middle area (50-75%)
          else if (i < 103) {
            y = 50 + Math.random() * 25;
          }
          // Next 8 lights: Below C/C++ Scanner (75-80%)
          else if (i < 111) {
            y = 75 + Math.random() * 5;
          }
          // Last 9 lights: Bottom scanner area (80-100%)
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
          className="text-center mb-28"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-5xl mb-4">
            Use Cases
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
            Explore how LLMShield can protect your AI systems from various threats
          </p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-40"
        >
          {useCases.map((useCase, index) => (
            <motion.div 
              key={useCase.id}
              variants={itemVariants}
              className={`flex flex-col ${index % 2 === 0 ? 'lg:flex-row' : 'lg:flex-row-reverse'} gap-8 lg:gap-16 items-center group`}
              id={useCase.id}
            >
              {/* Enhanced Card with Backdrop Blur and Hover Effects */}
              <div className="lg:w-1/2">
                <motion.div 
                  className={`h-64 w-full rounded-xl bg-gradient-to-r ${useCase.color} flex items-center justify-center p-8 shadow-lg backdrop-blur-sm bg-opacity-90 border border-white/20 dark:border-gray-700/50 transition-all duration-300 ease-out transform-gpu hover:-translate-y-2 hover:shadow-2xl hover:shadow-teal-500/25 hover:border-teal-400/50`}
                  whileHover={{ 
                    scale: 1.02,
                    boxShadow: "0 25px 50px -12px rgba(20, 184, 166, 0.4), 0 0 30px rgba(20, 184, 166, 0.3)"
                  }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                >
                  <div className="text-white text-4xl font-bold text-center drop-shadow-lg">{useCase.title}</div>
                </motion.div>
              </div>
              
              {/* Enhanced Content Card */}
              <div className="lg:w-1/2 space-y-6">
                <motion.div 
                  className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-md rounded-2xl p-8 shadow-xl border border-gray-200/50 dark:border-gray-700/50 transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-2xl hover:border-teal-400/30 hover:bg-white/90 dark:hover:bg-gray-900/90"
                  whileHover={{ 
                    boxShadow: "0 20px 40px -12px rgba(20, 184, 166, 0.2)"
                  }}
                >
                  <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">{useCase.title}</h2>
                  <p className="text-lg text-gray-600 dark:text-gray-300 mb-6">{useCase.description}</p>
                  
                  <div className="mt-8">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">How it works:</h3>
                    <ol className="space-y-4">
                      {useCase.steps.map((step, stepIndex) => (
                        <motion.li 
                          key={stepIndex} 
                          className="flex group/step"
                          whileHover={{ x: 4 }}
                          transition={{ duration: 0.2 }}
                        >
                          <div className="flex-shrink-0 h-8 w-8 rounded-full bg-gradient-to-r from-accent-teal to-teal-600 flex items-center justify-center text-white font-bold shadow-lg group-hover/step:shadow-teal-500/50 transition-all duration-300">
                            {stepIndex + 1}
                          </div>
                          <div className="ml-4">
                            <h4 className="text-lg font-medium text-gray-900 dark:text-white group-hover/step:text-teal-600 dark:group-hover/step:text-teal-400 transition-colors duration-300">{step.title}</h4>
                            <p className="mt-1 text-gray-600 dark:text-gray-400">{step.description}</p>
                          </div>
                        </motion.li>
                      ))}
                    </ol>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  );
};

export default UseCasesPage;
