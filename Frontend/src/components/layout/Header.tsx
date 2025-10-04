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

const Header: React.FC = () => {
  const { theme, toggleTheme } = useTheme();

  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Check if current route is active
  const isActive = (path: string) => location.pathname === path;
  
  // Transparent fixed header; no scroll background handling
  
  // Close mobile menu when route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location]);

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-transparent translate-y-[10px]">
        <div className="max-w-screen-2xl mx-auto px-3 h-full flex justify-between items-center">
        {/* Logo - Left Zone */}
        <div className="w-40 h-10 flex items-center">
          <Link to="/" className="flex items-center ml-2 mt-2">
            <img 
              src="/images/logo.svg" 
              alt="LLMShield" 
              className="h-64 w-64"
            />
          </Link>
        </div>

        {/* Main Navigation - Centered Pill */}
        <div className="absolute left-1/2 transform -translate-x-1/2">
          <nav className="hidden md:flex items-center justify-center rounded-full border border-white/15 backdrop-blur bg-black shadow-[0_0_30px_rgba(20,184,166,0.2)] px-4 py-2 space-x-6">
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

        {/* Right side controls */}
        <div className="flex items-center space-x-3">
          {/* Login button */}
          <Link
            to="/auth"
            className="hidden md:block px-4 py-1.5 rounded-full bg-accent-teal text-white hover:bg-accent-teal/90 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-accent-teal focus:ring-offset-2"
          >
            Login
          </Link>

          {/* Sign Up button */}
          <Link
            to="/auth?signup=true"
            className="hidden md:block px-4 py-1.5 rounded-full bg-accent-teal text-white hover:bg-accent-teal/90 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-accent-teal focus:ring-offset-2"
          >
            Sign Up
          </Link>
          
          {/* Divider */}
          <div className="hidden md:block mx-3 h-6 w-px bg-white/20"></div>
          
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-accent-teal"
            aria-label="Toggle theme"
          >
            {theme === 'light' ? (
              <MoonIcon className="h-5 w-5 text-accent-blue" />
            ) : (
              <SunIcon className="h-5 w-5 text-yellow-500" />
            )}
          </button>

          {/* Mobile menu button */}
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-accent-teal"
            aria-label="Toggle mobile menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? (
              <XMarkIcon className="h-6 w-6" />
            ) : (
              <Bars3Icon className="h-6 w-6" />
            )}
          </button>
        </div>
      </div>
      
      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 top-16 bg-light-primary dark:bg-dark-primary border-t border-gray-200 dark:border-gray-800 z-40 overflow-y-auto">
          <div className="container mx-auto px-4 py-4 flex flex-col space-y-3 min-h-full">
            <Link 
              to="/" 
              className={`px-4 py-2 rounded-md ${isActive('/') ? 'bg-gray-100 dark:bg-gray-800 text-accent-teal' : 'text-gray-700 dark:text-gray-300'}`}
            >
              Home
            </Link>
            <Link 
              to="/services" 
              className={`px-4 py-2 rounded-md ${isActive('/services') ? 'bg-gray-100 dark:bg-gray-800 text-accent-teal' : 'text-gray-700 dark:text-gray-300'}`}
            >
              Services
            </Link>
            <Link 
              to="/use-cases" 
              className={`px-4 py-2 rounded-md ${isActive('/use-cases') ? 'bg-gray-100 dark:bg-gray-800 text-accent-teal' : 'text-gray-700 dark:text-gray-300'}`}
            >
              Use Cases
            </Link>
            <Link 
              to="/pricing" 
              className={`px-4 py-2 rounded-md ${isActive('/pricing') ? 'bg-gray-100 dark:bg-gray-800 text-accent-teal' : 'text-gray-700 dark:text-gray-300'}`}
            >
              Pricing
            </Link>
            <Link 
              to="/about" 
              className={`px-4 py-2 rounded-md ${isActive('/about') ? 'bg-gray-100 dark:bg-gray-800 text-accent-teal' : 'text-gray-700 dark:text-gray-300'}`}
            >
              About Us
            </Link>
            <Link 
              to="/contact" 
              className={`px-4 py-2 rounded-md ${isActive('/contact') ? 'bg-gray-100 dark:bg-gray-800 text-accent-teal' : 'text-gray-700 dark:text-gray-300'}`}
            >
              Contact Us
            </Link>
