import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';
import { GoogleGenAI, Type } from '@google/genai';
import { GameRoom } from './server/gameRoom.js';
import { PRESET_SKINS, WormSkin } from './src/types/game.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json());

// Initialize Gemini SDK with User-Agent header as required
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Rooms manager
const rooms = new Map<string, GameRoom>();

function getOrCreateRoom(roomId: string, roomName?: string): GameRoom {
  const cleanId = (roomId || 'default').trim().toLowerCase().slice(0, 30);
  let room = rooms.get(cleanId);
  if (!room) {
    const displayName = roomName || (cleanId === 'default' ? '글로벌 아레나' : `룸: ${cleanId}`);
    room = new GameRoom(cleanId, displayName);
    rooms.set(cleanId, room);
  }
  return room;
}

// Pre-create the default arena
getOrCreateRoom('default', '글로벌 아레나 #1');

// REST API for Rooms list
app.get('/api/rooms', (req, res) => {
  const roomList = Array.from(rooms.values()).map((r) => ({
    id: r.id,
    name: r.name,
    players: r.getPlayerCount(),
    bots: r.getBotCount(),
  }));
  res.json({ rooms: roomList });
});

// Gemini AI Coach Endpoint: analyzes the player's run and gives tactical/roast feedback
app.post('/api/gemini/coach', async (req, res) => {
  try {
    const { score, length, kills, survivalSeconds, killerName, rank, reason } = req.body;

    const prompt = `당신은 전설적인 지렁이 게임(Slither Worms) 챔피언이자 재치 넘치는 프로 게이머 코치입니다.
방금 플레이어가 지렁이 게임에서 게임오버되었습니다.
플레이어의 전적 데이터를 바탕으로 재치있는 한 줄 평(로스트), 플레이 스타일 분석, 그리고 다음 판에서 1위를 하기 위한 핵심 전술 3가지를 분석해주세요.

전적 데이터:
- 최종 점수/길이: ${score || 100}점 (${length || 15}마디)
- 처치(킬) 수: ${kills || 0}킬
- 생존 시간: ${survivalSeconds || 30}초
- 사망 원인: ${reason || '몸통 충돌'}
- 킬러(날 죽인 상대): ${killerName || '장외 벽'}
- 방 내 순위: ${rank ? `${rank}위` : '순위권 밖'}

반드시 다음 JSON 형식으로만 응답해주세요:
{
  "rankTier": "칭호 (예: '황금빛 슬리더 마스터', '과속 단속 걸린 초보', '벽 박치기 장인')",
  "title": "한 줄 제목 요약 (예: '빛나는 질주, 허망한 급발진')",
  "roast": "유쾌하고 뼈 때리는 재치있는 한 마디",
  "advice": ["전술 조언 1 (머리 박기 방지나 부스트 타이밍 등)", "전술 조언 2", "전술 조언 3"],
  "playstyleAnalysis": "플레이어 성향 분석 (예: 먹이에 집착하는 불나방형, 다른 뱀을 감싸는 똬리형 등)"
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            rankTier: { type: Type.STRING },
            title: { type: Type.STRING },
            roast: { type: Type.STRING },
            advice: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            playstyleAnalysis: { type: Type.STRING },
          },
          required: ['rankTier', 'title', 'roast', 'advice', 'playstyleAnalysis'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    res.json({ success: true, data: parsed });
  } catch (error) {
    console.error('Gemini Coach error:', error);
    // Fallback if API key is missing or error occurs
    res.json({
      success: true,
      data: {
        rankTier: '사이버 슬리더 도전자',
        title: '불굴의 재도전 정신',
        roast: '충돌 각도를 조금만 더 넓혔다면 저 지렁이의 시체는 전부 당신의 것이었을 텐데요!',
        advice: [
          '부스트(클릭/스페이스)는 다른 뱀의 머리 앞을 가로막을 때만 순간적으로 사용하세요.',
          '시체가 터졌을 때 흥분해서 직진하지 말고, 주변 뱀들의 머리 위치를 먼저 확인하세요.',
          '몸집이 커지면 작은 뱀들을 원형으로 천천히 감싸는 똬리 전술(Coiling)을 시도해보세요.',
        ],
        playstyleAnalysis: '공격적이지만 부스트 타이밍 조절이 필요한 잠재적 챔피언',
      },
    });
  }
});

// Gemini AI Custom Skin Generator
app.post('/api/gemini/skin', async (req, res) => {
  try {
    const { prompt } = req.body;

    const systemPrompt = `사용자의 테마 요청에 어울리는 환상적인 네온 지렁이 스킨 색상 팔레트를 JSON으로 생성해주세요.
사용자 요청: "${prompt || '신비로운 우주 은하수'}"

색상은 모두 선명하고 눈에 띄는 HEX 코드(#RRGGBB)여야 합니다.
어두운 배경(#0b0f19)에서 빛나야 합니다.
pattern은 "stripes", "gradient", "dots", "neon", "gemini" 중 하나를 선택하세요.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: systemPrompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: '스킨 한글 이름' },
            headColor: { type: Type.STRING, description: '머리 색상 HEX' },
            bodyColor1: { type: Type.STRING, description: '몸통 1차 색상 HEX' },
            bodyColor2: { type: Type.STRING, description: '몸통 2차 색상 HEX' },
            glowColor: { type: Type.STRING, description: '네온 발광 색상 HEX' },
            eyeColor: { type: Type.STRING, description: '눈동자 색상 HEX' },
            pattern: {
              type: Type.STRING,
              enum: ['stripes', 'gradient', 'dots', 'neon', 'gemini'],
            },
          },
          required: ['name', 'headColor', 'bodyColor1', 'bodyColor2', 'glowColor', 'eyeColor', 'pattern'],
        },
      },
    });

    const skinData = JSON.parse(response.text || '{}');
    const customSkin: WormSkin = {
      id: `custom_${Date.now()}`,
      name: skinData.name || 'AI 맞춤 스킨',
      headColor: skinData.headColor || '#00ffff',
      bodyColor1: skinData.bodyColor1 || '#38bdf8',
      bodyColor2: skinData.bodyColor2 || '#818cf8',
      glowColor: skinData.glowColor || '#00f2fe',
      eyeColor: skinData.eyeColor || '#ffffff',
      pattern: skinData.pattern || 'neon',
    };

    res.json({ success: true, skin: customSkin });
  } catch (error) {
    console.error('Gemini Skin error:', error);
    // Fallback skin
    const fallbackSkin: WormSkin = {
      id: `custom_${Date.now()}`,
      name: '오로라 네온',
      headColor: '#06b6d4',
      bodyColor1: '#3b82f6',
      bodyColor2: '#a855f7',
      glowColor: '#38bdf8',
      eyeColor: '#ffffff',
      pattern: 'gradient',
    };
    res.json({ success: true, skin: fallbackSkin });
  }
});

// WebSocket Server
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws: WebSocket, req) => {
  let currentRoom: GameRoom | null = null;
  let playerId: string = `p_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  ws.on('message', (messageRaw: string) => {
    try {
      const msg = JSON.parse(messageRaw.toString());

      if (msg.type === 'join') {
        const roomId = msg.roomId || 'default';
        currentRoom = getOrCreateRoom(roomId, msg.roomName);
        const skin: WormSkin = msg.skin || PRESET_SKINS[0];
        currentRoom.addPlayer(ws, playerId, msg.name, skin);
      } else if (msg.type === 'input') {
        if (currentRoom) {
          currentRoom.handlePlayerInput(playerId, msg.angle, !!msg.boosting);
        }
      } else if (msg.type === 'emote') {
        if (currentRoom) {
          currentRoom.handleEmote(playerId, msg.icon);
        }
      } else if (msg.type === 'chat') {
        if (currentRoom) {
          currentRoom.handleChat(msg.sender || '플레이어', msg.text || '');
        }
      } else if (msg.type === 'respawn') {
        if (currentRoom) {
          currentRoom.respawnPlayer(playerId, msg.name, msg.skin);
        }
      }
    } catch (err) {
      console.error('WS message error:', err);
    }
  });

  ws.on('close', () => {
    if (currentRoom) {
      currentRoom.removePlayer(playerId);
    }
  });

  ws.on('error', (err) => {
    console.error('WS client error:', err);
  });
});

// Dev vs Prod Vite Integration
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Slither Worms Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
