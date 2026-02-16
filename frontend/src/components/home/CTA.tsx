import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const CTA: React.FC = () => {
  return (
    <section className="py-20 bg-gradient-to-r from-accent-darkBlue to-accent-darkTeal text-white">
      <div className="container mx-auto px-4 text-center">
        <motion.h2 
          className="text-3xl md:text-4xl font-bold mb-6"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          Ready to Secure Your AI Systems?
        </motion.h2>
        
        <motion.p 
          className="text-xl mb-8 max-w-3xl mx-auto"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          Start protecting your LLMs against prompt injection, model poisoning, and embedding risks today.
        </motion.p>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <Link 
            to="/auth?signup=true" 
            className="inline-block px-8 py-3 rounded-md bg-white text-accent-darkBlue font-medium hover:bg-gray-100 transition-colors duration-300 transform hover:scale-105"
          >
            Get Started Free
          </Link>
        </motion.div>
      </div>
    </section>
  );
};

export default CTA;
