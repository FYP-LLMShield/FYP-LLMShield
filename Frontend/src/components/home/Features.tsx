import React from 'react';
import { motion, useInView } from 'framer-motion';
import { ShieldCheckIcon, CodeBracketIcon, DocumentTextIcon, ServerIcon } from '@heroicons/react/24/outline';

const Features: React.FC = () => {
  const ref = React.useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.3 });

  const features = [
    {
      title: 'Prompt Injection Scanner',
      description: 'Detect and prevent malicious prompt injections with our advanced scanning technology.',
      icon: <DocumentTextIcon className="h-8 w-8 text-accent-teal" />,
    },
    {
      title: 'Model Poisoning Detection',
      description: 'Identify potential poisoning in your training data before it affects your models.',
      icon: <ShieldCheckIcon className="h-8 w-8 text-accent-purple" />,
    },
    {
      title: 'Vector Embedding Security',
      description: 'Secure your RAG systems with comprehensive embedding risk analysis.',
      icon: <ServerIcon className="h-8 w-8 text-accent-blue" />,
    },
    {
      title: 'C/C++ Code Scanner',
      description: 'Find vulnerabilities in your C/C++ code with our specialized scanner.',
      icon: <CodeBracketIcon className="h-8 w-8 text-accent-teal" />,
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
    <section className="py-20 bg-light-secondary dark:bg-dark-secondary transition-colors duration-300" ref={ref}>
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <motion.h2 
            className="text-3xl md:text-4xl font-bold mb-4 text-gray-800 dark:text-white"
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.5 }}
          >
            Comprehensive Security Features
          </motion.h2>
          <motion.p 
            className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            Protect your AI systems with our suite of specialized security tools
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          {/* 3D Robot Animation */}
          <div className="order-2 md:order-1 flex justify-center">
            <div className="robot-container w-full max-w-md">
              <div className="relative">
                {/* Simple CSS-based animation background */}
                <div className="absolute inset-0 w-full h-full opacity-30" style={{ zIndex: 0, pointerEvents: 'none' }}>
                  <div className="absolute top-8 left-8 w-2 h-2 bg-accent-teal rounded-full animate-pulse" />
                  <div className="absolute top-16 right-12 w-1 h-1 bg-accent-purple rounded-full animate-ping" style={{ animationDelay: '1s' }} />
                  <div className="absolute top-24 left-16 w-1.5 h-1.5 bg-accent-blue rounded-full animate-pulse" style={{ animationDelay: '2s' }} />
                  <div className="absolute top-32 right-8 w-1 h-1 bg-accent-teal rounded-full animate-ping" style={{ animationDelay: '0.5s' }} />
                  <div className="absolute bottom-32 left-12 w-2 h-2 bg-accent-purple rounded-full animate-pulse" style={{ animationDelay: '1.5s' }} />
                  <div className="absolute bottom-24 right-16 w-1 h-1 bg-accent-blue rounded-full animate-ping" style={{ animationDelay: '3s' }} />
                  <div className="absolute bottom-16 left-20 w-1.5 h-1.5 bg-accent-teal rounded-full animate-pulse" style={{ animationDelay: '2.5s' }} />
                  <div className="absolute bottom-8 right-20 w-1 h-1 bg-accent-purple rounded-full animate-ping" style={{ animationDelay: '4s' }} />
                </div>
                
                {/* Robot Image with animations */}
                <div className="robot-float robot-rotate relative" style={{ zIndex: 1 }}>
                  {/* Try to load 3D model first with fallback to static image */}
                  <div className="robot-3d-container">
                    <img 
                      src="/3d/robot.png" 
                      alt="LLMShield Robot" 
                      className="robot-glow w-full h-auto"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.onerror = null;
                        target.src = '/images/robot.png';
                      }}
                    />
                  </div>
                </div>
                

              </div>
            </div>
          </div>

          {/* Features Grid */}
          <motion.div 
            className="order-1 md:order-2 grid grid-cols-2 gap-4 relative"
            style={{ zIndex: 2 }}
            variants={containerVariants}
            initial="hidden"
            animate={isInView ? "visible" : "hidden"}
          >
            {features.map((feature, index) => (
              <motion.div 
                key={index} 
                className="bg-white dark:bg-dark-primary rounded-lg px-4 py-6 shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100 dark:border-gray-800 glow flex flex-col items-center text-center space-y-3 min-h-[160px]"
                variants={itemVariants}
                whileHover={{ scale: 1.02, boxShadow: "0 0 30px rgba(20, 184, 166, 0.6)" }}
              >
                <div className="text-2xl">{feature.icon}</div>
                <div>
                  <h3 className="text-base font-semibold mb-2 text-gray-800 dark:text-white">{feature.title}</h3>
                  <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">{feature.description}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default Features;
