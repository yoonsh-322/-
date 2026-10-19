import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { AICoachResponse } from '../types/game.js';
import { RotateCcw, Sparkles, Skull, Trophy, Flame, Timer, Lightbulb, Palette, RefreshCw } from 'lucide-react';

interface GameOverModalProps {
  score: number;
  length: number;
  kills: number;
  survivalSeconds: number;
  killerName: string;
  reason: string;
  rank?: number;
  onRespawn: () => void;
  onChangeSkin: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  score,
  length,
  kills,
  survivalSeconds,
  killerName,
  reason,
  rank,
  onRespawn,
  onChangeSkin,
}) => {
  const [coachData, setCoachData] = useState<AICoachResponse | null>(null);
  const [loadingCoach, setLoadingCoach] = useState(true);

  useEffect(() => {
    if (score > 600 || kills > 1) {
      try {
        confetti({
          particleCount: 60,
          spread: 70,
          origin: { y: 0.6 },
        });
      } catch {
        // ignore
      }
    }

    // Request Gemini Coach analysis
    const fetchCoach = async () => {
      setLoadingCoach(true);
      try {
        const res = await fetch('/api/gemini/coach', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            score,
            length,
            kills,
            survivalSeconds,
            killerName,
            reason,
            rank,
          }),
        });
        const json = await res.json();
        if (json.success && json.data) {
          setCoachData(json.data);
        }
      } catch (err) {
        console.error('Coach fetch error:', err);
      } finally {
        setLoadingCoach(false);
      }
    };

    fetchCoach();
  }, [score, length, kills, survivalSeconds, killerName, reason, rank]);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
      <div className="relative w-full max-w-lg bg-slate-900 border border-red-500/30 rounded-3xl p-6 shadow-2xl flex flex-col max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex flex-col items-center text-center pb-4 border-b border-slate-800">
          <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-500 mb-2">
            <Skull className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">게임 오버</h2>
          <p className="text-xs text-slate-400 mt-1">
            <span className="text-red-400 font-bold">{killerName}</span>에게 머리를 박아 먹이로 산화했습니다!
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-4 gap-2 my-4">
          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-2.5 text-center">
            <div className="flex items-center justify-center text-amber-400 mb-1">
              <Trophy className="w-3.5 h-3.5" />
            </div>
            <div className="text-[10px] text-slate-400 font-medium">최종 점수</div>
            <div className="text-sm font-black text-white font-mono mt-0.5">{score.toLocaleString()}</div>
          </div>
          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-2.5 text-center">
            <div className="flex items-center justify-center text-red-400 mb-1">
              <Flame className="w-3.5 h-3.5" />
            </div>
            <div className="text-[10px] text-slate-400 font-medium">처치 수</div>
            <div className="text-sm font-black text-red-400 font-mono mt-0.5">{kills} 킬</div>
          </div>
          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-2.5 text-center">
            <div className="flex items-center justify-center text-cyan-400 mb-1">
              <span className="text-xs font-bold">🐍</span>
            </div>
            <div className="text-[10px] text-slate-400 font-medium">최대 길이</div>
            <div className="text-sm font-black text-cyan-400 font-mono mt-0.5">{length} 마디</div>
          </div>
          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-2.5 text-center">
            <div className="flex items-center justify-center text-purple-400 mb-1">
              <Timer className="w-3.5 h-3.5" />
            </div>
            <div className="text-[10px] text-slate-400 font-medium">생존 시간</div>
            <div className="text-sm font-black text-purple-400 font-mono mt-0.5">{survivalSeconds}초</div>
          </div>
        </div>

        {/* Gemini AI Coach Review Card */}
        <div className="mb-4 bg-gradient-to-br from-indigo-950/40 via-purple-950/30 to-slate-950/60 border border-indigo-500/30 rounded-2xl p-4">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-indigo-500/20">
            <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-300">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span>Gemini AI 프로 코치 전술 분석</span>
            </div>
            {coachData && (
              <span className="text-[11px] font-bold text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                {coachData.rankTier}
              </span>
            )}
          </div>

          {loadingCoach ? (
            <div className="py-6 flex flex-col items-center justify-center gap-2 text-indigo-300/80 text-xs">
              <RefreshCw className="w-5 h-5 animate-spin text-indigo-400" />
              <span>플레이어의 움직임을 AI 코치가 정밀 분석 중...</span>
            </div>
          ) : coachData ? (
            <div className="space-y-2.5 text-xs">
              <div>
                <span className="font-bold text-white text-sm">"{coachData.title}"</span>
                <p className="text-slate-300 mt-1 italic bg-white/5 p-2 rounded-xl border border-white/5">
                  💬 {coachData.roast}
                </p>
              </div>

              <div>
                <span className="text-[11px] font-bold text-indigo-300 flex items-center gap-1 mb-1">
                  <Lightbulb className="w-3.5 h-3.5 text-yellow-400" />
                  다음 판 1등을 위한 핵심 전술
                </span>
                <ul className="space-y-1 text-slate-300 pl-1">
                  {coachData.advice.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-1.5 text-[11px]">
                      <span className="text-indigo-400 font-bold shrink-0">{idx + 1}.</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {coachData.playstyleAnalysis && (
                <div className="pt-1.5 border-t border-indigo-500/20 text-[11px] text-slate-400">
                  <span className="text-indigo-300 font-semibold">성향: </span>
                  {coachData.playstyleAnalysis}
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-400">코치 데이터를 불러오지 못했습니다.</p>
          )}
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-3 pt-2 border-t border-slate-800">
          <button
            onClick={onChangeSkin}
            className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-all active:scale-95"
          >
            <Palette className="w-4 h-4 text-cyan-400" />
            <span>스킨 변경</span>
          </button>
          <button
            onClick={onRespawn}
            className="flex-2 flex items-center justify-center gap-2 py-3 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-black text-sm shadow-xl shadow-cyan-500/20 transition-all active:scale-95"
          >
            <RotateCcw className="w-4 h-4" />
            <span>즉시 다시 플레이!</span>
          </button>
        </div>
      </div>
    </div>
  );
};
