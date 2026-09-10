import React from 'react';
import { cn } from '../lib/utils';
import { SignalQuality } from '../services/networkSignalService';

export interface NetworkSignalStripesProps {
  bars: number; // 0 to 4
  quality?: SignalQuality;
  className?: string;
  isChecking?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const NetworkSignalStripes: React.FC<NetworkSignalStripesProps> = ({
  bars = 4,
  quality = 'excellent',
  className,
  isChecking = false,
  size = 'md',
}) => {
  const isOffline = quality === 'offline' || bars === 0;

  // Height fractions for the 4 bars
  const heightStyles = ['h-[32%]', 'h-[54%]', 'h-[76%]', 'h-[100%]'];

  // Dimensions based on size prop
  const containerClasses = {
    sm: 'h-3 w-3 gap-[1.5px]',
    md: 'h-3.5 w-3.5 gap-[2px]',
    lg: 'h-4 w-4 gap-[2.5px]',
  }[size];

  const barWidthClass = {
    sm: 'w-[2px]',
    md: 'w-[2.5px]',
    lg: 'w-[3px]',
  }[size];

  // Active color depending on signal quality / bar count
  const getActiveColor = () => {
    if (isOffline) return 'bg-red-500 dark:bg-red-500';
    if (bars >= 3) return 'bg-emerald-500 dark:bg-emerald-400';
    if (bars === 2) return 'bg-amber-500 dark:bg-amber-400';
    return 'bg-rose-500 dark:bg-rose-400';
  };

  const activeColor = getActiveColor();
  const inactiveColor = isOffline ? 'bg-red-500/30 dark:bg-red-500/40' : 'bg-slate-200 dark:bg-zinc-700/60';

  return (
    <div 
      className={cn(
        "relative flex items-end shrink-0 select-none pb-[1px]",
        containerClasses,
        className
      )}
      title={isOffline ? "No Internet Connection (Offline)" : `Network Signal: ${bars} of 4 bars (${quality})`}
      aria-label={isOffline ? "No Internet Connection" : `Signal strength: ${bars} of 4 bars`}
    >
      {[0, 1, 2, 3].map((index) => {
        const isActive = isOffline || index < bars;
        const barColor = isOffline 
          ? (index === 0 ? 'bg-red-500 dark:bg-red-500' : 'bg-red-500/70 dark:bg-red-500/80')
          : (isActive ? activeColor : inactiveColor);

        return (
          <span
            key={index}
            className={cn(
              "rounded-t-[1.5px] transition-all duration-300",
              barWidthClass,
              heightStyles[index],
              barColor,
              isChecking && "animate-pulse"
            )}
            style={{
              transitionDelay: `${index * 30}ms`
            }}
          />
        );
      })}

      {/* When offline, render a red diagonal strike across the signal icon to clearly indicate No Internet */}
      {isOffline && (
        <span 
          className="absolute inset-0 m-auto w-[130%] h-[1.5px] bg-red-600 dark:bg-red-500 -rotate-45 pointer-events-none rounded-full shadow-xs origin-center"
        />
      )}
    </div>
  );
};
