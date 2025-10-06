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
