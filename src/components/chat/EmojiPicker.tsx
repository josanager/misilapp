import { useRef, useEffect } from 'react';

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥', '👏', '🎉', '💯', '🙏'];

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
  position: { x: number; y: number };
}

export function EmojiPicker({ onSelect, onClose, position }: EmojiPickerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  // Adjust position to stay within viewport
  const style: React.CSSProperties = {
    position: 'fixed',
    left: Math.min(position.x, window.innerWidth - 340),
    top: Math.max(8, position.y - 52),
    zIndex: 200,
  };

  return (
    <div ref={ref} className="emoji-picker" style={style}>
      {QUICK_EMOJIS.map(emoji => (
        <button
          key={emoji}
          className="emoji-btn"
          onPointerDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(emoji);
          }}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}

interface ReactionDisplayProps {
  reactions: { emoji: string; count: number; users: string[]; reacted: boolean }[];
  onToggle: (emoji: string) => void;
}

export function ReactionDisplay({ reactions, onToggle }: ReactionDisplayProps) {
  if (!reactions || reactions.length === 0) return null;
  
  return (
    <div className="reaction-bar">
      {reactions.map(r => (
        <button
          key={r.emoji}
          className={`reaction-pill ${r.reacted ? 'reacted' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggle(r.emoji);
          }}
          title={r.users.join(', ')}
        >
          <span className="reaction-emoji">{r.emoji}</span>
          <span className="reaction-count">{r.count}</span>
        </button>
      ))}
    </div>
  );
}
