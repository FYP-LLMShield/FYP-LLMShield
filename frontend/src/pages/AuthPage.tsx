import React, { useState, useEffect, useCallback, memo, useRef } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import TOTPInput from '../components/TOTPInput';
import { authAPI } from '../lib/api';
import PasswordRequirements from '../components/auth/PasswordRequirements';
import ForgotPasswordModal from '../components/auth/ForgotPasswordModal';
import { useGoogleAuth } from '../hooks/useGoogleAuth';

// Helper to turn unknown error shapes into user-friendly strings
const formatErrorMessage = (err: any): string => {
  const fallback = 'Something went wrong. Please try again.';
  if (!err) return fallback;

  const asString = (val: any) => {
    if (typeof val === 'string') return val;
    if (val && typeof val === 'object') return JSON.stringify(val);
    return fallback;
  };

  // Detect common connection / network issues and collapse to a friendly message
  const raw =
    err?.message ||
    err?.error ||
    err?.detail ||
    err?.response?.data?.detail ||
    err;

  const rawText = asString(raw);
  const lower = rawText.toLowerCase();
  if (
    lower.includes('connection refused') ||
    (lower.includes('socket') && lower.includes('timeout')) ||
    lower.includes('winerror') ||
    (lower.includes('topology') && lower.includes('timeout'))
  ) {
    return 'Cannot connect to the server. Please try again in a moment or contact support if this persists.';
  }

  // Handle array of validation errors
  if (Array.isArray(raw)) {
    return raw
      .map((d: any) => (d?.msg ? d.msg : asString(d)))
      .join(', ');
  }

  // Limit overly long messages
  const MAX_LEN = 200;
  return rawText.length > MAX_LEN ? `${rawText.slice(0, MAX_LEN)}...` : rawText;
};

const AuthPage: React.FC = memo(() => {
  const location = useLocation();
  const navigate = useNavigate();
  const { login, signup, setUser, isLoading, isInitialized } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  // Add error state to store backend error messages
  const [loginError, setLoginError] = useState('');
  const [loginSuccess, setLoginSuccess] = useState('');
  const [signupError, setSignupError] = useState('');
  const [signupSuccess, setSignupSuccess] = useState('');
  const [showMfaVerification, setShowMfaVerification] = useState(false);
  const [mfaError, setMfaError] = useState('');
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [mfaVerifying, setMfaVerifying] = useState(false);
  const [showResendModal, setShowResendModal] = useState(false);
  const [resendEmail, setResendEmail] = useState('');
  const [resendMessage, setResendMessage] = useState('');
  const [resendError, setResendError] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [showResendButton, setShowResendButton] = useState(false);

  // Show overlay when user is logging in / signing up (until redirect)
  const authInProgress = (isInitialized && isLoading) || mfaVerifying;

  // Track verification attempts to prevent duplicate API calls
  const verificationAttemptedRef = useRef(false);

  // Check for OAuth token in URL immediately
  const hasOAuthToken = typeof window !== 'undefined' &&
    window.location.hash.includes('id_token');

  // Track OAuth redirect in progress
  const [oauthRedirecting, setOauthRedirecting] = useState(hasOAuthToken);
  const handleGoogleSuccess = useCallback(
    (response: any) => {
      console.log('Google button/popup response:', JSON.stringify(response, null, 2));
      // Check if MFA is required
      if (response.mfa_required) {
        console.log('MFA verification required for Google sign-in');
        // Store partial token and show MFA screen
        localStorage.setItem('partial_token', response.partial_token);
        setShowMfaVerification(true);
        setOauthRedirecting(false);
      } else if (response.access_token) {
        // Store tokens
        localStorage.setItem('access_token', response.access_token);
        if (response.refresh_token) {
          localStorage.setItem('refresh_token', response.refresh_token);
        }

        // Store user data
        const userData = {
          id: response.user.id,
          email: response.user.email,
          name: response.user.name,
          plan: 'free',
          isVerified: response.user.is_verified,
        };
        localStorage.setItem('user', JSON.stringify(userData));

        // Update auth context
        setUser(userData);
        login(response.user.email, '');

        // Redirect
        setTimeout(() => navigate('/dashboard'), 1500);
      } else {
        setLoginError('Authentication response invalid. Please try again.');
      }
    },
    [navigate, setUser, login]
  );

  const handleGoogleError = useCallback((error: any) => {
    console.error('Google Sign-In error:', error);
    if (isSignUp) {
      setSignupError('Google Sign-In failed. Please try again.');
    } else {
      setLoginError('Google Sign-In failed. Please try again.');
    }
  }, [isSignUp]);

  const { openGoogleOAuthFlow, isLoading: googleLoading } = useGoogleAuth({
    onSuccess: handleGoogleSuccess,
    onError: handleGoogleError,
  });



  // Handle OAuth callback with id_token in URL
  useEffect(() => {
    const handleOAuthCallback = async () => {
      // Extract id_token from URL hash (from Google OAuth redirect)
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);
      const idToken = params.get('id_token');

      if (idToken) {
        console.log('Found id_token in URL, authenticating...');
        try {
          // Send token to backend for verification
          const response = await authAPI.googleSignIn({ id_token: idToken });
          console.log('Full Google OAuth response:', JSON.stringify(response, null, 2));

          if (response.success && response.data) {
            // Check if MFA is required
            if (response.data.mfa_required) {
              console.log('MFA verification required for Google OAuth user');
              // Store partial token and show MFA screen
              localStorage.setItem('partial_token', response.data.partial_token);
              setShowMfaVerification(true);
              setOauthRedirecting(false); // Hide the loading overlay
              // Clear URL hash
              window.history.replaceState({}, document.title, '/auth');
            } else if (response.data.access_token) {
              console.log('Google Sign-In successful via URL callback');

              // Store tokens
              localStorage.setItem('access_token', response.data.access_token);
              if (response.data.refresh_token) {
                localStorage.setItem('refresh_token', response.data.refresh_token);
              }

              // Store user data
              const userData = {
                id: response.data.user.id,
                email: response.data.user.email,
                name: response.data.user.name,
                plan: 'free',
                isVerified: response.data.user.is_verified,
              };
              localStorage.setItem('user', JSON.stringify(userData));

              // Update API client with token
              authAPI.setToken(response.data.access_token);

              // Clear URL hash
              window.history.replaceState({}, document.title, '/auth');

              // Show redirect screen
              setOauthRedirecting(true);

              // Reload page to reinitialize auth context with stored tokens
              // This ensures AuthContext picks up the tokens from localStorage
              console.log('Reloading page with authenticated tokens...');
              setTimeout(() => {
                window.location.href = '/dashboard';
              }, 500);
            } else {
              console.error('Unexpected response format:', response.data);
              setOauthRedirecting(false);
              setLoginError('Authentication response invalid. Please try again.');
            }
          } else {
            console.error('Google Sign-In failed:', response.error);
            setOauthRedirecting(false);
            setLoginError(response.error || 'Google Sign-In failed');
          }
        } catch (err: any) {
          console.error('OAuth callback error:', err);
          setOauthRedirecting(false);
          setLoginError('Authentication failed. Please try again.');
        }
      }
    };

    handleOAuthCallback();
  }, [navigate, setUser]);

  // Load remembered email if exists, otherwise clear fields
  useEffect(() => {
    const rememberedEmail = localStorage.getItem('rememberedEmail');
    const wasRemembered = localStorage.getItem('rememberMeChecked') === 'true';

    if (rememberedEmail && wasRemembered) {
      setEmail(rememberedEmail);
      setRememberMe(true);
    } else {
      setEmail('');
      setRememberMe(false);
      localStorage.removeItem('rememberedEmail');
      localStorage.removeItem('rememberMeChecked');
    }

    // Always clear password field
    setPassword('');
  }, []);

  // Handle login form submission - memoized for performance
  const handleLogin = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoginSuccess('');
    setMfaError('');
    
    if (rememberMe) {
      localStorage.setItem('rememberedEmail', email);
      localStorage.setItem('rememberMeChecked', 'true');
    } else {
      localStorage.removeItem('rememberedEmail');
      localStorage.removeItem('rememberMeChecked');
    }
    // Accept any login values and redirect to dashboard in same window
    if (email && password) {
      try {
        await login(email, password);
        setLoginSuccess('Login successful ... redirecting to dashboard.');
        setTimeout(() => navigate('/dashboard'), 1500);
      } catch (error: any) {
        console.error('Login failed:', error);
        // Check if MFA verification is required
        if (error.requiresMfa) {
          setShowMfaVerification(true);
        } else {
          // Store the error message from the backend
          const errorMsg = formatErrorMessage(error);
          setLoginError(errorMsg);

          // Show resend button if email verification is needed
          if (errorMsg.toLowerCase().includes('email') || errorMsg.toLowerCase().includes('verified')) {
            setShowResendButton(true);
            setResendEmail(email);
          }
        }
      }
    }
  }, [email, password, rememberMe, navigate, login]);

  // Handle MFA verification
  const handleMfaVerification = useCallback(async (code: string) => {
    setMfaVerifying(true);
    setMfaError('');
    try {
      // Get the partial token from localStorage
      const partialToken = localStorage.getItem('partial_token');
      if (!partialToken) {
        throw new Error('Authentication session expired. Please login again.');
      }
      
      // Call MFA verification API
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1'}/auth/mfa/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${partialToken}`,
        },
        body: JSON.stringify({
          totp_code: code
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Clean up partial token
        localStorage.removeItem('partial_token');
        
        // Store tokens in localStorage
        localStorage.setItem('access_token', data.access_token);
        if (data.refresh_token) {
          localStorage.setItem('refresh_token', data.refresh_token);
        }
        
        // Update API client with new token
        authAPI.setToken(data.access_token);
        
        // Create user data from MFA verification response
        const userData = {
          id: data.user.id,
          email: data.user.email,
          name: data.user.name || data.user.full_name || data.user.email.split('@')[0],
          plan: "free",
          isVerified: data.user.is_verified,
          mfaEnabled: data.user.mfa_enabled
        };
        
        setUser(userData);
        localStorage.setItem("user", JSON.stringify(userData));
        setShowMfaVerification(false);
        setMfaVerifying(false);
        setLoginSuccess('Login successful ... redirecting to dashboard.');
        setTimeout(() => navigate('/dashboard'), 1500);
      } else {
        const errorData = await response.json();
        // If unauthorized, the partial token might be expired
        if (response.status === 403 || response.status === 401) {
          localStorage.removeItem('partial_token');
          setMfaError('Session expired. Please login again.');
          setShowMfaVerification(false);
        } else {
          setMfaError(errorData.detail || 'Invalid verification code. Please try again.');
        }
      }
    } catch (error: any) {
      console.error('MFA verification failed:', error);
      if (error.message?.includes('Authentication session expired')) {
        setShowMfaVerification(false);
      }
      setMfaError(formatErrorMessage(error));
    } finally {
      setMfaVerifying(false);
    }
  }, [navigate, setUser]);

  // Handle back to login from MFA
  const handleBackToLogin = useCallback(() => {
    setShowMfaVerification(false);
    setMfaError('');
  }, []);

  // Handle resend verification email with cooldown
  const handleResendVerificationEmail = useCallback(async () => {
    setResendError('');
    setResendMessage('');

    if (!resendEmail) {
      setResendError('Please enter your email');
      return;
    }

    if (resendCooldown > 0) {
      setResendError(`Please wait ${resendCooldown} seconds before trying again`);
      return;
    }

    setResendLoading(true);
    try {
      const apiBase = process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1';
      const response = await fetch(`${apiBase}/auth/resend-verification-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: resendEmail })
      });

      const data = await response.json();

      if (response.ok) {
        setResendMessage('Verification email sent! Check your inbox (or spam folder).');
        setResendEmail('');

        // Start 60-second cooldown
        setResendCooldown(60);
        const cooldownInterval = setInterval(() => {
          setResendCooldown((prev) => {
            if (prev <= 1) {
              clearInterval(cooldownInterval);
              setShowResendButton(true); // Re-enable after cooldown
              return 0;
            }
            return prev - 1;
          });
        }, 1000);

        setTimeout(() => {
          setShowResendModal(false);
          setResendMessage('');
        }, 3000);
      } else {
        setResendError(data.detail || 'Failed to resend email');
      }
    } catch (error: any) {
      setResendError(error.message || 'Failed to resend email');
    } finally {
      setResendLoading(false);
    }
  }, [resendEmail, resendCooldown]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('signup') === 'true') {
      setIsSignUp(true);
    } else {
      setIsSignUp(false);
    }
  }, [location]);

  // Handle email verification link (?verify=1&token=...)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get('token');
    const verify = params.get('verify');

    // Reset verification attempt flag if token changed (new verification link)
    if (verify !== '1' || !token) {
      verificationAttemptedRef.current = false;
      return;
    }

    // Prevent duplicate verification attempts (fixes React StrictMode double-call)
    if (verificationAttemptedRef.current) return;

    // Mark as attempted to prevent duplicate calls
    verificationAttemptedRef.current = true;

    const apiBase = process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1';
    fetch(`${apiBase}/auth/verify-email/${encodeURIComponent(token)}`, { method: 'POST' })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          // Clear error message and show success
          setLoginError('');
          setLoginSuccess('Email verified. You can now log in.');
          setIsSignUp(false);
          // Wait a moment before navigating to show success message
          setTimeout(() => {
            navigate('/auth', { replace: true });
          }, 1500);
        } else {
          setLoginError(data?.detail || 'Verification failed. The link may have expired.');
          navigate('/auth', { replace: true });
        }
      })
      .catch(() => {
        setLoginError('Verification request failed. Please try again.');
        navigate('/auth', { replace: true });
      });
  }, [location.search, navigate]);

  // Handle signup form submission
  const handleSignup = useCallback(async (e: React.FormEvent, name: string, username: string) => {
    e.preventDefault();
    // Clear previous messages
    setSignupError('');
    setSignupSuccess('');
    
    if (email && password && name && username) {
      try {
        await signup(name, username, email, password);
        setSignupSuccess('Created account successfully. Please log in below.');
        setTimeout(() => {
          setIsSignUp(false);
          setSignupSuccess('');
          navigate('/auth');
        }, 2500);
      } catch (error: any) {
        console.error('Signup failed:', error);
        // Store the error message from the backend
        setSignupError(formatErrorMessage(error));
      }
    }
  }, [email, password, navigate, signup]);

  // Toggle between login and signup - memoized to prevent unnecessary re-renders
  const toggleAuthMode = useCallback(() => {
    // Don't call navigate inside setState updater
    const newIsSignUp = !isSignUp;
    setIsSignUp(newIsSignUp);
    // Call navigate after state update
    const newUrl = newIsSignUp ? '/auth?signup=true' : '/auth';
    navigate(newUrl, { replace: true });
  }, [navigate, isSignUp]);

  return (
    <div className={`h-screen flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 ${oauthRedirecting ? 'pointer-events-none opacity-50' : ''}`}>
      {/* Logo in upper left corner – match header sizing */}
      <div className="absolute -top-8 left-2 z-10">
        <Link to="/" className="flex items-center ml-0 mt-0">
          <img
            src="/images/logo.svg"
            alt="LLMShield"
            className="h-32 w-32"
          />
        </Link>
      </div>

      {/* Animated Background - Glowing Lights */}
      <div className="absolute inset-0 overflow-hidden z-10">
        {Array.from({ length: 50 }).map((_, i) => {
          const size = [4, 6, 8][Math.floor(Math.random() * 3)];
          const animationDuration = [4, 6, 8][Math.floor(Math.random() * 3)];
          const delay = Math.random() * 6;
          const x = Math.random() * 100;
          const y = Math.random() * 100;

          return (
            <div
              key={i}
              className={`absolute rounded-full animate-float-${animationDuration}`}
              style={{
                width: `${size}px`,
                height: `${size}px`,
                left: `${x}%`,
                top: `${y}%`,
                animationDelay: `${delay}s`,
                background: 'radial-gradient(circle, rgba(20, 184, 166, 0.6) 0%, rgba(20, 184, 166, 0.2) 100%)',
                boxShadow: `0 0 ${size * 2}px rgba(20, 184, 166, 0.4)`,
                opacity: 0.6
              }}
            />
          );
        })}
      </div>

      {/* Centered Rectangle Box */}
      <div className="relative z-20 w-full max-w-4xl mx-4">
        <motion.div
          className="relative w-full h-auto min-h-[500px] sm:min-h-[580px] md:min-h-[720px]"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8 }}
        >
          {/* Main Rectangle Container */}
          <div className="relative w-full h-auto min-h-[inherit] bg-gray-800/90 backdrop-blur-sm rounded-2xl border border-gray-700/50 shadow-2xl overflow-hidden grid md:grid-cols-2 items-stretch">
            {/* Loading overlay: moving circle + blurred background */}
            {authInProgress && (
              <div
                className="absolute inset-0 z-30 flex flex-col items-center justify-center rounded-2xl bg-gray-900/70 backdrop-blur-xl"
                aria-live="polite"
                aria-busy="true"
              >
                <div className="flex flex-col items-center gap-5">
                  {/* Moving circle: rotating ring with teal arc */}
                  <div className="relative flex items-center justify-center">
                    <div className="h-14 w-14 animate-spin auth-loading-spin">
                      <svg className="h-14 w-14 block" viewBox="0 0 56 56" aria-hidden="true">
                        <circle
                          cx="28"
                          cy="28"
                          r="24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="4"
                          className="text-white/25"
                        />
                        <circle
                          cx="28"
                          cy="28"
                          r="24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="4"
                          strokeLinecap="round"
                          strokeDasharray="75 150"
                          transform="rotate(-90 28 28)"
                          className="text-teal-400"
                        />
                      </svg>
                    </div>
                  </div>
                  <p className="text-white font-medium text-lg">
                    {mfaVerifying
                      ? 'Verifying code…'
                      : isSignUp
                        ? 'Creating your account…'
                        : 'Signing you in…'}
                  </p>
                  <p className="text-white/70 text-sm">Taking you to the dashboard</p>
                </div>
              </div>
            )}

            {/* Left Side - Form */}
            <div className="relative z-20 p-4 sm:p-6 flex items-start md:items-center justify-center overflow-y-auto md:overflow-visible max-h-[75svh] sm:max-h-[70svh] md:max-h-none smooth-scroll scroll-container">
              <div className="w-full max-w-sm">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={isSignUp ? 'signup' : 'login'}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.4 }}
                  >
                    {isSignUp ? (
                      <SignUpForm
                          toggleAuthMode={toggleAuthMode}
                          handleSignup={handleSignup}
                          email={email}
                          setEmail={setEmail}
                          password={password}
                          setPassword={setPassword}
                          error={signupError}
                          successMessage={signupSuccess}
                          submitting={isInitialized && isLoading}
                          onGoogleSignIn={openGoogleOAuthFlow}
                          googleLoading={googleLoading}
                        />
                    ) : showMfaVerification ? (
                      <MfaVerificationForm
                        onVerify={handleMfaVerification}
                        onBack={handleBackToLogin}
                        error={mfaError}
                        email={email}
                        loading={mfaVerifying}
                      />
                    ) : (
                      <LoginForm
                        toggleAuthMode={toggleAuthMode}
                        email={email}
                        setEmail={setEmail}
                        password={password}
                        setPassword={setPassword}
                        rememberMe={rememberMe}
                        setRememberMe={setRememberMe}
                        handleLogin={handleLogin}
                        error={loginError}
                        successMessage={loginSuccess}
                        setShowForgotPasswordModal={setShowForgotPasswordModal}
                        setShowResendModal={setShowResendModal}
                        showResendButton={showResendButton}
                        resendCooldown={resendCooldown}
                        submitting={isInitialized && isLoading}
                        onGoogleSignIn={openGoogleOAuthFlow}
                        googleLoading={googleLoading}
                      />
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            {/* Right Side - Welcome Content with Teal Background */}
            <div className="hidden md:block relative z-10">
              {/* Diagonal Cut Shape */}
              <div className="absolute inset-0 pointer-events-none [clip-path:polygon(35%_0,100%_0,100%_100%,0%_100%)] bg-accent-teal"></div>
              <div className="absolute inset-0 pointer-events-none [clip-path:polygon(35%_0,100%_0,100%_100%,0%_100%)] ring-1 ring-white/20 rounded-2xl"></div>

              {/* Welcome Content */}
              <div className="relative z-10 flex flex-col items-center justify-center h-full text-center p-8 text-white">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.3 }}
                >
                  <h1 className="text-3xl lg:text-4xl font-bold mb-4">
                    {isSignUp ? 'JOIN US!' : 'WELCOME BACK!'}
                  </h1>
                  <p className="text-lg opacity-90 leading-relaxed">
                    {isSignUp
                      ? 'Join our community and unlock amazing features designed just for you!'
                      : 'We are glad to see you again! Please log in to continue your journey with us.'
                    }
                  </p>
                </motion.div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* OAuth Redirect Loading Screen */}
      {oauthRedirecting && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          style={{ backdropFilter: 'blur(10px)' }}
        >
          <div className="bg-gray-800 rounded-2xl p-12 text-center border border-teal-500/30 shadow-2xl">
            <div className="flex flex-col items-center gap-6">
              {/* Loading Spinner */}
              <div className="relative w-16 h-16">
                <div className="absolute inset-0 animate-spin auth-loading-spin">
                  <svg className="w-16 h-16 block" viewBox="0 0 56 56" aria-hidden="true">
                    <circle
                      cx="28"
                      cy="28"
                      r="24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="4"
                      className="text-white/25"
                    />
                    <circle
                      cx="28"
                      cy="28"
                      r="24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="4"
                      strokeLinecap="round"
                      strokeDasharray="75 150"
                      transform="rotate(-90 28 28)"
                      className="text-teal-400"
                    />
                  </svg>
                </div>
              </div>

              {/* Text */}
              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-white">Redirecting to Dashboard</h3>
                <p className="text-white/70 text-sm">Finalizing your authentication...</p>
              </div>

              {/* Progress */}
              <div className="w-48 h-1 bg-gray-700 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-teal-400 to-teal-600"
                  initial={{ width: 0 }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 0.5, ease: 'easeInOut' }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Resend Verification Email Modal */}
      {showResendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="relative bg-gray-800 rounded-lg p-6 w-96 border border-gray-700">
            <h2 className="text-xl font-bold text-white mb-4">Resend Verification Email</h2>

            {resendMessage && (
              <div className="text-green-500 text-sm bg-green-100/10 p-3 rounded border border-green-500/30 mb-4">
                {resendMessage}
              </div>
            )}

            {resendError && (
              <div className="text-red-500 text-sm bg-red-100/10 p-3 rounded border border-red-500/30 mb-4">
                {resendError}
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-white mb-2">Email Address</label>
              <input
                type="email"
                value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)}
                placeholder="Enter your email"
                className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-teal-400 focus:outline-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleResendVerificationEmail}
                disabled={resendLoading || resendCooldown > 0}
                className="flex-1 py-2 px-4 bg-teal-500 hover:bg-teal-600 disabled:opacity-50 text-white rounded font-medium transition"
              >
                {resendLoading ? 'Sending...' : resendCooldown > 0 ? `Wait ${resendCooldown}s` : 'Resend Email'}
              </button>
              <button
                onClick={() => setShowResendModal(false)}
                className="flex-1 py-2 px-4 bg-gray-700 hover:bg-gray-600 text-white rounded font-medium transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Forgot Password Modal: uses login form email so user is not asked to type it again */}
      <ForgotPasswordModal
        isOpen={showForgotPasswordModal}
        onClose={() => setShowForgotPasswordModal(false)}
        prefillEmail={email}
      />
    </div>
  );
});

AuthPage.displayName = 'AuthPage';

interface AuthFormProps {
  toggleAuthMode: () => void;
  email?: string;
  setEmail?: (email: string) => void;
  password?: string;
  setPassword?: (password: string) => void;
  rememberMe?: boolean;
  setRememberMe?: (remember: boolean) => void;
  handleLogin?: (e: React.FormEvent) => void;
  handleSignup?: (e: React.FormEvent, name: string, username: string) => void;
  error?: string;
  successMessage?: string;
  setShowForgotPasswordModal?: (show: boolean) => void;
  setShowResendModal?: (show: boolean) => void;
  showResendButton?: boolean;
  resendCooldown?: number;
  submitting?: boolean;
  onGoogleSignIn?: () => void;
  googleLoading?: boolean;
}

const LoginForm: React.FC<AuthFormProps> = memo(({
  toggleAuthMode,
  email = '',
  setEmail = () => {},
  password = '',
  setPassword = () => {},
  rememberMe = false,
  setRememberMe = () => {},
  handleLogin = () => {},
  error = '',
  successMessage = '',
  setShowForgotPasswordModal,
  setShowResendModal,
  showResendButton = false,
  resendCooldown = 0,
  submitting = false,
  onGoogleSignIn,
  googleLoading = false,
}) => {
  const [showPassword, setShowPassword] = useState(false);
  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <div className="flex items-center justify-center mb-3">
          <svg className="w-5 h-5 text-gray-300 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <h2 className="text-xl font-bold text-white">Login</h2>
        </div>
      </div>

      <form className="space-y-3" onSubmit={handleLogin}>
        {error && (
          <div className="text-red-500 text-sm bg-red-100/10 p-2 rounded border border-red-500/30">
            {error}
          </div>
        )}
        {successMessage && (
          <div className="text-green-500 text-sm bg-green-100/10 p-3 rounded-lg border border-green-500/30 shadow-sm">
            <div className="flex items-center">
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {successMessage}
            </div>
          </div>
        )}
        
        <div className="space-y-3 sm:space-y-4">
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              {/* FIX: Using inline style with a HEX color for reliability */}
              <svg className="h-5 w-5" viewBox="0 0 20 20" style={{ fill: '#14b8a6' }}>
                <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
              </svg>
            </div>
            <input
              id="username"
              name="username"
              type="email"
              placeholder="Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              className="block w-full rounded-md border-gray-300 bg-white py-2 pl-10 pr-3 text-gray-900 placeholder-gray-500 shadow-sm focus:border-teal-400 focus:ring-teal-400 sm:text-sm"
            />
          </div>

          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              {/* FIX: Using inline style with a HEX color for reliability */}
              <svg className="h-5 w-5" viewBox="0 0 20 20" style={{ fill: '#14b8a6' }}>
                <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
              </svg>
            </div>
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              className="block w-full rounded-md border-gray-300 bg-white py-2 pl-10 pr-10 text-gray-900 placeholder-gray-500 shadow-sm focus:border-teal-400 focus:ring-teal-400 sm:text-sm"
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 flex items-center pr-3"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? (
                <svg className="h-5 w-5 text-gray-400 hover:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              ) : (
                <svg className="h-5 w-5 text-gray-400 hover:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                </svg>
              )}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center">
            <input
              id="remember-me"
              name="remember-me"
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="h-4 w-4 rounded border-gray-500 bg-gray-700 text-teal-400 focus:ring-teal-400"
            />
            <label htmlFor="remember-me" className="ml-2 block text-sm text-white/70">
              Remember me
            </label>
          </div>
          <div className="text-sm flex gap-3">
            <button
              type="button"
              onClick={() => setShowForgotPasswordModal?.(true)}
              className="text-teal-400 hover:text-teal-300 transition-colors duration-300"
            >
              Forgot password?
            </button>
            {showResendButton && (
              <>
                <span className="text-white/30">•</span>
                <button
                  type="button"
                  onClick={() => setShowResendModal?.(true)}
                  disabled={resendCooldown > 0}
                  className={`transition-colors duration-300 ${
                    resendCooldown > 0
                      ? 'text-gray-500 cursor-not-allowed'
                      : 'text-teal-400 hover:text-teal-300'
                  }`}
                >
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend email?'}
                </button>
              </>
            )}
          </div>
        </div>

        <motion.button
           type="submit"
           disabled={submitting}
           whileHover={submitting ? undefined : { scale: 1.02 }}
           whileTap={submitting ? undefined : { scale: 0.98 }}
           className="w-full py-2.5 px-4 mt-2 text-white font-semibold rounded-lg shadow-lg transition-all duration-300 transform hover:-translate-y-0.5 flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"
           style={{ backgroundColor: '#14b8a6' }}
           onMouseEnter={(e) => !submitting && (e.currentTarget.style.backgroundColor = '#0f9488')}
           onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#14b8a6')}
         >
           {submitting ? (
             <>
               <svg className="animate-spin h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                 <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                 <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
               </svg>
               Signing in…
             </>
           ) : (
             <>
               <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
               </svg>
               Login
             </>
           )}
         </motion.button>

        <div className="mt-4">
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-600" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-gray-800 text-white/60">OR</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onGoogleSignIn}
            disabled={googleLoading || submitting}
            className="w-full min-h-[44px] flex items-center justify-center gap-3 rounded-md bg-white text-gray-800 font-medium hover:bg-gray-50 transition-all px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {googleLoading ? (
              <>
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Signing in…</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <span>Continue with Google</span>
              </>
            )}
          </button>
        </div>

        <p className="pt-4 text-center text-sm text-white/60">
          Don't have an account?{' '}
          <button
            type="button"
            onClick={toggleAuthMode}
            className="font-medium transition-colors duration-300"
            style={{ color: '#14b8a6' }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#0f9488'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#14b8a6'}
          >
            Sign up
          </button>
        </p>
      </form>
    </div>
  );
});

LoginForm.displayName = 'LoginForm';

const SignUpForm = memo(({
  toggleAuthMode,
  handleSignup,
  email = '',
  setEmail = () => {},
  password = '',
  setPassword = () => {},
  error = '',
  successMessage = '',
  submitting = false,
  onGoogleSignIn,
  googleLoading = false,
}: AuthFormProps) => {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');

  const validatePassword = (password: string) => {
    const errors = [];
    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one digit');
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }
    return errors.length > 0 ? errors.join(', ') : '';
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate password
    const passwordValidationError = validatePassword(password);
    if (passwordValidationError) {
      setPasswordError(passwordValidationError);
      return;
    }
    
    // Clear password error if validation passes
    setPasswordError('');
    
    // Validate password confirmation
    if (password !== confirmPassword) {
      setConfirmPasswordError('Passwords do not match');
      return;
    }
    
    // Clear confirm password error if validation passes
    setConfirmPasswordError('');
    
    if (handleSignup) {
      if (name.trim() && username.trim()) {
        handleSignup(e, name.trim(), username.trim());
      } else {
        console.error("Please enter your name and username!");
      }
    }
  };

  // Clear password error when user types
  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    setPasswordError('');
  };

  // Clear confirm password error when user types
  const handleConfirmPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setConfirmPassword(e.target.value);
    if (confirmPasswordError) {
      setConfirmPasswordError('');
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <div className="flex items-center justify-center mb-3">
          <svg className="w-5 h-5 text-gray-300 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <h2 className="text-xl font-bold text-white">Create Account</h2>
        </div>
      </div>

      <form className="space-y-2 sm:space-y-3 pb-4 sm:pb-8 md:pb-0" onSubmit={onSubmit}>
        {/* Display error message if it exists */}
        {error && (
          <div className="text-red-500 text-sm bg-red-100/10 p-3 rounded-lg border border-red-500/30 shadow-sm">
            <div className="flex items-center">
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          </div>
        )}
        
        {/* Display success message if it exists */}
        {successMessage && (
          <div className="text-green-500 text-sm bg-green-100/10 p-3 rounded-lg border border-green-500/30 shadow-sm">
            <div className="flex items-center">
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {successMessage}
            </div>
          </div>
        )}
        
        {/* Display password validation error */}
        {passwordError && (
          <div className="text-red-500 text-sm bg-red-100/10 p-3 rounded-lg border border-red-500/30 shadow-sm">
            <div className="flex items-start">
              <svg className="w-4 h-4 mr-2 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{passwordError}</span>
            </div>
          </div>
        )}
        
        {/* Display confirm password error */}
        {confirmPasswordError && (
          <div className="text-red-500 text-sm bg-red-100/10 p-3 rounded-lg border border-red-500/30 shadow-sm">
            <div className="flex items-center">
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {confirmPasswordError}
            </div>
          </div>
        )}
        
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                {/* FIX: Using inline style with a HEX color for reliability */}
                <svg className="h-5 w-5" viewBox="0 0 20 20" style={{ fill: '#14b8a6' }}>
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                </svg>
              </div>
               <input
                  type="text"
                  name="name"
                  id="name"
                  placeholder="Full Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  required
                  className="block w-full rounded-md border-gray-300 bg-white py-2 pl-10 pr-3 text-gray-900 placeholder-gray-500 shadow-sm focus:border-teal-400 focus:ring-teal-400 sm:text-sm"
                />
            </div>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                {/* FIX: Using inline style with a HEX color for reliability */}
                <svg className="h-5 w-5" viewBox="0 0 20 20" style={{ fill: '#14b8a6' }}>
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                </svg>
              </div>
                <input
                  type="text"
                  name="username"
                  id="username"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  required
                  className="block w-full rounded-md border-gray-300 bg-white py-2 pl-10 pr-3 text-gray-900 placeholder-gray-500 shadow-sm focus:border-teal-400 focus:ring-teal-400 sm:text-sm"
                />
            </div>
          </div>
          
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              {/* FIX: Using inline style with a HEX color for reliability */}
              <svg className="h-5 w-5" viewBox="0 0 20 20" style={{ fill: '#14b8a6' }}>
                <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
              </svg>
            </div>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              className="block w-full rounded-md border-gray-300 bg-white py-2 pl-10 pr-3 text-gray-900 placeholder-gray-500 shadow-sm focus:border-teal-400 focus:ring-teal-400 sm:text-sm"
            />
          </div>

          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              {/* FIX: Using inline style with a HEX color for reliability */}
              <svg className="h-5 w-5" viewBox="0 0 20 20" style={{ fill: '#14b8a6' }}>
                <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
              </svg>
            </div>
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={handlePasswordChange}
              autoComplete="new-password"
              required
              className="block w-full rounded-md border-gray-300 bg-white py-2 pl-10 pr-10 text-gray-900 placeholder-gray-500 shadow-sm focus:border-teal-400 focus:ring-teal-400 sm:text-sm"
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 flex items-center pr-3"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? (
                <svg className="h-5 w-5 text-gray-400 hover:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              ) : (
                <svg className="h-5 w-5 text-gray-400 hover:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                </svg>
              )}
            </button>
          </div>

          {/* Password requirements component (separate block to avoid overlap with eye icon) */}
          {password.length > 0 && (
            <div className="mt-3">
              <PasswordRequirements password={password} />
            </div>
          )}
          

          
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              {/* FIX: Using inline style with a HEX color for reliability */}
              <svg className="h-5 w-5" viewBox="0 0 20 20" style={{ fill: '#14b8a6' }}>
                <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
              </svg>
            </div>
            <input
              id="password-confirm"
              name="password-confirm"
              type={showConfirmPassword ? "text" : "password"}
              placeholder="Confirm Password"
              value={confirmPassword}
              onChange={handleConfirmPasswordChange}
              autoComplete="new-password"
              required
              className="block w-full rounded-md border-gray-300 bg-white py-2 pl-10 pr-10 text-gray-900 placeholder-gray-500 shadow-sm focus:border-teal-400 focus:ring-teal-400 sm:text-sm"
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 flex items-center pr-3"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            >
              {showConfirmPassword ? (
                <svg className="h-5 w-5 text-gray-400 hover:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              ) : (
                <svg className="h-5 w-5 text-gray-400 hover:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                </svg>
              )}
            </button>
          </div>
        </div>

        <div className="pt-4 pb-2">
          <div className="flex items-center">
            <input
              id="terms"
              name="terms"
              type="checkbox"
              required
              className="h-4 w-4 rounded border-gray-500 bg-gray-700 text-teal-400 focus:ring-teal-400"
            />
            <label htmlFor="terms" className="ml-2 block text-sm text-white/70">
              I agree to the{' '}
              <button 
                type="button" 
                className="font-medium transition-colors duration-300"
                style={{ color: '#14b8a6' }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#0f9488'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#14b8a6'}
              >
                Terms of Service
              </button>
              {' '}and{' '}
              <button 
                type="button" 
                className="font-medium transition-colors duration-300"
                style={{ color: '#14b8a6' }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#0f9488'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#14b8a6'}
              >
                Privacy Policy
              </button>
            </label>
          </div>
        </div>

        <motion.button
           type="submit"
           disabled={submitting}
           whileHover={submitting ? undefined : { scale: 1.02 }}
           whileTap={submitting ? undefined : { scale: 0.98 }}
           className="w-full py-3 px-4 text-white font-semibold rounded-lg shadow-lg transition-all duration-300 transform hover:-translate-y-0.5 flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"
           style={{ backgroundColor: '#14b8a6' }}
           onMouseEnter={(e) => !submitting && (e.currentTarget.style.backgroundColor = '#0f9488')}
           onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#14b8a6')}
         >
           {submitting ? (
             <>
               <svg className="animate-spin h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                 <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                 <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
               </svg>
               Creating account…
             </>
           ) : (
             <>
               <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
               </svg>
               Create Account
             </>
           )}
         </motion.button>

        <div className="mt-4">
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-600" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-gray-800 text-white/60">OR</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onGoogleSignIn}
            disabled={googleLoading || submitting}
            className="w-full min-h-[44px] flex items-center justify-center gap-3 rounded-md bg-white text-gray-800 font-medium hover:bg-gray-50 transition-all px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {googleLoading ? (
              <>
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Signing up…</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <span>Continue with Google</span>
              </>
            )}
          </button>
        </div>

        <p className="pt-4 text-center text-sm text-white/60">
          Already have an account?{' '}
          <button
            type="button"
            onClick={toggleAuthMode}
            className="font-medium transition-colors duration-300"
            style={{ color: '#14b8a6' }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#0f9488'}
            onMouseLeave={(e) => e.currentTarget.style.color = '#14b8a6'}
          >
            Sign in
          </button>
        </p>
      </form>
    </div>
  );
});

SignUpForm.displayName = 'SignUpForm';

// MFA Verification Form Component
const MfaVerificationForm: React.FC<{
  onVerify: (code: string) => void;
  onBack: () => void;
  error: string;
  email: string;
  loading?: boolean;
}> = memo(({ onVerify, onBack, error, email, loading: loadingProp }) => {
  const [localLoading, setLocalLoading] = useState(false);
  const loading = loadingProp ?? localLoading;

  const handleCodeComplete = async (code: string) => {
    setLocalLoading(true);
    await onVerify(code);
    setLocalLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <div className="flex items-center justify-center mb-3">
          <svg className="w-6 h-6 text-blue-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <h2 className="text-xl font-bold text-white">Two-Factor Authentication</h2>
        </div>
        <p className="text-gray-400 text-sm">
          Enter the 6-digit code from your authenticator app for <span className="text-white">{email}</span>
        </p>
      </div>

      <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6">
        <TOTPInput
          onComplete={handleCodeComplete}
          loading={loading}
          error={error}
        />
      </div>

      <div className="space-y-3">
        <div className="text-center">
          <p className="text-gray-400 text-sm mb-2">Can't access your authenticator app?</p>
          <button
            type="button"
            className="text-blue-400 hover:text-blue-300 text-sm underline"
          >
            Use recovery code instead
          </button>
        </div>
        
        <button
          type="button"
          onClick={onBack}
          className="w-full py-2 px-4 text-gray-400 hover:text-white border border-gray-600 hover:border-gray-500 rounded-lg transition-colors"
        >
          ← Back to Login
        </button>
      </div>
    </div>
  );
});

MfaVerificationForm.displayName = 'MfaVerificationForm';

export default AuthPage;