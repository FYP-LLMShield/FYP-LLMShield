import React, { useRef } from 'react';
import { motion, useInView } from 'framer-motion';

const Stats: React.FC = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.3 });

  const stats = [
    { value: '99.8%', label: 'Threat Detection Rate' },
    { value: '10,000+', label: 'Scans Performed Daily' },
    { value: '500+', label: 'Enterprise Clients' },
    { value: '24/7', label: 'Security Monitoring' },
  ];

  return (
    <section 
      className="py-16 bg-gradient-to-r from-accent-darkBlue to-accent-darkTeal text-white"
      ref={ref}
    >
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {stats.map((stat, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <motion.div 
                className="text-4xl md:text-5xl font-bold mb-2"
                initial={{ scale: 0.5 }}
                animate={isInView ? { scale: 1 } : { scale: 0.5 }}
                transition={{ 
                  type: "spring", 
                  stiffness: 100, 
                  delay: index * 0.1 + 0.2 
                }}
              >
                {stat.value}
              </motion.div>
              <p className="text-lg text-gray-200">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Stats;
