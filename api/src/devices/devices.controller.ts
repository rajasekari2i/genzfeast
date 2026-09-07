import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantContextInterceptor } from '../common/interceptors/tenant-context.interceptor';
import { CurrentTenantContext } from '../common/decorators/current-tenant-context.decorator';
import type { TenantContext } from '../common/prisma/tenant-prisma.service';
import { DevicesService } from './devices.service';
import { RegisterDeviceDto } from './dto/register-device.dto';

/**
 * specs/009-order-fcm-push-notifications contracts/openapi.yaml — /me/devices.
 * Every role may register a device for their own account; no `@Roles(...)`
 * restriction, same reasoning as specs/007's Profile endpoints.
 */
@Controller('me/devices')
@UseGuards(JwtAuthGuard)
@UseInterceptors(TenantContextInterceptor)
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async register(
    @CurrentTenantContext() ctx: TenantContext,
    @Body() dto: RegisterDeviceDto,
  ): Promise<{ registered: true }> {
    await this.devicesService.registerAuthenticated(ctx, dto.fcm_token, dto.refresh_token);
    return { registered: true };
  }
}
