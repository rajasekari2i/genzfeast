import { Module } from '@nestjs/common';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';
import { PasswordService } from '../auth/password.service';

@Module({
  controllers: [CompaniesController],
  // PasswordService is provided directly rather than by importing AuthModule:
  // it is a stateless argon2 wrapper with no dependencies, and importing the
  // whole auth module here would pull in JWT and session concerns this module
  // has no use for.
  providers: [CompaniesService, PasswordService],
})
export class CompaniesModule {}
