import { useEffect, useRef } from 'react';

type HotkeyHandlers = {
  onQuickGoal: () => void;
  onTogglePause: () => void;
  onToggleMode: () => void;
  onToggleView: () => void;
  onEscape: () => void;
};

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return (
    tag === 'input' ||
    tag === 'textarea' ||
    tag === 'select' ||
    target.isContentEditable ||
    target.getAttribute('role') === 'textbox'
  );
}

export function useHotkeys(handlers: HotkeyHandlers) {
  const handlersRef = useRef(handlers);

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;

      switch (event.code) {
        case 'Escape':
          handlersRef.current.onEscape();
          break;
        case 'KeyQ':
          if (event.repeat) return;
          event.preventDefault();
          handlersRef.current.onQuickGoal();
          break;
        case 'Space':
          event.preventDefault();
          if (event.repeat) return;
          handlersRef.current.onTogglePause();
          break;
        case 'KeyM':
          if (event.repeat) return;
          handlersRef.current.onToggleMode();
          break;
        case 'KeyV':
          if (event.repeat) return;
          handlersRef.current.onToggleView();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}
