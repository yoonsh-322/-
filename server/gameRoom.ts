import { WebSocket } from 'ws';
import { Food, KillEvent, LeaderboardEntry, Vector, WormData, WormSkin, PRESET_SKINS } from '../src/types/game.js';

export const WORLD_RADIUS = 1600;
const TICK_RATE = 30; // 30 FPS
const TARGET_FOOD_COUNT = 380;
const BASE_SPEED = 4.2;
const BOOST_SPEED = 7.8;
const SEGMENT_DISTANCE = 10;
const INITIAL_SEGMENT_COUNT = 15;
const BOT_NAMES = [
  '🔥네온살인마', '⚡번개꿈틀이', '🐍은하룡', '👑킹왕짱지렁이',
  '💨폭풍질주', '🥑와사비슬러그', '💎다이아파이톤', '도토리묵',
  '무지개빛깔', '초고속추격자', 'CyberSnake', 'ViperX'
];

interface PlayerConnection {
  ws: WebSocket;
  id: string;
  wormId: string;
}

export class GameRoom {
  public id: string;
  public name: string;
  private worms: Map<string, WormData> = new Map();
  private foods: Map<number, Food> = new Map();
  private connections: Map<string, PlayerConnection> = new Map();
  private killEvents: KillEvent[] = [];
  private foodIdCounter = 1;
  private intervalId: NodeJS.Timeout | null = null;
  private addedFoodsBuffer: Food[] = [];
  private removedFoodIdsBuffer: number[] = [];
  private chatMessages: Array<{ id: string; sender: string; text: string; time: number; isAi?: boolean }> = [];
  private botCountTarget = 8;

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
    this.initFoods();
    this.initBots();
    this.startLoop();
  }

  private initFoods() {
    for (let i = 0; i < TARGET_FOOD_COUNT; i++) {
      this.spawnRandomFood();
    }
  }

  private spawnRandomFood(forceSpecial = false): Food {
    // Random position within circular boundary
    const r = Math.sqrt(Math.random()) * (WORLD_RADIUS - 60);
    const theta = Math.random() * Math.PI * 2;
    const x = Math.cos(theta) * r;
    const y = Math.sin(theta) * r;

    const colors = ['#00f2fe', '#4facfe', '#ff416c', '#ff4b2b', '#00ff87', '#60efff', '#f59e0b', '#ec4899', '#a855f7', '#fbbf24'];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const isSpecial = forceSpecial || Math.random() < 0.05;
    const radius = isSpecial ? 5.5 + Math.random() * 3 : 2.8 + Math.random() * 2.2;
    const value = isSpecial ? 6 + Math.floor(Math.random() * 6) : 1 + Math.floor(Math.random() * 2);

    const food: Food = {
      id: this.foodIdCounter++,
      x,
      y,
      radius,
      color,
      value,
      isSpecial,
    };

    this.foods.set(food.id, food);
    this.addedFoodsBuffer.push(food);
    return food;
  }

  private initBots() {
    for (let i = 0; i < this.botCountTarget; i++) {
      this.spawnBot(i);
    }
  }

  private spawnBot(index: number) {
    const id = `bot_${Date.now()}_${index}_${Math.floor(Math.random() * 1000)}`;
    const skin = PRESET_SKINS[index % PRESET_SKINS.length];
    const name = BOT_NAMES[index % BOT_NAMES.length];

    // Spawn at random location not too close to border
    const r = Math.sqrt(Math.random()) * (WORLD_RADIUS * 0.75);
    const theta = Math.random() * Math.PI * 2;
    const x = Math.cos(theta) * r;
    const y = Math.sin(theta) * r;
    const angle = Math.random() * Math.PI * 2;

    const segments: Vector[] = [];
    for (let s = 0; s < INITIAL_SEGMENT_COUNT + Math.floor(Math.random() * 10); s++) {
      segments.push({
        x: x - Math.cos(angle) * s * SEGMENT_DISTANCE,
        y: y - Math.sin(angle) * s * SEGMENT_DISTANCE,
      });
    }

    const bot: WormData = {
      id,
      name,
      isBot: true,
      skin,
      x,
      y,
      angle,
      speed: BASE_SPEED,
      isBoosting: false,
      score: segments.length * 10,
      length: segments.length,
      radius: 10,
      segments,
      isAlive: true,
      kills: 0,
    };

    this.worms.set(id, bot);
  }

  public addPlayer(ws: WebSocket, playerId: string, name: string, skin: WormSkin): WormData {
    // Generate initial position
    const r = Math.sqrt(Math.random()) * (WORLD_RADIUS * 0.65);
    const theta = Math.random() * Math.PI * 2;
    const x = Math.cos(theta) * r;
    const y = Math.sin(theta) * r;
    const angle = Math.random() * Math.PI * 2;

    const segments: Vector[] = [];
    for (let s = 0; s < INITIAL_SEGMENT_COUNT; s++) {
      segments.push({
        x: x - Math.cos(angle) * s * SEGMENT_DISTANCE,
        y: y - Math.sin(angle) * s * SEGMENT_DISTANCE,
      });
    }

    const worm: WormData = {
      id: playerId,
      name: (name || '이름없는 지렁이').slice(0, 16),
      isBot: false,
      skin,
      x,
      y,
      angle,
      speed: BASE_SPEED,
      isBoosting: false,
      score: INITIAL_SEGMENT_COUNT * 10,
      length: INITIAL_SEGMENT_COUNT,
      radius: 10,
      segments,
      isAlive: true,
      kills: 0,
    };

    this.worms.set(playerId, worm);
    this.connections.set(playerId, { ws, id: playerId, wormId: playerId });

    // Send init packet to the new player
    const initPayload = {
      type: 'init',
      selfId: playerId,
      worldRadius: WORLD_RADIUS,
      worms: Array.from(this.worms.values()),
      foods: Array.from(this.foods.values()),
      room: {
        id: this.id,
        name: this.name,
      },
    };
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(initPayload));
    }

    return worm;
  }

  public removePlayer(playerId: string) {
    const conn = this.connections.get(playerId);
    if (conn) {
      this.connections.delete(playerId);
    }
    const worm = this.worms.get(playerId);
    if (worm) {
      if (worm.isAlive) {
        this.killWorm(worm, '연결 종료');
      }
      this.worms.delete(playerId);
    }
  }

  public handlePlayerInput(playerId: string, targetAngle: number, isBoosting: boolean) {
    const worm = this.worms.get(playerId);
    if (!worm || !worm.isAlive) return;

    // Smooth angle update: limit angular velocity
    let diff = targetAngle - worm.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;

    const maxTurn = 0.22; // max turning rate per tick
    const turn = Math.max(-maxTurn, Math.min(maxTurn, diff));
    worm.angle += turn;

    // Normalizing angle to [-PI, PI]
    while (worm.angle > Math.PI) worm.angle -= Math.PI * 2;
    while (worm.angle < -Math.PI) worm.angle += Math.PI * 2;

    // Boosting allowed only if score > 30 and length > 8
    worm.isBoosting = isBoosting && worm.score > 30 && worm.segments.length > 8;
  }

  public handleEmote(playerId: string, icon: string) {
    const worm = this.worms.get(playerId);
    if (!worm) return;
    worm.emote = { icon, time: Date.now() };
  }

  public handleChat(senderName: string, text: string, isAi = false) {
    const msg = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      sender: senderName,
      text: text.slice(0, 100),
      time: Date.now(),
      isAi,
    };
    this.chatMessages.push(msg);
    if (this.chatMessages.length > 50) this.chatMessages.shift();

    this.broadcast({
      type: 'chat',
      message: msg,
    });
  }

  public respawnPlayer(playerId: string, name?: string, skin?: WormSkin): WormData | null {
    const conn = this.connections.get(playerId);
    if (!conn) return null;

    const existingWorm = this.worms.get(playerId);
    const chosenSkin = skin || existingWorm?.skin || PRESET_SKINS[0];
    const chosenName = name || existingWorm?.name || '부활한 지렁이';

    const r = Math.sqrt(Math.random()) * (WORLD_RADIUS * 0.6);
    const theta = Math.random() * Math.PI * 2;
    const x = Math.cos(theta) * r;
    const y = Math.sin(theta) * r;
    const angle = Math.random() * Math.PI * 2;

    const segments: Vector[] = [];
    for (let s = 0; s < INITIAL_SEGMENT_COUNT; s++) {
      segments.push({
        x: x - Math.cos(angle) * s * SEGMENT_DISTANCE,
        y: y - Math.sin(angle) * s * SEGMENT_DISTANCE,
      });
    }

    const newWorm: WormData = {
      id: playerId,
      name: chosenName.slice(0, 16),
      isBot: false,
      skin: chosenSkin,
      x,
      y,
      angle,
      speed: BASE_SPEED,
      isBoosting: false,
      score: INITIAL_SEGMENT_COUNT * 10,
      length: INITIAL_SEGMENT_COUNT,
      radius: 10,
      segments,
      isAlive: true,
      kills: 0,
    };

    this.worms.set(playerId, newWorm);

    if (conn.ws.readyState === WebSocket.OPEN) {
      conn.ws.send(JSON.stringify({
        type: 'respawned',
        worm: newWorm,
      }));
    }

    return newWorm;
  }

  private startLoop() {
    this.intervalId = setInterval(() => {
      this.tick();
    }, 1000 / TICK_RATE);
  }

  public stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private tick() {
    // 1. Update AI bots logic
    this.updateBots();

    // 2. Move all living worms
    for (const worm of this.worms.values()) {
      if (!worm.isAlive) continue;

      worm.speed = worm.isBoosting ? BOOST_SPEED : BASE_SPEED;

      // When boosting: lose mass and spawn food trail
      if (worm.isBoosting) {
        if (Math.random() < 0.28 && worm.score > 30) {
          worm.score -= 2;
          const tail = worm.segments[worm.segments.length - 1] || { x: worm.x, y: worm.y };
          const droppedFood: Food = {
            id: this.foodIdCounter++,
            x: tail.x + (Math.random() - 0.5) * 6,
            y: tail.y + (Math.random() - 0.5) * 6,
            radius: 3,
            color: worm.skin.glowColor || '#00f2fe',
            value: 2,
          };
          this.foods.set(droppedFood.id, droppedFood);
          this.addedFoodsBuffer.push(droppedFood);

          // Update target segments length
          worm.length = Math.max(8, Math.floor(worm.score / 10));
        }
      }

      // Move head forward
      worm.x += Math.cos(worm.angle) * worm.speed;
      worm.y += Math.sin(worm.angle) * worm.speed;

      // Dynamic radius based on score
      worm.radius = Math.min(22, 10 + Math.sqrt(worm.score) * 0.2);

      // Update segments chain smoothly
      if (worm.segments.length === 0) {
        worm.segments.push({ x: worm.x, y: worm.y });
      } else {
        // Shift head position into segments
        const headTarget = { x: worm.x, y: worm.y };
        const newSegments: Vector[] = [headTarget];

        let prev = headTarget;
        for (let i = 0; i < worm.segments.length; i++) {
          const seg = worm.segments[i];
          const dx = seg.x - prev.x;
          const dy = seg.y - prev.y;
          const dist = Math.hypot(dx, dy);

          if (dist > SEGMENT_DISTANCE) {
            const factor = SEGMENT_DISTANCE / dist;
            const updated = {
              x: prev.x + dx * factor,
              y: prev.y + dy * factor,
            };
            newSegments.push(updated);
            prev = updated;
          } else {
            newSegments.push(seg);
            prev = seg;
          }

          // If reached target length, trim excess
          if (newSegments.length >= worm.length) {
            break;
          }
        }

        // If worm grew, extend tail
        while (newSegments.length < worm.length) {
          const last = newSegments[newSegments.length - 1];
          newSegments.push({ x: last.x, y: last.y });
        }

        worm.segments = newSegments;
      }

      // Check arena boundary collision
      const distFromCenter = Math.hypot(worm.x, worm.y);
      if (distFromCenter + worm.radius > WORLD_RADIUS) {
        this.killWorm(worm, '장외 벽 충돌');
        continue;
      }

      // Eat food
      this.checkFoodEating(worm);
    }

    // 3. Check Head-to-Body Collisions among worms
    this.checkCollisions();

    // 4. Replenish ambient food if needed
    if (this.foods.size < TARGET_FOOD_COUNT) {
      const needed = Math.min(10, TARGET_FOOD_COUNT - this.foods.size);
      for (let i = 0; i < needed; i++) {
        this.spawnRandomFood();
      }
    }

    // 5. Respawn dead bots after delay
    let aliveBots = 0;
    for (const worm of this.worms.values()) {
      if (worm.isBot && worm.isAlive) aliveBots++;
    }
    if (aliveBots < this.botCountTarget) {
      if (Math.random() < 0.1) {
        this.spawnBot(Math.floor(Math.random() * BOT_NAMES.length));
      }
    }

    // 6. Broadcast sync packet to all connected clients
    this.broadcastSync();
  }

  private checkFoodEating(worm: WormData) {
    const eatRadius = worm.radius + 16;
    const eatRadiusSq = eatRadius * eatRadius;

    for (const [id, food] of this.foods.entries()) {
      const dx = worm.x - food.x;
      const dy = worm.y - food.y;
      const dSq = dx * dx + dy * dy;

      if (dSq < eatRadiusSq) {
        // Worm eats food
        worm.score += food.value;
        worm.length = Math.floor(worm.score / 10) + INITIAL_SEGMENT_COUNT;

        this.foods.delete(id);
        this.removedFoodIdsBuffer.push(id);
      }
    }
  }

  private checkCollisions() {
    const aliveWorms = Array.from(this.worms.values()).filter((w) => w.isAlive);

    for (let i = 0; i < aliveWorms.length; i++) {
      const wA = aliveWorms[i];
      if (!wA.isAlive) continue;

      for (let j = 0; j < aliveWorms.length; j++) {
        const wB = aliveWorms[j];
        if (!wB.isAlive) continue;

        // Same worm: can't collide with self head or first few segments
        if (wA.id === wB.id) continue;

        // Check head of wA against each segment of wB
        const collisionThreshold = (wA.radius + wB.radius) * 0.82;
        const threshSq = collisionThreshold * collisionThreshold;

        // Check if wA head hits wB segments
        let collided = false;
        // Start from index 1 (skip wB head to handle head-on separately)
        for (let s = 1; s < wB.segments.length; s++) {
          const seg = wB.segments[s];
          const dx = wA.x - seg.x;
          const dy = wA.y - seg.y;
          if (dx * dx + dy * dy < threshSq) {
            // wA slammed head into wB's body!
            this.killWorm(wA, `${wB.name}의 몸통에 충돌`, wB);
            collided = true;
            break;
          }
        }

        if (collided) continue;

        // Head-to-Head collision: both heads hit
        const headDx = wA.x - wB.x;
        const headDy = wA.y - wB.y;
        const headDistSq = headDx * headDx + headDy * headDy;
        const headThresh = (wA.radius + wB.radius) * 0.85;

        if (headDistSq < headThresh * headThresh) {
          if (wA.score > wB.score * 1.15) {
            // wA is significantly bigger, wB dies
            this.killWorm(wB, `${wA.name}와 정면 충돌`, wA);
          } else if (wB.score > wA.score * 1.15) {
            // wB is bigger, wA dies
            this.killWorm(wA, `${wB.name}와 정면 충돌`, wB);
          } else {
            // Equal sizes: both die!
            this.killWorm(wA, `${wB.name}와 정면 충돌`, wB);
            this.killWorm(wB, `${wA.name}와 정면 충돌`, wA);
          }
        }
      }
    }
  }

  private killWorm(victim: WormData, reason: string, killer?: WormData) {
    victim.isAlive = false;

    if (killer) {
      killer.kills += 1;
      killer.score += Math.floor(victim.score * 0.15); // Bonus score for kill
      killer.length = Math.floor(killer.score / 10) + INITIAL_SEGMENT_COUNT;

      const killEvent: KillEvent = {
        id: `kill_${Date.now()}_${Math.random()}`,
        killerId: killer.id,
        killerName: killer.name,
        victimId: victim.id,
        victimName: victim.name,
        time: Date.now(),
      };
      this.killEvents.unshift(killEvent);
      if (this.killEvents.length > 10) this.killEvents.pop();
    }

    // Convert victim's body segments into glowing high-value death food!
    // The core rule requested: "머리 박으면 죽어서 시체가 먹이가 되는"
    const step = Math.max(1, Math.floor(victim.segments.length / 40));
    for (let s = 0; s < victim.segments.length; s += step) {
      const seg = victim.segments[s];
      const jitterX = (Math.random() - 0.5) * 16;
      const jitterY = (Math.random() - 0.5) * 16;

      const deathFood: Food = {
        id: this.foodIdCounter++,
        x: Math.max(-WORLD_RADIUS + 30, Math.min(WORLD_RADIUS - 30, seg.x + jitterX)),
        y: Math.max(-WORLD_RADIUS + 30, Math.min(WORLD_RADIUS - 30, seg.y + jitterY)),
        radius: 4.5 + Math.random() * 3,
        color: Math.random() < 0.5 ? victim.skin.headColor : victim.skin.bodyColor1,
        value: 5 + Math.floor(Math.random() * 6),
        isSpecial: true,
      };

      this.foods.set(deathFood.id, deathFood);
      this.addedFoodsBuffer.push(deathFood);
    }

    // Notify the victim player if it's a real user
    const conn = this.connections.get(victim.id);
    if (conn && conn.ws.readyState === WebSocket.OPEN) {
      conn.ws.send(JSON.stringify({
        type: 'you_died',
        killerName: killer ? killer.name : '벽',
        finalScore: victim.score,
        kills: victim.kills,
        reason,
      }));
    }
  }

  private updateBots() {
    const aliveBots = Array.from(this.worms.values()).filter((w) => w.isBot && w.isAlive);
    const allAliveWorms = Array.from(this.worms.values()).filter((w) => w.isAlive);

    for (const bot of aliveBots) {
      // 1. Avoid boundary
      const distFromCenter = Math.hypot(bot.x, bot.y);
      if (distFromCenter > WORLD_RADIUS * 0.85) {
        const toCenterAngle = Math.atan2(-bot.y, -bot.x);
        bot.angle = toCenterAngle;
        bot.isBoosting = false;
        continue;
      }

      // 2. Avoid hitting other worm bodies!
      let obstacleNearby = false;
      const lookAheadDist = 60 + (bot.isBoosting ? 30 : 0);
      const lookAheadX = bot.x + Math.cos(bot.angle) * lookAheadDist;
      const lookAheadY = bot.y + Math.sin(bot.angle) * lookAheadDist;

      for (const other of allAliveWorms) {
        if (other.id === bot.id) continue;

        for (let s = 0; s < other.segments.length; s += 3) {
          const seg = other.segments[s];
          const dSq = (lookAheadX - seg.x) ** 2 + (lookAheadY - seg.y) ** 2;
          if (dSq < (bot.radius + other.radius + 35) ** 2) {
            obstacleNearby = true;
            // Steer away!
            const steerAway = Math.atan2(bot.y - seg.y, bot.x - seg.x);
            bot.angle = steerAway;
            bot.isBoosting = false;
            break;
          }
        }
        if (obstacleNearby) break;
      }

      if (obstacleNearby) continue;

      // 3. Find closest food orb
      let nearestFood: Food | null = null;
      let minFoodDistSq = 400 * 400; // sight range

      // Sample a subset of foods for bot performance
      for (const food of this.foods.values()) {
        const dSq = (bot.x - food.x) ** 2 + (bot.y - food.y) ** 2;
        if (dSq < minFoodDistSq) {
          minFoodDistSq = dSq;
          nearestFood = food;
        }
      }

      if (nearestFood) {
        const targetAngle = Math.atan2(nearestFood.y - bot.y, nearestFood.x - bot.x);
        let diff = targetAngle - bot.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        bot.angle += Math.max(-0.16, Math.min(0.16, diff));

        // Occasionally boost towards special big food
        if (nearestFood.isSpecial && Math.random() < 0.25 && bot.score > 60) {
          bot.isBoosting = true;
        } else {
          bot.isBoosting = false;
        }
      } else {
        // Wandering / patrolling
        bot.angle += (Math.random() - 0.5) * 0.1;
        bot.isBoosting = false;
      }
    }
  }

  private broadcastSync() {
    // Generate leaderboard
    const leaderboard: LeaderboardEntry[] = Array.from(this.worms.values())
      .filter((w) => w.isAlive)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map((w) => ({
        id: w.id,
        name: w.name,
        score: w.score,
        kills: w.kills,
        isBot: w.isBot,
      }));

    // Compact worm sync data
    const syncWorms = Array.from(this.worms.values()).map((w) => ({
      id: w.id,
      name: w.name,
      isBot: w.isBot,
      skin: w.skin,
      x: Math.round(w.x * 10) / 10,
      y: Math.round(w.y * 10) / 10,
      angle: Math.round(w.angle * 100) / 100,
      speed: w.speed,
      isBoosting: w.isBoosting,
      score: w.score,
      length: w.length,
      radius: Math.round(w.radius * 10) / 10,
      segments: w.segments.map((s) => ({
        x: Math.round(s.x * 10) / 10,
        y: Math.round(s.y * 10) / 10,
      })),
      isAlive: w.isAlive,
      kills: w.kills,
      emote: w.emote && Date.now() - w.emote.time < 3000 ? w.emote : undefined,
    }));

    const packet = {
      type: 'sync',
      worms: syncWorms,
      addedFoods: this.addedFoodsBuffer.length > 0 ? this.addedFoodsBuffer : undefined,
      removedFoodIds: this.removedFoodIdsBuffer.length > 0 ? this.removedFoodIdsBuffer : undefined,
      leaderboard,
      killEvents: this.killEvents,
      time: Date.now(),
      aliveCount: syncWorms.filter((w) => w.isAlive).length,
    };

    this.addedFoodsBuffer = [];
    this.removedFoodIdsBuffer = [];

    const json = JSON.stringify(packet);

    for (const conn of this.connections.values()) {
      if (conn.ws.readyState === WebSocket.OPEN) {
        conn.ws.send(json);
      }
    }
  }

  private broadcast(data: object) {
    const json = JSON.stringify(data);
    for (const conn of this.connections.values()) {
      if (conn.ws.readyState === WebSocket.OPEN) {
        conn.ws.send(json);
      }
    }
  }

  public getPlayerCount() {
    return this.connections.size;
  }

  public getBotCount() {
    let count = 0;
    for (const w of this.worms.values()) {
      if (w.isBot && w.isAlive) count++;
    }
    return count;
  }
}
