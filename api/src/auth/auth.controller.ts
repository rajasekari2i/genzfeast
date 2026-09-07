import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantContextInterceptor } from '../common/interceptors/tenant-context.interceptor';
import { CurrentTenantContext } from '../common/decorators/current-tenant-context.decorator';
import type { TenantContext } from '../common/prisma/tenant-prisma.service';
import { AuthService, AuthenticatedUserResponse, RegistrationOptionsResponse, SessionResponse } from './auth.service';
import { AuditMeta } from './auth-audit.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ForgotPasswordRequestDto } from './dto/forgot-password-request.dto';
import { ForgotPasswordVerifyDto } from './dto/forgot-password-verify.dto';
import { RegisterStudentDto } from './dto/register-student.dto';

function requestMeta(req: Request): AuditMeta {
  return { ipAddress: req.ip, userAgent: req.get('user-agent') };
}

/** specs/002-registration-login-jwt-auth contracts/openapi.yaml. */
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Not part of any spec's original contract — a pre-auth Category/Department
   * lookup so the Registration screen can render its dropdowns before the
   * user has an account (FR-012). See AuthService.getRegistrationOptions.
   */
  @Get('register/options')
  getRegistrationOptions(
    @Query('company_id', ParseUUIDPipe) companyId: string,
  ): Promise<RegistrationOptionsResponse> {
    return this.authService.getRegistrationOptions(companyId);
  }

  /**
   * specs/001-company-role-user-setup contracts/openapi.yaml, extended by
   * specs/002-registration-login-jwt-auth's contract — 201 with a Session
   * (FR-001), never a separate login step.
   */
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  register(@Body() dto: RegisterStudentDto, @Req() req: Request): Promise<AuthenticatedUserResponse> {
    return this.authService.registerStudent(dto, requestMeta(req));
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto, @Req() req: Request): Promise<AuthenticatedUserResponse> {
    return this.authService.login(dto, requestMeta(req));
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshTokenDto, @Req() req: Request): Promise<SessionResponse> {
    return this.authService.refresh(dto.refresh_token, requestMeta(req));
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(TenantContextInterceptor)
  async logout(@Body() dto: RefreshTokenDto, @CurrentTenantContext() ctx: TenantContext): Promise<void> {
    await this.authService.logout(ctx, dto.refresh_token);
  }

  /** specs/003-forgot-password-otp-reset contracts/openapi.yaml — always 202. */
  @Post('forgot-password/request')
  @HttpCode(HttpStatus.ACCEPTED)
  requestPasswordReset(
    @Body() dto: ForgotPasswordRequestDto,
    @Req() req: Request,
  ): Promise<{ message: string }> {
    return this.authService.requestPasswordReset(dto, requestMeta(req));
  }

  /** specs/003-forgot-password-otp-reset contracts/openapi.yaml — 200/400/422. */
  @Post('forgot-password/verify')
  @HttpCode(HttpStatus.OK)
  verifyPasswordReset(@Body() dto: ForgotPasswordVerifyDto, @Req() req: Request): Promise<{ message: string }> {
    return this.authService.verifyPasswordReset(dto, requestMeta(req));
  }
}
