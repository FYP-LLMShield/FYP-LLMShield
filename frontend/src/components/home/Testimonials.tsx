import React, { useRef } from 'react';
import { motion, useInView } from 'framer-motion';

const Testimonials: React.FC = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.3 });

  const faqs = [
    {
      question: "How long does a security scan take?",
      answer: "Most scans complete in seconds to minutes depending on input size. Prompt injection tests run in 10-30 seconds. Dataset analysis typically completes in 1-5 minutes for datasets under 500MB."
    },
    {
      question: "Do you store my data or keep logs?",
      answer: "No. We process your data in-memory and don't store raw files or prompts unless you explicitly save results. Scan history is stored for tracking, but original content is never persisted."
    },
    {
      question: "Which plan is right for my team?",
      answer: "Free for individuals testing locally (5 scans/month). Pro ($5/month) for small teams with 50 scans/month. Premium ($10/month) for enterprises with unlimited scans and API access."
    }
  ];

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
            Frequently Asked Questions
          </motion.h2>
          <motion.p
            className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            Everything you need to know about LLMShield
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {faqs.map((faq, index) => (
            <motion.div
              key={index}
              className="bg-white dark:bg-dark-primary rounded-lg p-6 shadow-lg border border-gray-100 dark:border-gray-800"
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              transition={{ duration: 0.5, delay: index * 0.1 + 0.3 }}
            >
              <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-white">
                {faq.question}
              </h3>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                {faq.answer}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
