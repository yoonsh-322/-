import React from 'react';
import { KillEvent } from '../types/game.js';

interface KillFeedProps {
  events: KillEvent[];
}

export const KillFeed: React.FC<KillFeedProps> = ({ events }) => {
  if (events.length === 0) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-1.5 pointer-events-none max-w-md w-full px-4">
      {events.slice(0, 3).map((event) => (
        <div
          key={event.id}
          className="bg-black/60 backdrop-blur-md border border-white/10 text-xs px-3.5 py-1.5 rounded-full shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-300"
        >
          <span className="font-bold text-amber-400 max-w-[120px] truncate">{event.killerName}</span>
          <span className="text-gray-400">⚔️</span>
          <span className="text-red-400 font-semibold max-w-[120px] truncate">{event.victimName}</span>
          <span className="text-[10px] text-gray-400 bg-white/10 px-1.5 py-0.5 rounded-full ml-1">처치</span>
        </div>
      ))}
    </div>
  );
};
