import React, { useState, useEffect, useRef } from 'react';

interface DashboardLoadingTextProps {
  className?: string;
}

export function DashboardLoadingText({ className = '' }: DashboardLoadingTextProps) {
  const fullText = "Opening TrackBook Dashboard...";
  const [displayedText, setDisplayedText] = useState("");
  const [showCursor, setShowCursor] = useState(true);

  // Blinking cursor interval
  useEffect(() => {
    const cursorInterval = setInterval(() => {
      setShowCursor((prev) => !prev);
    }, 530);
    return () => clearInterval(cursorInterval);
  }, []);

  // Typing animation
  useEffect(() => {
    let currentIndex = 0;
    let timeoutId: any;
    let isCancelled = false;

    const typeNextCharacter = () => {
      if (isCancelled) return;

      if (currentIndex < fullText.length) {
        currentIndex++;
        setDisplayedText(fullText.slice(0, currentIndex));
        
        // Realistic typing rhythm with slight natural variance (40ms - 60ms)
        const char = fullText[currentIndex - 1];
        const variance = char === ' ' ? 30 : Math.floor(Math.random() * 20);
        const delay = 48 + variance;
        
        timeoutId = setTimeout(typeNextCharacter, delay);
      } else {
        // Complete text appears: keep it visible briefly (2.8s)
        // If the dashboard is still loading, re-run typing
        timeoutId = setTimeout(() => {
          if (!isCancelled) {
            currentIndex = 0;
            setDisplayedText("");
            timeoutId = setTimeout(typeNextCharacter, 250);
          }
        }, 2800);
      }
    };

    // Brief initial hesitation before typing begins
    timeoutId = setTimeout(typeNextCharacter, 150);

    return () => {
      isCancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  return (
    <p
      className={`text-sm font-medium text-slate-500 font-sans tracking-normal flex items-center justify-center min-h-[20px] select-none ${className}`}
    >
      <span>{displayedText}</span>
      <span
        aria-hidden="true"
        className={`inline-block w-[1.5px] h-[13px] bg-slate-400 dark:bg-slate-500 ml-0.5 align-middle transition-opacity duration-100 ${
          showCursor ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </p>
  );
}
