import { ReactNode, RefObject, useEffect, useRef, useState } from 'react';

interface VirtualMessageProps {
  children: ReactNode;
  rootRef: RefObject<HTMLElement>;
  estimate?: number;
  measureKey?: string;
}

export function VirtualMessage({ children, rootRef, estimate = 160, measureKey }: VirtualMessageProps) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(true);
  const [height, setHeight] = useState(estimate);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;

    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      {
        root: rootRef.current,
        rootMargin: '900px 0px',
        threshold: 0,
      }
    );

    observer.observe(shell);
    return () => observer.disconnect();
  }, [rootRef]);

  useEffect(() => {
    if (!isVisible || !contentRef.current) return;

    const content = contentRef.current;
    const updateHeight = () => {
      const next = content.getBoundingClientRect().height;
      if (next > 0) setHeight(next);
    };

    updateHeight();

    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(updateHeight);
    observer.observe(content);
    return () => observer.disconnect();
  }, [isVisible, measureKey]);

  return (
    <div ref={shellRef} style={{ minHeight: isVisible ? undefined : height }}>
      {isVisible && <div ref={contentRef}>{children}</div>}
    </div>
  );
}
