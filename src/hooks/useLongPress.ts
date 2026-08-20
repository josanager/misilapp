import { useCallback, useRef } from 'react';
import type { MouseEvent as ReactMouseEvent, TouchEvent as ReactTouchEvent } from 'react';

interface Options {
  delay?: number;
  shouldPreventDefault?: boolean;
}

type LongPressEvent = ReactMouseEvent<HTMLElement> | ReactTouchEvent<HTMLElement>;

export function useLongPress(
  onLongPress: (event: LongPressEvent) => void,
  onClick?: (event: LongPressEvent) => void,
  { delay = 500, shouldPreventDefault = true }: Options = {},
) {
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const target = useRef<EventTarget | null>(null);
  const longPressTriggered = useRef(false);

  const start = useCallback((event: LongPressEvent) => {
    longPressTriggered.current = false;
    if (shouldPreventDefault && event.target) {
      event.target.addEventListener('touchend', preventDefault, { passive: false });
      target.current = event.target;
    }
    timeout.current = setTimeout(() => {
      longPressTriggered.current = true;
      timeout.current = null;
      onLongPress(event);
    }, delay);
  }, [delay, onLongPress, shouldPreventDefault]);

  const clear = useCallback((event: LongPressEvent, shouldTriggerClick = true) => {
    if (timeout.current) {
      clearTimeout(timeout.current);
      timeout.current = null;
    }
    if (shouldTriggerClick && !longPressTriggered.current) onClick?.(event);
    if (shouldPreventDefault && target.current) {
      target.current.removeEventListener('touchend', preventDefault);
      target.current = null;
    }
  }, [onClick, shouldPreventDefault]);

  return {
    onMouseDown: (event: ReactMouseEvent<HTMLElement>) => start(event),
    onTouchStart: (event: ReactTouchEvent<HTMLElement>) => start(event),
    onMouseUp: (event: ReactMouseEvent<HTMLElement>) => clear(event),
    onMouseLeave: (event: ReactMouseEvent<HTMLElement>) => clear(event, false),
    onTouchEnd: (event: ReactTouchEvent<HTMLElement>) => clear(event),
  };
}

function preventDefault(event: Event) {
  if ('touches' in event && (event as TouchEvent).touches.length < 2) event.preventDefault();
}
