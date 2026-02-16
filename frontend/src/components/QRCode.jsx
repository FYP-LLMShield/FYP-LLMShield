import React from 'react';

const QRCode = ({ value, size = 200 }) => {
  // Check if value is a base64 data URL (from backend)
  if (value && value.startsWith('data:image/png;base64,')) {
    return (
      <div className="bg-white p-4 rounded-lg inline-block">
        <img 
          src={value} 
          alt="QR Code for MFA Setup" 
          width={size} 
          height={size}
          className="border"
        />
        <div className="text-center mt-2 text-xs text-gray-600">
          Scan with authenticator app
        </div>
      </div>
    );
  }

  // Fallback for invalid or missing QR code data
  return (
    <div className="bg-white p-4 rounded-lg inline-block">
      <div 
        className="border border-gray-300 flex items-center justify-center bg-gray-100"
        style={{ width: size, height: size }}
      >
        <div className="text-center text-gray-500">
          <div className="text-sm font-medium">QR Code</div>
          <div className="text-xs">Loading...</div>
        </div>
      </div>
      <div className="text-center mt-2 text-xs text-gray-600">
        Scan with authenticator app
      </div>
    </div>
  );
};

export default QRCode;