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
