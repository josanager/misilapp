import { useCallback, useRef } from 'react';

interface Options {
  delay?: number;
  shouldPreventDefault?: boolean;
}

export function useLongPress(
  onLongPress: (e: any) => void,
  onClick?: (e: any) => void,
  { delay = 500, shouldPreventDefault = true }: Options = {}
) {
  const timeout = useRef<NodeJS.Timeout>();
  const target = useRef<EventTarget>();

  const start = useCallback(
    (event: any) => {
      if (shouldPreventDefault && event.target) {
        event.target.addEventListener('touchend', preventDefault, {
          passive: false
        });
        target.current = event.target;
      }
      timeout.current = setTimeout(() => {
        onLongPress(event);
      }, delay);
    },
    [onLongPress, delay, shouldPreventDefault]
  );

  const clear = useCallback(
    (event: any, shouldTriggerClick = true) => {
      if (timeout.current) {
        clearTimeout(timeout.current);
      }
      if (shouldTriggerClick && !timeout.current && onClick) {
        onClick(event);
      }
      if (shouldPreventDefault && target.current) {
        target.current.removeEventListener('touchend', preventDefault);
      }
    },
    [shouldPreventDefault, onClick]
  );

  return {
    onMouseDown: (e: any) => start(e),
    onTouchStart: (e: any) => start(e),
    onMouseUp: (e: any) => clear(e),
    onMouseLeave: (e: any) => clear(e, false),
    onTouchEnd: (e: any) => clear(e),
  };
}

function preventDefault(e: Event) {
  if (!('touches' in e)) return;
  if ((e as TouchEvent).touches.length < 2 && e.preventDefault) {
    e.preventDefault();
  }
}
