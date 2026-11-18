// Ce que le bot lit d'Hexa : les adresses publiques du jeu (rien de privé, aucun accès à la base).
import { config } from "./config.ts";
import type { Level } from "@hexa/game";

async function get<T>(path: string): Promise<T> {
  const r = await fetch(config.hexa + path, { signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(`${path} : HTTP ${r.status}`);
  return r.json() as Promise<T>;
}

export interface Daily { day: string; number: number }
export interface Row { name: string; home: string | null; points: number; elapsedMs: number; guest?: number }
export interface Board { day: string; number: number; level: Level; counts: Record<string, number>; top: Row[] }
export interface PublicRoom { code: string; kind: string; phase: string; players: number; spectators: number; host: string; round: number; rounds: number; level: Level }
export interface Hof { daily: { week: Record<Level, { name: string; points: number; days: number }[]>; since: { week: string } } }

export const daily = () => get<Daily>("/api/daily");
export const board = (level: Level, day?: string) => get<Board>(`/api/daily/leaderboard?level=${level}${day ? `&day=${day}` : ""}`);
export const publicRooms = () => get<{ rooms: PublicRoom[] }>("/api/rooms/public").then((r) => r.rooms);
export const hof = () => get<Hof>("/api/hof");
