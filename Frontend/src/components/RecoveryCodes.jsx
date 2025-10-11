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

      
      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={copyAllCodes}
          className="flex items-center space-x-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
        >
          {copiedIndex === 'all' ? (
            <Check className="w-4 h-4" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
          <span>{copiedIndex === 'all' ? 'Copied!' : 'Copy All'}</span>
        </button>
        
        <button
          onClick={downloadCodes}
          className="flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
        >
          <Download className="w-4 h-4" />
          <span>Download</span>
        </button>
        
        <button
          onClick={handleRegenerate}
          disabled={loading}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
            showWarning
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-gray-600 hover:bg-gray-700 text-white'
          } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>
            {loading ? 'Regenerating...' : showWarning ? 'Confirm Regenerate' : 'Regenerate'}
          </span>
        </button>
      </div>
      
      {/* Warning for regeneration */}
      {showWarning && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 text-sm">
            <strong>Warning:</strong> Regenerating codes will invalidate all existing recovery codes. 
            Make sure you have saved the current codes before proceeding.
          </p>
          <button
            onClick={() => setShowWarning(false)}
            className="mt-2 text-red-600 hover:text-red-700 text-sm underline"
          >
            Cancel
          </button>
        </div>
      )}

      
      {/* Recovery Codes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {codes.map((code, index) => (
          <div
            key={index}
            className="flex items-center justify-between p-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <div className="flex items-center space-x-3">
              <span className="text-gray-500 text-sm font-medium w-6">
                {index + 1}.
              </span>
              <code className="font-mono text-gray-900 select-all">
                {code}
              </code>
            </div>
            <button
              onClick={() => copyToClipboard(code, index)}
              className="p-1 text-gray-500 hover:text-gray-700 transition-colors"
              title="Copy code"
            >
              {copiedIndex === index ? (
                <Check className="w-4 h-4 text-green-600" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          </div>
        ))}
      </div>

       {/* Usage Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-blue-800 font-medium mb-2">How to use recovery codes:</h4>
        <ul className="text-blue-700 text-sm space-y-1">
          <li>• Use these codes when you can't access your authenticator app</li>
          <li>• Enter any unused code when prompted during login</li>
          <li>• Each code can only be used once</li>
          <li>• Generate new codes if you're running low</li>
        </ul>
      </div>
    </div>
  );
};

export default RecoveryCodes;









