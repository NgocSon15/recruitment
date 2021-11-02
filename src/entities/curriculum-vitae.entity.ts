import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, JoinColumn, UpdateDateColumn,
  OneToMany, OneToOne } from 'typeorm';
import { AutoMap } from '@automapper/classes';

import { Gender } from '@Shared/enums/gender';

import { CurriculumVitaeExperienceEntity } from '@Entities/curriculum-vitae-experience.entity';

import { UserEntity } from '@Entities/user.entity';

@Entity('curriculum-vitaes')
export class CurriculumVitaeEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @AutoMap()
  @OneToOne(() => UserEntity)
  @JoinColumn({ name: 'user_id'})
  user: UserEntity;

  @Column({ type: 'enum', enum: Gender, default: Gender.UNDEFINED })
  gender: Gender;

  @Column({ nullable: true, type: 'timestamp', default: null, name: 'date_of_birth' })
  dateOfBirth: Date

  @Column({ nullable: true, name: 'phone_number' })
  phoneNumber: string;

  @AutoMap()
  @Column({ default: null, nullable: true })
  nationality: number;

  @Column({ default: '' })
  address: string;

  @Column({ default: '' })
  summary: string;

  @AutoMap()
  @Column({ default: '' })
  skills: string;

  @Column({ default: '' })
  educations: string;

  @Column({ default: '' })
  certifications: string;

  @Column({ default: '' })
  languages: string;

  @Column({ default: '' })
  hobbies: string;

  @CreateDateColumn({ name: 'created_at'})
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at'})
  updatedAt: Date

  @AutoMap()
  @Column({ default: '' })
  introduce: string;

  @OneToMany(() => CurriculumVitaeExperienceEntity, experience => experience.curriculumnVitae)
  experiences: CurriculumVitaeExperienceEntity[]

  @AutoMap()
  @Column({ default: 0, name: 'minimal_hourly_rate' })
  minimalHourlyRate: number
}