import { useState, useRef, useEffect, useLayoutEffect, type ReactNode } from 'react';
import { Wrench } from 'lucide-react';

interface MaintenanceTooltipProps {
  children: ReactNode;
  isActive?: boolean;
  message?: string;
  position?: 'top' | 'bottom';
  className?: string;
}

export function MaintenanceTooltip({
  children,
  isActive = true,
  message = "Produk ini sedang dalam pemeliharaan sistem. Silakan coba beberapa saat lagi.",
  position = 'top',
  className = '',
}: MaintenanceTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const [coords, setCoords] = useState<{
    left: number;
    arrowLeft: number;
    side: 'top' | 'bottom';
  } | null>(null);

  // Auto hide on click outside
  useEffect(() => {
    if (!isVisible) return;
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsVisible(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isVisible]);

  // Dynamically calculate position clamped strictly within the viewport
  // to prevent any clipping or overflow on mobile and small screens
  useLayoutEffect(() => {
    if (!isVisible || !containerRef.current) return;

    const calculatePosition = () => {
      if (!containerRef.current) return;

      const anchor = containerRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      const safeMargin = 12; // Minimum margin from viewport edge in pixels

      // Target tooltip width (max 260px or available viewport width minus margins)
      const maxAvailableWidth = viewportWidth - safeMargin * 2;
      const tooltipWidth = Math.min(260, maxAvailableWidth);

      const anchorCenterX = anchor.left + anchor.width / 2;

      // Ideal viewport left coordinate if centered on the anchor
      let targetViewportLeft = anchorCenterX - tooltipWidth / 2;

      // Clamp targetViewportLeft strictly within [safeMargin, viewportWidth - tooltipWidth - safeMargin]
      if (targetViewportLeft < safeMargin) {
        targetViewportLeft = safeMargin;
      } else if (targetViewportLeft + tooltipWidth > viewportWidth - safeMargin) {
        targetViewportLeft = viewportWidth - safeMargin - tooltipWidth;
      }

      // Convert from viewport coordinates to container-relative coordinate
      const relativeLeft = targetViewportLeft - anchor.left;

      // Calculate arrow position relative to the tooltip box
      const arrowRelativeX = anchorCenterX - targetViewportLeft;
      // Clamp arrow so it never extends beyond the rounded corners of the tooltip card
      const clampedArrowLeft = Math.max(16, Math.min(tooltipWidth - 16, arrowRelativeX));

      // Auto flip to bottom if top space is too constrained
      let side = position;
      if (position === 'top' && anchor.top < 130 && viewportHeight - anchor.bottom > 130) {
        side = 'bottom';
      } else if (position === 'bottom' && viewportHeight - anchor.bottom < 130 && anchor.top > 130) {
        side = 'top';
      }

      setCoords({
        left: relativeLeft,
        arrowLeft: clampedArrowLeft,
        side,
      });
    };

    calculatePosition();
    window.addEventListener('resize', calculatePosition);
    window.addEventListener('scroll', calculatePosition, true);

    return () => {
      window.removeEventListener('resize', calculatePosition);
      window.removeEventListener('scroll', calculatePosition, true);
    };
  }, [isVisible, position]);

  if (!isActive) {
    return <>{children}</>;
  }

  const currentSide = coords?.side ?? position;

  return (
    <div
      ref={containerRef}
      className={`relative inline-block ${className}`}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onClick={() => setIsVisible((prev) => !prev)}
      role="tooltip"
      aria-label="Produk sedang maintenance"
    >
      {children}

      {isVisible && (
        <div
          ref={tooltipRef}
          style={{
            left: coords ? `${coords.left}px` : '50%',
            transform: coords ? 'none' : 'translateX(-50%)',
            width: 'min(260px, calc(100vw - 24px))',
            opacity: coords ? 1 : 0,
          }}
          className={`absolute z-50 transition-opacity duration-150 pointer-events-none select-none ${
            currentSide === 'top'
              ? 'bottom-full mb-2.5 animate-in fade-in slide-in-from-bottom-2'
              : 'top-full mt-2.5 animate-in fade-in slide-in-from-top-2'
          }`}
        >
          {/* Tooltip Card */}
          <div className="bg-[#181C2A] text-white p-3 rounded-xl border-2 border-black shadow-[3px_3px_0px_#000000] text-left">
            <div className="flex items-center gap-1.5 font-black text-xs uppercase tracking-wider text-amber-400 mb-1">
              <Wrench className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>SEDANG MAINTENANCE</span>
            </div>
            <p className="text-[11px] leading-relaxed text-gray-200 font-medium break-words">
              {message}
            </p>
          </div>

          {/* Pointer Arrow */}
          <div
            style={{
              left: coords ? `${coords.arrowLeft}px` : '50%',
            }}
            className={`absolute -translate-x-1/2 w-0 h-0 border-x-[6px] border-x-transparent ${
              currentSide === 'top'
                ? 'top-full border-t-[6px] border-t-black'
                : 'bottom-full border-b-[6px] border-b-black'
            }`}
          />
        </div>
      )}
    </div>
  );
}
