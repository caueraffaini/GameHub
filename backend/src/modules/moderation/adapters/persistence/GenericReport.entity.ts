// src/modules/moderation/adapters/persistence/GenericReport.entity.ts

import { Entity, PrimaryColumn, Column } from 'typeorm';
import { GenericReport, ReportStatus } from '../../domain/models/GenericReport';

@Entity('generic_reports')
export class GenericReportEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ name: 'reported_by_user_id', type: 'uuid' })
  reportedByUserId: string;

  @Column({ name: 'target_user_id', type: 'uuid' })
  targetUserId: string;

  @Column()
  reason: string;

  @Column('text')
  details: string;

  @Column({ name: 'reported_at', default: () => 'CURRENT_TIMESTAMP' })
  reportedAt: Date;

  @Column()
  status: ReportStatus;

  static toEntity(model: GenericReport): GenericReportEntity {
    const entity = new GenericReportEntity();
    entity.id = model.id;
    entity.reportedByUserId = model.reportedByUserId;
    entity.targetUserId = model.targetUserId;
    entity.reason = model.reason;
    entity.details = model.details;
    entity.reportedAt = model.reportedAt;
    entity.status = model.status;
    return entity;
  }

  toModel(): GenericReport {
    return new GenericReport({
      id: this.id,
      reportedByUserId: this.reportedByUserId,
      targetUserId: this.targetUserId,
      reason: this.reason,
      details: this.details,
      reportedAt: this.reportedAt,
      status: this.status,
    });
  }
}
