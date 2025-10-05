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


