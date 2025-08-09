// src/components/LoadingSpinner.tsx
import React from 'react';

export const LoadingSpinner = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      {/* Background decorative circles */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-200 rounded-full mix-blend-multiply filter blur-2xl opacity-50 animate-blob"></div>
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-200 rounded-full mix-blend-multiply filter blur-2xl opacity-50 animate-blob animation-delay-2000"></div>
      <div className="absolute -bottom-40 -left-20 w-80 h-80 bg-sky-200 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob animation-delay-4000"></div>
      
      <div className="relative flex flex-col items-center space-y-4">
        <img 
          src="/logoofficial.png" 
          alt="UI Logo" 
          className="h-24 w-24 animate-bounce-slow" 
        />
        <div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin-slow border-primary"></div>
        <p className="text-lg text-gray-600">Loading your dashboard...</p>
      </div>
    </div>
  );
};
