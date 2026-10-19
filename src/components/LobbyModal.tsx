import React, { useState } from 'react';
import { WormSkin } from '../types/game.js';
import { Play, Sparkles, Users, Palette, Zap, MousePointer, ShieldAlert } from 'lucide-react';

interface LobbyModalProps {
  playerName: string;
  onPlayerNameChange: (name: string) => void;
  selectedSkin: WormSkin;
  onOpenSkinModal: () => void;
  roomId: string;
  onRoomIdChange: (roomId: string) => void;
  onStartGame: () => void;
  connecting?: boolean;
}

export const LobbyModal: React.FC<LobbyModalProps> = ({
  playerName,
  onPlayerNameChange,
  selectedSkin,
  onOpenSkinModal,
  roomId,
  onRoomIdChange,
  onStartGame,
  connecting,
}) => {
  const [isCustomRoom, setIsCustomRoom] = useState(roomId !== 'default');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onStartGame();
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
      <div className="relative w-full max-w-md bg-slate-900/95 border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col">
        {/* Title & Brand */}
        <div className="text-center pb-5 border-b border-slate-800">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-bold mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>실시간 멀티플레이 슬리더</span>
          </div>
          <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-300 to-indigo-400 tracking-tight">
            SLITHER WORMS
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            먹이를 먹고 거대해지세요! 상대 머리를 몸통에 유도하면 시체가 내 먹이가 됩니다!
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          {/* Player Name */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              지렁이 이름 (닉네임)
            </label>
            <input
              type="text"
              value={playerName}
              onChange={(e) => onPlayerNameChange(e.target.value)}
              placeholder="멋진 지렁이 이름을 입력하세요"
              maxLength={14}
              required
              className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-colors"
            />
          </div>

          {/* Skin Selector Button */}
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">스킨 선택</label>
            <button
              type="button"
              onClick={onOpenSkinModal}
              className="w-full flex items-center justify-between bg-slate-950 border border-slate-700 hover:border-cyan-500/60 rounded-2xl p-3 text-left transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <div
                    className="w-4 h-4 rounded-full border border-white/20 shadow-sm"
                    style={{ backgroundColor: selectedSkin.headColor }}
                  />
                  <div
                    className="w-3.5 h-3.5 rounded-full border border-white/20"
                    style={{ backgroundColor: selectedSkin.bodyColor1 }}
                  />
                  <div
                    className="w-3 h-3 rounded-full border border-white/20"
                    style={{ backgroundColor: selectedSkin.bodyColor2 }}
                  />
                </div>
                <div className="text-xs">
                  <div className="font-bold text-white group-hover:text-cyan-300 transition-colors">
                    {selectedSkin.name}
                  </div>
                  <div className="text-[10px] text-slate-400">Gemini AI 스킨 생성 가능</div>
                </div>
              </div>
              <div className="flex items-center gap-1 text-xs font-bold text-cyan-400 bg-cyan-500/10 px-2.5 py-1 rounded-xl">
                <Palette className="w-3.5 h-3.5" />
                <span>변경</span>
              </div>
            </button>
          </div>

          {/* Room Selection */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-300">플레이 모드 / 룸</label>
              <button
                type="button"
                onClick={() => {
                  const next = !isCustomRoom;
                  setIsCustomRoom(next);
                  onRoomIdChange(next ? 'friends-room' : 'default');
                }}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 font-semibold"
              >
                {isCustomRoom ? '글로벌 아레나로 변경' : '+ 친구와 할 비밀 방 만들기'}
              </button>
            </div>

            {isCustomRoom ? (
              <div className="space-y-1">
                <input
                  type="text"
                  value={roomId}
                  onChange={(e) => onRoomIdChange(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                  placeholder="방 코드 (영문/숫자, 예: my-room)"
                  maxLength={20}
                  className="w-full bg-slate-950 border border-indigo-500/50 rounded-2xl px-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-400"
                />
                <span className="text-[10px] text-indigo-300/80 block">
                  * 같은 방 코드를 입력한 친구들끼리만 실시간 매칭됩니다!
                </span>
              </div>
            ) : (
              <div className="flex items-center justify-between bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2.5 text-xs text-slate-300">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-cyan-400" />
                  <span className="font-bold text-white">글로벌 통합 아레나</span>
                </div>
                <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full">
                  실시간 진행 중
                </span>
              </div>
            )}
          </div>

          {/* Controls Quick Guide */}
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-3 space-y-1.5 text-[11px] text-slate-300">
            <div className="flex items-center gap-2">
              <MousePointer className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>
                <strong>마우스/터치:</strong> 커서 방향으로 지렁이가 회전 및 이동합니다.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
              <span>
                <strong>클릭 / 스페이스바:</strong> 부스트 대시 (점수를 소모해 고속 질주).
              </span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-3.5 h-3.5 text-red-400 shrink-0" />
              <span>
                <strong>핵심 룰:</strong> 다른 지렁이 몸통에 머리를 부딪히면 사망하고 시체가 먹이가 됩니다!
              </span>
            </div>
          </div>

          {/* Play Button */}
          <button
            type="submit"
            disabled={connecting || !playerName.trim()}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-black text-base shadow-xl shadow-cyan-500/25 active:scale-98 transition-all disabled:opacity-50"
          >
            <Play className="w-5 h-5 fill-white" />
            <span>{connecting ? '서버 접속 중...' : '게임 시작 (Play Now)'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
