import React, { useState, useEffect, useRef, useCallback } from 'react';

export function useRunawayButton(isValid: boolean) {
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [step, setStep] = useState(0);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  // When all required fields become valid, smoothly return to normal resting position
  useEffect(() => {
    if (isValid) {
      setOffset({ x: 0, y: 0 });
    }
  }, [isValid]);

  const triggerRunaway = useCallback((e?: React.SyntheticEvent | MouseEvent | TouchEvent) => {
    if (isValid) return;

    // Suppress submission and propagation
    if (e) {
      if ('preventDefault' in e && typeof e.preventDefault === 'function') {
        e.preventDefault();
      }
      if ('stopPropagation' in e && typeof e.stopPropagation === 'function') {
        e.stopPropagation();
      }
    }

    // Subtle playful haptic feedback on supported mobile devices
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(25);
      } catch {
        // Silently catch unsupported vibration
      }
    }

    // Safe presets that keep the button inside the visible card & form bounds
    const presets = [
      { x: -18, y: 38 },
      { x: 18, y: -38 },
      { x: -20, y: -36 },
      { x: 20, y: 40 },
      { x: -16, y: 40 },
      { x: 16, y: -40 },
      { x: 0, y: 38 },
      { x: 0, y: -38 },
    ];

    // If pointer coords are available, dodge away from pointer position
    let clientX: number | null = null;
    let clientY: number | null = null;

    if (e) {
      if ('touches' in e && (e as any).touches?.[0]) {
        clientX = (e as any).touches[0].clientX;
        clientY = (e as any).touches[0].clientY;
      } else if ('clientX' in e && typeof (e as any).clientX === 'number') {
        clientX = (e as any).clientX;
        clientY = (e as any).clientY;
      }
    }

    if (buttonRef.current && clientX !== null && clientY !== null) {
      const rect = buttonRef.current.getBoundingClientRect();
      const isTop = clientY < rect.top + rect.height / 2;
      const isLeft = clientX < rect.left + rect.width / 2;

      let nextY = isTop ? 40 : -40;
      let nextX = isLeft ? 18 : -18;

      setOffset((prev) => {
        // If already near target position, flip to opposite quadrant
        if (Math.abs(prev.y - nextY) < 12) {
          nextY = -nextY;
        }
        if (Math.abs(prev.x - nextX) < 8) {
          nextX = -nextX;
        }
        return { x: nextX, y: nextY };
      });
    } else {
      // Cycle through presets
      setStep((prev) => {
        const next = (prev + 1) % presets.length;
        setOffset(presets[next]);
        return next;
      });
    }
  }, [isValid]);

  return {
    buttonRef,
    offset,
    isValid,
    triggerRunaway,
    runawayProps: {
      ref: buttonRef,
      type: isValid ? ('submit' as const) : ('button' as const),
      animate: { x: offset.x, y: offset.y },
      transition: {
        type: 'spring' as const,
        stiffness: 420,
        damping: 24,
        mass: 0.8,
      },
      whileHover: isValid ? { scale: 1.01 } : undefined,
      whileTap: isValid ? { scale: 0.985 } : undefined,
      onMouseEnter: (e: React.MouseEvent) => {
        if (!isValid) triggerRunaway(e);
      },
      onPointerDown: (e: React.PointerEvent) => {
        if (!isValid) triggerRunaway(e);
      },
      onTouchStart: (e: React.TouchEvent) => {
        if (!isValid) triggerRunaway(e);
      },
      onClick: (e: React.MouseEvent) => {
        if (!isValid) {
          e.preventDefault();
          e.stopPropagation();
          triggerRunaway(e);
        }
      },
      onFocus: (e: React.FocusEvent) => {
        if (!isValid) triggerRunaway(e);
      },
    }
  };
}
