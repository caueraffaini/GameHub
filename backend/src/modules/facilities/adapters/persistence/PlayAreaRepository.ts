import { Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IPlayAreaRepositoryPort } from '../../ports/outbound/IPlayAreaRepositoryPort';
import { PlayArea } from '../../domain/models/PlayArea';
import { PlayAreaEntity } from './PlayArea.entity';
import { PlayAreaSupportedGameEntity } from './PlayAreaSupportedGame.entity';

@Injectable()
export class PlayAreaRepository implements IPlayAreaRepositoryPort {
  constructor(
    @InjectRepository(PlayAreaEntity)
    private readonly playAreaRepo: Repository<PlayAreaEntity>,
    @InjectRepository(PlayAreaSupportedGameEntity)
    private readonly supportedGameRepo: Repository<PlayAreaSupportedGameEntity>,
  ) {}

  async findById(id: string): Promise<PlayArea | null> {
    const entity = await this.playAreaRepo.findOneBy({ id });
    if (!entity) return null;

    const gameMappings = await this.supportedGameRepo.findBy({ playAreaId: id });
    const supportedGameTypes = gameMappings.map((m) => m.gameType);

    return entity.toModel(supportedGameTypes);
  }

  async save(playArea: PlayArea): Promise<PlayArea> {
    const entity = PlayAreaEntity.toEntity(playArea);
    const saved = await this.playAreaRepo.save(entity);

    // Save supported game mappings
    await this.supportedGameRepo.delete({ playAreaId: playArea.id });
    if (playArea.supportedGameTypes && playArea.supportedGameTypes.length > 0) {
      const mappings = playArea.supportedGameTypes.map((gameType) => {
        const mapping = new PlayAreaSupportedGameEntity();
        mapping.playAreaId = playArea.id;
        mapping.gameType = gameType;
        return mapping;
      });
      await this.supportedGameRepo.save(mappings);
    }

    return saved.toModel(playArea.supportedGameTypes);
  }

  async findAll(): Promise<PlayArea[]> {
    const entities = await this.playAreaRepo.find();
    const result: PlayArea[] = [];
    for (const entity of entities) {
      const gameMappings = await this.supportedGameRepo.findBy({ playAreaId: entity.id });
      const supportedGameTypes = gameMappings.map((m) => m.gameType);
      result.push(entity.toModel(supportedGameTypes));
    }
    return result;
  }
}
