// src/modules/progression/domain/models/Season.ts

export class Season {
  id: string;
  name: string;
  startTime: Date;
  endTime: Date;
  isActive: boolean;

  constructor(init?: Partial<Season>) {
    Object.assign(this, init);
  }
}
