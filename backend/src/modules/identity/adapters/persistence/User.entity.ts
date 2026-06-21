import { Entity, PrimaryColumn, Column } from 'typeorm';
import { User, AvailabilityStatus } from '../../domain/models/User';

@Entity('users')
export class UserEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ unique: true })
  nusp: string;

  @Column()
  nickname: string;

  @Column({ unique: true })
  email: string;

  @Column({ name: 'full_name' })
  fullName: string;

  @Column({ name: 'birth_date', type: 'date' })
  birthDate: Date;

  @Column({ name: 'pin_hash' })
  pinHash: string;

  @Column({ name: 'avatar_url', nullable: true })
  avatarUrl: string;

  @Column({ name: 'institute_id', type: 'uuid' })
  instituteId: string;

  @Column({ name: 'course_id', type: 'uuid' })
  courseId: string;

  @Column({ name: 'availability_status', default: 'OFFLINE' })
  availabilityStatus: AvailabilityStatus;

  @Column({ name: 'is_deleted', default: false })
  isDeleted: boolean;

  static toEntity(model: User): UserEntity {
    const entity = new UserEntity();
    entity.id = model.id;
    entity.nusp = model.nusp;
    entity.nickname = model.nickname;
    entity.email = model.email;
    entity.fullName = model.fullName;
    entity.birthDate = model.birthDate;
    entity.pinHash = model.pinHash;
    entity.avatarUrl = model.avatarUrl;
    entity.instituteId = model.instituteId;
    entity.courseId = model.courseId;
    entity.availabilityStatus = model.availabilityStatus;
    entity.isDeleted = model.isDeleted;
    return entity;
  }

  toModel(): User {
    return new User({
      id: this.id,
      nusp: this.nusp,
      nickname: this.nickname,
      email: this.email,
      fullName: this.fullName,
      birthDate: this.birthDate,
      pinHash: this.pinHash,
      avatarUrl: this.avatarUrl || undefined,
      instituteId: this.instituteId,
      courseId: this.courseId,
      availabilityStatus: this.availabilityStatus,
      isDeleted: this.isDeleted,
    });
  }
}
