import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Shield, X } from 'lucide-react';

interface MfaNotificationPopupProps {
  isOpen: boolean;
  onClose: () => void;
  userName?: string;
}

const MfaNotificationPopup: React.FC<MfaNotificationPopupProps> = ({ 
  isOpen, 
  onClose, 
  userName = "User" 
}) => {
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

  const handleEnableNow = () => {
    // Navigate to settings page with security tab
    navigate('/dashboard/settings', { state: { activeTab: 'security' } });
    onClose();
  };

  const handleMaybeLater = () => {
    onClose();
  };

  // Get the portal target element from the DOM
  const modalRoot = document.getElementById('modal-root');

  // Ensure modal-root has proper styling for full viewport coverage
  useEffect(() => {
    if (modalRoot && isOpen) {
      modalRoot.style.position = 'fixed';
      modalRoot.style.top = '0';
      modalRoot.style.left = '0';
      modalRoot.style.width = '100vw';
      modalRoot.style.height = '100vh';
      modalRoot.style.pointerEvents = 'none';
      modalRoot.style.zIndex = '99998';
    }
    return () => {
      if (modalRoot) {
        modalRoot.style.position = '';
        modalRoot.style.top = '';
        modalRoot.style.left = '';
        modalRoot.style.width = '';
        modalRoot.style.height = '';
        modalRoot.style.pointerEvents = '';
        modalRoot.style.zIndex = '';
      }
    };
  }, [modalRoot, isOpen]);

  // Safety check: if the component isn't open or the portal root doesn't exist, render nothing
  if (!isOpen || !modalRoot) {
    return null;
  }

  return createPortal(
    <div 
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/95 backdrop-blur-md p-4" 
      style={{ 
        pointerEvents: 'auto',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <div 
        className="relative w-full max-w-md mx-auto bg-gradient-to-br from-white to-gray-100 rounded-2xl border-4 border-orange-500 shadow-2xl shadow-orange-500/50 overflow-hidden z-[100000]" 
        style={{ 
          pointerEvents: 'auto',
          position: 'relative',
          zIndex: 100001,
          maxWidth: '28rem',
          width: '100%',
          margin: '0 auto'
        }}
      >
        <button
          onClick={handleMaybeLater}
          className="absolute top-4 right-4 z-10 p-2 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-700 hover:text-gray-900 transition-all duration-200 backdrop-blur-sm border-2 border-gray-400"
        >
          <X size={18} />
        </button>
        
        <div className="p-8 space-y-6">
          {/* Header with Shield Icon */}
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-orange-500 rounded-full mb-4 border-4 border-orange-600 shadow-lg shadow-orange-500/50">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2 drop-shadow-lg">
              Enhance Your Security
            </h2>
            <div className="h-1 w-16 bg-gradient-to-r from-orange-500 to-red-500 mx-auto rounded-full shadow-sm" />
          </div>

          {/* Message */}
          <div className="text-center space-y-3">
            <p className="text-gray-800 text-lg leading-relaxed drop-shadow-sm">
              Hi {userName}! For better security, you can enable 
              <span className="font-semibold text-orange-600 drop-shadow-sm"> 2-Factor Authentication</span> from your settings.
            </p>
            <p className="text-gray-700 text-sm">
              Add an extra layer of protection to your account with 2FA.
            </p>
          </div>

          {/* Security Features */}
          <div className="grid grid-cols-2 gap-3">
            <div className="text-center p-3 rounded-lg bg-orange-100 border-2 border-orange-400 shadow-md">
              <div className="text-xl mb-1">🔐</div>
              <p className="text-xs text-gray-700">Extra Security</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-red-100 border-2 border-red-400 shadow-md">
              <div className="text-xl mb-1">🛡️</div>
              <p className="text-xs text-gray-700">Account Protection</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col space-y-3 pt-2">
            <button
              onClick={handleEnableNow}
              className="w-full px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 border-2 border-orange-600"
            >
              Enable Now
            </button>
            <button
              onClick={handleMaybeLater}
              className="w-full px-6 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 hover:text-gray-900 font-medium rounded-lg transition-all duration-200 border-2 border-gray-500"
            >
              Maybe Later
            </button>
          </div>
        </div>

        {/* Gradient overlay for visual appeal */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-orange-50/50 via-red-50/50 to-orange-50/50 pointer-events-none" />
        <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-orange-200/30 via-red-200/30 to-orange-200/30 blur-xl pointer-events-none" />
      </div>
    </div>,
    modalRoot
  );
};

export default MfaNotificationPopup;