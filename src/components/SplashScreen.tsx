import React, { useEffect, useState } from 'react';

interface SplashScreenProps {
  onFinish?: () => void;
  minDuration?: number; // ms to show animation before starting fadeout
}

export default function SplashScreen({
  onFinish,
  minDuration = 2500
}: SplashScreenProps) {
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [isRemoved, setIsRemoved] = useState(false);

  useEffect(() => {
    // 1. Block scrolling, swipe gestures, bounce, and overscroll movement
    const prevOverflow = document.body.style.overflow;
    const prevTouchAction = document.body.style.touchAction;
    const prevOverscroll = document.body.style.overscrollBehavior;

    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    document.body.style.overscrollBehavior = 'none';

    const preventScroll = (e: Event) => {
      e.preventDefault();
    };

    window.addEventListener('wheel', preventScroll, { passive: false });
    window.addEventListener('touchmove', preventScroll, { passive: false });

    // 2. Timer to trigger smooth fadeout
    const fadeTimer = setTimeout(() => {
      setIsFadingOut(true);
    }, minDuration);

    // 3. Timer to completely unmount and restore scrolling
    const unmountTimer = setTimeout(() => {
      setIsRemoved(true);
      document.body.style.overflow = prevOverflow;
      document.body.style.touchAction = prevTouchAction;
      document.body.style.overscrollBehavior = prevOverscroll;
      window.removeEventListener('wheel', preventScroll);
      window.removeEventListener('touchmove', preventScroll);
      if (onFinish) {
        onFinish();
      }
    }, minDuration + 600);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(unmountTimer);
      document.body.style.overflow = prevOverflow;
      document.body.style.touchAction = prevTouchAction;
      document.body.style.overscrollBehavior = prevOverscroll;
      window.removeEventListener('wheel', preventScroll);
      window.removeEventListener('touchmove', preventScroll);
    };
  }, [minDuration, onFinish]);

  if (isRemoved) return null;

  return (
    <div
      className={`fixed inset-0 z-[99999] flex flex-col items-center justify-center select-none overflow-hidden transition-all duration-600 ease-out ${
        isFadingOut ? 'opacity-0 scale-[1.02] pointer-events-none' : 'opacity-100 scale-100'
      }`}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: '#f8fafc',
        touchAction: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        fontFamily: "'Montserrat', system-ui, -apple-system, sans-serif"
      }}
    >
      <style>{`
        /* --- App Icon Soft Spring Zoom-in --- */
        @keyframes tbZoomInIcon {
          0% {
            transform: scale(0.35);
            opacity: 0;
          }
          70% {
            transform: scale(1.04);
            opacity: 1;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        /* --- Falling Book & "T" with Natural Gravity, Motion Stretch & Soft Squash Rebound --- */
        @keyframes tbGravityFallT {
          0% {
            transform: translateY(-260px) scaleY(1.3) scaleX(0.9);
            opacity: 0;
          }
          64% {
            transform: translateY(0px) scaleY(1.14) scaleX(0.93);
            opacity: 1;
          }
          68% {
            transform: translateY(3px) scaleY(0.84) scaleX(1.16);
            opacity: 1;
          }
          80% {
            transform: translateY(-8px) scaleY(1.05) scaleX(0.98);
            opacity: 1;
          }
          92% {
            transform: translateY(1.5px) scaleY(0.98) scaleX(1.01);
            opacity: 1;
          }
          100% {
            transform: translateY(0) scaleY(1) scaleX(1);
            opacity: 1;
          }
        }

        /* --- Ground Impact Ripple --- */
        @keyframes tbImpactShockwave {
          0% {
            transform: scale(0.25);
            opacity: 0.85;
          }
          45% {
            opacity: 0.55;
          }
          100% {
            transform: scale(1.65);
            opacity: 0;
          }
        }

        @keyframes tbRingExpand {
          0% {
            transform: scale(0.35);
            opacity: 0.85;
          }
          100% {
            transform: scale(2.3);
            opacity: 0;
          }
        }

        /* --- 3D Book Page Fanning with Elastic Overshoot & Damped Settle --- */
        @keyframes tbFlipOpenPages {
          0% {
            transform: rotateY(-100deg) scale(0.85);
            opacity: 0;
          }
          30% {
            opacity: 1;
          }
          70% {
            transform: rotateY(10deg) scale(1.02);
            opacity: 1;
          }
          86% {
            transform: rotateY(-3deg) scale(0.99);
            opacity: 1;
          }
          100% {
            transform: rotateY(0deg) scale(1);
            opacity: 1;
            filter: drop-shadow(-1px 3px 8px rgba(16, 185, 129, 0.28));
          }
        }

        /* --- Staggered Checklist Lines Slide-in --- */
        @keyframes tbShowLine {
          0% {
            opacity: 0;
            transform: translateX(8px);
          }
          100% {
            opacity: 1;
            transform: translateX(0);
          }
        }

        /* --- Brand Wordmark Smooth Reveal --- */
        @keyframes tbFadeUpText {
          0% {
            opacity: 0;
            transform: translateY(18px);
            filter: blur(4px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
            filter: blur(0px);
          }
        }
      `}</style>

      {/* Clean Light-Mode Ambient Viewport Background */}
      <div 
        className="w-full h-full flex flex-col items-center justify-center relative"
        style={{
          background: 'radial-gradient(circle at 50% 45%, #ffffff 0%, #f8fafc 55%, #edf2f7 100%)'
        }}
      >
        <div className="flex flex-col items-center justify-center transform-gpu" style={{ perspective: 1000 }}>
          
          {/* App Icon Box - Pristine Light Floating Card */}
          <div
            className="relative flex items-center justify-center"
            style={{
              width: 170,
              height: 170,
              backgroundColor: '#ffffff',
              borderRadius: 40,
              boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.12), 0 8px 24px -4px rgba(15, 23, 42, 0.06), 0 0 0 1px rgba(15, 23, 42, 0.05)',
              transform: 'scale(0)',
              animation: 'tbZoomInIcon 0.52s cubic-bezier(0.34, 1.56, 0.64, 1) forwards'
            }}
          >
            <div className="relative" style={{ width: 120, height: 120, perspective: 600 }}>
              
              {/* Ground Impact Shockwave (triggers as book lands at 0.68s) */}
              <div
                className="absolute pointer-events-none"
                style={{
                  bottom: 12,
                  left: 25,
                  width: 70,
                  height: 14,
                  background: 'radial-gradient(ellipse at center, rgba(11,28,51,0.28) 0%, rgba(16,185,129,0.25) 45%, transparent 75%)',
                  borderRadius: '50%',
                  transform: 'scale(0.25)',
                  opacity: 0,
                  animation: 'tbImpactShockwave 0.45s 0.68s cubic-bezier(0.1, 0.9, 0.2, 1) forwards'
                }}
              />
              {/* Outer ripple ring */}
              <div
                className="absolute pointer-events-none"
                style={{
                  bottom: 8,
                  left: 21,
                  width: 78,
                  height: 22,
                  borderRadius: '50%',
                  border: '1.5px solid rgba(16, 185, 129, 0.4)',
                  transform: 'scale(0.35)',
                  opacity: 0,
                  animation: 'tbRingExpand 0.42s 0.68s ease-out forwards'
                }}
              />

              {/* The Unified Book & "T" Entity (Falls and Bounces) */}
              <div
                className="absolute"
                style={{
                  top: 20,
                  left: 20,
                  width: 80,
                  height: 80,
                  opacity: 0,
                  transformOrigin: 'center bottom',
                  transform: 'translateY(-260px) scaleY(1.3) scaleX(0.9)',
                  animation: 'tbGravityFallT 0.68s 0.30s cubic-bezier(0.32, 0.08, 0.15, 1) forwards',
                  zIndex: 2,
                  willChange: 'transform, opacity'
                }}
              >
                {/* 1. T Top Crossbar (Spans the entire book header) */}
                <div
                  className="absolute"
                  style={{
                    top: 0,
                    left: 0,
                    width: 80,
                    height: 16,
                    backgroundColor: '#0B1C33',
                    borderRadius: 6,
                    boxShadow: '0 4px 10px rgba(11, 28, 51, 0.22)',
                    zIndex: 5
                  }}
                >
                  {/* Top White Bookmark / Page Edge Accent Strip */}
                  <div
                    className="absolute"
                    style={{
                      top: 3.5,
                      left: 8,
                      width: 64,
                      height: 2.5,
                      backgroundColor: '#ffffff',
                      borderRadius: 2,
                      opacity: 0.95
                    }}
                  />
                </div>

                {/* 2. Left Book Cover / Wing (Deep Navy, seamless with the T) */}
                <div
                  className="absolute"
                  style={{
                    top: 14,
                    left: 2,
                    width: 30,
                    height: 64,
                    background: 'linear-gradient(135deg, #071526 0%, #0B1C33 100%)',
                    borderRadius: '0 0 4px 8px',
                    boxShadow: '-2px 4px 10px rgba(11, 28, 51, 0.15)',
                    zIndex: 3
                  }}
                >
                  {/* Subtle vertical spine groove */}
                  <div
                    className="absolute"
                    style={{
                      top: 6,
                      left: 5,
                      width: 2,
                      height: 52,
                      backgroundColor: 'rgba(255, 255, 255, 0.12)',
                      borderRadius: 1
                    }}
                  />
                </div>

                {/* 3. Center Bold Vertical Stem of the "T" (Standing bold down the middle) */}
                <div
                  className="absolute"
                  style={{
                    top: 14,
                    left: 29,
                    width: 22,
                    height: 64,
                    backgroundColor: '#0B1C33',
                    borderRadius: '0 0 6px 6px',
                    boxShadow: '0 4px 12px rgba(11, 28, 51, 0.28)',
                    zIndex: 6
                  }}
                >
                  {/* Center stem inner lighting highlight */}
                  <div
                    className="absolute"
                    style={{
                      top: 4,
                      left: 3,
                      width: 2,
                      height: 54,
                      backgroundColor: 'rgba(255, 255, 255, 0.2)',
                      borderRadius: 1
                    }}
                  />
                </div>

                {/* 4. Right Emerald Green Ledger Pages (Flips open smoothly from the central stem) */}
                <div
                  className="absolute flex flex-col items-center justify-center gap-1.5"
                  style={{
                    top: 15,
                    left: 49,
                    width: 29,
                    height: 63,
                    backgroundColor: '#10B981',
                    borderRadius: '0 0 8px 0',
                    transformOrigin: 'left center',
                    transform: 'rotateY(-100deg) scale(0.85)',
                    opacity: 0,
                    animation: 'tbFlipOpenPages 0.85s 0.72s cubic-bezier(0.2, 0.9, 0.3, 1.15) forwards',
                    zIndex: 4,
                    willChange: 'transform, opacity',
                    boxShadow: '-2px 0 6px rgba(0, 0, 0, 0.1), 0 6px 16px rgba(16, 185, 129, 0.32)'
                  }}
                >
                  {/* Book page spine shadow gradient */}
                  <div
                    className="absolute inset-0 pointer-events-none rounded-[inherit]"
                    style={{
                      background: 'linear-gradient(to right, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.02) 20%, transparent 60%)',
                      zIndex: 1
                    }}
                  />

                  {/* Crisp white checklist lines (Guaranteed visible with z-index) */}
                  <div
                    className="relative"
                    style={{
                      width: 17,
                      height: 3,
                      backgroundColor: '#ffffff',
                      borderRadius: 2,
                      opacity: 0,
                      transform: 'translateX(8px)',
                      animation: 'tbShowLine 0.25s 1.10s cubic-bezier(0.16, 1, 0.3, 1) forwards',
                      zIndex: 2
                    }}
                  />
                  <div
                    className="relative"
                    style={{
                      width: 17,
                      height: 3,
                      backgroundColor: '#ffffff',
                      borderRadius: 2,
                      opacity: 0,
                      transform: 'translateX(8px)',
                      animation: 'tbShowLine 0.25s 1.22s cubic-bezier(0.16, 1, 0.3, 1) forwards',
                      zIndex: 2
                    }}
                  />
                  <div
                    className="relative"
                    style={{
                      width: 12,
                      height: 3,
                      backgroundColor: '#ffffff',
                      borderRadius: 2,
                      opacity: 0,
                      transform: 'translateX(8px)',
                      animation: 'tbShowLine 0.25s 1.34s cubic-bezier(0.16, 1, 0.3, 1) forwards',
                      zIndex: 2
                    }}
                  />
                </div>
              </div>

            </div>
          </div>

          {/* Brand Wordmark Typography - Pristine in Light Theme */}
          <div
            className="text-center font-bold tracking-tight"
            style={{
              marginTop: 34,
              fontSize: '2.2rem',
              letterSpacing: '-0.02em',
              color: '#0f172a',
              opacity: 0,
              transform: 'translateY(18px)',
              animation: 'tbFadeUpText 0.72s 1.32s cubic-bezier(0.16, 1, 0.3, 1) forwards'
            }}
          >
            Track<span style={{ color: '#10B981' }}>Book</span>
          </div>

          <div
            className="uppercase font-semibold tracking-widest text-center"
            style={{
              marginTop: 6,
              fontSize: '0.8rem',
              letterSpacing: '0.16em',
              color: '#64748b',
              opacity: 0,
              transform: 'translateY(10px)',
              animation: 'tbFadeUpText 0.65s 1.50s cubic-bezier(0.16, 1, 0.3, 1) forwards'
            }}
          >
            Smart Financial Tracking
          </div>

        </div>
      </div>
    </div>
  );
}
