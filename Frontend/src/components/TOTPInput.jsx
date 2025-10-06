import React, { useState, useRef, useEffect } from 'react';

const TOTPInput = ({ onComplete, loading = false, error = '', value = '' }) => {
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const inputRefs = useRef([]);

  useEffect(() => {
    // Focus first input on mount
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, []);
  // Sync internal digits state with external value prop
  useEffect(() => {
    if (value === '' || value.length === 0) {
      setDigits(['', '', '', '', '', '']);
    } else if (value.length === 6) {
      setDigits(value.split(''));
    }
  }, [value]);

  useEffect(() => {
    // Check if all digits are filled
    if (digits.every(digit => digit !== '')) {
      const code = digits.join('');
      onComplete(code);
    }
  }, [digits, onComplete]);
  const handleChange = (index, value) => {
    // Only allow single digits
    if (value.length > 1) return;
    
    // Only allow numbers
    if (value && !/^[0-9]$/.test(value)) return;

    const newDigits = [...digits];
    newDigits[index] = value;
    setDigits(newDigits);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };
  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        // If current input is empty, focus previous and clear it
        inputRefs.current[index - 1]?.focus();
        const newDigits = [...digits];
        newDigits[index - 1] = '';
        setDigits(newDigits);
      } else {
        // Clear current input
        const newDigits = [...digits];
        newDigits[index] = '';
        setDigits(newDigits);
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };
  
  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text');
    
    // Check if pasted data is 6 digits
    if (/^[0-9]{6}$/.test(pastedData)) {
      const newDigits = pastedData.split('');
      setDigits(newDigits);
      // Focus last input
      inputRefs.current[5]?.focus();
    }
  };

  const clearInputs = () => {
    setDigits(['', '', '', '', '', '']);
    inputRefs.current[0]?.focus();
  };
  
  return (
    <div className="space-y-4">
      <div className="flex justify-center space-x-2">
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(el) => (inputRefs.current[index] = el)}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => handleChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={handlePaste}
            disabled={loading}
            className={`w-12 h-12 text-center text-xl font-bold border-2 rounded-lg transition-all duration-200 ${
              error
                ? 'border-red-500 bg-red-50 text-red-900'
                : digit
                ? 'border-green-500 bg-green-50 text-green-900'
                : 'border-gray-300 bg-white text-gray-900 focus:border-purple-500 focus:ring-2 focus:ring-purple-200'
            } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
          />
        ))}
      </div>
      {error && (
        <div className="text-center">
          <p className="text-red-500 text-sm mb-2">{error}</p>
          <button
            onClick={clearInputs}
            className="text-purple-600 hover:text-purple-700 text-sm underline"
          >
            Clear and try again
          </button>
        </div>
      )}
      
      {loading && (
        <div className="text-center">
          <div className="inline-flex items-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600"></div>
            <span className="text-gray-600 text-sm">Verifying...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default TOTPInput;








