import React, { useState, useEffect, useCallback, memo } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext'; // Assuming this path is correct

const AuthPage: React.FC = memo(() => {
  const location = useLocation();
  const navigate = useNavigate();
  const { login, signup } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  // Load saved email on component mount
  useEffect(() => {
    const savedEmail = localStorage.getItem('rememberedEmail');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  // Handle login form submission - memoized for performance
  const handleLogin = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (rememberMe) {
      localStorage.setItem('rememberedEmail', email);
    } else {
      localStorage.removeItem('rememberedEmail');
    }
    // Accept any login values and redirect to dashboard in same window
    if (email && password) {
      try {
        await login(email, password);
        // Navigate to dashboard in same window
        navigate('/dashboard');
      } catch (error) {
        console.error('Login failed:', error);
        // Optionally, show a user-friendly error message
      }
    }
  }, [email, password, rememberMe, navigate, login]);

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
  const handleSignup = useCallback(async (e: React.FormEvent, fullName: string) => {
    e.preventDefault();
    if (email && password && fullName) {
      try {
        await signup(fullName, email, password);
        // Navigate to dashboard in same window
        navigate('/dashboard');
      } catch (error) {
        console.error('Signup failed:', error);
        // Optionally, show a user-friendly error message
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
            <div className="relative z-20 p-4 sm:p-6 flex items-start md:items-center justify-center overflow-y-auto md:overflow-visible max-h-[80svh] sm:max-h-[75svh] md:max-h-none">
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
  handleSignup?: (e: React.FormEvent, fullName: string) => void;
}

const LoginForm: React.FC<AuthFormProps> = memo(({
  toggleAuthMode,
  email = '',
  setEmail = () => {},
  password = '',
  setPassword = () => {},
  rememberMe = false,
  setRememberMe = () => {},
  handleLogin = () => {}
}) => {
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
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              className="block w-full rounded-md border-gray-300 bg-white py-2 pl-10 pr-3 text-gray-900 placeholder-gray-500 shadow-sm focus:border-teal-400 focus:ring-teal-400 sm:text-sm"
            />
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
            <button type="button" className="text-teal-400 hover:text-white transition-colors duration-300">
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

          <button
            type="button"
            className="w-full inline-flex justify-center py-2.5 px-4 border border-white/20 rounded-lg shadow-sm bg-white/10 text-sm font-medium text-white hover:bg-white/20 transition-all duration-300"
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
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

const SignUpForm: React.FC<AuthFormProps> = memo(({
  toggleAuthMode,
  handleSignup,
  email = '',
  setEmail = () => {},
  password = '',
  setPassword = () => {}
}) => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === confirmPassword && handleSignup) {
      const fullName = `${firstName} ${lastName}`.trim();
      if (fullName) {
        handleSignup(e, fullName);
      } else {
        console.error("Please enter your name!");
      }
    } else {
        console.error("Passwords do not match!");
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
                  name="first-name"
                  id="first-name"
                  placeholder="Name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  autoComplete="given-name"
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
                  name="last-name"
                  id="last-name"
                  placeholder="Username"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
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
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
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
              id="password-confirm"
              name="password-confirm"
              type="password"
              placeholder="Confirm Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              required
              className="block w-full rounded-md border-gray-300 bg-white py-2 pl-10 pr-3 text-gray-900 placeholder-gray-500 shadow-sm focus:border-teal-400 focus:ring-teal-400 sm:text-sm"
            />
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
              <button type="button" className="text-teal-400 hover:text-white transition-colors duration-300">
                Terms of Service
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

export default AuthPage;