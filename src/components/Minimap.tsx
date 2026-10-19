import React, { useRef, useEffect } from 'react';
import { WormData } from '../types/game.js';

interface MinimapProps {
  worms: WormData[];
  selfWorm?: WormData;
  worldRadius: number;
}

export const Minimap: React.FC<MinimapProps> = ({ worms, selfWorm, worldRadius }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = canvas.width;
    const center = size / 2;
    const scale = (center - 8) / worldRadius;

    ctx.clearRect(0, 0, size, size);

    // Draw radar background
    ctx.save();
    ctx.beginPath();
    ctx.arc(center, center, center - 6, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
    ctx.stroke();

    // Radar crosshairs
    ctx.beginPath();
    ctx.moveTo(center, 10);
    ctx.lineTo(center, size - 10);
    ctx.moveTo(10, center);
    ctx.lineTo(size - 10, center);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
    ctx.stroke();

    // Other worms
    for (const w of worms) {
      if (!w.isAlive) continue;
      const isSelf = selfWorm && w.id === selfWorm.id;
      if (isSelf) continue;

      const mx = center + w.x * scale;
      const my = center + w.y * scale;

      ctx.beginPath();
      ctx.arc(mx, my, Math.max(1.8, Math.min(4.5, w.radius * scale * 0.4)), 0, Math.PI * 2);
      ctx.fillStyle = w.skin.glowColor || '#f43f5e';
      ctx.fill();
    }

    // Self worm
    if (selfWorm && selfWorm.isAlive) {
      const sx = center + selfWorm.x * scale;
      const sy = center + selfWorm.y * scale;

      // Pulse ring around self
      const pulse = (Date.now() % 1500) / 1500;
      ctx.beginPath();
      ctx.arc(sx, sy, 4 + pulse * 6, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(34, 211, 238, ${1 - pulse})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Heading indicator
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + Math.cos(selfWorm.angle) * 7, sy + Math.sin(selfWorm.angle) * 7);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Center dot
      ctx.beginPath();
      ctx.arc(sx, sy, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#22d3ee';
      ctx.fill();
    }

    ctx.restore();
  }, [worms, selfWorm, worldRadius]);

  return (
    <div className="fixed bottom-4 right-4 z-20 flex flex-col items-center">
      <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800/80 p-1.5 rounded-full shadow-2xl">
        <canvas ref={canvasRef} width={130} height={130} className="rounded-full" />
      </div>
      <span className="text-[10px] text-slate-400 font-medium mt-1">미니맵 레이더</span>
    </div>
  );
};
