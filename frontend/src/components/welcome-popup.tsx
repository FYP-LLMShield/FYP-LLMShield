import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom'; // <-- 1. Import createPortal
import { X, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface WelcomePopupProps {
  isOpen: boolean;
  onClose: () => void;
  userName?: string;
}

const WelcomePopup: React.FC<WelcomePopupProps> = ({ isOpen, onClose, userName = "User" }) => {
  const [typedText, setTypedText] = useState('');
  const [showVideo, setShowVideo] = useState(true);
  const navigate = useNavigate();
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

  const handleEnableMFA = () => {
    // Navigate to settings page with security tab
    navigate('/dashboard/settings', { state: { activeTab: 'security' } });
    onClose();
  };

  // 2. Get the portal target element from the DOM
  const modalRoot = document.getElementById('modal-root');

  // 3. Add a safety check: if the component isn't open or the portal root doesn't exist, render nothing.
  if (!isOpen || !modalRoot) {
    return null;
  }

  // 4. Wrap the entire JSX in createPortal
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-2xl mx-auto bg-black rounded-2xl border border-blue-500/30 shadow-2xl overflow-hidden">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-red-500/20 hover:bg-red-500/30 text-red-400 hover:text-red-300 transition-all duration-200 backdrop-blur-sm border border-red-500/30"
        >
          <X size={20} />
        </button>
        
        <div className="flex items-center p-8 space-x-8">
          {/* Left Content */}
          <div className="flex-1 space-y-6">
            {/* Title */}
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-teal-400 bg-clip-text text-transparent mb-2">
                HELLO! 👋
              </h1>
              <div className="h-1 w-20 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full" />
            </div>

            {/* Message */}
            <div className="space-y-4">
              <p className="text-xl text-gray-300 font-medium">
                Welcome back, {userName}! Ready to secure your AI systems?
              </p>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <div className="text-xl mb-1">🛡️</div>
                <p className="text-xs text-gray-400">AI Security</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                <div className="text-xl mb-1">🔍</div>
                <p className="text-xs text-gray-400">Threat Detection</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-teal-500/10 border border-teal-500/20">
                <div className="text-xl mb-1">📊</div>
                <p className="text-xs text-gray-400">Analytics</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-3 pt-4">
              <button
                onClick={onClose}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 border border-blue-500/30"
              >
                Continue to Dashboard
              </button>
              <button
                onClick={handleEnableMFA}
                className="px-6 py-3 bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 border border-green-500/30 flex items-center justify-center space-x-2"
              >
                <Shield className="w-4 h-4" />
                <span>Enable MFA Now</span>
              </button>
            </div>

            {/* Highlighted note */}
            <div className="mt-4 p-3 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-400/30 rounded-lg">
              <p className="text-sm text-center bg-gradient-to-r from-blue-400 via-purple-400 to-teal-400 bg-clip-text text-transparent font-medium">
                💡 You can always enable MFA later from your Security Settings
              </p>
            </div>
          </div>

          {/* Right Side - Robot Image (updated) */}
          <div className="flex-shrink-0 relative">
            <div className="w-64 h-64 relative flex items-center justify-center">
              <img
                src="/images/robot.png"
                alt="Friendly robot waving"
                className="w-56 h-auto animate-float drop-shadow-xl"
              />
            </div>
          </div>
        </div>

        {/* Gradient overlays for visual appeal */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-teal-500/10 pointer-events-none" />
        <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-teal-600/20 blur-xl pointer-events-none" />
      </div>
    </div>,
    modalRoot // The second argument is the target DOM node
  );
};

export default WelcomePopup;