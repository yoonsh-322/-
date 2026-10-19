import React, { useState, useRef, useEffect } from 'react';
import { PRESET_SKINS, WormSkin } from '../types/game.js';
import { Sparkles, Check, Wand2, X, RefreshCw } from 'lucide-react';

interface SkinModalProps {
  currentSkin: WormSkin;
  onSelectSkin: (skin: WormSkin) => void;
  onClose: () => void;
}

export const SkinModal: React.FC<SkinModalProps> = ({ currentSkin, onSelectSkin, onClose }) => {
  const [selected, setSelected] = useState<WormSkin>(currentSkin);
  const [customPrompt, setCustomPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [customSkins, setCustomSkins] = useState<WormSkin[]>([]);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number | null>(null);

  // Animated preview of the currently selected skin
  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let time = 0;
    const renderPreview = () => {
      time += 0.04;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const numSegments = 16;
      const segDist = 8;
      const radius = 9;

      // Draw segments in S-curve
      for (let i = numSegments - 1; i >= 0; i--) {
        const offset = i * segDist;
        const wave = Math.sin(time + i * 0.3) * 16;
        const sx = cx - offset + 60;
        const sy = cy + wave;

        let segColor = selected.bodyColor1;
        if (selected.pattern === 'stripes') {
          segColor = i % 2 === 0 ? selected.bodyColor1 : selected.bodyColor2;
        } else if (selected.pattern === 'gradient') {
          segColor = i < 8 ? selected.bodyColor1 : selected.bodyColor2;
        } else if (selected.pattern === 'gemini') {
          const colors = ['#6366f1', '#8b5cf6', '#38bdf8', '#a855f7'];
          segColor = colors[i % colors.length];
        }

        ctx.save();
        ctx.shadowColor = selected.glowColor;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(sx, sy, radius, 0, Math.PI * 2);
        ctx.fillStyle = segColor;
        ctx.fill();
        ctx.restore();
      }

      // Draw head
      const headX = cx + 60;
      const headY = cy + Math.sin(time) * 16;

      ctx.save();
      ctx.shadowColor = selected.glowColor;
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(headX, headY, radius + 2, 0, Math.PI * 2);
      ctx.fillStyle = selected.headColor;
      ctx.fill();

      // Eyes
      const eyeOffset = 4;
      const eyeR = 3;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(headX + 2, headY - eyeOffset, eyeR, 0, Math.PI * 2);
      ctx.arc(headX + 2, headY + eyeOffset, eyeR, 0, Math.PI * 2);
      ctx.fill();

      // Pupils
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.arc(headX + 3.5, headY - eyeOffset, 1.5, 0, Math.PI * 2);
      ctx.arc(headX + 3.5, headY + eyeOffset, 1.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      animFrameRef.current = requestAnimationFrame(renderPreview);
    };

    renderPreview();

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [selected]);

  const handleGenerateAISkin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customPrompt.trim() || isGenerating) return;

    setIsGenerating(true);
    try {
      const res = await fetch('/api/gemini/skin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: customPrompt }),
      });
      const json = await res.json();
      if (json.success && json.skin) {
        setCustomSkins((prev) => [json.skin, ...prev]);
        setSelected(json.skin);
      }
    } catch (err) {
      console.error('Failed to generate skin:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApply = () => {
    onSelectSkin(selected);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-bold text-white">지렁이 스킨 커스터마이징</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Preview Canvas */}
        <div className="my-4 flex flex-col items-center justify-center bg-slate-950/70 border border-slate-800 rounded-2xl p-3 relative overflow-hidden">
          <div className="absolute top-2 left-3 text-[11px] font-semibold text-slate-400">
            스킨 미리보기: <span className="text-cyan-400 font-bold">{selected.name}</span>
          </div>
          <canvas ref={previewCanvasRef} width={260} height={90} className="w-full max-w-[260px] h-[90px]" />
          <div className="flex items-center gap-2 mt-1">
            <span
              className="w-3.5 h-3.5 rounded-full border border-white/20"
              style={{ backgroundColor: selected.headColor }}
              title="머리 색"
            />
            <span
              className="w-3.5 h-3.5 rounded-full border border-white/20"
              style={{ backgroundColor: selected.bodyColor1 }}
              title="몸통 1"
            />
            <span
              className="w-3.5 h-3.5 rounded-full border border-white/20"
              style={{ backgroundColor: selected.bodyColor2 }}
              title="몸통 2"
            />
            <span
              className="w-3.5 h-3.5 rounded-full border border-white/20"
              style={{ backgroundColor: selected.glowColor }}
              title="네온 광택"
            />
            <span className="text-[10px] text-slate-400 uppercase ml-2 bg-slate-800 px-2 py-0.5 rounded-full">
              패턴: {selected.pattern}
            </span>
          </div>
        </div>

        {/* Gemini AI Skin Generator */}
        <div className="mb-4 bg-gradient-to-r from-indigo-950/50 to-purple-950/40 border border-indigo-500/30 rounded-2xl p-3.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-300 mb-1.5">
            <Wand2 className="w-3.5 h-3.5 text-indigo-400" />
            <span>Gemini AI 맞춤 스킨 제작</span>
          </div>
          <form onSubmit={handleGenerateAISkin} className="flex gap-2">
            <input
              type="text"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="예: 은하수 번개 드래곤, 황금빛 피카츄 뱀..."
              className="flex-1 bg-slate-900 border border-indigo-500/30 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-400"
            />
            <button
              type="submit"
              disabled={isGenerating || !customPrompt.trim()}
              className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition-all shrink-0"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>생성 중</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>스킨 생성</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Skin selection grid */}
        <div className="space-y-2 mb-4">
          <span className="text-xs font-semibold text-slate-400">프리셋 및 제작된 스킨</span>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-48 overflow-y-auto pr-1">
            {[...customSkins, ...PRESET_SKINS].map((skin) => {
              const isCur = selected.id === skin.id;
              return (
                <button
                  key={skin.id}
                  onClick={() => setSelected(skin)}
                  className={`flex flex-col p-2.5 rounded-xl border text-left transition-all ${
                    isCur
                      ? 'bg-slate-800 border-cyan-400 shadow-lg shadow-cyan-500/10'
                      : 'bg-slate-950/50 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-white truncate">{skin.name}</span>
                    {isCur && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div
                      className="w-4 h-4 rounded-full border border-white/20 shadow-sm"
                      style={{ backgroundColor: skin.headColor }}
                    />
                    <div
                      className="w-3.5 h-3.5 rounded-full border border-white/20"
                      style={{ backgroundColor: skin.bodyColor1 }}
                    />
                    <div
                      className="w-3 h-3 rounded-full border border-white/20"
                      style={{ backgroundColor: skin.bodyColor2 }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800"
          >
            취소
          </button>
          <button
            onClick={handleApply}
            className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 shadow-lg shadow-cyan-500/20 active:scale-95 transition-all"
          >
            <Check className="w-3.5 h-3.5" />
            <span>이 스킨으로 결정</span>
          </button>
        </div>
      </div>
    </div>
  );
};
