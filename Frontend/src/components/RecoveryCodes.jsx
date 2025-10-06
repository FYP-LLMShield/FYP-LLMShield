import React, { useState } from 'react';
import { Copy, Check, Download, RefreshCw, AlertTriangle } from 'lucide-react';

const RecoveryCodes = ({ codes, onRegenerate, loading = false }) => {
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [showWarning, setShowWarning] = useState(false);

  const copyToClipboard = async (code, index) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const copyAllCodes = async () => {
    try {
      const allCodes = codes.join('\n');
      await navigator.clipboard.writeText(allCodes);
      setCopiedIndex('all');
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error('Failed to copy all codes:', err);
    }
  };

  const downloadCodes = () => {
    const codesText = codes.map((code, index) => `${index + 1}. ${code}`).join('\n');
    const blob = new Blob([codesText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mfa-recovery-codes.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleRegenerate = () => {
    if (showWarning) {
      onRegenerate();
      setShowWarning(false);
    } else {
      setShowWarning(true);
    }
  };

  if (!codes || codes.length === 0) {
    return (
      <div className="text-center py-8">
        <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
        <p className="text-gray-600">No recovery codes available</p>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      {/* Warning Banner */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
          <div>
            <h4 className="text-yellow-800 font-medium">Important: Save These Codes</h4>
            <p className="text-yellow-700 text-sm mt-1">
              These recovery codes can be used to access your account if you lose your authenticator device. 
              Each code can only be used once. Store them in a safe place.
            </p>
          </div>
        </div>
      </div>


