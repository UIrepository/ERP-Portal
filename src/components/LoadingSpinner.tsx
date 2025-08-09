// src/components/LoadingSpinner.tsx
import React from 'react';

export const LoadingSpinner = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      {/* Background decorative circles, same as AuthPage */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-200 rounded-full mix-blend-multiply filter blur-2xl opacity-50 animate-blob"></div>
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-200 rounded-full mix-blend-multiply filter blur-2xl opacity-50 animate-blob animation-delay-2000"></div>
      <div className="absolute -bottom-40 -left-20 w-80 h-80 bg-sky-200 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob animation-delay-4000"></div>

      <div className="relative flex flex-col items-center justify-center space-y-8">
        {/* Logo with pulsing rings */}
        <div className="relative w-32 h-32 flex items-center justify-center">
          <div className="absolute w-full h-full rounded-full bg-primary/10 animate-pulse-slow"></div>
          <div className="absolute w-2/3 h-2/3 rounded-full bg-primary/20 animate-pulse-slower"></div>
          <img 
            src="/logoofficial.png" 
            alt="UI Logo" 
            className="relative h-16 w-16" 
          />
        </div>

        {/* Horizontal Loading Bar */}
        <div className="w-48 h-1.5 bg-primary/10 rounded-full overflow-hidden">
          <div className="w-full h-full bg-gradient-to-r from-blue-400 via-indigo-500 to-sky-400 animate-fill-bar"></div>
        </div>
      </div>
    </div>
  );
};
