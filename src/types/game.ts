export interface Vector {
  x: number;
  y: number;
}

export interface Food {
  id: number;
  x: number;
  y: number;
  radius: number;
  color: string;
  value: number;
  isSpecial?: boolean;
}

export interface WormSkin {
  id: string;
  name: string;
  headColor: string;
  bodyColor1: string;
  bodyColor2: string;
  glowColor: string;
  eyeColor?: string;
  pattern: 'stripes' | 'gradient' | 'dots' | 'neon' | 'gemini';
}

export interface WormData {
  id: string;
  name: string;
  isBot: boolean;
  skin: WormSkin;
  x: number;
  y: number;
  angle: number;
  speed: number;
  isBoosting: boolean;
  score: number;
  length: number;
  radius: number;
  segments: Vector[];
  isAlive: boolean;
  kills: number;
  emote?: { icon: string; time: number };
}

export interface KillEvent {
  id: string;
  killerId: string;
  killerName: string;
  victimId: string;
  victimName: string;
  time: number;
}

export interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
  kills: number;
  isBot: boolean;
}

export interface RoomInfo {
  id: string;
  name: string;
  players: number;
  bots: number;
}

export interface AICoachResponse {
  rankTier: string;
  title: string;
  roast: string;
  advice: string[];
  playstyleAnalysis: string;
}

export const PRESET_SKINS: WormSkin[] = [
  {
    id: 'cyber-neon',
    name: '사이버 네온',
    headColor: '#00ffff',
    bodyColor1: '#00f2fe',
    bodyColor2: '#4facfe',
    glowColor: '#00ffff',
    eyeColor: '#ffffff',
    pattern: 'neon',
  },
  {
    id: 'fire-dragon',
    name: '불타는 드래곤',
    headColor: '#ff2d55',
    bodyColor1: '#ff416c',
    bodyColor2: '#ff4b2b',
    glowColor: '#ff0844',
    eyeColor: '#ffff00',
    pattern: 'stripes',
  },
  {
    id: 'toxic-acid',
    name: '맹독 애시드',
    headColor: '#10b981',
    bodyColor1: '#00ff87',
    bodyColor2: '#60efff',
    glowColor: '#00ff87',
    eyeColor: '#ffffff',
    pattern: 'gradient',
  },
  {
    id: 'royal-gold',
    name: '황금 엠페러',
    headColor: '#f59e0b',
    bodyColor1: '#ffd700',
    bodyColor2: '#f59e0b',
    glowColor: '#fbbf24',
    eyeColor: '#ffffff',
    pattern: 'stripes',
  },
  {
    id: 'cotton-candy',
    name: '코튼 캔디',
    headColor: '#ec4899',
    bodyColor1: '#f472b6',
    bodyColor2: '#818cf8',
    glowColor: '#ec4899',
    eyeColor: '#ffffff',
    pattern: 'dots',
  },
  {
    id: 'gemini-galaxy',
    name: '제미나이 코스모스',
    headColor: '#6366f1',
    bodyColor1: '#8b5cf6',
    bodyColor2: '#38bdf8',
    glowColor: '#a855f7',
    eyeColor: '#ffffff',
    pattern: 'gemini',
  },
];
