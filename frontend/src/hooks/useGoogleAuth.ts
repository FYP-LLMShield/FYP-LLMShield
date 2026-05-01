import { useEffect, useCallback, useState } from 'react';
import { authAPI } from '../lib/api';
import { linkGoogleIdTokenToSupabaseAuth } from '../lib/googleSupabaseLink';

// Declare Google's global object
declare global {
  interface Window {
    google?: any;
  }
}

const GOOGLE_MODE_KEY = 'llmshield_google_auth_mode';

interface UseGoogleAuthProps {
  onSuccess?: (response: any) => void;
  onError?: (error: any) => void;
  clientId?: string;
}

export const useGoogleAuth = ({
  onSuccess,
  onError,
  clientId = process.env.REACT_APP_GOOGLE_CLIENT_ID || '',
}: UseGoogleAuthProps = {}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle the credential response from Google
  const handleCredentialResponse = useCallback(
    async (response: { credential: string }) => {
      setIsLoading(true);
      setError(null);

      try {
        console.log('Google credential received');

        const storedMode = sessionStorage.getItem(GOOGLE_MODE_KEY);
        const mode = storedMode === 'signin' ? ('signin' as const) : undefined;

        // Supabase Auth: real Google identity (dashboard shows provider "google"). Falls back if not configured.
        await linkGoogleIdTokenToSupabaseAuth(response.credential);

        // Backend: app JWT, public.users profile, MFA
        const result = await authAPI.googleSignIn({
          id_token: response.credential,
          ...(mode ? { mode } : {}),
        });

        console.log('Google Sign-In API response:', result);

        if (result.success && result.data) {
          sessionStorage.removeItem(GOOGLE_MODE_KEY);
          onSuccess?.(result.data);
        } else {
          const errorMsg = result.error || 'Google Sign-In failed';
          setError(errorMsg);
          onError?.(new Error(errorMsg));
        }
      } catch (err: any) {
        console.error('Google Sign-In error:', err);
        const errorMsg = err?.message || 'An error occurred during sign-in';
        setError(errorMsg);
        onError?.(err);
      } finally {
        setIsLoading(false);
      }
    },
    [onSuccess, onError]
  );

  // Initialize Google Sign-In
  const initializeGoogleSignIn = useCallback(() => {
    if (!window.google || !clientId) {
      console.warn('Google SDK or Client ID not available');
      return;
    }

    try {
      console.log('Initializing Google Sign-In...');
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleCredentialResponse,
        auto_select: false,
        cancel_on_tap_outside: true,
      });
      console.log('Google Sign-In initialized successfully');
    } catch (err) {
      console.error('Failed to initialize Google Sign-In:', err);
    }
  }, [clientId, handleCredentialResponse]);

  // Setup: Wait for Google SDK to load and initialize
  useEffect(() => {
    const checkGoogleLoaded = () => {
      if (window.google) {
        initializeGoogleSignIn();
      } else {
        setTimeout(checkGoogleLoaded, 100);
      }
    };

    checkGoogleLoaded();
  }, [initializeGoogleSignIn]);

  // Render Google Sign-In button (opens full popup)
  const renderGoogleButton = useCallback((buttonId: string) => {
    if (!window.google) {
      setError('Google SDK not loaded');
      return;
    }

    try {
      console.log('Rendering Google Sign-In button...');
      const buttonElement = document.getElementById(buttonId);
      if (!buttonElement) {
        console.warn(`Button element with ID "${buttonId}" not found`);
        return;
      }

      window.google.accounts.id.renderButton(buttonElement, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
      });
      console.log('Google Sign-In button rendered successfully');
    } catch (err: any) {
      console.error('Error rendering Google button:', err);
      setError(err.message || 'Failed to render Google button');
    }
  }, []);

  // Full OAuth 2.0 redirect flow (opens complete Google login page)
  const openGoogleOAuthFlow = useCallback((flowMode: 'signup' | 'signin' = 'signup') => {
    try {
      console.log('Opening Google OAuth flow...');
      sessionStorage.setItem(GOOGLE_MODE_KEY, flowMode);
      const scope = 'openid email profile';
      const responseType = 'id_token';
      const nonce = Math.random().toString(36).substring(2, 15);
      const redirectUri = `${window.location.origin}/auth`;

      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: responseType,
        scope,
        nonce,
      });

      const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
      window.location.href = googleAuthUrl;
    } catch (err) {
      console.error('Error opening Google OAuth flow:', err);
      setError('Failed to open Google login');
    }
  }, [clientId]);

  // Show Google Sign-In prompt (small popup on corner)
  const showPrompt = useCallback(() => {
    if (!window.google) {
      setError('Google SDK not loaded');
      return;
    }

    try {
      console.log('Attempting to show Google prompt...');
      window.google.accounts.id.prompt((notification: any) => {
        console.log('Prompt notification:', notification);
        if (notification.isNotDisplayed()) {
          console.warn('Prompt not displayed:', notification.getNotDisplayedReason());
          setError(`Prompt not displayed: ${notification.getNotDisplayedReason()}`);
        }
        if (notification.isSkippedMoment()) {
          console.log('Prompt skipped');
        }
      });
    } catch (err: any) {
      console.error('Error showing Google prompt:', err);
      setError(err.message || 'Failed to show Google prompt');
    }
  }, []);

  return {
    handleCredentialResponse,
    showPrompt,
    renderGoogleButton,
    openGoogleOAuthFlow,
    initializeGoogleSignIn,
    isLoading,
    error,
    setError,
  };
};
