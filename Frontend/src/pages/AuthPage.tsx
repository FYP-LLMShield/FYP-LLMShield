import React, { useState, useEffect, useCallback, memo } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import TOTPInput from '../components/TOTPInput';
import { authAPI } from '../lib/api';
import PasswordRequirements from '../components/auth/PasswordRequirements';
import ForgotPasswordModal from '../components/auth/ForgotPasswordModal';
import { useGoogleSignIn } from '../hooks/useGoogleSignIn';

const AuthPage: React.FC = memo(() => {
  const location = useLocation();
  const navigate = useNavigate();
  const { login, signup, setUser } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  // Add error state to store backend error messages
  const [loginError, setLoginError] = useState('');
  const [signupError, setSignupError] = useState('');
  const [signupSuccess, setSignupSuccess] = useState('');
  const [showMfaVerification, setShowMfaVerification] = useState(false);
  const [mfaError, setMfaError] = useState('');
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);

  // Google Sign-In integration
  const { renderGoogleButton, initializeGoogleSignIn } = useGoogleSignIn({
    onSuccess: (response) => {
      console.log('Google Sign-In successful:', response);
      setUser(response.user);
      navigate('/dashboard');
    },
    onError: (error) => {
      console.error('Google Sign-In failed:', error);
      setLoginError('Google Sign-In failed. Please try again.');
    }
  });

  // Handle Google Sign-In button click
  const handleGoogleSignIn = useCallback(async () => {
    try {
      console.log('=== Google Sign-In Debug Info ===');
      console.log('Button clicked!');
      console.log('Client ID from env:', process.env.REACT_APP_GOOGLE_CLIENT_ID);
      console.log('window.google available:', !!window.google);
      console.log('window.google object:', window.google);
      
      // Re-initialize Google Sign-In to ensure it's properly set up
      initializeGoogleSignIn();
      
      // Trigger the Google Sign-In prompt
      if (window.google && window.google.accounts && window.google.accounts.id) {
        console.log('Prompting Google Sign-In');
        window.google.accounts.id.prompt();
      } else {
        console.error('Google Sign-In not available');
        setLoginError('Google Sign-In is not available. Please try again later.');
      }
    } catch (error) {
      console.error('Google Sign-In error:', error);
      setLoginError('Google Sign-In failed. Please try again.');
    }
  }, [initializeGoogleSignIn]);

  // Render Google button in a div element
  const renderGoogleSignInButton = useCallback((containerId: string) => {
    const container = document.getElementById(containerId);
    if (container && window.google) {
      // Clear any existing content
      container.innerHTML = '';
      renderGoogleButton(container, {
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'rectangular',
        width: '100%'
      });
    }
  }, [renderGoogleButton]);

  // Effect to render Google buttons after component mounts
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isSignUp) {
        renderGoogleSignInButton('google-signin-signup');
      } else {
        renderGoogleSignInButton('google-signin-login');
      }
    }, 500); // Small delay to ensure DOM is ready

    return () => clearTimeout(timer);
  }, [isSignUp, renderGoogleSignInButton]);

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
    // Clear previous errors
    setLoginError('');
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
        // Navigate to dashboard in same window
        navigate('/dashboard');
      } catch (error: any) {
        console.error('Login failed:', error);
        // Check if MFA verification is required
        if (error.requiresMfa) {
          setShowMfaVerification(true);
        } else {
          // Store the error message from the backend
          setLoginError(error.message || 'Login failed. Please try again.');
        }
      }
    }
  }, [email, password, rememberMe, navigate, login]);

  // Handle MFA verification
  const handleMfaVerification = useCallback(async (code: string) => {
    try {
      setMfaError('');
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
          name: data.user.full_name || data.user.email.split('@')[0],
          plan: "free",
          isVerified: data.user.is_verified,
          mfaEnabled: data.user.mfa_enabled
        };
        
        // Update user state and localStorage directly
         setUser(userData);
         localStorage.setItem("user", JSON.stringify(userData));
         
         navigate('/dashboard');
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
      if (error.message.includes('Authentication session expired')) {
        setShowMfaVerification(false);
      }
      setMfaError(error.message || 'Verification failed. Please try again.');
    }
  }, [navigate, setUser]);

  // Handle back to login from MFA
  const handleBackToLogin = useCallback(() => {
    setShowMfaVerification(false);
    setMfaError('');
  }, []);

  useEffect(() => {
    // Check if URL has signup parameter
    const params = new URLSearchParams(location.search);
    if (params.get('signup') === 'true') {
      setIsSignUp(true);
    } else {
      setIsSignUp(false); // Ensure it's false if signup param is not present
    }
  }, [location]);

  // Handle signup form submission
  const handleSignup = useCallback(async (e: React.FormEvent, name: string, username: string) => {
    e.preventDefault();
    // Clear previous messages
    setSignupError('');
    setSignupSuccess('');
    
    if (email && password && name && username) {
      try {
        await signup(name, username, email, password);
        // Show success message
        setSignupSuccess('Account created successfully! Please login to continue.');
        // Navigate to login page after a short delay
        setTimeout(() => {
          setIsSignUp(false);
          navigate('/auth');
        }, 2000);
      } catch (error: any) {
        console.error('Signup failed:', error);
        // Store the error message from the backend
        setSignupError(error.message || 'Signup failed. Please try again.');
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
    <div className="h-screen flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
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
                          handleGoogleSignIn={handleGoogleSignIn}
                        />
                    ) : showMfaVerification ? (
                      <MfaVerificationForm
                        onVerify={handleMfaVerification}
                        onBack={handleBackToLogin}
                        error={mfaError}
                        email={email}
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
                        handleGoogleSignIn={handleGoogleSignIn}
                        setShowForgotPasswordModal={setShowForgotPasswordModal}
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

      {/* Forgot Password Modal */}
      <ForgotPasswordModal
        isOpen={showForgotPasswordModal}
        onClose={() => setShowForgotPasswordModal(false)}
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
  error?: string; // Add error prop
  successMessage?: string; // Add success message prop
  handleGoogleSignIn?: () => void;
  setShowForgotPasswordModal?: (show: boolean) => void;
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
  error = '', // Add error prop with default value
  handleGoogleSignIn,
  setShowForgotPasswordModal
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
        {/* Display error message if it exists */}
        {error && (
          <div className="text-red-500 text-sm bg-red-100/10 p-2 rounded border border-red-500/30">
            {error}
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
          <div className="text-sm">
            <button 
              type="button" 
              onClick={() => setShowForgotPasswordModal?.(true)}
              className="text-teal-400 hover:text-teal-300 transition-colors duration-300"
            >
              Forgot password?
            </button>
          </div>
        </div>

        <motion.button
           type="submit"
           whileHover={{ scale: 1.02 }}
           whileTap={{ scale: 0.98 }}
           className="w-full py-2.5 px-4 mt-2 text-white font-semibold rounded-lg shadow-lg transition-all duration-300 transform hover:-translate-y-0.5 flex items-center justify-center"
           style={{ backgroundColor: '#14b8a6' }}
           onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#0f9488'}
           onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#14b8a6'}
         >
           <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
           </svg>
           Login
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

          <div id="google-signin-login" className="w-full"></div>
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
  handleGoogleSignIn
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
            
            {/* Password requirements component */}
            {password.length > 0 && <PasswordRequirements password={password} />}
          </div>
          

          
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
           whileHover={{ scale: 1.02 }}
           whileTap={{ scale: 0.98 }}
           className="w-full py-3 px-4 text-white font-semibold rounded-lg shadow-lg transition-all duration-300 transform hover:-translate-y-0.5 flex items-center justify-center"
           style={{ backgroundColor: '#14b8a6' }}
           onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#0f9488'}
           onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#14b8a6'}
         >
           <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
           </svg>
           Create Account
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

          <div id="google-signin-signup" className="w-full"></div>
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
}> = memo(({ onVerify, onBack, error, email }) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleCodeComplete = async (code: string) => {
    setIsLoading(true);
    await onVerify(code);
    setIsLoading(false);
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
          loading={isLoading}
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