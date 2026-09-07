import { IsString, MinLength } from 'class-validator';

/**
 * Matches contracts/openapi.yaml's /tenant/staff/orders/{id}/verify body.
 * Deliberately no format/length constraint beyond non-empty: FR-007/Edge
 * Cases require a wrong-length or non-numeric submission to be rejected
 * the exact same way as any other mismatch (422, logged, retry allowed) —
 * not a distinct 400 validation error, which the contract's own responses
 * don't even list for this endpoint. The service's plain string comparison
 * against the stored code handles this naturally.
 */
export class VerifyOrderCodeDto {
  @IsString()
  @MinLength(1)
  code!: string;
}
