import { useEffect, useCallback } from 'react';
import { authAPI } from '../lib/api';

// Extend the Window interface to include Google Sign-In
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: GoogleSignInConfig) => void;
          renderButton: (element: HTMLElement, config: GoogleButtonConfig) => void;
          prompt: () => void;
          cancel: () => void;
        };
      };
    };
  }
}

interface GoogleSignInConfig {
  client_id: string;
  callback: (response: GoogleCredentialResponse) => void;
  auto_select?: boolean;
  cancel_on_tap_outside?: boolean;
}

interface GoogleButtonConfig {
  theme?: 'outline' | 'filled_blue' | 'filled_black';
  size?: 'large' | 'medium' | 'small';
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
  shape?: 'rectangular' | 'pill' | 'circle' | 'square';
  logo_alignment?: 'left' | 'center';
  width?: string;
  locale?: string;
}

interface GoogleCredentialResponse {
  credential: string;
  select_by?: string;
}

interface UseGoogleSignInProps {
  onSuccess?: (response: any) => void;
  onError?: (error: any) => void;
  clientId?: string;
}

export const useGoogleSignIn = ({ 
  onSuccess, 
  onError,
  clientId = process.env.REACT_APP_GOOGLE_CLIENT_ID || ''
}: UseGoogleSignInProps = {}) => {
  
  const handleCredentialResponse = useCallback(async (response: GoogleCredentialResponse) => {
    try {
      const result = await authAPI.googleSignIn({ id_token: response.credential });
      
      if (result.success && result.data) {
        onSuccess?.(result.data);
      } else {
        onError?.(new Error(result.error || 'Google Sign-In failed'));
      }
    } catch (error) {
      console.error('Google Sign-In error:', error);
      onError?.(error);
    }
  }, [onSuccess, onError]);

  const initializeGoogleSignIn = useCallback(() => {
    console.log('Initializing Google Sign-In with clientId:', clientId);
    console.log('window.google available:', !!window.google);
    
    if (window.google && clientId) {
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleCredentialResponse,
        auto_select: false,
        cancel_on_tap_outside: true,
      });
      console.log('Google Sign-In initialized successfully');
    } else {
      console.warn('Google Sign-In initialization failed:', {
        googleAvailable: !!window.google,
        clientIdProvided: !!clientId
      });
    }
  }, [clientId, handleCredentialResponse]);

  const renderGoogleButton = useCallback((element: HTMLElement, config: GoogleButtonConfig = {}) => {
    if (window.google && element) {
      const defaultConfig: GoogleButtonConfig = {
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'rectangular',
        logo_alignment: 'left',
        width: '100%',
        ...config
      };
      
      window.google.accounts.id.renderButton(element, defaultConfig);
    }
  }, []);

  const signInWithGoogle = useCallback(async (idToken: string) => {
    try {
      const result = await authAPI.googleSignIn({ id_token: idToken });
      return result;
    } catch (error) {
      console.error('Google Sign-In API error:', error);
      throw error;
    }
  }, []);

  useEffect(() => {
    // Wait for Google script to load
    const checkGoogleLoaded = () => {
      if (window.google) {
        initializeGoogleSignIn();
      } else {
        // Retry after a short delay
        setTimeout(checkGoogleLoaded, 100);
      }
    };

    checkGoogleLoaded();
  }, [initializeGoogleSignIn]);

  return {
    renderGoogleButton,
    signInWithGoogle,
    initializeGoogleSignIn
  };
};