import React from 'react';
import Auth from '../components/Auth';

export default function Login({ 
  theme = 'light',
  initialMode = 'signin'
}: { 
  theme: 'light' | 'dark';
  initialMode?: 'signin' | 'signup' | 'forgot';
}) {
  return (
    <div className="min-h-screen">
      <Auth theme={theme} />
    </div>
  );
}
