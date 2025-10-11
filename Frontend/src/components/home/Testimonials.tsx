import React, { useRef } from 'react';
import { motion, useInView } from 'framer-motion';

const Testimonials: React.FC = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.3 });

  const testimonials = [
    {
      quote: "LLMShield has been instrumental in securing our AI systems. We've detected and prevented multiple prompt injection attacks that would have otherwise gone unnoticed.",
      author: "Sarah Johnson",
      position: "CTO, TechInnovate",
      image: "https://randomuser.me/api/portraits/women/32.jpg",
    },
    {
      quote: "The model poisoning detection feature saved us countless hours of debugging and potential security breaches. Highly recommended for any organization working with LLMs.",
      author: "Michael Chen",
      position: "AI Security Lead, DataDefend",
      image: "https://randomuser.me/api/portraits/men/46.jpg",
    },
    {
      quote: "As a financial institution, security is paramount. LLMShield's comprehensive scanning tools have become an essential part of our AI development pipeline.",
      author: "Emily Rodriguez",
      position: "CISO, Global Finance",
      image: "https://randomuser.me/api/portraits/women/65.jpg",
    },
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
            What Our Clients Say
          </motion.h2>
          <motion.p 
            className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            Trusted by leading organizations worldwide
          </motion.p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <motion.div 
              key={index}
              className="bg-white dark:bg-dark-primary rounded-lg p-6 shadow-lg border border-gray-100 dark:border-gray-800"
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              transition={{ duration: 0.5, delay: index * 0.1 + 0.3 }}
            >
              <div className="mb-6">
                <svg className="h-8 w-8 text-accent-teal mb-2" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
                </svg>
                <p className="text-gray-600 dark:text-gray-300 italic">{testimonial.quote}</p>
              </div>
              <div className="flex items-center">
                <img 
                  src={testimonial.image} 
                  alt={testimonial.author} 
                  className="w-12 h-12 rounded-full mr-4"
                />
                <div>
                  <h4 className="font-semibold text-gray-800 dark:text-white">{testimonial.author}</h4>
                  <p className="text-gray-500 dark:text-gray-400 text-sm">{testimonial.position}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="mt-16 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.5, delay: 0.6 }}
          >
            <a 
              href="/case-studies" 
              className="inline-flex items-center text-accent-teal hover:text-accent-darkTeal transition-colors duration-300"
            >
              <span>View all case studies</span>
              <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </a>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
