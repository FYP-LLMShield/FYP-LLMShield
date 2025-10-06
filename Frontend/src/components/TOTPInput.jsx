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




