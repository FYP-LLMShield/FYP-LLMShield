import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import { SunIcon, MoonIcon, Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';

const StickyNavigation: React.FC = () => {
  const location = useLocation();
  const [isVisible, setIsVisible] = useState(false);
  
  // Check if current route is active
  const isActive = (path: string) => location.pathname === path;
  
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      setIsVisible(scrollY > 100);
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
  if (!isVisible) return null;
  
  return (
    <div className="sticky top-0 z-50 flex justify-center pt-4 pb-2 transition-all duration-300">
      <nav className="flex items-center justify-center rounded-full border border-white/15 backdrop-blur bg-black shadow-[0_0_30px_rgba(20,184,166,0.2)] px-4 py-2 space-x-6">
        <Link 
          to="/" 
          className={`text-gray-700 dark:text-gray-300 hover:text-accent-teal dark:hover:text-accent-teal transition-colors duration-300 px-2 py-1 rounded focus:outline-none focus:ring-2 focus:ring-accent-teal ${isActive('/') ? 'text-accent-teal dark:text-accent-teal font-medium after:content-[""] after:block after:h-0.5 after:rounded-full after:bg-teal-400 after:mt-1' : ''}`}
        >
          Home
        </Link>
        <Link 
          to="/services" 
          className={`text-gray-700 dark:text-gray-300 hover:text-accent-teal dark:hover:text-accent-teal transition-colors duration-300 px-2 py-1 rounded focus:outline-none focus:ring-2 focus:ring-accent-teal ${isActive('/services') ? 'text-accent-teal dark:text-accent-teal font-medium after:content-[""] after:block after:h-0.5 after:rounded-full after:bg-teal-400 after:mt-1' : ''}`}
        >
          Services
        </Link>
        <Link 
          to="/use-cases" 
          className={`text-gray-700 dark:text-gray-300 hover:text-accent-teal dark:hover:text-accent-teal transition-colors duration-300 px-2 py-1 rounded focus:outline-none focus:ring-2 focus:ring-accent-teal ${isActive('/use-cases') ? 'text-accent-teal dark:text-accent-teal font-medium after:content-[""] after:block after:h-0.5 after:rounded-full after:bg-teal-400 after:mt-1' : ''}`}
        >
          Use Cases
        </Link>
        <Link 
          to="/pricing" 
          className={`text-gray-700 dark:text-gray-300 hover:text-accent-teal dark:hover:text-accent-teal transition-colors duration-300 px-2 py-1 rounded focus:outline-none focus:ring-2 focus:ring-accent-teal ${isActive('/pricing') ? 'text-accent-teal dark:text-accent-teal font-medium after:content-[""] after:block after:h-0.5 after:rounded-full after:bg-teal-400 after:mt-1' : ''}`}
        >
          Pricing
        </Link>
        <Link 
          to="/about" 
          className={`text-gray-700 dark:text-gray-300 hover:text-accent-teal dark:hover:text-accent-teal transition-colors duration-300 px-2 py-1 rounded focus:outline-none focus:ring-2 focus:ring-accent-teal ${isActive('/about') ? 'text-accent-teal dark:text-accent-teal font-medium after:content-[""] after:block after:h-0.5 after:rounded-full after:bg-teal-400 after:mt-1' : ''}`}
        >
          About Us
        </Link>
        <Link 
          to="/contact" 
          className={`text-gray-700 dark:text-gray-300 hover:text-accent-teal dark:hover:text-accent-teal transition-colors duration-300 px-2 py-1 rounded focus:outline-none focus:ring-2 focus:ring-accent-teal ${isActive('/contact') ? 'text-accent-teal dark:text-accent-teal font-medium after:content-[""] after:block after:h-0.5 after:rounded-full after:bg-teal-400 after:mt-1' : ''}`}
        >
          Contact Us
        </Link>
      </nav>
    </div>
  );
};
