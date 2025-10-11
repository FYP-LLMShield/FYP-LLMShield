import React, { useRef } from 'react';
import { motion, useInView } from 'framer-motion';

const HowItWorks: React.FC = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.3 });

  const steps = [
    {
      number: '01',
      title: 'Upload Your Content',
      description: 'Upload your prompts, training data, or code files for analysis.',
    },
    {
      number: '02',
      title: 'Automated Scanning',
      description: 'Our advanced algorithms scan for vulnerabilities and security risks.',
    },
    {
      number: '03',
      title: 'Detailed Reports',
      description: 'Receive comprehensive reports with risk levels and mitigation recommendations.',
    },
    {
      number: '04',
      title: 'Implement Fixes',
      description: 'Follow our guided recommendations to secure your AI systems.',
    },
  ];

  return (
    <section id="how-it-works" className="py-20 bg-light-primary dark:bg-dark-primary transition-colors duration-300" ref={ref}>
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <motion.h2 
            className="text-3xl md:text-4xl font-bold mb-4 text-gray-800 dark:text-white"
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.5 }}
          >
            How It Works
          </motion.h2>
          <motion.p 
            className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            Securing your AI systems in four simple steps
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, index) => (
            <motion.div 
              key={index}
              className="relative"
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              transition={{ duration: 0.5, delay: index * 0.1 + 0.3 }}
            >
              {/* Step number with gradient background */}
              <div className="absolute -top-10 left-0 w-16 h-16 rounded-full bg-gradient-to-r from-accent-teal to-accent-blue flex items-center justify-center text-white text-2xl font-bold">
                {step.number}
              </div>
              
              {/* Content */}
              <div className="bg-white dark:bg-dark-secondary rounded-lg p-6 pt-10 shadow-lg border border-gray-100 dark:border-gray-800 h-full">
                <h3 className="text-xl font-semibold mb-3 text-gray-800 dark:text-white mt-4">
                  {step.title}
                </h3>
                <p className="text-gray-600 dark:text-gray-300">
                  {step.description}
                </p>
              </div>
              
              {/* Connector line (except for the last item) */}
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-8 left-full w-full h-0.5 bg-gradient-to-r from-accent-teal to-accent-blue transform -translate-x-8"></div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
