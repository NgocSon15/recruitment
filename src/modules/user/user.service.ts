import { Injectable, ForbiddenException } from '@nestjs/common';
import { getManager, getRepository, In } from 'typeorm';
import { InjectMapper } from '@automapper/nestjs';
import type { Mapper } from '@automapper/types';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import fs from 'fs';

import { CurriculumVitaeExperienceEntity } from '@Entities/curriculum-vitae-experience.entity';
import { CurriculumVitaeSkillRelation } from '@Entities/curriculum-vitae-skill.relation';
import { CurriculumVitaeEntity } from '@Entities/curriculum-vitae.entity';
import { LanguageEntity } from '@Entities/language.entity';
import { SkillEntity } from '@Entities/skill.entity';
import { UserEntity } from '@Entities/user.entity';

import { CurriculumVitaeRepository } from '@Repositories/curriculum-vitae.repository';
// import { ReviewRepository } from '@Repositories/review.repository';
import { UserRepository } from '@Repositories/user.repository';

// import { CurriculumVitaeExperience } from '@Shared/responses/curriculum-vitae-experience';
import { CurriculumVitae } from '@Shared/responses/curriculum-vitae';
import { User } from '@Shared/responses/user';

import { FileService } from '@Shared/services/file.service';

import {
  UpdateCurriculumnVitaeExperienceRequest,
  UpdateCurriculumnVitaeRequest,
  RemoveCertificationsRequest,
  ChangePasswordRequest,
} from './dtos/requests';
import { UpdateCertificationsResponse, ChangePasswordResponse, ChangeAvatarResponse } from './dtos/responses';
import { CountryEntity } from '@Entities/country.entity';
import { AreaEntity } from '@Entities/area.entity';
import { NationalityEntity } from '@Entities/nationality.entity';

@Injectable()
export class UserService {
  constructor(
    @InjectMapper() private readonly mapper: Mapper,
    private curriculumVitaeRepository: CurriculumVitaeRepository,
    private userRepository: UserRepository,
    private configService: ConfigService,
    private fileService: FileService,
  ) {}

  getCurrentUser(_currentUser: UserEntity) {
    return this.mapper.map(_currentUser, User, UserEntity);
  }

  async getCurriculumVitae(userId: string): Promise<CurriculumVitaeEntity> {
    const _cv = await this.curriculumVitaeRepository.findOne({
      where: { userId: userId },
      relations: [
        'skillRelations.skill',
        'skillRelations',
        'experiences',
        'nationality',
        'languages',
        'country',
        'user',
        'area',
      ],
    });
    return _cv;
  }

  async changePassword(
    _currentUser: UserEntity,
    changePasswordRequest: ChangePasswordRequest,
  ): Promise<ChangePasswordResponse> {
    const oldPassword = changePasswordRequest.oldPassword;
    if (!(await bcrypt.compare(oldPassword, _currentUser.password))) {
      throw new ForbiddenException('Wrong password');
    }
    const saltOrRounds = this.configService.get<number>('bscryptSlatRounds');
    const newPassword = changePasswordRequest.newPassword;
    const hash = await bcrypt.hash(newPassword, saltOrRounds);
    _currentUser.password = hash;
    await this.userRepository.save(_currentUser);
    const changePasswordResponse = new ChangePasswordResponse();
    changePasswordResponse.status = true;
    return changePasswordResponse;
  }

  async updateAvatar(_currentUser: UserEntity, avatar: Express.Multer.File): Promise<ChangeAvatarResponse> {
    if (_currentUser.avatar != '') {
      fs.unlinkSync(`./public/avatars/${_currentUser.avatar}`);
    }
    _currentUser.avatar = avatar.filename;
    await this.userRepository.save(_currentUser);
    return {
      avatar: this.fileService.getAvatar(_currentUser),
    };
  }

  async updateCurriculumnVitae(
    _currentUser: UserEntity,
    updateCurriculumnVitaeRequest: UpdateCurriculumnVitaeRequest,
  ): Promise<CurriculumVitae> {
    const _cv = await this.curriculumVitaeRepository.findOne({
      where: { user: _currentUser },
      relations: [
        'skillRelations.skill',
        'skillRelations',
        'nationality',
        'experiences',
        'languages',
        'country',
        'user',
        'area',
      ],
    });

    await getManager().transaction(async (transactionalEntityManager) => {
      _currentUser.firstName = updateCurriculumnVitaeRequest.firstName;
      _currentUser.lastName = updateCurriculumnVitaeRequest.lastName;
      await transactionalEntityManager.save(_currentUser);

      _cv.dateOfBirth = new Date(updateCurriculumnVitaeRequest.dateOfBirth);
      _cv.briefIntroduce = updateCurriculumnVitaeRequest.briefIntroduce;
      _cv.nationalityId = updateCurriculumnVitaeRequest.nationalityId;
      _cv.hobbies = updateCurriculumnVitaeRequest.hobbies.join('|');
      _cv.phoneNumber = updateCurriculumnVitaeRequest.phoneNumber;
      _cv.educations = updateCurriculumnVitaeRequest.educations;
      _cv.introduce = updateCurriculumnVitaeRequest.introduce;
      _cv.address = updateCurriculumnVitaeRequest.address;
      _cv.gender = updateCurriculumnVitaeRequest.gender;

      _cv.nationality = await getRepository(NationalityEntity).findOne();
      _cv.country = await getRepository(CountryEntity).findOne({ id: updateCurriculumnVitaeRequest.countryId });
      _cv.area = await getRepository(AreaEntity).findOne({ id: updateCurriculumnVitaeRequest.areaId });
      _cv.languages = await getRepository(LanguageEntity).find({
        where: { id: In(updateCurriculumnVitaeRequest.languageIds) },
      });
      _cv.skillRelations = [];

      const _experiences: CurriculumVitaeExperienceEntity[] = [];
      if (updateCurriculumnVitaeRequest.experiences != null && updateCurriculumnVitaeRequest.experiences.length != 0) {
        for (let index = 0; index < updateCurriculumnVitaeRequest.experiences.length; index++) {
          const experience: UpdateCurriculumnVitaeExperienceRequest = updateCurriculumnVitaeRequest.experiences[index];
          const _experience = new CurriculumVitaeExperienceEntity();
          _experience.companyEmail = experience.companyEmail;
          _experience.companyName = experience.companyName;
          _experience.description = experience.description;
          _experience.startDate = experience.startDate;
          _experience.endDate = experience.endDate;
          _experience.role = experience.role;
          _experience.type = experience.type;
          _experience.index = index;
          _experience.cvId = _cv.id;
          _experiences.push(_experience);
        }
      }
      _cv.experiences = _experiences;
      await transactionalEntityManager.save(_cv);

      const _skills = await getRepository(SkillEntity).find({
        id: In(updateCurriculumnVitaeRequest.skills.map((s) => s.skillId)),
      });
      const skillRelations: CurriculumVitaeSkillRelation[] = [];
      for (const updateSkill of updateCurriculumnVitaeRequest.skills) {
        const _skill = _skills.find((_skill) => _skill.id == updateSkill.skillId);
        if (_skill != null) {
          const skillRelation = new CurriculumVitaeSkillRelation();
          skillRelation.experience = updateSkill.experience;
          skillRelation.skillId = _skill.id;
          skillRelation.skill = _skill;
          skillRelation.cvId = _cv.id;
          skillRelations.push(skillRelation);
        }
      }
      await transactionalEntityManager.save(skillRelations);
      _cv.skillRelations = skillRelations;
    });

    return this.mapper.map(_cv, CurriculumVitae, CurriculumVitaeEntity);
  }

  async updateCertifications(
    _currentUser: UserEntity,
    certifications: Express.Multer.File[],
  ): Promise<UpdateCertificationsResponse> {
    const _cv = await this.curriculumVitaeRepository.findOne({ where: { user: _currentUser } });
    const _certifications = _cv.certifications.split('|').filter((_certification) => _certification);

    /// Remove old file
    for (const _certification of _certifications) {
      if (_certification != '') {
        const path = `./public/certifications/${_certification}`;
        fs.unlinkSync(path);
      }
    }

    const newCertifications = certifications.map((certification) => certification.filename);
    _cv.certifications = newCertifications.join('|');
    await this.curriculumVitaeRepository.save(_cv);
    return {
      certifications: newCertifications.map((_c) => this.fileService.getCertification(_c)),
    };
  }

  async updateCertification(
    _currentUser: UserEntity,
    certification: Express.Multer.File,
  ): Promise<UpdateCertificationsResponse> {
    const _cv = await this.curriculumVitaeRepository.findOne({ where: { user: _currentUser } });
    const _certifications = _cv.certifications.split('|').filter((_certification) => _certification);

    if (_certifications.length >= 3) {
      fs.unlinkSync(`./public/certifications/${certification.filename}`);
      throw new ForbiddenException('Total certifications greater than 3');
    } else {
      _certifications.push(certification.filename);
      _cv.certifications = _certifications.join('|');
      await this.curriculumVitaeRepository.save(_cv);
      return {
        certifications: _certifications.map((_c) => this.fileService.getCertification(_c)),
      };
    }
  }

  async removeCertifications(
    _currentUser: UserEntity,
    removeCertificationsRequest: RemoveCertificationsRequest,
  ): Promise<UpdateCertificationsResponse> {
    const certifications = removeCertificationsRequest.certifications;
    const _cv = await this.curriculumVitaeRepository.findOne({ where: { user: _currentUser } });
    const _certifications = _cv.certifications.split('|').filter((_certification) => _certification);

    if (certifications.length == 0) {
      return {
        certifications: _certifications.map((_c) => this.fileService.getCertification(_c)),
      };
    } else {
      if (!certifications.every((certification) => _certifications.includes(certification)))
        throw new ForbiddenException('No permission to delete');

      for (const certification of certifications.filter((certification) => certification)) {
        const path = `./public/certifications/${certification}`;
        fs.unlinkSync(path);
      }

      const _newCertifications = _certifications.filter((_c) => certifications.indexOf(_c) == -1);
      _cv.certifications = _newCertifications.join('|');
      await this.curriculumVitaeRepository.save(_cv);

      return {
        certifications: _newCertifications.map((_c) => this.fileService.getCertification(_c)),
      };
    }
  }
}
