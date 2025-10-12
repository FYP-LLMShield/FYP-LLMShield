import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react';
import { authAPI } from '../../lib/api';
import PasswordRequirements from './PasswordRequirements';

const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);

  // Password validation
  const [passwordRequirements, setPasswordRequirements] = useState({
    minLength: false,
    hasUppercase: false,
    hasLowercase: false,
    hasNumber: false,
    hasSpecialChar: false,
  });

  useEffect(() => {
    if (!token) {
      setError('Invalid or missing reset token');
      setTokenValid(false);
      return;
    }
    setTokenValid(true);
  }, [token]);

  useEffect(() => {
    setPasswordRequirements({
      minLength: password.length >= 8,
      hasUppercase: /[A-Z]/.test(password),
      hasLowercase: /[a-z]/.test(password),
      hasNumber: /\d/.test(password),
      hasSpecialChar: /[!@#$%^&*(),.?":{}|<>]/.test(password),
    });
  }, [password]);

  const isPasswordValid = Object.values(passwordRequirements).every(Boolean);
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!token) {
      setError('Invalid reset token');
      return;
    }

    if (!isPasswordValid) {
      setError('Please ensure your password meets all requirements');
      return;
    }

    if (!passwordsMatch) {
      setError('Passwords do not match');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      const response = await authAPI.resetPassword({
        token,
        new_password: password,
      });

      if (response.success) {
        setSuccess(true);
        setTimeout(() => {
          navigate('/auth', { replace: true });
        }, 3000);
      } else {
        setError(response.error || 'Failed to reset password. Please try again.');
      }
    } catch (error) {
      console.error('Reset password error:', error);
      setError('An error occurred. Please try again or request a new reset link.');
    } finally {
      setIsLoading(false);
    }
  };

  if (tokenValid === false) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-gray-800 rounded-2xl shadow-2xl border border-gray-700 p-8 text-center"
        >
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-4">Invalid Reset Link</h1>
          <p className="text-gray-400 mb-6">
            This password reset link is invalid or has expired. Please request a new one.
          </p>
          <button
            onClick={() => navigate('/auth')}
            className="w-full py-3 px-4 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg transition-all duration-200"
          >
            Back to Login
          </button>
        </motion.div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-gray-800 rounded-2xl shadow-2xl border border-gray-700 p-8 text-center"
        >
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-4">Password Reset Successful</h1>
          <p className="text-gray-400 mb-6">
            Your password has been successfully reset. You will be redirected to the login page shortly.
          </p>
          <div className="w-8 h-8 border-2 border-teal-400/30 border-t-teal-400 rounded-full animate-spin mx-auto" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-gray-800 rounded-2xl shadow-2xl border border-gray-700"
      >
        <div className="p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-teal-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-teal-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Reset Your Password</h1>
            <p className="text-gray-400 text-sm">
              Enter your new password below
            </p>
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-6 p-4 bg-red-900/20 border border-red-500/30 rounded-lg">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* New Password */}
            <div>
              <label htmlFor="new-password" className="block text-sm font-medium text-gray-300 mb-2">
                New Password
              </label>
              <div className="relative">
                <input
                  id="new-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your new password"
                  className="w-full px-4 py-3 pr-12 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 transition-all duration-200"
                  required
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors duration-200"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Password Requirements */}
            {password && (
              <PasswordRequirements 
                password={password} 
              />
            )}

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-300 mb-2">
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  id="confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your new password"
                  className="w-full px-4 py-3 pr-12 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 transition-all duration-200"
                  required
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors duration-200"
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {confirmPassword && !passwordsMatch && (
                <p className="mt-2 text-sm text-red-400">Passwords do not match</p>
              )}
              {confirmPassword && passwordsMatch && (
                <p className="mt-2 text-sm text-green-400">Passwords match</p>
              )}
            </div>

            {/* Submit Button */}
            <motion.button
              type="submit"
              disabled={isLoading || !isPasswordValid || !passwordsMatch}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full py-3 px-4 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all duration-200 flex items-center justify-center"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                'Reset Password'
              )}
            </motion.button>
          </form>

          {/* Back to Login */}
          <div className="mt-6 text-center">
            <button
              onClick={() => navigate('/auth')}
              className="text-gray-400 hover:text-white text-sm transition-colors duration-200"
            >
              Back to Login
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default ResetPasswordPage;