import React, { useEffect, useRef } from 'react';

/**
 * Scroll reveal, built to fail safe.
 *
 * The previous implementation used gsap.from({opacity: 0}) driven by
 * ScrollTrigger. That sets the element to invisible immediately and only
 * restores it when the trigger fires, so any failure, a scroll hijacker
 * disagreeing about scroll position, a lazy chunk arriving late, a blocked
 * script, left whole sections permanently invisible. It did exactly that in
 * production.
 *
 * The rule now: **content is visible by default.** CSS paints it at full
 * opacity, and the animation is opt in, added only once JavaScript has
 * confirmed the element is off screen and IntersectionObserver is available.
 * If anything at all goes wrong, the reader still sees the page.
 *
 * It is also cheap: one shared observer, a class toggle, and a compositor only
 * transform. No animation library on the scroll path.
 */

let observer: IntersectionObserver | null = null;
const pending = new WeakMap<Element, () => void>();

function getObserver(): IntersectionObserver | null {
  if (typeof IntersectionObserver === 'undefined') return null;

  if (!observer) {
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          pending.get(entry.target)?.();
          pending.delete(entry.target);
          observer?.unobserve(entry.target);
        }
      },
      // Starts slightly before the element enters, so the motion has finished
      // by the time the reader's eye arrives.
      { rootMargin: '0px 0px -10% 0px', threshold: 0.01 }
    );
  }
  return observer;
}

export const Reveal: React.FC<{
  children: React.ReactNode;
  /** Animate direct children one after another instead of the block as a whole. */
  stagger?: boolean;
  className?: string;
  as?: 'div' | 'section' | 'ul' | 'article';
}> = ({ children, stagger = false, className = '', as = 'div' }) => {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const io = getObserver();
    if (!io) return; // no observer, content simply stays visible

    const targets = stagger
      ? (Array.from(node.children) as HTMLElement[])
      : [node as HTMLElement];
    if (targets.length === 0) return;

    // Only animate what is currently below the fold. Anything already on
    // screen, which includes every element when the page is short, is left
    // exactly as painted so nothing flickers.
    const belowFold = targets.filter(
      (el) => el.getBoundingClientRect().top > window.innerHeight * 0.9
    );
    if (belowFold.length === 0) return;

    belowFold.forEach((el, index) => {
      el.classList.add('reveal-pending');
      el.style.setProperty('--reveal-delay', `${Math.min(index, 5) * 70}ms`);
    });

    let safety: number | undefined;

    const trigger = () => {
      window.clearTimeout(safety);
      belowFold.forEach((el) => {
        el.classList.remove('reveal-pending');
        el.classList.add('reveal-in');
      });
    };

    pending.set(node, trigger);
    io.observe(node);

    // Last resort. If the observer never fires for any reason, an unusual
    // scroll container, a browser quirk, a page that is restored mid scroll,
    // the content reveals itself anyway. Nothing on this site is ever allowed
    // to stay invisible waiting for an event that may not come.
    safety = window.setTimeout(trigger, 2500);

    return () => {
      window.clearTimeout(safety);
      pending.delete(node);
      io.unobserve(node);
      belowFold.forEach((el) => el.classList.remove('reveal-pending', 'reveal-in'));
    };
  }, [stagger, children]);

  const Tag = as as any;
  return (
    <Tag ref={ref} className={className}>
      {children}
    </Tag>
  );
};
