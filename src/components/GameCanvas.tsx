import React, { useRef, useEffect, useCallback } from 'react';
import { Food, Vector, WormData } from '../types/game.js';
import { sounds } from '../utils/audio.js';

interface GameCanvasProps {
  worms: WormData[];
  foods: Map<number, Food>;
  selfId: string;
  worldRadius: number;
  onSendInput: (angle: number, boosting: boolean) => void;
  isAlive: boolean;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  worms,
  foods,
  selfId,
  worldRadius,
  onSendInput,
  isAlive,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cameraRef = useRef<{ x: number; y: number; zoom: number }>({ x: 0, y: 0, zoom: 1.0 });
  const mousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isBoostingRef = useRef<boolean>(false);
  const targetAngleRef = useRef<number>(0);
  const animFrameRef = useRef<number | null>(null);
  const lastInputSentRef = useRef<number>(0);
  const prevScoreRef = useRef<number>(0);

  // Sound trigger when self eats food
  useEffect(() => {
    const selfWorm = worms.find((w) => w.id === selfId);
    if (selfWorm && selfWorm.isAlive) {
      if (prevScoreRef.current > 0 && selfWorm.score > prevScoreRef.current) {
        const diff = selfWorm.score - prevScoreRef.current;
        sounds.playEat(diff >= 5);
      }
      prevScoreRef.current = selfWorm.score;
    }
  }, [worms, selfId]);

  // Handle Mouse/Touch inputs
  const updateAngle = useCallback(
    (clientX: number, clientY: number) => {
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      const dx = clientX - centerX;
      const dy = clientY - centerY;
      const angle = Math.atan2(dy, dx);
      targetAngleRef.current = angle;

      const now = performance.now();
      if (now - lastInputSentRef.current > 25) {
        // ~40Hz client input rate
        onSendInput(angle, isBoostingRef.current);
        lastInputSentRef.current = now;
      }
    },
    [onSendInput]
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mousePosRef.current = { x: e.clientX, y: e.clientY };
      updateAngle(e.clientX, e.clientY);
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0) {
        // Left click
        isBoostingRef.current = true;
        onSendInput(targetAngleRef.current, true);
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 0) {
        isBoostingRef.current = false;
        onSendInput(targetAngleRef.current, false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        isBoostingRef.current = true;
        onSendInput(targetAngleRef.current, true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        isBoostingRef.current = false;
        onSendInput(targetAngleRef.current, false);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        updateAngle(touch.clientX, touch.clientY);
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        updateAngle(touch.clientX, touch.clientY);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchstart', handleTouchStart, { passive: true });

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchstart', handleTouchStart);
    };
  }, [updateAngle, onSendInput]);

  // Main 60 FPS Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let dpr = window.devicePixelRatio || 1;
    const resize = () => {
      dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
    };
    resize();
    window.addEventListener('resize', resize);

    const render = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;

      // Find self worm
      const selfWorm = worms.find((w) => w.id === selfId && w.isAlive);
      if (selfWorm) {
        // Smooth camera follow
        cameraRef.current.x += (selfWorm.x - cameraRef.current.x) * 0.12;
        cameraRef.current.y += (selfWorm.y - cameraRef.current.y) * 0.12;

        // Dynamic zoom based on score (larger worm = zoom out)
        const targetZoom = Math.max(0.62, 1.0 - Math.min(1, selfWorm.score / 2800) * 0.38);
        cameraRef.current.zoom += (targetZoom - cameraRef.current.zoom) * 0.05;
      } else {
        cameraRef.current.zoom += (0.85 - cameraRef.current.zoom) * 0.05;
      }

      const camX = cameraRef.current.x;
      const camY = cameraRef.current.y;
      const zoom = cameraRef.current.zoom;

      ctx.save();
      ctx.scale(dpr, dpr);

      // Deep space background
      ctx.fillStyle = '#06080f';
      ctx.fillRect(0, 0, width, height);

      // Apply Camera Transform
      ctx.save();
      ctx.translate(width / 2, height / 2);
      ctx.scale(zoom, zoom);
      ctx.translate(-camX, -camY);

      // 1. Draw arena boundary and background grid
      drawArena(ctx, worldRadius, camX, camY, width, height, zoom);

      // 2. Draw Food Orbs (frustum culled for high FPS)
      const visibleMargin = 120 / zoom;
      const minX = camX - (width / 2) / zoom - visibleMargin;
      const maxX = camX + (width / 2) / zoom + visibleMargin;
      const minY = camY - (height / 2) / zoom - visibleMargin;
      const maxY = camY + (height / 2) / zoom + visibleMargin;

      const now = Date.now();
      drawFoods(ctx, foods, minX, maxX, minY, maxY, now);

      // 3. Draw Worms (Dead first if any, then alive worms sorted by length)
      const sortedWorms = [...worms].sort((a, b) => a.length - b.length);
      const topWormId = worms.filter((w) => w.isAlive).sort((a, b) => b.score - a.score)[0]?.id;

      for (const worm of sortedWorms) {
        if (!worm.isAlive) continue;
        drawWorm(ctx, worm, worm.id === topWormId, now);
      }

      ctx.restore(); // Restore camera transform

      // Overlay Vignette
      drawVignette(ctx, width, height);

      ctx.restore(); // Restore DPR scale

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', resize);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [worms, foods, selfId, worldRadius]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full cursor-crosshair z-0 block"
    />
  );
};

// Helper: Draw arena circular boundary and futuristic cyber grid
function drawArena(
  ctx: CanvasRenderingContext2D,
  worldRadius: number,
  camX: number,
  camY: number,
  w: number,
  h: number,
  zoom: number
) {
  // Arena floor circle
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, worldRadius, 0, Math.PI * 2);
  ctx.fillStyle = '#0b0f19';
  ctx.fill();

  // Grid lines inside arena
  ctx.clip(); // clip to inside arena
  const gridSize = 80;
  const startX = Math.floor((-worldRadius) / gridSize) * gridSize;
  const endX = Math.ceil(worldRadius / gridSize) * gridSize;
  const startY = Math.floor((-worldRadius) / gridSize) * gridSize;
  const endY = Math.ceil(worldRadius / gridSize) * gridSize;

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
  ctx.lineWidth = 1;

  ctx.beginPath();
  for (let x = startX; x <= endX; x += gridSize) {
    ctx.moveTo(x, -worldRadius);
    ctx.lineTo(x, worldRadius);
  }
  for (let y = startY; y <= endY; y += gridSize) {
    ctx.moveTo(-worldRadius, y);
    ctx.lineTo(worldRadius, y);
  }
  ctx.stroke();

  // Decorative concentric rings
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.05)';
  ctx.lineWidth = 1.5;
  for (let r = 400; r < worldRadius; r += 400) {
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  // Glowing Arena Perimeter Ring
  const pulse = Math.sin(Date.now() * 0.003) * 0.2 + 0.8;
  ctx.save();
  ctx.shadowColor = '#00f2fe';
  ctx.shadowBlur = 24 * pulse;
  ctx.beginPath();
  ctx.arc(0, 0, worldRadius, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(0, 242, 254, ${0.85 * pulse})`;
  ctx.lineWidth = 7;
  ctx.stroke();

  // Outer danger boundary glow
  ctx.beginPath();
  ctx.arc(0, 0, worldRadius + 4, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(244, 63, 94, 0.4)';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();
}

// Helper: Draw food orbs with radial glow
function drawFoods(
  ctx: CanvasRenderingContext2D,
  foods: Map<number, Food>,
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
  now: number
) {
  for (const food of foods.values()) {
    // Frustum culling check
    if (food.x < minX || food.x > maxX || food.y < minY || food.y > maxY) {
      continue;
    }

    const pulse = Math.sin(now * 0.005 + food.id) * 0.2 + 1;
    const r = food.radius * pulse;

    ctx.save();
    if (food.isSpecial) {
      // High-value death food / special orb
      ctx.shadowColor = food.color;
      ctx.shadowBlur = 14;

      // Outer glow
      ctx.beginPath();
      ctx.arc(food.x, food.y, r * 1.5, 0, Math.PI * 2);
      ctx.fillStyle = food.color + '44';
      ctx.fill();

      // Core
      ctx.beginPath();
      ctx.arc(food.x, food.y, r, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(food.x, food.y, r * 0.8, 0, Math.PI * 2);
      ctx.fillStyle = food.color;
      ctx.fill();
    } else {
      // Normal food orb
      ctx.shadowColor = food.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(food.x, food.y, r, 0, Math.PI * 2);
      ctx.fillStyle = food.color;
      ctx.fill();

      // Subtle bright center
      ctx.beginPath();
      ctx.arc(food.x - r * 0.25, food.y - r * 0.25, r * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.fill();
    }
    ctx.restore();
  }
}

// Helper: Draw worm with segments, custom skin, eyes, boost flames, and overhead info
function drawWorm(
  ctx: CanvasRenderingContext2D,
  worm: WormData,
  isTopPlayer: boolean,
  now: number
) {
  const segments = worm.segments;
  if (!segments || segments.length === 0) return;

  const radius = worm.radius;
  const skin = worm.skin;

  // 1. Boost flame particles behind tail
  if (worm.isBoosting && segments.length > 2) {
    const tail = segments[segments.length - 1];
    ctx.save();
    ctx.shadowColor = skin.glowColor || '#00f2fe';
    ctx.shadowBlur = 16;
    for (let p = 0; p < 3; p++) {
      const offsetX = (Math.random() - 0.5) * radius * 1.2;
      const offsetY = (Math.random() - 0.5) * radius * 1.2;
      ctx.beginPath();
      ctx.arc(tail.x + offsetX, tail.y + offsetY, radius * (0.3 + Math.random() * 0.3), 0, Math.PI * 2);
      ctx.fillStyle = Math.random() < 0.5 ? '#ffffff' : skin.glowColor;
      ctx.fill();
    }
    ctx.restore();
  }

  // 2. Draw Body Segments from Tail to Head
  ctx.save();
  ctx.shadowColor = worm.isBoosting ? skin.glowColor : 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = worm.isBoosting ? 16 : 8;

  for (let i = segments.length - 1; i >= 1; i--) {
    const seg = segments[i];
    // Slightly taper the tail segments
    const taper = i > segments.length - 5 ? 0.75 + (segments.length - i) * 0.05 : 1.0;
    const segRadius = radius * taper;

    let segColor = skin.bodyColor1;
    if (skin.pattern === 'stripes') {
      segColor = Math.floor(i / 2) % 2 === 0 ? skin.bodyColor1 : skin.bodyColor2;
    } else if (skin.pattern === 'gradient') {
      const ratio = i / segments.length;
      segColor = ratio < 0.5 ? skin.bodyColor1 : skin.bodyColor2;
    } else if (skin.pattern === 'dots') {
      segColor = skin.bodyColor1;
    } else if (skin.pattern === 'gemini') {
      const colors = ['#6366f1', '#8b5cf6', '#38bdf8', '#a855f7'];
      segColor = colors[i % colors.length];
    }

    ctx.beginPath();
    ctx.arc(seg.x, seg.y, segRadius, 0, Math.PI * 2);
    ctx.fillStyle = segColor;
    ctx.fill();

    // Pattern accent: Dots
    if (skin.pattern === 'dots' && i % 3 === 0) {
      ctx.beginPath();
      ctx.arc(seg.x, seg.y, segRadius * 0.35, 0, Math.PI * 2);
      ctx.fillStyle = skin.bodyColor2;
      ctx.fill();
    }
  }
  ctx.restore();

  // 3. Draw Worm Head
  const headX = worm.x;
  const headY = worm.y;
  const headRadius = radius * 1.15;

  ctx.save();
  ctx.shadowColor = skin.glowColor;
  ctx.shadowBlur = worm.isBoosting ? 22 : 12;
  ctx.beginPath();
  ctx.arc(headX, headY, headRadius, 0, Math.PI * 2);
  ctx.fillStyle = skin.headColor;
  ctx.fill();
  ctx.restore();

  // 4. Draw Expressive Eyes pointing in direction of worm.angle
  ctx.save();
  const eyeDistance = headRadius * 0.65;
  const eyeRadius = Math.max(3.5, headRadius * 0.38);
  const pupilRadius = eyeRadius * 0.55;

  const leftEyeAngle = worm.angle - 0.7;
  const rightEyeAngle = worm.angle + 0.7;

  const lx = headX + Math.cos(leftEyeAngle) * eyeDistance;
  const ly = headY + Math.sin(leftEyeAngle) * eyeDistance;
  const rx = headX + Math.cos(rightEyeAngle) * eyeDistance;
  const ry = headY + Math.sin(rightEyeAngle) * eyeDistance;

  // Eye Whites
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(lx, ly, eyeRadius, 0, Math.PI * 2);
  ctx.arc(rx, ry, eyeRadius, 0, Math.PI * 2);
  ctx.fill();

  // Pupils (looking towards worm heading)
  const pupilOffset = eyeRadius * 0.35;
  const plx = lx + Math.cos(worm.angle) * pupilOffset;
  const ply = ly + Math.sin(worm.angle) * pupilOffset;
  const prx = rx + Math.cos(worm.angle) * pupilOffset;
  const pry = ry + Math.sin(worm.angle) * pupilOffset;

  ctx.fillStyle = skin.eyeColor && skin.eyeColor !== '#ffffff' ? skin.eyeColor : '#0f172a';
  ctx.beginPath();
  ctx.arc(plx, ply, pupilRadius, 0, Math.PI * 2);
  ctx.arc(prx, pry, pupilRadius, 0, Math.PI * 2);
  ctx.fill();

  // Eye reflection glints
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.beginPath();
  ctx.arc(plx - pupilRadius * 0.3, ply - pupilRadius * 0.3, pupilRadius * 0.4, 0, Math.PI * 2);
  ctx.arc(prx - pupilRadius * 0.3, pry - pupilRadius * 0.3, pupilRadius * 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 5. Crown on #1 Leader
  if (isTopPlayer) {
    ctx.save();
    ctx.translate(headX, headY - headRadius - 16);
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('👑', 0, 0);
    ctx.restore();
  }

  // 6. Name and Score Badge above head
  ctx.save();
  const tagY = headY - headRadius - (isTopPlayer ? 30 : 16);
  ctx.font = 'bold 11px Outfit, Noto Sans KR, sans-serif';
  ctx.textAlign = 'center';

  const nameText = worm.name;
  const metrics = ctx.measureText(nameText);
  const tagWidth = Math.max(50, metrics.width + 16);

  // Background capsule
  ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
  ctx.beginPath();
  ctx.roundRect(headX - tagWidth / 2, tagY - 10, tagWidth, 18, 9);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Name text
  ctx.fillStyle = worm.isBot ? '#cbd5e1' : '#38bdf8';
  ctx.fillText(nameText, headX, tagY + 3);
  ctx.restore();

  // 7. Floating Emote Bubble
  if (worm.emote && now - worm.emote.time < 3000) {
    const emoteAge = (now - worm.emote.time) / 1000;
    const floatY = headY - headRadius - 38 - Math.sin(emoteAge * 4) * 6;

    ctx.save();
    ctx.font = '24px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Bubble
    ctx.beginPath();
    ctx.arc(headX, floatY, 18, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 10;
    ctx.fill();

    // Tail
    ctx.beginPath();
    ctx.moveTo(headX - 4, floatY + 16);
    ctx.lineTo(headX, floatY + 22);
    ctx.lineTo(headX + 4, floatY + 16);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.fill();

    ctx.fillText(worm.emote.icon, headX, floatY);
    ctx.restore();
  }
}

// Helper: Subtle vignette around edges for cinematic focus
function drawVignette(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const gradient = ctx.createRadialGradient(
    width / 2,
    height / 2,
    Math.min(width, height) * 0.45,
    width / 2,
    height / 2,
    Math.max(width, height) * 0.8
  );
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0.55)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}
