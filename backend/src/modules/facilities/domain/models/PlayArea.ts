// src/modules/facilities/domain/models/PlayArea.ts

export type GameType = 'BOLA_8' | 'PINGPONG' | 'PEBOLIM' | 'TRUCO' | 'BURACO' | 'SNOOKER';
export type PlayAreaStatus = 'EMPTY' | 'IN_USE' | 'MAINTENANCE';

export class PlayArea {
  id: string;
  name: string;
  supportedGameTypes: GameType[]; // Decouples game types from single hardcoded associations
  status: PlayAreaStatus;
  isVirtual: boolean; // Differentiates transient card game instances from physical inventory

  constructor(init?: Partial<PlayArea>) {
    Object.assign(this, init);
  }
}
