import React, { useState, useRef, useEffect, useId } from 'react';
import { ChevronDown, Check, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

export interface InAppSelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  badge?: string;
  color?: string;
}

export interface InAppSelectProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: (string | InAppSelectOption)[];
  placeholder?: string;
  label?: string;
  theme?: 'light' | 'dark';
  className?: string;
  menuClassName?: string;
  triggerClassName?: string;
  optionClassName?: string;
  tabIndex?: number;
  disabled?: boolean;
  searchable?: boolean;
  align?: 'left' | 'right';
  icon?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export const InAppSelect: React.FC<InAppSelectProps> = ({
  id,
  value,
  onChange,
  options,
  placeholder = 'Select an option',
  label,
  theme = 'light',
  className,
  menuClassName,
  triggerClassName,
  optionClassName,
  tabIndex = 0,
  disabled = false,
  searchable = false,
  align = 'left',
  icon,
  size = 'md',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const autoId = useId();
  const selectId = id || autoId;

  // Normalize options to object format
  const normalizedOptions: InAppSelectOption[] = React.useMemo(() => {
    return options.map((opt) => {
      if (typeof opt === 'string') {
        return { value: opt, label: opt };
      }
      return opt;
    });
  }, [options]);

  const selectedOption = normalizedOptions.find((opt) => opt.value === value);

  // Filter options by search query if searchable
  const filteredOptions = React.useMemo(() => {
    if (!searchQuery.trim()) return normalizedOptions;
    const q = searchQuery.toLowerCase().trim();
    return normalizedOptions.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        opt.value.toLowerCase().includes(q) ||
        (opt.badge && opt.badge.toLowerCase().includes(q))
    );
  }, [normalizedOptions, searchQuery]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      // Auto-focus search input when opened
      if (searchable) {
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, searchable]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (e.key === 'Enter' || e.key === ' ') {
      if (!isOpen) {
        e.preventDefault();
        setIsOpen(true);
      }
    } else if (e.key === 'Escape') {
      if (isOpen) {
        e.preventDefault();
        setIsOpen(false);
        setSearchQuery('');
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      } else {
        const currentIndex = filteredOptions.findIndex((opt) => opt.value === value);
        const nextIndex = (currentIndex + 1) % filteredOptions.length;
        if (filteredOptions[nextIndex]) {
          onChange(filteredOptions[nextIndex].value);
        }
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      } else {
        const currentIndex = filteredOptions.findIndex((opt) => opt.value === value);
        const prevIndex = (currentIndex - 1 + filteredOptions.length) % filteredOptions.length;
        if (filteredOptions[prevIndex]) {
          onChange(filteredOptions[prevIndex].value);
        }
      }
    }
  };

  const isDark = theme === 'dark';

  return (
    <div
      ref={containerRef}
      className={cn('relative w-full text-left select-none', className)}
      id={`in-app-select-container-${selectId}`}
    >
      {label && (
        <label
          htmlFor={selectId}
          className="block text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1.5"
        >
          {label}
        </label>
      )}

      {/* Trigger Button */}
      <button
        type="button"
        id={selectId}
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        tabIndex={tabIndex}
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            setIsOpen(!isOpen);
            if (!isOpen) setSearchQuery('');
          }
        }}
        onKeyDown={handleKeyDown}
        className={cn(
          'w-full flex items-center justify-between gap-2.5 transition-all outline-none font-semibold text-left',
          size === 'sm' && 'h-9 px-3 text-xs rounded-lg',
          size === 'md' && 'h-11 px-4 text-sm rounded-xl',
          size === 'lg' && 'h-[52px] px-4 text-sm rounded-xl',
          isDark
            ? 'bg-slate-800 border border-slate-700/70 text-slate-100 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20'
            : 'bg-slate-50 border border-slate-200 text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20',
          isOpen && 'ring-2 ring-indigo-500/30 border-indigo-500 shadow-sm',
          disabled && 'opacity-50 cursor-not-allowed bg-slate-100 dark:bg-slate-900',
          triggerClassName
        )}
      >
        <div className="flex items-center gap-2 truncate flex-1 min-w-0">
          {icon && <span className="shrink-0 text-slate-400">{icon}</span>}
          {selectedOption?.icon && <span className="shrink-0">{selectedOption.icon}</span>}
          <span
            className={cn(
              'truncate font-semibold',
              !selectedOption && 'text-slate-400 dark:text-slate-500 font-normal'
            )}
          >
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          {selectedOption?.badge && (
            <span
              className={cn(
                'ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider',
                isDark ? 'bg-zinc-800 text-zinc-400' : 'bg-slate-200 text-slate-600'
              )}
            >
              {selectedOption.badge}
            </span>
          )}
        </div>

        <ChevronDown
          size={16}
          className={cn(
            'shrink-0 text-slate-400 transition-transform duration-200',
            isOpen && 'transform rotate-180 text-indigo-500'
          )}
        />
      </button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 4, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            role="listbox"
            id={`in-app-select-menu-${selectId}`}
            className={cn(
              'absolute top-full z-[9999] mt-1 w-full min-w-[180px] p-1.5 rounded-2xl border shadow-2xl backdrop-blur-xl',
              align === 'right' ? 'right-0' : 'left-0',
              isDark
                ? 'bg-slate-900/98 border-slate-700/80 text-slate-100 shadow-black/60'
                : 'bg-white/98 border-slate-200/90 text-slate-900 shadow-slate-900/15',
              menuClassName
            )}
            style={{ maxHeight: '280px' }}
          >
            {searchable && (
              <div className="p-1 mb-1 relative">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search options..."
                  className={cn(
                    'w-full pl-8 pr-3 py-1.5 text-xs font-semibold rounded-lg border outline-none transition-colors',
                    isDark
                      ? 'bg-slate-800/80 border-slate-700 text-white placeholder-slate-500 focus:border-indigo-500'
                      : 'bg-slate-100 border-slate-200 text-slate-900 placeholder-slate-400 focus:border-indigo-500'
                  )}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            )}

            <div className="max-h-56 overflow-y-auto space-y-0.5 custom-scrollbar pr-0.5">
              {filteredOptions.length === 0 ? (
                <div className="py-4 text-center text-xs font-medium text-slate-400 dark:text-slate-500">
                  No options found
                </div>
              ) : (
                filteredOptions.map((option) => {
                  const isSelected = option.value === value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => {
                        onChange(option.value);
                        setIsOpen(false);
                        setSearchQuery('');
                      }}
                      className={cn(
                        'w-full flex items-center justify-between gap-2 px-3 py-2 text-xs md:text-sm font-semibold rounded-xl transition-colors cursor-pointer text-left',
                        isSelected
                          ? isDark
                            ? 'bg-indigo-600/20 text-indigo-400 font-bold'
                            : 'bg-indigo-50 text-indigo-700 font-bold'
                          : isDark
                          ? 'hover:bg-slate-800 text-slate-200 hover:text-white'
                          : 'hover:bg-slate-100 text-slate-700 hover:text-slate-900',
                        optionClassName
                      )}
                    >
                      <div className="flex items-center gap-2 truncate min-w-0 flex-1">
                        {option.icon && (
                          <span
                            className={cn(
                              'shrink-0',
                              isSelected
                                ? 'text-indigo-600 dark:text-indigo-400'
                                : 'text-slate-400'
                            )}
                          >
                            {option.icon}
                          </span>
                        )}
                        <span className="truncate">{option.label}</span>
                        {option.badge && (
                          <span
                            className={cn(
                              'ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0',
                              isSelected
                                ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300'
                                : isDark
                                ? 'bg-slate-800 text-slate-400'
                                : 'bg-slate-200 text-slate-600'
                            )}
                          >
                            {option.badge}
                          </span>
                        )}
                      </div>

                      {isSelected && (
                        <Check
                          size={15}
                          className="shrink-0 text-indigo-600 dark:text-indigo-400 font-bold stroke-[2.5]"
                        />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default InAppSelect;
