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
          <div className="grid grid-cols-3 gap-4 mt-6">
            <div className="text-center p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <div className="text-2xl mb-2">🛡️</div>
              <p className="text-sm text-gray-400">AI Security</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
              <div className="text-2xl mb-2">🔍</div>
              <p className="text-sm text-gray-400">Threat Detection</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-teal-500/10 border border-teal-500/20">
              <div className="text-2xl mb-2">📊</div>
              <p className="text-sm text-gray-400">Analytics</p>
            </div>
          </div>
          <div className="flex justify-center md:justify-start pt-4">
            <button
              onClick={onClose}
              className="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 border border-blue-500/30"
            >
              Continue to Dashboard
            </button>
          </div>
        </div>
        {showVideo && (
          <div className="flex-1 relative bg-gradient-to-br from-blue-900/20 to-purple-900/20 flex items-center justify-center overflow-hidden min-h-[400px] md:min-h-[500px]">
            <video
              autoPlay
              muted
              loop
              className="w-full h-full object-cover opacity-80"
              onError={() => setShowVideo(false)}
            >
              <source src="/videos/robot-hello.mp4" type="video/mp4" />
              Your browser does not support the video tag.
            </video>
            <div className="absolute inset-0 bg-gradient-to-t from-[#0B1230]/60 via-transparent to-transparent" />
          </div>
        )}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-teal-500/10 pointer-events-none" />
        <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-teal-600/20 blur-xl pointer-events-none" />
      </div>
    </div>,
    modalRoot // The second argument is the target DOM node
  );
};

export default WelcomePopup;