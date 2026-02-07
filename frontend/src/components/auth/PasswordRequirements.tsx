import React from 'react';
import { Check, X } from 'lucide-react';

interface PasswordRequirementProps {
  isMet: boolean;
  text: string;
}

const PasswordRequirement: React.FC<PasswordRequirementProps> = ({ isMet, text }) => {
  return (
    <div className="flex items-center space-x-2">
      {isMet ? (
        <Check className="h-4 w-4 text-green-500" />
      ) : (
        <X className="h-4 w-4 text-gray-400" />
      )}
      <span className={`text-sm ${isMet ? 'text-green-500' : 'text-gray-400'}`}>
        {text}
      </span>
    </div>
  );
};

interface PasswordRequirementsProps {
  password: string;
}

const PasswordRequirements: React.FC<PasswordRequirementsProps> = ({ password }) => {
  // Check if password meets requirements
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  
  // Calculate overall strength
  const requirementsMet = [hasMinLength, hasUppercase, hasLowercase, hasDigit, hasSpecialChar].filter(Boolean).length;
  const strength = requirementsMet / 5;
  
  // Determine strength color and label
  let strengthColor = 'bg-red-500';
  let strengthLabel = 'Weak';
  
  if (strength === 1) {
    strengthColor = 'bg-green-500';
    strengthLabel = 'Strong';
  } else if (strength >= 0.6) {
    strengthColor = 'bg-yellow-500';
    strengthLabel = 'Moderate';
  }

  return (
    <div className="mt-2 p-3 bg-gray-800/50 rounded-md border border-gray-700">
      <div className="mb-2">
        <div className="flex justify-between mb-1">
          <span className="text-xs text-gray-300">Password strength:</span>
          <span className="text-xs font-medium" style={{ color: strengthColor === 'bg-green-500' ? '#10b981' : strengthColor === 'bg-yellow-500' ? '#f59e0b' : '#ef4444' }}>
            {strengthLabel}
          </span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-1.5">
          <div 
            className={`${strengthColor} h-1.5 rounded-full transition-all duration-300`} 
            style={{ width: `${strength * 100}%` }}
          ></div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
        <PasswordRequirement isMet={hasMinLength} text="At least 8 characters" />
        <PasswordRequirement isMet={hasUppercase} text="One uppercase letter" />
        <PasswordRequirement isMet={hasLowercase} text="One lowercase letter" />
        <PasswordRequirement isMet={hasDigit} text="One digit" />
        <PasswordRequirement isMet={hasSpecialChar} text="One special character" />
      </div>
    </div>
  );
};

export default PasswordRequirements;