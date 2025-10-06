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
