import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom'; // <-- 1. Import createPortal
import { X } from 'lucide-react';

interface WelcomePopupProps {
  isOpen: boolean;
  onClose: () => void;
  userName?: string;
}

const WelcomePopup: React.FC<WelcomePopupProps> = ({ isOpen, onClose, userName = "User" }) => {
  const [typedText, setTypedText] = useState('');
  const [showVideo, setShowVideo] = useState(true);
  const welcomeText = `Welcome back, ${userName}! Ready to secure your AI systems?`;
  
  // This effect correctly prevents background scroll. No changes needed here.
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isOpen]);
  
  useEffect(() => {
    if (isOpen) {
      setTypedText('');
      setShowVideo(true);
      const timer = setTimeout(() => {
        let currentIndex = 0;
        const typingInterval = setInterval(() => {
          if (currentIndex <= welcomeText.length) {
            setTypedText(welcomeText.slice(0, currentIndex));
            currentIndex++;
          } else {
            clearInterval(typingInterval);
          }
        }, 50);
        return () => clearInterval(typingInterval);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isOpen, welcomeText]);

  // 2. Get the portal target element from the DOM
  const modalRoot = document.getElementById('modal-root');
  
  // 3. Add a safety check: if the component isn't open or the portal root doesn't exist, render nothing.
  if (!isOpen || !modalRoot) {
    return null;
  }

  // 4. Wrap the entire JSX in createPortal
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-4xl mx-auto bg-black rounded-2xl border border-blue-500/30 shadow-2xl overflow-hidden flex flex-col md:flex-row">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-red-500/20 hover:bg-red-500/30 text-red-400 hover:text-red-300 transition-all duration-200 backdrop-blur-sm border border-red-500/30"
        >
          <X size={20} />
        </button>
        <div className="flex-1 p-8 space-y-6 flex flex-col justify-center">
          <div className="text-center md:text-left">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-teal-400 bg-clip-text text-transparent mb-2">
              HELLO! 👋
            </h1>
            <div className="h-1 w-20 bg-gradient-to-r from-blue-500 to-purple-500 mx-auto md:mx-0 rounded-full" />
          </div>
          <div className="text-center md:text-left min-h-[60px] flex items-center justify-center md:justify-start">
            <p className="text-lg text-gray-300 font-medium">
              {typedText}
              <span className="animate-pulse text-blue-400">|</span>
            </p>
          </div>



