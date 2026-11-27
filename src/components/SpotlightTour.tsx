import React, { useEffect, useLayoutEffect, useState, useRef, useCallback, useMemo } from 'react';
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Compass, Check, CheckCircle2, MousePointerClick } from 'lucide-react';
import { cn, vibrate } from '../lib/utils';

export const TOUR_STORAGE_KEY = 'trackbook_tour_v1_status';
export const CASHBOOK_TOUR_STORAGE_KEY = 'trackbook_cashbook_tour_v1_status';

export type TourScope = 'home' | 'cashbook';
export type TourStatus = 'completed' | 'dismissed' | null;

export interface TourStep {
  id: string;
  selector: string;
  title: string;
  description: string;
  preferredPlacement?: 'top' | 'bottom' | 'left' | 'right';
  padding?: number;
  borderRadius?: number;
  /** When true, the highlighted element inside the spotlight cutout stays 100% clickable/typeable in real time */
  interactive?: boolean;
  /** When true, hides the Next button and guides the user to actually tap the highlighted button */
  requireAction?: boolean;
  /** When true, displays an animated tapping hand-finger pointer & ripple on top of the highlighted button */
  showHandPointer?: boolean;
  /** Optional short action hint shown inside the tooltip for interactive practice steps */
  actionHint?: string;
  /** Optional short badge label shown in place of Next while requireAction is true */
  requireActionLabel?: string;
}

export interface TourModalCoach {
  stepLabel: string;
  title: string;
  instruction: string;
  /** Optional short 1-line hint shown automatically when the user is typing (keyboard open) */
  compactText?: string;
  /** Optional action button inside the coach card to close the previewed modal/dropdown and move to the next step */
  onContinue?: () => void;
  continueLabel?: string;
}

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
  radius: number;
}

type Placement = 'top' | 'bottom' | 'left' | 'right' | 'center';

interface TooltipPosition {
  top: number;
  left: number;
  placement: Placement;
  arrowOffset: number;
}

export const MANDATORY_TOUR_STORAGE_KEY = 'trackbook_mandatory_tour_v1';

function getStorageKey(scope: TourScope, userId?: string): string {
  const base = scope === 'cashbook' ? CASHBOOK_TOUR_STORAGE_KEY : TOUR_STORAGE_KEY;
  return userId ? `${base}_${userId}` : base;
}

export function getTourStatus(scope: TourScope = 'home', userId?: string): TourStatus {
  if (typeof window === 'undefined') return null;
  try {
    const val = window.localStorage.getItem(getStorageKey(scope, userId));
    if (val === 'completed' || val === 'dismissed') return val;
    return null;
  } catch {
    return null;
  }
}

export function setTourStatus(status: 'completed' | 'dismissed', scope: TourScope = 'home', userId?: string): void {
  if (typeof window === 'undefined') return;
  try {
    if (userId) {
      window.localStorage.setItem(getStorageKey(scope, userId), status);
    }
    window.localStorage.setItem(getStorageKey(scope), status);
  } catch {
    // Ignore storage quota or WebView private mode errors
  }
}

export function getMandatoryTourState(userId?: string): 'active' | 'done' | null {
  if (typeof window === 'undefined') return null;
  try {
    const key = userId ? `${MANDATORY_TOUR_STORAGE_KEY}_${userId}` : MANDATORY_TOUR_STORAGE_KEY;
    const val = window.localStorage.getItem(key);
    if (val === 'active' || val === 'done') return val;
    return null;
  } catch {
    return null;
  }
}

export function setMandatoryTourState(state: 'active' | 'done', userId?: string): void {
  if (typeof window === 'undefined') return;
  try {
    const key = userId ? `${MANDATORY_TOUR_STORAGE_KEY}_${userId}` : MANDATORY_TOUR_STORAGE_KEY;
    window.localStorage.setItem(key, state);
  } catch {
    // Ignore storage quota or WebView private mode errors
  }
}

/**
 * Finds the first currently visible DOM element matching a selector.
 * Automatically resolves responsive desktop vs. mobile duplicate elements.
 */
function findVisibleElement(selector: string): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  const nodes = Array.from(document.querySelectorAll<HTMLElement>(selector));
  for (const el of nodes) {
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      continue;
    }
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      return el;
    }
  }
  return null;
}

/**
 * Returns true if the target element should be scrolled into view:
 * - Returns true if it sits inside a scrollable container (e.g., scrollable modal body) BEFORE any fixed/sticky ancestor.
 * - Returns false for viewport-fixed / sticky bars (e.g., mobile bottom Cash In/Out bar).
 */
function shouldScrollIntoView(el: HTMLElement): boolean {
  let current: HTMLElement | null = el.parentElement;
  while (current && current !== document.body) {
    const style = window.getComputedStyle(current);
    const isScrollableY =
      (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
      current.scrollHeight > current.clientHeight + 4;
    if (isScrollableY) return true;
    if (style.position === 'fixed' || style.position === 'sticky') return false;
    current = current.parentElement;
  }
  return true;
}

function isEditableElement(el: EventTarget | null): boolean {
  const node = el as HTMLElement | null;
  if (!node || !node.tagName) return false;
  return (
    node.tagName === 'INPUT' ||
    node.tagName === 'TEXTAREA' ||
    node.tagName === 'SELECT' ||
    node.isContentEditable
  );
}

function getViewportSize() {
  if (typeof window === 'undefined') return { vw: 375, vh: 812 };
  const vv = window.visualViewport;
  return {
    vw: Math.round(vv ? vv.width : window.innerWidth),
    vh: Math.round(vv ? vv.height : window.innerHeight),
  };
}

interface SpotlightTourProps {
  isOpen: boolean;
  steps: TourStep[];
  theme: 'light' | 'dark';
  /** Optional controlled step ID to jump directly to a step after a real-time user action */
  activeStepId?: string | null;
  onActiveStepIdChange?: (stepId: string) => void;
  /** When the user opens a real modal (e.g. Create Book / Add Entry) during the tour, show a non-blocking top coach card */
  modalCoach?: TourModalCoach | null;
  /** Celebratory inline feedback banner shown when user completes a live action */
  feedbackMessage?: string | null;
  /** Optional label for the final button (defaults to "Finish") */
  finishLabel?: string;
  /** When false (mandatory first-time user onboarding), hides all Skip buttons and disables Escape dismissal */
  allowSkip?: boolean;
  onFinish: () => void;
  onSkip: () => void;
}

export function SpotlightTour({
  isOpen,
  steps,
  theme,
  activeStepId,
  onActiveStepIdChange,
  modalCoach,
  feedbackMessage,
  finishLabel,
  allowSkip = true,
  onFinish,
  onSkip,
}: SpotlightTourProps) {
  const [resolvedSteps, setResolvedSteps] = useState<TourStep[]>([]);
  const [stepIndex, setStepIndex] = useState(0);
  const [spotRect, setSpotRect] = useState<SpotlightRect | null>(null);
  const [tooltipPos, setTooltipPos] = useState<TooltipPosition>({
    top: 100,
    left: 16,
    placement: 'center',
    arrowOffset: 0,
  });
  const [viewport, setViewport] = useState(getViewportSize);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [isCoachCollapsed, setIsCoachCollapsed] = useState(false);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const activeElementRef = useRef<HTMLElement | null>(null);

  // Filter steps down to elements that actually exist & are visible when tour opens or steps change.
  // Uses staggered retries + a lightweight MutationObserver so Framer Motion page transitions
  // (e.g., Home -> Cashbook) always lock onto target buttons the moment they mount and become visible.
  useEffect(() => {
    if (!isOpen) {
      setStepIndex((prev) => (prev === 0 ? prev : 0));
      setSpotRect((prev) => (prev === null ? prev : null));
      activeElementRef.current = null;
      return;
    }

    if (modalCoach) return;

    let cancelled = false;
    let observer: MutationObserver | null = null;
    let rafId: number | null = null;

    const resolveSteps = (): boolean => {
      if (cancelled) return true;
      const available = steps.filter((step) => findVisibleElement(step.selector) !== null);
      const nextResolved = available.length > 0 ? available : steps;

      setResolvedSteps((prev) => {
        const same =
          prev.length === nextResolved.length &&
          prev.every(
            (s, idx) =>
              s.id === nextResolved[idx].id &&
              s.selector === nextResolved[idx].selector &&
              s.requireAction === nextResolved[idx].requireAction &&
              s.showHandPointer === nextResolved[idx].showHandPointer &&
              s.title === nextResolved[idx].title &&
              s.description === nextResolved[idx].description &&
              s.actionHint === nextResolved[idx].actionHint &&
              s.requireActionLabel === nextResolved[idx].requireActionLabel
          );
        return same ? prev : nextResolved;
      });

      if (activeStepId) {
        const idx = nextResolved.findIndex((s) => s.id === activeStepId);
        if (idx >= 0) {
          setStepIndex((prev) => (prev === idx ? prev : idx));
        } else {
          setStepIndex((prev) => {
            const clamped = Math.min(prev, Math.max(0, nextResolved.length - 1));
            return prev === clamped ? prev : clamped;
          });
        }
      } else {
        setStepIndex((prev) => {
          const clamped = Math.min(prev, Math.max(0, nextResolved.length - 1));
          return prev === clamped ? prev : clamped;
        });
      }

      return available.length > 0;
    };

    const foundNow = resolveSteps();

    // Retry across typical Framer Motion exit/enter transition windows (Home <-> Cashbook)
    const timers = [120, 280, 520, 850, 1250].map((delay) =>
      window.setTimeout(() => {
        resolveSteps();
      }, delay)
    );

    // If elements haven't mounted yet (e.g., AnimatePresence mode="wait"), watch DOM until they appear
    if (!foundNow && typeof MutationObserver !== 'undefined' && document.body) {
      observer = new MutationObserver(() => {
        if (rafId !== null) return;
        rafId = window.requestAnimationFrame(() => {
          rafId = null;
          if (resolveSteps() && observer) {
            observer.disconnect();
            observer = null;
          }
        });
      });
      observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] });
    }

    return () => {
      cancelled = true;
      timers.forEach((id) => window.clearTimeout(id));
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      observer?.disconnect();
    };
  }, [isOpen, steps, activeStepId, modalCoach]);

  const currentStep = useMemo(
    () => resolvedSteps[stepIndex] || null,
    [resolvedSteps, stepIndex]
  );

  const measureAndPosition = useCallback(() => {
    if (!isOpen || !currentStep || modalCoach) return;

    const { vw, vh } = getViewportSize();
    setViewport((prev) => (prev.vw === vw && prev.vh === vh ? prev : { vw, vh }));

    const el = findVisibleElement(currentStep.selector);
    activeElementRef.current = el;

    const pad = currentStep.padding ?? 8;

    if (!el) {
      setSpotRect((prev) => (prev === null ? prev : null));
      const tooltipEl = tooltipRef.current;
      const tw = tooltipEl?.offsetWidth || Math.min(340, vw - 24);
      const th = tooltipEl?.offsetHeight || 200;
      const nextCenterPos: TooltipPosition = {
        top: Math.max(16, Math.round((vh - th) / 2)),
        left: Math.max(12, Math.round((vw - tw) / 2)),
        placement: 'center',
        arrowOffset: 0,
      };
      setTooltipPos((prev) =>
        prev.top === nextCenterPos.top &&
        prev.left === nextCenterPos.left &&
        prev.placement === nextCenterPos.placement &&
        prev.arrowOffset === nextCenterPos.arrowOffset
          ? prev
          : nextCenterPos
      );
      return;
    }

    const rect = el.getBoundingClientRect();
    const computedRadius = parseFloat(window.getComputedStyle(el).borderRadius || '12') || 12;
    const radius = currentStep.borderRadius ?? Math.min(Math.max(computedRadius + 4, 12), 28);

    const clampedLeft = Math.max(4, rect.left - pad);
    const clampedTop = Math.max(4, rect.top - pad);
    const clampedRight = Math.min(vw - 4, rect.right + pad);
    const clampedBottom = Math.min(vh - 4, rect.bottom + pad);

    const nextSpot: SpotlightRect = {
      top: Math.round(clampedTop),
      left: Math.round(clampedLeft),
      right: Math.round(clampedRight),
      bottom: Math.round(clampedBottom),
      width: Math.round(Math.max(0, clampedRight - clampedLeft)),
      height: Math.round(Math.max(0, clampedBottom - clampedTop)),
      radius: Math.round(radius),
    };

    setSpotRect((prev) =>
      prev &&
      prev.top === nextSpot.top &&
      prev.left === nextSpot.left &&
      prev.width === nextSpot.width &&
      prev.height === nextSpot.height &&
      prev.radius === nextSpot.radius
        ? prev
        : nextSpot
    );

    const tooltipEl = tooltipRef.current;
    const tw = tooltipEl?.offsetWidth || Math.min(340, vw - 24);
    const th = tooltipEl?.offsetHeight || 225;

    const GAP = 14;
    const MARGIN = 12;

    const spaceBelow = vh - nextSpot.bottom - GAP - MARGIN;
    const spaceAbove = nextSpot.top - GAP - MARGIN;
    const spaceRight = vw - nextSpot.right - GAP - MARGIN;
    const spaceLeft = nextSpot.left - GAP - MARGIN;

    const isMobile = vw < 640;

    const fits: Record<'top' | 'bottom' | 'left' | 'right', boolean> = {
      bottom: spaceBelow >= th,
      top: spaceAbove >= th,
      right: !isMobile && spaceRight >= tw,
      left: !isMobile && spaceLeft >= tw,
    };

    const pref = currentStep.preferredPlacement || 'bottom';
    let placement: Placement = 'bottom';

    if (fits[pref]) {
      placement = pref;
    } else if (isMobile) {
      if (fits.bottom) placement = 'bottom';
      else if (fits.top) placement = 'top';
      else placement = spaceBelow >= spaceAbove ? 'bottom' : 'top';
    } else {
      const order: Array<'bottom' | 'top' | 'right' | 'left'> = ['bottom', 'top', 'right', 'left'];
      const match = order.find((dir) => fits[dir]);
      if (match) {
        placement = match;
      } else {
        const candidates: Array<{ dir: 'bottom' | 'top' | 'right' | 'left'; space: number }> = [
          { dir: 'bottom', space: spaceBelow },
          { dir: 'top', space: spaceAbove },
          { dir: 'right', space: spaceRight },
          { dir: 'left', space: spaceLeft },
        ];
        candidates.sort((a, b) => b.space - a.space);
        placement = candidates[0].dir;
      }
    }

    const targetCenterX = nextSpot.left + nextSpot.width / 2;
    const targetCenterY = nextSpot.top + nextSpot.height / 2;

    let top = MARGIN;
    let left = MARGIN;
    let arrowOffset = 0;

    if (placement === 'bottom') {
      top = nextSpot.bottom + GAP;
      left = targetCenterX - tw / 2;
      left = Math.min(Math.max(left, MARGIN), Math.max(MARGIN, vw - tw - MARGIN));
      top = Math.min(Math.max(top, MARGIN), Math.max(MARGIN, vh - th - MARGIN));
      arrowOffset = Math.min(Math.max(targetCenterX - left, 22), tw - 22);
    } else if (placement === 'top') {
      top = nextSpot.top - GAP - th;
      left = targetCenterX - tw / 2;
      left = Math.min(Math.max(left, MARGIN), Math.max(MARGIN, vw - tw - MARGIN));
      top = Math.min(Math.max(top, MARGIN), Math.max(MARGIN, vh - th - MARGIN));
      arrowOffset = Math.min(Math.max(targetCenterX - left, 22), tw - 22);
    } else if (placement === 'right') {
      left = nextSpot.right + GAP;
      top = targetCenterY - th / 2;
      top = Math.min(Math.max(top, MARGIN), Math.max(MARGIN, vh - th - MARGIN));
      left = Math.min(Math.max(left, MARGIN), Math.max(MARGIN, vw - tw - MARGIN));
      arrowOffset = Math.min(Math.max(targetCenterY - top, 22), th - 22);
    } else if (placement === 'left') {
      left = nextSpot.left - GAP - tw;
      top = targetCenterY - th / 2;
      top = Math.min(Math.max(top, MARGIN), Math.max(MARGIN, vh - th - MARGIN));
      left = Math.min(Math.max(left, MARGIN), Math.max(MARGIN, vw - tw - MARGIN));
      arrowOffset = Math.min(Math.max(targetCenterY - top, 22), th - 22);
    }

    const nextTooltipPos: TooltipPosition = {
      top: Math.round(top),
      left: Math.round(left),
      placement,
      arrowOffset: Math.round(arrowOffset),
    };

    setTooltipPos((prev) =>
      prev.top === nextTooltipPos.top &&
      prev.left === nextTooltipPos.left &&
      prev.placement === nextTooltipPos.placement &&
      prev.arrowOffset === nextTooltipPos.arrowOffset
        ? prev
        : nextTooltipPos
    );
  }, [isOpen, currentStep, modalCoach]);

  // Scroll target smoothly into view if off-screen, then re-measure (with retries if still animating in)
  useEffect(() => {
    if (!isOpen || !currentStep || modalCoach) return;

    const scrollAndMeasure = () => {
      const el = findVisibleElement(currentStep.selector);
      if (el && shouldScrollIntoView(el)) {
        const rect = el.getBoundingClientRect();
        const { vh } = getViewportSize();
        const outOfSafeBand = rect.top < 72 || rect.bottom > vh - 120;
        if (outOfSafeBand) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        }
      }
      measureAndPosition();
      return el !== null;
    };

    const foundInitially = scrollAndMeasure();
    const rafId = window.requestAnimationFrame(measureAndPosition);
    const settleTimers = [140, 320, 620, 1000].map((ms) =>
      window.setTimeout(scrollAndMeasure, ms)
    );

    let observer: MutationObserver | null = null;
    let obsRaf: number | null = null;
    if (!foundInitially && typeof MutationObserver !== 'undefined' && document.body) {
      observer = new MutationObserver(() => {
        if (obsRaf !== null) return;
        obsRaf = window.requestAnimationFrame(() => {
          obsRaf = null;
          if (scrollAndMeasure() && observer) {
            observer.disconnect();
            observer = null;
          }
        });
      });
      observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] });
    }

    return () => {
      window.cancelAnimationFrame(rafId);
      if (obsRaf !== null) window.cancelAnimationFrame(obsRaf);
      settleTimers.forEach((id) => window.clearTimeout(id));
      observer?.disconnect();
    };
  }, [isOpen, currentStep, stepIndex, modalCoach, measureAndPosition]);

  // Re-measure after tooltip renders its updated text height
  useLayoutEffect(() => {
    if (!isOpen || modalCoach) return;
    measureAndPosition();
  }, [isOpen, stepIndex, currentStep?.title, currentStep?.description, feedbackMessage, modalCoach, measureAndPosition]);

  // Track viewport resize, orientation changes, scrolling, and target layout shifts
  useEffect(() => {
    if (!isOpen || modalCoach) return;

    let rafId: number | null = null;
    const scheduleMeasure = () => {
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        measureAndPosition();
      });
    };

    window.addEventListener('resize', scheduleMeasure);
    window.addEventListener('orientationchange', scheduleMeasure);
    window.addEventListener('scroll', scheduleMeasure, true);
    window.visualViewport?.addEventListener('resize', scheduleMeasure);
    window.visualViewport?.addEventListener('scroll', scheduleMeasure);

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(scheduleMeasure);
      if (tooltipRef.current) resizeObserver.observe(tooltipRef.current);
      if (activeElementRef.current) resizeObserver.observe(activeElementRef.current);
    }

    return () => {
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', scheduleMeasure);
      window.removeEventListener('orientationchange', scheduleMeasure);
      window.removeEventListener('scroll', scheduleMeasure, true);
      window.visualViewport?.removeEventListener('resize', scheduleMeasure);
      window.visualViewport?.removeEventListener('scroll', scheduleMeasure);
      resizeObserver?.disconnect();
    };
  }, [isOpen, stepIndex, modalCoach, measureAndPosition]);

  // Track active input focus & mobile soft keyboard height so tooltips/coach cards NEVER cover what the user is typing
  useEffect(() => {
    if (!isOpen) {
      setIsInputFocused(false);
      setIsCoachCollapsed(false);
      return;
    }

    const syncFocusAndViewport = () => {
      const focused = isEditableElement(document.activeElement);
      setIsInputFocused((prev) => (prev === focused ? prev : focused));
      const { vw, vh } = getViewportSize();
      setViewport((prev) => (prev.vw === vw && prev.vh === vh ? prev : { vw, vh }));
    };

    const handleFocusIn = (e: FocusEvent) => {
      if (isEditableElement(e.target)) {
        setIsInputFocused(true);
      }
    };
    const handleFocusOut = () => {
      window.setTimeout(() => {
        const focused = isEditableElement(document.activeElement);
        setIsInputFocused((prev) => (prev === focused ? prev : focused));
      }, 60);
    };

    syncFocusAndViewport();
    document.addEventListener('focusin', handleFocusIn, true);
    document.addEventListener('focusout', handleFocusOut, true);
    window.visualViewport?.addEventListener('resize', syncFocusAndViewport);
    window.addEventListener('resize', syncFocusAndViewport);

    return () => {
      document.removeEventListener('focusin', handleFocusIn, true);
      document.removeEventListener('focusout', handleFocusOut, true);
      window.visualViewport?.removeEventListener('resize', syncFocusAndViewport);
      window.removeEventListener('resize', syncFocusAndViewport);
    };
  }, [isOpen]);

  // Reset manual collapse when switching to a different modalCoach card
  useEffect(() => {
    setIsCoachCollapsed(false);
  }, [modalCoach?.stepLabel]);

  const handleNext = useCallback(() => {
    vibrate(15);
    if (isEditableElement(document.activeElement)) {
      (document.activeElement as HTMLElement).blur();
    }
    if (stepIndex >= resolvedSteps.length - 1) {
      onFinish();
    } else {
      const nextIdx = stepIndex + 1;
      setStepIndex(nextIdx);
      const nextStep = resolvedSteps[nextIdx];
      if (nextStep && onActiveStepIdChange) {
        onActiveStepIdChange(nextStep.id);
      }
    }
  }, [stepIndex, resolvedSteps, onFinish, onActiveStepIdChange]);

  const handleBack = useCallback(() => {
    vibrate(15);
    if (isEditableElement(document.activeElement)) {
      (document.activeElement as HTMLElement).blur();
    }
    if (stepIndex > 0) {
      const prevIdx = stepIndex - 1;
      setStepIndex(prevIdx);
      const prevStep = resolvedSteps[prevIdx];
      if (prevStep && onActiveStepIdChange) {
        onActiveStepIdChange(prevStep.id);
      }
    }
  }, [stepIndex, resolvedSteps, onActiveStepIdChange]);

  const handleSkip = useCallback(() => {
    if (!allowSkip) return;
    vibrate(15);
    onSkip();
  }, [allowSkip, onSkip]);

  // Keyboard navigation (disabled while typing inside live inputs/modals)
  useEffect(() => {
    if (!isOpen || modalCoach) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isEditableElement(e.target)) return;

      if (e.key === 'Escape') {
        if (!allowSkip) return;
        e.preventDefault();
        handleSkip();
      } else if (e.key === 'ArrowRight') {
        if (currentStep?.requireAction) return;
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleBack();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, modalCoach, currentStep?.requireAction, allowSkip, handleSkip, handleNext, handleBack]);

  if (!isOpen) return null;

  const isCompactViewport = viewport.vh < 520;
  const shouldCompactCoach = isCoachCollapsed || isInputFocused || isCompactViewport;

  // LIVE MODAL COACH MODE: When user clicked a spotlighted button to open a real modal/dropdown,
  // keep the real modal 100% interactive & unobstructed. Automatically collapses into a slim ~40px
  // single-line bar whenever an input is focused or the mobile keyboard is open!
  if (modalCoach) {
    return (
      <div
        data-tour-ui="true"
        role="status"
        aria-live="polite"
        className="fixed left-2.5 right-2.5 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-[165] w-auto sm:w-full sm:max-w-lg pointer-events-none select-none"
        style={{ top: 'max(0.4rem, env(safe-area-inset-top))' }}
      >
        {shouldCompactCoach ? (
          <div
            className={cn(
              'pointer-events-auto rounded-xl border px-2.5 py-1.5 shadow-lg backdrop-blur-md flex items-center justify-between gap-2 ring-1 ring-indigo-500/40',
              theme === 'dark'
                ? 'bg-zinc-950/95 border-indigo-500/50 text-slate-100 shadow-black/60'
                : 'bg-white/95 border-indigo-200 text-slate-900 shadow-indigo-950/15'
            )}
          >
            <button
              type="button"
              onClick={() => setIsCoachCollapsed(false)}
              className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer"
              title="Expand hint"
            >
              <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0 animate-pulse" />
              <span className="text-xs font-semibold truncate">
                {modalCoach.compactText || modalCoach.title}
              </span>
              {!isInputFocused && !isCompactViewport && (
                <ChevronDown size={14} className="shrink-0 text-slate-400" />
              )}
            </button>
            <div className="flex items-center gap-1 shrink-0">
              {modalCoach.onContinue && (
                <button
                  type="button"
                  onClick={() => {
                    vibrate(15);
                    modalCoach.onContinue?.();
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white whitespace-nowrap cursor-pointer"
                >
                  <span>{modalCoach.continueLabel || 'Next'}</span>
                  <ChevronRight size={13} />
                </button>
              )}
              {allowSkip && (
                <button
                  type="button"
                  onClick={handleSkip}
                  className={cn(
                    'text-[11px] font-semibold px-2 py-1 rounded-lg transition-colors whitespace-nowrap cursor-pointer',
                    theme === 'dark'
                      ? 'text-slate-400 hover:text-slate-200 hover:bg-zinc-900'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                  )}
                >
                  Skip
                </button>
              )}
            </div>
          </div>
        ) : (
          <div
            className={cn(
              'pointer-events-auto rounded-2xl border p-3 shadow-2xl backdrop-blur-md flex flex-col gap-2 ring-2 ring-indigo-500/40',
              theme === 'dark'
                ? 'bg-zinc-950/95 border-indigo-500/50 text-slate-100 shadow-black/60'
                : 'bg-white/95 border-indigo-200 text-slate-900 shadow-indigo-950/15'
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2.5 min-w-0 flex-1">
                <div
                  className={cn(
                    'w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5',
                    theme === 'dark'
                      ? 'bg-indigo-950/80 text-indigo-400'
                      : 'bg-indigo-50 text-indigo-600'
                  )}
                >
                  <MousePointerClick size={15} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                    {modalCoach.stepLabel}
                  </p>
                  <h4
                    className={cn(
                      'text-[13px] font-bold leading-snug mt-0.5',
                      theme === 'dark' ? 'text-white' : 'text-slate-900'
                    )}
                  >
                    {modalCoach.title}
                  </h4>
                  <p
                    className={cn(
                      'text-xs leading-snug mt-0.5',
                      theme === 'dark' ? 'text-slate-300' : 'text-slate-600'
                    )}
                  >
                    {modalCoach.instruction}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsCoachCollapsed(true)}
                  aria-label="Minimize guide"
                  title="Minimize"
                  className={cn(
                    'p-1.5 rounded-lg transition-colors cursor-pointer',
                    theme === 'dark'
                      ? 'text-slate-400 hover:text-slate-200 hover:bg-zinc-900'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                  )}
                >
                  <ChevronUp size={15} />
                </button>
                {allowSkip && (
                  <button
                    type="button"
                    onClick={handleSkip}
                    className={cn(
                      'text-xs font-semibold px-2 py-1 rounded-lg transition-colors whitespace-nowrap cursor-pointer',
                      theme === 'dark'
                        ? 'text-slate-400 hover:text-slate-200 hover:bg-zinc-900'
                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                    )}
                  >
                    Skip
                  </button>
                )}
              </div>
            </div>

            {modalCoach.onContinue && (
              <div
                className={cn(
                  'pt-2 border-t flex items-center justify-end',
                  theme === 'dark' ? 'border-zinc-800/80' : 'border-slate-100'
                )}
              >
                <button
                  type="button"
                  onClick={() => {
                    vibrate(15);
                    modalCoach.onContinue?.();
                  }}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 min-h-[34px] rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white transition-all whitespace-nowrap shadow-sm cursor-pointer"
                >
                  <span>{modalCoach.continueLabel || 'Got It, Next Step'}</span>
                  <ChevronRight size={15} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  if (!currentStep || resolvedSteps.length === 0) return null;

  const isFirst = stepIndex === 0;
  const isLast = stepIndex === resolvedSteps.length - 1;
  const progressPct = Math.round(((stepIndex + 1) / resolvedSteps.length) * 100);
  const maskId = 'trackbook-spotlight-cutout-mask';
  const isInteractiveStep = Boolean((currentStep.interactive || currentStep.requireAction) && spotRect);
  const isActionRequired = Boolean(currentStep.requireAction && spotRect);
  const showHand = Boolean(currentStep.showHandPointer && spotRect && !isInputFocused);

  // Compute safe screen coordinates for the animated tapping hand pointer right over the target button
  const handAnchorX = spotRect
    ? Math.min(Math.max(spotRect.left + Math.min(spotRect.width * 0.62, spotRect.width - 14), 24), viewport.vw - 38)
    : 0;
  const handAnchorY = spotRect
    ? Math.min(Math.max(spotRect.top + spotRect.height * 0.58, 24), viewport.vh - 44)
    : 0;

  return (
    <div
      data-tour-ui="true"
      className="fixed inset-0 z-[150] select-none pointer-events-none"
      role="dialog"
      aria-modal="false"
      aria-labelledby="trackbook-tour-title"
      aria-describedby="trackbook-tour-desc"
    >
      {/* Dimmed Screen Overlay (bg-black/60) with Crisp SVG Cutout (pointer-events-none so cutout stays live) */}
      <svg
        className="fixed inset-0 w-full h-full pointer-events-none"
        width={viewport.vw}
        height={viewport.vh}
        viewBox={`0 0 ${viewport.vw} ${viewport.vh}`}
        aria-hidden="true"
      >
        <defs>
          <mask id={maskId}>
            <rect x="0" y="0" width={viewport.vw} height={viewport.vh} fill="white" />
            {spotRect && (
              <rect
                x={spotRect.left}
                y={spotRect.top}
                width={spotRect.width}
                height={spotRect.height}
                rx={spotRect.radius}
                ry={spotRect.radius}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width={viewport.vw}
          height={viewport.vh}
          fill="rgba(0, 0, 0, 0.6)"
          mask={`url(#${maskId})`}
        />
      </svg>

      {/* Click blockers OUTSIDE the spotlight cutout: keeps highlighted feature 100% live & clickable when interactive */}
      {isInteractiveStep && spotRect ? (
        <>
          {/* Top blocker */}
          <div
            aria-hidden="true"
            className="fixed pointer-events-auto"
            style={{ top: 0, left: 0, right: 0, height: `${Math.max(0, spotRect.top)}px` }}
            onClick={(e) => e.stopPropagation()}
          />
          {/* Bottom blocker */}
          <div
            aria-hidden="true"
            className="fixed pointer-events-auto"
            style={{
              top: `${spotRect.bottom}px`,
              left: 0,
              right: 0,
              bottom: 0,
            }}
            onClick={(e) => e.stopPropagation()}
          />
          {/* Left blocker */}
          <div
            aria-hidden="true"
            className="fixed pointer-events-auto"
            style={{
              top: `${spotRect.top}px`,
              left: 0,
              width: `${Math.max(0, spotRect.left)}px`,
              height: `${spotRect.height}px`,
            }}
            onClick={(e) => e.stopPropagation()}
          />
          {/* Right blocker */}
          <div
            aria-hidden="true"
            className="fixed pointer-events-auto"
            style={{
              top: `${spotRect.top}px`,
              left: `${spotRect.right}px`,
              right: 0,
              height: `${spotRect.height}px`,
            }}
            onClick={(e) => e.stopPropagation()}
          />
        </>
      ) : (
        <div
          aria-hidden="true"
          className="fixed inset-0 pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        />
      )}

      {/* Clean Spotlight Ring & Glow Around Highlighted Feature */}
      {spotRect && (
        <div
          aria-hidden="true"
          className={cn(
            'fixed pointer-events-none z-[151] transition-all duration-200 ease-out motion-reduce:transition-none ring-2',
            isInteractiveStep
              ? 'ring-indigo-400 shadow-[0_0_0_4px_rgba(99,102,241,0.34),0_0_28px_rgba(99,102,241,0.55)]'
              : 'ring-indigo-400 shadow-[0_0_0_4px_rgba(99,102,241,0.28),0_0_24px_rgba(99,102,241,0.45)]'
          )}
          style={{
            top: `${spotRect.top}px`,
            left: `${spotRect.left}px`,
            width: `${spotRect.width}px`,
            height: `${spotRect.height}px`,
            borderRadius: `${spotRect.radius}px`,
          }}
        />
      )}

      {/* Animated Tapping Hand-Finger Pointer & Tap Ripple (pointer-events-none so real taps go straight through) */}
      {showHand && spotRect && (
        <div
          aria-hidden="true"
          className="fixed pointer-events-none z-[154] transition-[top,left] duration-200 ease-out motion-reduce:transition-none"
          style={{
            top: `${Math.round(handAnchorY)}px`,
            left: `${Math.round(handAnchorX)}px`,
          }}
        >
          {/* Expanding Tap Ripple right under the fingertip */}
          <span
            className="absolute -top-3.5 -left-3.5 w-7 h-7 rounded-full border-2 border-indigo-400 bg-indigo-500/30 animate-tour-tap-ripple"
          />
          <span
            className="absolute -top-1.5 -left-1.5 w-3 h-3 rounded-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.9)]"
          />
          {/* Crisp Tapping Hand Finger SVG */}
          <div className="relative -mt-1 -ml-1 animate-tour-hand-tap drop-shadow-[0_6px_12px_rgba(15,23,42,0.5)]">
            <svg
              width="40"
              height="44"
              viewBox="0 0 40 44"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M15.2 4.2C15.2 2.43 16.63 1 18.4 1C20.17 1 21.6 2.43 21.6 4.2V16.8C22.45 16.05 23.56 15.6 24.75 15.6C26.45 15.6 27.9 16.58 28.6 18.02C29.35 17.5 30.25 17.2 31.2 17.2C33.4 17.2 35.2 18.98 35.2 21.2V27.6C35.2 34.45 29.65 40 22.8 40H19.4C15.1 40 11.4 37.55 9.6 33.9L5.4 25.35C4.65 23.82 5.28 21.97 6.82 21.22C8.35 20.47 10.2 21.1 10.95 22.64L13.6 28.05C14.12 29.1 15.2 28.72 15.2 27.55V4.2Z"
                fill="#FFFFFF"
                stroke="#312E81"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M21.6 16.8V23.2M28.4 18.1V23.8"
                stroke="#312E81"
                strokeWidth="2.1"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>
      )}

      {/* Sleek Dynamically Positioned Tooltip Card — auto-shrinks into a 1-line top bar if user is actively typing on mobile */}
      {isInputFocused && isInteractiveStep && (viewport.vw < 640 || viewport.vh < 560) ? (
        <div
          ref={tooltipRef}
          className="fixed left-2.5 right-2.5 z-[152] pointer-events-auto"
          style={{ top: 'max(0.4rem, env(safe-area-inset-top))' }}
        >
          <div
            className={cn(
              'rounded-xl border px-3 py-2 shadow-xl backdrop-blur-md flex items-center justify-between gap-2 ring-1 ring-indigo-500/40',
              theme === 'dark'
                ? 'bg-zinc-950/95 border-zinc-800 text-slate-100 shadow-black/60'
                : 'bg-white/95 border-slate-200 text-slate-900 shadow-slate-900/15'
            )}
          >
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                Step {stepIndex + 1}/{resolvedSteps.length}
              </p>
              <p className="text-xs font-bold truncate">{currentStep.title}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {isActionRequired ? (
                <span
                  className={cn(
                    'inline-flex items-center px-2.5 min-h-[30px] rounded-lg text-[11px] font-bold whitespace-nowrap border',
                    theme === 'dark'
                      ? 'bg-indigo-950/70 border-indigo-800/70 text-indigo-300'
                      : 'bg-indigo-50 border-indigo-200 text-indigo-700'
                  )}
                >
                  {currentStep.requireActionLabel || 'Required *'}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleNext}
                  className="inline-flex items-center gap-1 px-3 min-h-[32px] rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white whitespace-nowrap cursor-pointer"
                >
                  <span>{isLast ? finishLabel || 'Finish' : 'Next'}</span>
                  {!isLast && <ChevronRight size={14} />}
                </button>
              )}
              {allowSkip && (
                <button
                  type="button"
                  onClick={handleSkip}
                  className={cn(
                    'text-xs font-semibold px-2 min-h-[32px] rounded-lg whitespace-nowrap cursor-pointer',
                    theme === 'dark' ? 'text-slate-400 hover:bg-zinc-900' : 'text-slate-500 hover:bg-slate-100'
                  )}
                >
                  Skip
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
      <div
        ref={tooltipRef}
        className={cn(
          'fixed z-[152] pointer-events-auto w-[min(340px,calc(100vw-24px))] rounded-2xl border p-4 sm:p-5 shadow-2xl transition-[top,left,opacity] duration-200 ease-out motion-reduce:transition-none',
          theme === 'dark'
            ? 'bg-zinc-950 border-zinc-800 text-slate-100 shadow-black/60'
            : 'bg-white border-slate-200 text-slate-900 shadow-slate-900/20'
        )}
        style={{
          top: `${tooltipPos.top}px`,
          left: `${tooltipPos.left}px`,
        }}
      >
        {/* Dynamic Directional Arrow */}
        {spotRect && tooltipPos.placement === 'bottom' && (
          <div
            aria-hidden="true"
            className={cn(
              'absolute -top-[7px] w-3.5 h-3.5 rotate-45 border-l border-t',
              theme === 'dark' ? 'bg-zinc-950 border-zinc-800' : 'bg-white border-slate-200'
            )}
            style={{ left: `${tooltipPos.arrowOffset - 7}px` }}
          />
        )}
        {spotRect && tooltipPos.placement === 'top' && (
          <div
            aria-hidden="true"
            className={cn(
              'absolute -bottom-[7px] w-3.5 h-3.5 rotate-45 border-r border-b',
              theme === 'dark' ? 'bg-zinc-950 border-zinc-800' : 'bg-white border-slate-200'
            )}
            style={{ left: `${tooltipPos.arrowOffset - 7}px` }}
          />
        )}
        {spotRect && tooltipPos.placement === 'right' && (
          <div
            aria-hidden="true"
            className={cn(
              'absolute -left-[7px] w-3.5 h-3.5 rotate-45 border-l border-b',
              theme === 'dark' ? 'bg-zinc-950 border-zinc-800' : 'bg-white border-slate-200'
            )}
            style={{ top: `${tooltipPos.arrowOffset - 7}px` }}
          />
        )}
        {spotRect && tooltipPos.placement === 'left' && (
          <div
            aria-hidden="true"
            className={cn(
              'absolute -right-[7px] w-3.5 h-3.5 rotate-45 border-r border-t',
              theme === 'dark' ? 'bg-zinc-950 border-zinc-800' : 'bg-white border-slate-200'
            )}
            style={{ top: `${tooltipPos.arrowOffset - 7}px` }}
          />
        )}

        {/* Header Row: Step Counter + Skip Tour (hidden when mandatory) */}
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 tabular-nums whitespace-nowrap">
            Step {stepIndex + 1} of {resolvedSteps.length}
          </span>
          {allowSkip ? (
            <button
              type="button"
              onClick={handleSkip}
              className={cn(
                'text-xs font-semibold px-2 py-1 -mr-2 rounded-lg transition-colors whitespace-nowrap shrink-0 min-h-[32px] cursor-pointer',
                theme === 'dark'
                  ? 'text-slate-400 hover:text-slate-200 hover:bg-zinc-900'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
              )}
            >
              Skip Tour
            </button>
          ) : (
            <span
              className={cn(
                'text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md whitespace-nowrap shrink-0',
                theme === 'dark'
                  ? 'bg-indigo-950/70 text-indigo-300 border border-indigo-800/60'
                  : 'bg-indigo-50 text-indigo-700 border border-indigo-200/70'
              )}
            >
              Guided Setup
            </span>
          )}
        </div>

        {/* Slim Step Progress Bar */}
        <div
          className={cn(
            'w-full h-1 rounded-full overflow-hidden mt-2 mb-3.5',
            theme === 'dark' ? 'bg-zinc-800' : 'bg-slate-100'
          )}
        >
          <div
            className="h-full bg-indigo-600 dark:bg-indigo-500 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Live Action Completed Feedback Banner */}
        {feedbackMessage && (
          <div
            className={cn(
              'mb-2.5 px-2.5 py-1.5 rounded-xl border flex items-center gap-1.5 text-[11px] font-semibold',
              theme === 'dark'
                ? 'bg-emerald-950/50 border-emerald-800/60 text-emerald-300'
                : 'bg-emerald-50 border-emerald-200 text-emerald-700'
            )}
          >
            <CheckCircle2 size={13} className="shrink-0 text-emerald-500" />
            <span>{feedbackMessage}</span>
          </div>
        )}

        {/* Title & Description */}
        <h3
          id="trackbook-tour-title"
          className={cn(
            'text-base font-bold tracking-tight leading-snug',
            theme === 'dark' ? 'text-white' : 'text-slate-900'
          )}
        >
          {currentStep.title}
        </h3>
        <p
          id="trackbook-tour-desc"
          className={cn(
            'mt-1.5 text-[13px] sm:text-sm leading-relaxed',
            theme === 'dark' ? 'text-slate-300' : 'text-slate-600'
          )}
        >
          {currentStep.description}
        </p>

        {/* Live Interactive Prompt Hint */}
        {isInteractiveStep && currentStep.actionHint && (
          <div
            className={cn(
              'mt-2.5 flex items-center gap-1.5 text-[11px] font-semibold',
              theme === 'dark' ? 'text-indigo-400' : 'text-indigo-600'
            )}
          >
            <MousePointerClick size={13} className="shrink-0" />
            <span>{currentStep.actionHint}</span>
          </div>
        )}

        {/* Action Buttons Row */}
        <div
          className={cn(
            'mt-4 pt-3.5 border-t flex items-center justify-between gap-2',
            theme === 'dark' ? 'border-zinc-800/90' : 'border-slate-100'
          )}
        >
          <button
            type="button"
            onClick={handleBack}
            disabled={isFirst}
            className={cn(
              'inline-flex items-center justify-center gap-1 px-3.5 min-h-[40px] rounded-xl text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer',
              isFirst
                ? theme === 'dark'
                  ? 'text-zinc-600 bg-zinc-900/50 cursor-not-allowed'
                  : 'text-slate-300 bg-slate-50 cursor-not-allowed'
                : theme === 'dark'
                ? 'text-slate-200 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800'
                : 'text-slate-700 bg-slate-100 hover:bg-slate-200'
            )}
          >
            <ChevronLeft size={16} />
            Back
          </button>

          {isActionRequired ? (
            <div
              className={cn(
                'inline-flex items-center justify-center gap-1.5 px-3.5 min-h-[40px] rounded-xl text-xs font-bold whitespace-nowrap shrink-0 border',
                theme === 'dark'
                  ? 'bg-indigo-950/60 border-indigo-800/70 text-indigo-300'
                  : 'bg-indigo-50 border-indigo-200 text-indigo-700'
              )}
            >
              <MousePointerClick size={15} className="shrink-0 animate-pulse" />
              <span>{currentStep.requireActionLabel || 'Tap highlighted button'}</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleNext}
              className="inline-flex items-center justify-center gap-1.5 px-4 min-h-[40px] rounded-xl text-xs sm:text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white transition-all whitespace-nowrap shrink-0 shadow-sm cursor-pointer"
            >
              {isLast ? (
                <>
                  {finishLabel ? (
                    <>
                      <span>{finishLabel}</span>
                      <ChevronRight size={16} />
                    </>
                  ) : (
                    <>
                      <Check size={16} />
                      Finish
                    </>
                  )}
                </>
              ) : (
                <>
                  Next
                  <ChevronRight size={16} />
                </>
              )}
            </button>
          )}
        </div>
      </div>
      )}
    </div>
  );
}

interface TourUpdateBannerProps {
  visible: boolean;
  theme: 'light' | 'dark';
  title?: string;
  message?: string;
  onAccept: () => void;
  onDismiss: () => void;
}

export function TourUpdateBanner({
  visible,
  theme,
  title,
  message,
  onAccept,
  onDismiss,
}: TourUpdateBannerProps) {
  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="trackbook-tour-reminder-title"
      className="fixed inset-0 z-[145] flex items-center justify-center p-4 bg-slate-950/55 backdrop-blur-xs"
    >
      <div
        className={cn(
          'w-full max-w-md rounded-3xl border p-5 sm:p-6 shadow-2xl transition-all',
          theme === 'dark'
            ? 'bg-zinc-950 border-zinc-800 text-slate-100 shadow-black/70'
            : 'bg-white border-slate-200 text-slate-900 shadow-slate-900/20'
        )}
      >
        <div className="flex items-start gap-3.5">
          <div
            className={cn(
              'w-11 h-11 rounded-2xl flex items-center justify-center shrink-0',
              theme === 'dark'
                ? 'bg-indigo-950/80 text-indigo-400 border border-indigo-800/50'
                : 'bg-indigo-50 text-indigo-600 border border-indigo-100'
            )}
          >
            <Compass size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              Interactive App Guide
            </p>
            <h3
              id="trackbook-tour-reminder-title"
              className={cn(
                'text-base sm:text-lg font-bold tracking-tight mt-0.5 leading-snug',
                theme === 'dark' ? 'text-white' : 'text-slate-900'
              )}
            >
              {title || 'Want a quick guided tour of TrackBook?'}
            </h3>
            <p
              className={cn(
                'text-xs sm:text-sm leading-relaxed mt-1.5',
                theme === 'dark' ? 'text-slate-300' : 'text-slate-600'
              )}
            >
              {message ||
                'Take a 1-minute interactive walkthrough of Cash In/Out, Bill Photo Uploads, Edit & Delete, Import by Code/Excel, and PDF/Excel Reports.'}
            </p>
          </div>
        </div>

        <div
          className={cn(
            'mt-5 pt-4 border-t flex items-center justify-end gap-2.5',
            theme === 'dark' ? 'border-zinc-800/90' : 'border-slate-100'
          )}
        >
          <button
            type="button"
            onClick={() => {
              vibrate(15);
              onDismiss();
            }}
            className={cn(
              'px-4 min-h-[42px] rounded-xl text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer',
              theme === 'dark'
                ? 'bg-zinc-900 hover:bg-zinc-800 text-slate-300 border border-zinc-800'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            )}
          >
            No, Later
          </button>
          <button
            type="button"
            onClick={() => {
              vibrate(15);
              onAccept();
            }}
            className="inline-flex items-center justify-center gap-1.5 px-5 min-h-[42px] rounded-xl text-xs sm:text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white transition-all whitespace-nowrap shadow-md shadow-indigo-600/20 cursor-pointer"
          >
            <span>Yes, Start Tour</span>
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
