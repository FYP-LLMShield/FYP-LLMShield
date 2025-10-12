import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Shield, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface MfaPromptPopupProps {
  isOpen: boolean;
  onClose: () => void;
  userName?: string;
}

const MfaPromptPopup: React.FC<MfaPromptPopupProps> = ({ isOpen, onClose, userName = "User" }) => {
  const navigate = useNavigate();

  // Prevent background scroll when popup is open
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

  // Get the portal target element from the DOM
  const modalRoot = document.getElementById('modal-root');

  // Safety check: if the component isn't open or the portal root doesn't exist, render nothing
  if (!isOpen || !modalRoot) {
    return null;
  }

  const handleEnableNow = () => {
    onClose();
    navigate('/dashboard/mfa');
  };

  const handleLater = () => {
    onClose();
    // Set session storage to prevent showing again until MFA is enabled
    sessionStorage.setItem('mfaPromptDismissed', 'true');
  };

  // Wrap the entire JSX in createPortal
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-2xl mx-auto bg-black rounded-2xl border border-orange-500/30 shadow-2xl overflow-hidden">
        <button
          onClick={handleLater}
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-gray-500/20 hover:bg-gray-500/30 text-gray-400 hover:text-gray-300 transition-all duration-200 backdrop-blur-sm border border-gray-500/30"
        >
          <X size={20} />
        </button>
        
        <div className="p-8 space-y-6 text-center">
          {/* Security Icon */}
          <div className="flex justify-center mb-6">
            <div className="p-4 rounded-full bg-orange-500/20 border border-orange-500/30">
              <Shield size={48} className="text-orange-400" />
            </div>
          </div>

          {/* Title */}
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-orange-400 via-red-400 to-yellow-400 bg-clip-text text-transparent mb-2">
              Enhance Your Security
            </h1>
            <div className="h-1 w-20 bg-gradient-to-r from-orange-500 to-red-500 mx-auto rounded-full" />
          </div>

          {/* Message */}
          <div className="space-y-4">
            <p className="text-xl text-gray-300 font-medium">
              Hi {userName}! 👋
            </p>
            <p className="text-lg text-gray-400 leading-relaxed">
              Enhance your account security by enabling <span className="text-orange-400 font-semibold">Multi-Factor Authentication (MFA)</span>. 
              This adds an extra layer of protection to keep your AI security tools safe.
            </p>
          </div>

          {/* Security Benefits */}
          <div className="grid grid-cols-3 gap-4 mt-6">
            <div className="text-center p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
              <div className="text-2xl mb-2">🔐</div>
              <p className="text-sm text-gray-400">Extra Security</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <div className="text-2xl mb-2">🛡️</div>
              <p className="text-sm text-gray-400">Account Protection</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
              <div className="text-2xl mb-2">⚡</div>
              <p className="text-sm text-gray-400">Quick Setup</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 pt-6">
            <button
              onClick={handleEnableNow}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 border border-orange-500/30 flex items-center justify-center gap-2"
            >
              Enable Now
              <ArrowRight size={18} />
            </button>
            <button
              onClick={handleLater}
              className="flex-1 px-6 py-3 bg-gray-600/20 hover:bg-gray-600/30 text-gray-300 hover:text-white font-semibold rounded-lg border border-gray-500/30 transition-all duration-200"
            >
              Later
            </button>
          </div>

          {/* Small note */}
          <p className="text-xs text-gray-500 mt-4">
            You can always enable MFA later from your Security Settings
          </p>
        </div>

        {/* Gradient overlays for visual appeal */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-orange-500/10 via-red-500/10 to-yellow-500/10 pointer-events-none" />
        <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-orange-600/20 via-red-600/20 to-yellow-600/20 blur-xl pointer-events-none" />
      </div>
    </div>,
    modalRoot
  );
};

export default MfaPromptPopup;