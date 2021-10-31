import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { UserRepository } from '@Repositories/user.repository';

import { JwtAuthenticationGuard } from './jwt-authentication.guard';
import { AuthenticationService } from './authentication.service';
import { JwtStrategy } from './jwt.strategy';
import { AuthenticationController } from './authentication.controller';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([UserRepository]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get('secret.jwt'),
      }),
    }),
  ],
  providers: [AuthenticationService, JwtStrategy, JwtAuthenticationGuard],
  controllers: [AuthenticationController],
  exports: [AuthenticationService],
})
export class AuthenticationModule {}