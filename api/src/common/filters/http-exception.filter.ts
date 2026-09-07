import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { MulterError } from 'multer';

/**
 * coding_standard.md §7: one global filter producing a consistent
 * { message } body — never a raw Prisma error, stack trace, or internal
 * field name reaching a client response.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        response.status(status).json({ message: body });
        return;
      }
      // Preserve any extra fields a handler deliberately attached (e.g.
      // specs/002's `AccountBlockedErrorResponse.reason`,
      // specs/006's `UnavailableItemsError.unavailable_product_ids`) —
      // `message` alone isn't always the full documented error shape.
      const message = (body as { message?: string | string[] }).message ?? exception.message;
      response.status(status).json({ ...(body as object), message });
      return;
    }

    // FileInterceptor's `limits.fileSize` (products.controller.ts's product
    // photo upload — 2MB) throws this directly, outside the HttpException
    // hierarchy, before the handler ever runs — without this branch it
    // would fall through to a bare 500 with no useful message.
    if (exception instanceof MulterError) {
      const message =
        exception.code === 'LIMIT_FILE_SIZE' ? 'Image exceeds the maximum allowed size (2MB)' : exception.message;
      response.status(HttpStatus.BAD_REQUEST).json({ message });
      return;
    }

    this.logger.error(
      'Unhandled exception',
      exception instanceof Error ? exception.stack : String(exception),
    );
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
  }
}
