import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Food, KillEvent, LeaderboardEntry, PRESET_SKINS, WormData, WormSkin } from './types/game.js';
import { GameCanvas } from './components/GameCanvas.js';
import { Leaderboard } from './components/Leaderboard.js';
import { Minimap } from './components/Minimap.js';
import { KillFeed } from './components/KillFeed.js';
import { EmoteBar } from './components/EmoteBar.js';
import { LobbyModal } from './components/LobbyModal.js';
import { GameOverModal } from './components/GameOverModal.js';
import { SkinModal } from './components/SkinModal.js';
import { sounds } from './utils/audio.js';
import {
  Volume2,
  VolumeX,
  Share2,
  Users,
  Trophy,
  Flame,
  Zap,
  Sparkles,
  Palette,
  Check,
} from 'lucide-react';

export default function App() {
  // Game states
  const [isPlaying, setIsPlaying] = useState(false);
  const [isDead, setIsDead] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [showSkinModal, setShowSkinModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Player configuration
  const [playerName, setPlayerName] = useState(() => {
    try {
      return localStorage.getItem('slither_player_name') || '슈퍼꿈틀이';
    } catch {
      return '슈퍼꿈틀이';
    }
  });
  const [selectedSkin, setSelectedSkin] = useState<WormSkin>(() => {
    try {
      const saved = localStorage.getItem('slither_selected_skin');
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return PRESET_SKINS[0];
  });

  // Room config from URL search params
  const [roomId, setRoomId] = useState(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('room') || 'default';
  });

  // Multiplayer synchronization states
  const [selfId, setSelfId] = useState<string>('');
  const [worldRadius, setWorldRadius] = useState<number>(1600);
  const [worms, setWorms] = useState<WormData[]>([]);
  const foodsRef = useRef<Map<number, Food>>(new Map());
  const [foodCount, setFoodCount] = useState<number>(0);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [killEvents, setKillEvents] = useState<KillEvent[]>([]);
  const [totalAlive, setTotalAlive] = useState<number>(0);
  const [isMuted, setIsMuted] = useState(sounds.getMuted());

  // Game over stats
  const [deathStats, setDeathStats] = useState<{
    score: number;
    length: number;
    kills: number;
    survivalSeconds: number;
    killerName: string;
    reason: string;
    rank?: number;
  }>({
    score: 0,
    length: 0,
    kills: 0,
    survivalSeconds: 0,
    killerName: '상대 지렁이',
    reason: '몸통 충돌',
  });

  const gameStartTimeRef = useRef<number>(0);
  const wsRef = useRef<WebSocket | null>(null);

  // Sound mute toggle
  const handleToggleMute = () => {
    const next = sounds.toggleMute();
    setIsMuted(next);
  };

  // Copy shareable room link
  const handleCopyRoomLink = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('room', roomId);
    navigator.clipboard.writeText(url.toString());
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Handle skin change
  const handleSelectSkin = (skin: WormSkin) => {
    setSelectedSkin(skin);
    try {
      localStorage.setItem('slither_selected_skin', JSON.stringify(skin));
    } catch {
      // ignore
    }
  };

  // Establish or maintain WebSocket connection
  const connectToServer = useCallback(
    (onOpenCallback?: () => void) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        onOpenCallback?.();
        return;
      }

      setConnecting(true);
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnecting(false);
        onOpenCallback?.();
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === 'init') {
            setSelfId(msg.selfId);
            setWorldRadius(msg.worldRadius);
            setWorms(msg.worms);

            // Populate initial foods map
            const fMap = new Map<number, Food>();
            for (const f of msg.foods) {
              fMap.set(f.id, f);
            }
            foodsRef.current = fMap;
            setFoodCount(fMap.size);
          } else if (msg.type === 'sync') {
            setWorms(msg.worms);
            setLeaderboard(msg.leaderboard);
            setKillEvents(msg.killEvents || []);
            setTotalAlive(msg.aliveCount || 0);

            // Apply food delta
            const fMap = foodsRef.current;
            if (msg.removedFoodIds) {
              for (const rid of msg.removedFoodIds) {
                fMap.delete(rid);
              }
            }
            if (msg.addedFoods) {
              for (const af of msg.addedFoods) {
                fMap.set(af.id, af);
              }
            }
            setFoodCount(fMap.size);
          } else if (msg.type === 'you_died') {
            sounds.playDeath();
            setIsDead(true);
            const survival = Math.max(1, Math.round((Date.now() - gameStartTimeRef.current) / 1000));
            setDeathStats({
              score: msg.finalScore || 0,
              length: Math.max(15, Math.floor((msg.finalScore || 0) / 10)),
              kills: msg.kills || 0,
              survivalSeconds: survival,
              killerName: msg.killerName || '장외 벽',
              reason: msg.reason || '몸통 충돌',
            });
          } else if (msg.type === 'respawned') {
            setIsDead(false);
            gameStartTimeRef.current = Date.now();
          }
        } catch (err) {
          console.error('WS parse error:', err);
        }
      };

      ws.onclose = () => {
        setConnecting(false);
      };

      ws.onerror = (err) => {
        console.error('WS error:', err);
        setConnecting(false);
      };
    },
    []
  );

  // Send input to server
  const handleSendInput = useCallback((angle: number, boosting: boolean) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'input',
          angle,
          boosting,
        })
      );
    }
  }, []);

  // Send Emote
  const handleSendEmote = useCallback((icon: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'emote',
          icon,
        })
      );
    }
  }, []);

  // Start Game from Lobby
  const handleStartGame = () => {
    try {
      localStorage.setItem('slither_player_name', playerName);
    } catch {
      // ignore
    }

    connectToServer(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'join',
            name: playerName,
            skin: selectedSkin,
            roomId,
          })
        );
        setIsPlaying(true);
        setIsDead(false);
        gameStartTimeRef.current = Date.now();
      }
    });
  };

  // Respawn
  const handleRespawn = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'respawn',
          name: playerName,
          skin: selectedSkin,
        })
      );
      setIsDead(false);
      gameStartTimeRef.current = Date.now();
    } else {
      handleStartGame();
    }
  };

  // Find self worm
  const selfWorm = worms.find((w) => w.id === selfId);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#06080f] select-none text-white">
      {/* Canvas Layer */}
      <GameCanvas
        worms={worms}
        foods={foodsRef.current}
        selfId={selfId}
        worldRadius={worldRadius}
        onSendInput={handleSendInput}
        isAlive={isPlaying && !isDead}
      />

      {/* In-Game HUD Elements */}
      {isPlaying && (
        <>
          {/* Top-Left Game Bar */}
          <div className="fixed top-4 left-4 z-20 flex items-center gap-2">
            <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800/80 px-3 py-2 rounded-2xl flex items-center gap-3 shadow-xl">
              <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="max-w-[100px] truncate text-cyan-300">{roomId === 'default' ? '글로벌 아레나' : roomId}</span>
              </div>
              <button
                onClick={handleCopyRoomLink}
                title="친구 초대 링크 복사"
                className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 px-2 py-1 rounded-lg transition-all"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
                <span>{copiedLink ? '복사됨!' : '룸 공유'}</span>
              </button>
            </div>

            {/* Sound toggle button */}
            <button
              onClick={handleToggleMute}
              className="p-2.5 rounded-2xl bg-slate-900/80 backdrop-blur-md border border-slate-800/80 text-slate-300 hover:text-white transition-all shadow-xl"
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
            </button>
          </div>

          {/* Kill Feed */}
          <KillFeed events={killEvents} />

          {/* Leaderboard */}
          <Leaderboard entries={leaderboard} selfId={selfId} totalAlive={totalAlive} />

          {/* Bottom-Left Self Stats Card */}
          {selfWorm && selfWorm.isAlive && (
            <div className="fixed bottom-4 left-4 z-20 bg-slate-900/80 backdrop-blur-md border border-slate-800/80 rounded-2xl p-3 shadow-2xl flex flex-col gap-1.5 min-w-[150px]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">내 지렁이 점수</span>
                <span className="text-xs font-black text-amber-400 font-mono">
                  {selfWorm.score.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <div className="flex items-center gap-1 text-red-400 font-bold">
                  <Flame className="w-3.5 h-3.5" />
                  <span>{selfWorm.kills} 킬</span>
                </div>
                <div className="flex items-center gap-1 text-cyan-400 font-bold">
                  <span>🐍</span>
                  <span>{selfWorm.length} 마디</span>
                </div>
              </div>
              {/* Boost indicator */}
              <div className="pt-1 border-t border-slate-800/80 flex items-center justify-between text-[10px]">
                <span className="flex items-center gap-1 text-yellow-400 font-semibold">
                  <Zap className="w-3 h-3" />
                  {selfWorm.isBoosting ? '고속 부스트 중!' : '부스트 대기'}
                </span>
                <span className="text-slate-500">클릭/스페이스</span>
              </div>
            </div>
          )}

          {/* Quick Emotes Bar */}
          <EmoteBar onSendEmote={handleSendEmote} disabled={isDead} />

          {/* Minimap */}
          <Minimap worms={worms} selfWorm={selfWorm} worldRadius={worldRadius} />

          {/* Mobile Touch Boost Button for touch devices */}
          <div className="md:hidden fixed bottom-20 right-4 z-20">
            <button
              onTouchStart={() => handleSendInput(0, true)}
              onTouchEnd={() => handleSendInput(0, false)}
              className="w-14 h-14 rounded-full bg-gradient-to-r from-amber-500 to-red-500 flex items-center justify-center text-white shadow-2xl active:scale-90 font-black text-xs border border-white/20"
            >
              부스트
            </button>
          </div>
        </>
      )}

      {/* Lobby Modal (Start Screen) */}
      {!isPlaying && (
        <LobbyModal
          playerName={playerName}
          onPlayerNameChange={setPlayerName}
          selectedSkin={selectedSkin}
          onOpenSkinModal={() => setShowSkinModal(true)}
          roomId={roomId}
          onRoomIdChange={setRoomId}
          onStartGame={handleStartGame}
          connecting={connecting}
        />
      )}

      {/* Game Over Modal with Gemini Coach */}
      {isDead && (
        <GameOverModal
          score={deathStats.score}
          length={deathStats.length}
          kills={deathStats.kills}
          survivalSeconds={deathStats.survivalSeconds}
          killerName={deathStats.killerName}
          reason={deathStats.reason}
          rank={leaderboard.findIndex((e) => e.id === selfId) + 1 || undefined}
          onRespawn={handleRespawn}
          onChangeSkin={() => setShowSkinModal(true)}
        />
      )}

      {/* Custom Skin / AI Skin Modal */}
      {showSkinModal && (
        <SkinModal
          currentSkin={selectedSkin}
          onSelectSkin={handleSelectSkin}
          onClose={() => setShowSkinModal(false)}
        />
      )}
    </div>
  );
}
