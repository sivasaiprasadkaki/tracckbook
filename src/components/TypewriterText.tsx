import React, { useState, useEffect } from 'react';

interface TypewriterTextProps {
  text: string;
  speed?: number;
  delay?: number;
  cursor?: boolean;
  loop?: boolean;
  loopInterval?: number;
  className?: string;
  cursorClassName?: string;
}

export default function TypewriterText({
  text,
  speed = 75,
  delay = 200,
  cursor = true,
  loop = true,
  loopInterval = 6000,
  className = '',
  cursorClassName = 'w-[2px] h-[0.9em] bg-current ml-0.5 inline-block align-middle'
}: TypewriterTextProps) {
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(true);

  useEffect(() => {
    let intervalId: any = null;
    let loopTimeout: any = null;
    let startTimeout: any = null;
    let isCancelled = false;

    function startTyping() {
      if (isCancelled) return;
      setDisplayedText('');
      setIsTyping(true);

      startTimeout = setTimeout(() => {
        if (isCancelled) return;
        let index = 0;
        intervalId = setInterval(() => {
          if (isCancelled) return;
          index++;
          setDisplayedText(text.slice(0, index));
          if (index >= text.length) {
            clearInterval(intervalId);
            setIsTyping(false);
            if (loop) {
              loopTimeout = setTimeout(() => {
                if (!isCancelled) startTyping();
              }, loopInterval);
            }
          }
        }, speed);
      }, delay);
    }

    startTyping();

    return () => {
      isCancelled = true;
      if (intervalId) clearInterval(intervalId);
      if (loopTimeout) clearTimeout(loopTimeout);
      if (startTimeout) clearTimeout(startTimeout);
    };
  }, [text, speed, delay, loop, loopInterval]);

  return (
    <span className={`inline-flex items-center font-['Inter',sans-serif] ${className}`}>
      <span>{displayedText}</span>
      {cursor && (
        <span 
          className={`${cursorClassName} ${isTyping ? 'opacity-100 animate-pulse' : 'animate-ping opacity-60'}`}
          aria-hidden="true"
        />
      )}
    </span>
  );
}
