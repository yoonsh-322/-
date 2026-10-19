import React, { useEffect } from 'react';
import { sounds } from '../utils/audio.js';

interface EmoteBarProps {
  onSendEmote: (icon: string) => void;
  disabled?: boolean;
}

const EMOTES = ['🔥', '😎', '💀', '👑', '🐍', '⚡', '😭', '😈'];

export const EmoteBar: React.FC<EmoteBarProps> = ({ onSendEmote, disabled }) => {
  const handleTrigger = (icon: string) => {
    if (disabled) return;
    sounds.playEmote();
    onSendEmote(icon);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (disabled) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= EMOTES.length) {
        handleTrigger(EMOTES[num - 1]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [disabled, onSendEmote]);

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 bg-slate-900/80 backdrop-blur-md border border-slate-800/80 px-3 py-1.5 rounded-full shadow-2xl">
      {EMOTES.map((icon, idx) => (
        <button
          key={icon}
          onClick={() => handleTrigger(icon)}
          disabled={disabled}
          title={`단축키 ${idx + 1}`}
          className="relative group p-1.5 hover:bg-white/10 active:scale-125 transition-all rounded-full flex items-center justify-center text-lg disabled:opacity-50"
        >
          <span>{icon}</span>
          <span className="hidden group-hover:block absolute -top-6 bg-black/80 text-[10px] text-white px-1.5 py-0.5 rounded pointer-events-none">
            {idx + 1}
          </span>
        </button>
      ))}
    </div>
  );
};
