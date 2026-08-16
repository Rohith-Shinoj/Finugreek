import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export const NotFound = () => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <h1 className="text-9xl font-bold text-text-primary tracking-tighter mb-4 opacity-20">
        404
      </h1>
      <h2 className="text-2xl font-semibold text-text-primary mb-2">
        Page Not Found
      </h2>
      <p className="text-text-secondary max-w-md mb-8">
        The page you are looking for does not exist in the current index.
      </p>
      
      <Link 
        to="/" 
        className="inline-flex items-center gap-2 px-6 py-3 bg-surface hover:bg-surface-hover border border-border rounded-lg text-text-primary transition-colors duration-200"
      >
        <ArrowLeft size={18} />
        <span>Return to Dashboard</span>
      </Link>
    </div>
  );
};
