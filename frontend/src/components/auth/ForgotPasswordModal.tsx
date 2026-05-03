import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import { authAPI } from '../../lib/api';
import { supabase, isSupabaseAuthAvailable, isSupabaseUnavailableError } from '../../lib/supabase';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** When set, use this email (e.g. from login form) and send reset link without asking user to type it */
  prefillEmail?: string;
}

function passwordResetRedirectBase(): string {
  const fromEnv = (process.env.REACT_APP_APP_URL || '').trim().replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  if (typeof window !== 'undefined') return window.location.origin.replace(/\/$/, '');
  return '';
}

/**
 * Prefer Supabase Auth's reset email when the app uses Supabase (same keys as sign-in).
 * Falls back to backend /auth/forgot-password for Mongo-only auth or when Supabase is down.
 */
async function requestPasswordResetEmail(emailRaw: string): Promise<{ ok: boolean; message?: string }> {
  const email = emailRaw.trim().toLowerCase();
  if (!email) return { ok: false, message: 'Please enter your email address.' };

  if (isSupabaseAuthAvailable() && supabase) {
    try {
      const base = passwordResetRedirectBase();
      const redirectTo = base ? `${base}/reset-password` : undefined;
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        ...(redirectTo ? { redirectTo } : {}),
      });
      if (!error) {
        return { ok: true };
      }
      if (isSupabaseUnavailableError(error)) {
        const res = await authAPI.forgotPassword({ email });
        return res.success ? { ok: true } : { ok: false, message: res.error || 'Failed to send reset email.' };
      }
      return { ok: false, message: error.message || 'Failed to send reset email.' };
    } catch (e) {
      console.warn('Supabase resetPasswordForEmail failed, trying backend:', e);
      const res = await authAPI.forgotPassword({ email });
      return res.success ? { ok: true } : { ok: false, message: res.error || 'Failed to send reset email.' };
    }
  }

  const res = await authAPI.forgotPassword({ email });
  return res.success ? { ok: true } : { ok: false, message: res.error || 'Failed to send reset email.' };
}

const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({ isOpen, onClose, prefillEmail = '' }) => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [step, setStep] = useState<'email' | 'success'>('email');

  const runResetRequest = useCallback(async (emailToSend: string): Promise<boolean> => {
    const result = await requestPasswordResetEmail(emailToSend);
    if (result.ok) {
      setSuccess(true);
      setError('');
      return true;
    }
    setSuccess(false);
    setError(result.message || 'Failed to send reset email. Please try again.');
    return false;
  }, []);

  // When modal opens with prefillEmail, use that email and send reset link immediately (no "enter email" form)
  useEffect(() => {
    if (!isOpen) return;
    const toUse = (prefillEmail || '').trim();
    if (toUse) {
      setEmail(toUse);
      setStep('success');
      setSuccess(false);
      setError('');
      setIsLoading(true);
      runResetRequest(toUse)
        .catch((err) => {
          console.error('Forgot password error:', err);
          setError('An error occurred. Please try again.');
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else {
      setEmail('');
      setStep('email');
      setSuccess(false);
      setError('');
    }
  }, [isOpen, prefillEmail, runResetRequest]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const ok = await runResetRequest(email);
      if (ok) setStep('success');
    } catch (error) {
      console.error('Forgot password error:', error);
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setEmail('');
    setError('');
    setSuccess(false);
    setStep('email');
    onClose();
  };

  const handleBackToEmail = () => {
    setStep('email');
    setSuccess(false);
    setError('');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md bg-gray-800 rounded-2xl shadow-2xl border border-gray-700"
          >
            {/* Close button */}
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white transition-colors duration-200 rounded-full hover:bg-gray-700"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="p-6">
              {step === 'email' ? (
                <>
                  {/* Header */}
                  <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-teal-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Mail className="w-8 h-8 text-teal-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">Forgot Password?</h2>
                    <p className="text-gray-400 text-sm">
                      Enter your email address and we'll send you a link to reset your password.
                    </p>
                  </div>

                  {/* Error message */}
                  {error && (
                    <div className="mb-4 p-3 bg-red-900/20 border border-red-500/30 rounded-lg">
                      <p className="text-red-400 text-sm">{error}</p>
                    </div>
                  )}

                  {/* Form */}
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label htmlFor="reset-email" className="block text-sm font-medium text-gray-300 mb-2">
                        Email Address
                      </label>
                      <input
                        id="reset-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Enter your email address"
                        className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 transition-all duration-200"
                        required
                        disabled={isLoading}
                      />
                    </div>

                    <motion.button
                      type="submit"
                      disabled={isLoading || !email.trim()}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="w-full py-3 px-4 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all duration-200 flex items-center justify-center"
                    >
                      {isLoading ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        'Send Reset Link'
                      )}
                    </motion.button>
                  </form>
                </>
              ) : (
                <>
                  {/* Success state (or loading when using prefillEmail) */}
                  <div className="text-center">
                    {isLoading ? (
                      <>
                        <div className="w-16 h-16 bg-teal-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                          <div className="w-8 h-8 border-2 border-teal-400/30 border-t-teal-400 rounded-full animate-spin" />
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-2">Sending reset link</h2>
                        <p className="text-gray-400 text-sm">
                          Sending password reset link to <span className="text-white font-medium">{email}</span>…
                        </p>
                      </>
                    ) : error ? (
                      <>
                        <div className="mb-4 p-3 bg-red-900/20 border border-red-500/30 rounded-lg">
                          <p className="text-red-400 text-sm">{error}</p>
                        </div>
                        <button
                          onClick={handleClose}
                          className="w-full py-2.5 px-4 text-gray-400 hover:text-white font-medium transition-colors duration-200"
                        >
                          Back to Login
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                          <CheckCircle className="w-8 h-8 text-green-400" />
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-2">Check Your Email</h2>
                        <p className="text-gray-400 text-sm mb-6">
                          We've sent a password reset link to <span className="text-white font-medium">{email}</span>
                        </p>
                        <p className="text-gray-500 text-xs mb-6">
                          Didn't receive the email? Check your spam folder or try again.
                        </p>

                        <div className="space-y-3">
                          {!prefillEmail && (
                            <button
                              onClick={handleBackToEmail}
                              className="w-full py-2.5 px-4 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-all duration-200 flex items-center justify-center"
                            >
                              <ArrowLeft className="w-4 h-4 mr-2" />
                              Try Different Email
                            </button>
                          )}
                          
                          <button
                            onClick={handleClose}
                            className="w-full py-2.5 px-4 text-gray-400 hover:text-white font-medium transition-colors duration-200"
                          >
                            Back to Login
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ForgotPasswordModal;