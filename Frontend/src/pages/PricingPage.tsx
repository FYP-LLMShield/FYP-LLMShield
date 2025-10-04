import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CheckIcon, XMarkIcon, LockClosedIcon } from '@heroicons/react/24/outline';



const PricingPage: React.FC = () => {
  const tiers = [
    {
      name: 'Free',
      price: '0',
      description: 'Basic protection for individuals and small projects',
      features: [
        { name: 'Prompt Injection Scanner', included: true, limit: '5/month' },
        { name: 'C/C++ Scanner', included: true, limit: '3/month' },
        { name: 'Basic Reports', included: true },
        { name: 'Email Support', included: true },
        { name: 'Model Poisoning Detection', included: false },
        { name: 'Vector Embedding Security', included: false },
        { name: 'Live Model Connection', included: false },
        { name: 'Advanced Reports', included: false },
        { name: 'API Access', included: false },
      ],
      cta: 'Get Started',
      mostPopular: false,
    },
    {
      name: 'Regular',
      price: '29',
      description: 'Enhanced protection for teams and growing projects',
      features: [
        { name: 'Prompt Injection Scanner', included: true, limit: 'Included in 100 scans' },
        { name: 'C/C++ Scanner', included: true, limit: 'Included in 100 scans' },
        { name: 'Model Poisoning Detection', included: true },
        { name: 'Vector Embedding Security (Upload Only)', included: true },
        { name: '100 Scans per Month', included: true },
        { name: 'Basic Reports', included: true },
        { name: 'Priority Email Support', included: true },
        { name: 'Live Model Connection', included: false },
        { name: 'Advanced Reports', included: false },
        { name: 'API Access', included: false },
      ],
      cta: 'Start Free Trial',
      mostPopular: true,
    },
    {
      name: 'Premium',
      price: '99',
      description: 'Complete protection for enterprises and critical applications',
      features: [
        { name: 'Prompt Injection Scanner', included: true, limit: 'Unlimited' },
        { name: 'C/C++ Scanner', included: true, limit: 'Unlimited' },
        { name: 'Model Poisoning Detection', included: true },
        { name: 'Vector Embedding Security', included: true },
        { name: 'Live Model Connection', included: true },
        { name: 'Unlimited Scans', included: true },
        { name: 'Advanced Reports', included: true },
        { name: 'API Access', included: true },
        { name: 'Dedicated Support', included: true },
      ],
      cta: 'Contact Sales',
      mostPopular: false,
    },
  ];

  return (
    <div className="bg-light-primary dark:bg-dark-primary pt-36 pb-16 transition-colors duration-300 page-transition relative overflow-hidden">
      {/* Animated Background - Floating Glow Lights */}
      <div className="absolute inset-0 overflow-hidden z-10">
        <style>{`
          @keyframes float-gentle {
            0%, 100% { transform: translateY(0px) translateX(0px) rotate(0deg); }
            25% { transform: translateY(-20px) translateX(10px) rotate(90deg); }
            50% { transform: translateY(-10px) translateX(-15px) rotate(180deg); }
            75% { transform: translateY(-30px) translateX(5px) rotate(270deg); }
          }
          @keyframes float-medium {
            0%, 100% { transform: translateY(0px) translateX(0px) scale(1); }
            33% { transform: translateY(-25px) translateX(-20px) scale(1.1); }
            66% { transform: translateY(-15px) translateX(25px) scale(0.9); }
          }
          @keyframes float-strong {
            0%, 100% { transform: translateY(0px) translateX(0px) rotate(0deg) scale(1); }
            20% { transform: translateY(-35px) translateX(15px) rotate(72deg) scale(1.2); }
            40% { transform: translateY(-20px) translateX(-25px) rotate(144deg) scale(0.8); }
            60% { transform: translateY(-40px) translateX(20px) rotate(216deg) scale(1.1); }
            80% { transform: translateY(-10px) translateX(-10px) rotate(288deg) scale(0.9); }
          }
          @keyframes pulse-glow {
            0%, 100% { opacity: 0.6; filter: brightness(1); }
            50% { opacity: 1; filter: brightness(1.5); }
          }
          @keyframes card-glow {
            0%, 100% { 
              box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(255, 255, 255, 0.1);
            }
            50% { 
              box-shadow: 0 8px 40px rgba(20, 184, 166, 0.3), 0 0 0 2px rgba(20, 184, 166, 0.5), 0 0 60px rgba(20, 184, 166, 0.2);
            }
          }
          @keyframes premium-glow {
            0%, 100% { 
              box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1), 0 0 0 1px rgba(20, 184, 166, 0.3);
            }
            50% { 
              box-shadow: 0 12px 50px rgba(20, 184, 166, 0.4), 0 0 0 3px rgba(20, 184, 166, 0.7), 0 0 80px rgba(20, 184, 166, 0.3);
            }
          }
          @keyframes shimmer {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }
          .card-shimmer::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
            animation: shimmer 2s infinite;
            z-index: 1;
          }
        `}</style>
        {/* Desktop: 40 lights total, Mobile: 10 lights */}
        {Array.from({ length: 40 }).map((_, i) => {
          const size = [8, 12, 16, 20][Math.floor(Math.random() * 4)];
          const floatType = ['float-gentle', 'float-medium', 'float-strong'][Math.floor(Math.random() * 3)];
          const animationDuration = [6, 8, 10, 12][Math.floor(Math.random() * 4)];
          const delay = Math.random() * 8;
          const x = Math.random() * 100;
          const y = Math.random() * 100;

          return (
            <div
              key={i}
              className={`absolute rounded-full bg-accent-teal hidden md:block`}
              style={{
                left: `${x}%`,
                top: `${y}%`,
                width: `${size}px`,
                height: `${size}px`,
                animation: `${floatType} ${animationDuration}s ease-in-out infinite ${delay}s, pulse-glow ${animationDuration * 0.7}s ease-in-out infinite ${delay}s`,
                boxShadow: `0 0 ${size * 2}px rgba(20, 184, 166, 1), 0 0 ${size * 4}px rgba(20, 184, 166, 0.8), 0 0 ${size * 6}px rgba(20, 184, 166, 0.6), 0 0 ${size * 8}px rgba(20, 184, 166, 0.4)`,
                filter: `drop-shadow(0 0 ${size}px rgba(20, 184, 166, 0.7))`,
                opacity: 0.6
              }}
              onMouseEnter={(e) => {
                 // Enhanced hover effect with rotation and scaling
                 const moveX = Math.random() * 40 - 20;
                 const moveY = Math.random() * 40 - 20;
                 const rotation = Math.random() * 360;
                 e.currentTarget.style.transform = `translate3d(${moveX}px, ${moveY}px, 0) scale(1.5) rotate(${rotation}deg)`;
                 e.currentTarget.style.filter = `drop-shadow(0 0 ${size * 4}px rgba(20, 184, 166, 1)) brightness(2)`;
                 e.currentTarget.style.opacity = '1';
                 e.currentTarget.style.zIndex = '50';
                 
                 // Pause animations
                 e.currentTarget.style.animationPlayState = 'paused';
               }}
               onMouseLeave={(e) => {
                 e.currentTarget.style.transform = 'translate3d(0, 0, 0) scale(1) rotate(0deg)';
                 e.currentTarget.style.filter = `drop-shadow(0 0 ${size}px rgba(20, 184, 166, 0.7))`;
                 e.currentTarget.style.opacity = '0.6';
                 e.currentTarget.style.zIndex = 'auto';
                 
                 // Resume animations
                 e.currentTarget.style.animationPlayState = 'running';
               }}
            />
          );
        })}
        {/* Mobile lights - fewer and smaller */}
        {Array.from({ length: 10 }).map((_, i) => {
          const size = [6, 8, 10][Math.floor(Math.random() * 3)];
          const animationDuration = [4, 6, 8][Math.floor(Math.random() * 3)];
          const delay = Math.random() * 6;
          const x = Math.random() * 100;
          const y = Math.random() * 100;

          return (
            <div
              key={`mobile-${i}`}
              className={`absolute rounded-full bg-accent-teal opacity-40 animate-pulse md:hidden`}
              style={{
                left: `${x}%`,
                top: `${y}%`,
                width: `${size}px`,
                height: `${size}px`,
                animationDelay: `${delay}s`,
                animationDuration: `${animationDuration}s`,
                boxShadow: `0 0 ${size}px rgba(20, 184, 166, 0.8)`,
                filter: `drop-shadow(0 0 ${size/2}px rgba(20, 184, 166, 0.5))`
              }}
            />
          );
        })}
      </div>
      <div className="mx-auto max-w-7xl px-6 lg:px-8 relative z-20">
        <div className="mx-auto max-w-4xl text-center">
          <motion.h1 
            className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-5xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            Plans
          </motion.h1>
          <motion.p 
            className="mt-6 text-xl text-gray-600 dark:text-gray-300"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            Choose the plan that's right for your security needs
          </motion.p>
        </div>

        <motion.div 
          className="isolate mx-auto mt-14 md:mt-20 grid max-w-6xl grid-cols-1 gap-6 md:gap-10 md:grid-cols-3 px-4 md:px-0"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          {tiers.map((tier, index) => (
            <motion.div 
              key={tier.name}
              className={`rounded-2xl md:rounded-3xl p-4 md:p-8 ring-1 ${tier.mostPopular ? 'ring-accent-teal bg-white dark:bg-dark-secondary shadow-xl card-shimmer' : 'ring-gray-200 dark:ring-gray-800 bg-white/60 dark:bg-dark-secondary/60'} relative flex flex-col transition-all duration-500 hover:scale-105 hover:shadow-2xl hover:ring-2 ${tier.mostPopular ? 'hover:ring-accent-teal hover:shadow-accent-teal/20' : 'hover:ring-accent-teal/50 hover:shadow-accent-teal/10'} cursor-pointer group overflow-hidden`}
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.2 }}
              whileHover={{ 
                scale: 1.08, 
                rotateY: 5,
                boxShadow: tier.mostPopular 
                  ? "0 25px 50px -12px rgba(20, 184, 166, 0.4), 0 0 0 3px rgba(20, 184, 166, 0.6)"
                  : "0 25px 50px -12px rgba(20, 184, 166, 0.25), 0 0 0 2px rgba(20, 184, 166, 0.4)",
                transition: { duration: 0.4, ease: "easeOut" }
              }}
              whileTap={{ scale: 0.98 }}
              style={{
                animation: tier.mostPopular 
                  ? 'premium-glow 3s ease-in-out infinite' 
                  : tier.name === 'Premium' 
                    ? 'card-glow 4s ease-in-out infinite' 
                    : 'card-glow 5s ease-in-out infinite',
                transformStyle: 'preserve-3d'
              }}
            >
              {tier.mostPopular && (
                <div className="absolute -top-5 left-0 right-0 mx-auto w-32 rounded-full bg-gradient-to-r from-accent-teal to-accent-blue px-3 py-1 text-center text-sm font-semibold text-white">
                  Most Popular
                </div>
              )}
              
              <div className="mb-8">
                <h3 className="text-lg font-semibold leading-8 text-gray-900 dark:text-white">{tier.name}</h3>
                <div className="mt-4 flex items-baseline">
                  <span className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white">${tier.price}</span>
                  <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">/month</span>
                </div>
                <p className="mt-6 text-sm text-gray-600 dark:text-gray-400">{tier.description}</p>
              </div>
              
              <div className="flex-1">
                <ul className="space-y-3">
                  {tier.features.map((feature) => (
                    <li key={feature.name} className="flex items-start">
                      <div className="flex-shrink-0">
                        {feature.included ? (
                          <CheckIcon className="h-6 w-6 text-accent-teal" />
                        ) : (
                          <XMarkIcon className="h-6 w-6 text-gray-400" />
                        )}
                      </div>
                      <div className="ml-3 text-sm">
                        <span className={feature.included ? 'text-gray-700 dark:text-gray-300' : 'text-gray-400 dark:text-gray-500'}>
                          {feature.name}
                          {feature.limit && (
                            <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">({feature.limit})</span>
                          )}
                        </span>
                      </div>
                      {!feature.included && index === 0 && (
                        <LockClosedIcon className="ml-2 h-4 w-4 text-gray-400" />
                      )}
                    </li>
                  ))}
                </ul>
              </div>
              
              <Link
                to={tier.name === 'Free' ? '/auth?signup=true' : tier.name === 'Regular' ? '/auth?signup=true&plan=regular' : '/contact'}
                className={`mt-8 block rounded-md px-3.5 py-2 text-center text-sm font-semibold leading-6 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${tier.mostPopular ? 'bg-accent-teal text-white hover:bg-accent-darkTeal focus-visible:outline-accent-teal' : 'bg-gray-800 dark:bg-gray-700 text-white hover:bg-gray-700 dark:hover:bg-gray-600'} transition-colors duration-300`}
              >
                {tier.cta}
              </Link>
            </motion.div>
          ))}
        </motion.div>

        {/* Security Features Showcase */}
        <motion.div 
          className="mt-24"
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
        >
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              Advanced Security Features
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-300">
              Comprehensive protection for your AI applications
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8 mb-12 md:mb-20 px-4 md:px-0">
            {[
              {
                icon: (
                  <svg className="w-12 h-12 text-accent-teal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                ),
                title: "Real-time Threat Detection",
                description: "Advanced AI algorithms continuously monitor and detect potential security threats in real-time, ensuring your applications stay protected."
              },
              {
                icon: (
                  <svg className="w-12 h-12 text-accent-teal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                ),
                title: "Automated Security Scanning",
                description: "Comprehensive automated scans for prompt injections, model poisoning, and vector embedding vulnerabilities with detailed reports."
              },
              {
                icon: (
                  <svg className="w-12 h-12 text-accent-teal" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                ),
                title: "Lightning Fast Analysis",
                description: "Get security analysis results in seconds, not hours. Our optimized algorithms provide instant feedback for rapid development cycles."
              }
            ].map((feature, index) => (
              <motion.div
                key={index}
                className="bg-white dark:bg-dark-secondary rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow duration-300 border border-gray-200 dark:border-gray-700 group relative overflow-hidden"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.8 + index * 0.1 }}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-accent-teal/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="relative z-10">
                  <div className="mb-6 flex justify-center transition-transform duration-200 hover:scale-105">
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 text-center">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-300 text-center leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>



        {/* Features Comparison Table */}
        <motion.div 
          className="mt-24"
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 1.6 }}
        >
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Feature Comparison</h2>
            <p className="text-lg text-gray-600 dark:text-gray-300">Compare all features across our plans</p>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full bg-white dark:bg-dark-secondary rounded-2xl shadow-lg overflow-hidden">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Features</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900 dark:text-white">Free</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900 dark:text-white bg-accent-teal/10">Regular</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900 dark:text-white">Premium</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {[
                  { feature: 'Monthly Scans', free: '8 total', regular: '100 total', premium: 'Unlimited' },
                  { feature: 'Prompt Injection Scanner', free: '✓', regular: '✓', premium: '✓' },
                  { feature: 'C/C++ Code Scanner', free: '✓', regular: '✓', premium: '✓' },
                  { feature: 'Model Poisoning Detection', free: '✗', regular: '✓', premium: '✓' },
                  { feature: 'Vector Embedding Security', free: '✗', regular: 'Upload Only', premium: 'Full Access' },
                  { feature: 'Live Model Connection', free: '✗', regular: '✗', premium: '✓' },
                  { feature: 'API Access', free: '✗', regular: '✗', premium: '✓' },
                  { feature: 'Advanced Reports', free: '✗', regular: '✗', premium: '✓' },
                  { feature: 'Support Level', free: 'Email', regular: 'Priority Email', premium: 'Dedicated' }
                ].map((row, index) => (
                  <motion.tr 
                    key={index}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors duration-200"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: 1.8 + index * 0.1 }}
                  >
                    <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">{row.feature}</td>
                    <td className="px-6 py-4 text-sm text-center text-gray-600 dark:text-gray-300">{row.free}</td>
                    <td className="px-6 py-4 text-sm text-center text-gray-600 dark:text-gray-300 bg-accent-teal/5">{row.regular}</td>
                    <td className="px-6 py-4 text-sm text-center text-gray-600 dark:text-gray-300">{row.premium}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        <motion.div 
          className="mt-20 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 1.6 }}
        >
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Need a custom plan?</h2>
          <p className="mt-2 text-gray-600 dark:text-gray-300">Contact our sales team for enterprise solutions tailored to your organization's needs.</p>
          <Link
            to="/contact"
            className="mt-6 inline-block rounded-md bg-accent-teal px-6 py-3 text-center text-sm font-semibold text-white hover:bg-accent-darkTeal transition-colors duration-300"
          >
            Contact Sales
          </Link>
        </motion.div>
      </div>
    </div>
  );
};

export default PricingPage;
