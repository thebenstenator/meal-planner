import { useEffect, useState } from 'react';

/**
 * Tracks whether the page is being scrolled down far enough to tuck a fixed bar
 * away. Returns `hidden = true` while scrolling down (past a small threshold),
 * `false` while scrolling up or near the top. rAF-throttled so the scroll
 * handler stays cheap, and it ignores jitter so the bar doesn't flicker.
 *
 * Powers the mobile bottom nav's hide-on-scroll behaviour.
 */
export function useScrollDirection(threshold = 8): boolean {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let lastY = window.scrollY;
    let ticking = false;

    function update() {
      const y = window.scrollY;
      const delta = y - lastY;
      // Always reveal near the top; only react once past the jitter threshold.
      if (y < 24) {
        setHidden(false);
      } else if (Math.abs(delta) > threshold) {
        setHidden(delta > 0);
      }
      lastY = y;
      ticking = false;
    }

    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold]);

  return hidden;
}
