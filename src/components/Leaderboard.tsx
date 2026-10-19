import React from 'react';
import { LeaderboardEntry } from '../types/game.js';
import { Trophy, Crown, Flame } from 'lucide-react';

interface LeaderboardProps {
  entries: LeaderboardEntry[];
  selfId: string;
  totalAlive: number;
}

export const Leaderboard: React.FC<LeaderboardProps> = ({ entries, selfId, totalAlive }) => {
  const selfEntry = entries.find((e) => e.id === selfId);
  const selfRankIndex = entries.findIndex((e) => e.id === selfId);

  return (
    <div className="fixed top-4 right-4 z-20 w-64 bg-slate-900/80 backdrop-blur-md border border-slate-800/80 rounded-2xl p-3.5 shadow-2xl text-white select-none pointer-events-none md:pointer-events-auto">
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
        <div className="flex items-center gap-1.5 font-bold text-sm tracking-wide text-amber-400">
          <Trophy className="w-4 h-4 text-amber-400" />
          <span>리더보드</span>
        </div>
        <span className="text-[11px] font-medium text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-full">
          생존 {totalAlive}명
        </span>
      </div>

      <div className="space-y-1">
        {entries.slice(0, 10).map((entry, index) => {
          const isSelf = entry.id === selfId;
          const rank = index + 1;

          let rankBadge = (
            <span className="w-4 text-center font-bold text-[11px] text-slate-400">{rank}</span>
          );
          if (rank === 1) {
            rankBadge = <Crown className="w-4 h-4 text-amber-400 fill-amber-400" />;
          } else if (rank === 2) {
            rankBadge = <Crown className="w-3.5 h-3.5 text-slate-300 fill-slate-300" />;
          } else if (rank === 3) {
            rankBadge = <Crown className="w-3.5 h-3.5 text-amber-700 fill-amber-700" />;
          }

          return (
            <div
              key={entry.id}
              className={`flex items-center justify-between px-2 py-1 rounded-lg text-xs transition-colors ${
                isSelf
                  ? 'bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-bold'
                  : 'hover:bg-slate-800/40 text-slate-300'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0 pr-1">
                <div className="flex items-center justify-center w-4">{rankBadge}</div>
                <span className="truncate max-w-[110px]">{entry.name}</span>
                {entry.kills > 0 && (
                  <span className="flex items-center text-[10px] text-red-400 font-medium">
                    <Flame className="w-2.5 h-2.5 mr-0.5" />
                    {entry.kills}
                  </span>
                )}
              </div>
              <span className="font-mono text-slate-400 text-[11px] tabular-nums font-semibold">
                {entry.score.toLocaleString()}
              </span>
            </div>
          );
        })}
      </div>

      {/* If player is outside top 10 */}
      {selfEntry && selfRankIndex >= 10 && (
        <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between px-2 py-1 rounded-lg text-xs bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-bold">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-4 text-center text-[11px] font-bold text-cyan-400">
              #{selfRankIndex + 1}
            </span>
            <span className="truncate max-w-[110px]">{selfEntry.name} (나)</span>
          </div>
          <span className="font-mono text-cyan-300 text-[11px] tabular-nums font-semibold">
            {selfEntry.score.toLocaleString()}
          </span>
        </div>
      )}
    </div>
  );
};
