import { IsString, MinLength } from 'class-validator';

/**
 * POST /me/delete-account. Only the caller's own password — the account
 * being closed is always `ctx.userId` from the verified JWT, never a body
 * or path parameter, matching every other method in this module (FR-014).
 */
export class DeleteAccountDto {
  /**
   * Re-confirms ownership before an irreversible action, so a briefly
   * unattended or stolen session cannot close the account. No MinLength(8)
   * here despite registration requiring it: this is a comparison against
   * an existing hash, not a new password being set, and imposing today's
   * policy would reject an older account whose password predates it.
   */
  @IsString()
  @MinLength(1)
  current_password!: string;
}
