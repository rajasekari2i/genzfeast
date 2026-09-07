import { IsBoolean, IsEmail, IsOptional, IsString } from 'class-validator';

/**
 * PATCH semantics (coding_standard.md §6): every field optional, only
 * submitted fields change. Matches contracts/openapi.yaml's
 * CompanyUpdateRequest, including the is_open toggle.
 */
export class UpdateCompanyDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  contact_person?: string;

  @IsOptional()
  @IsString()
  mobile?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsBoolean()
  is_open?: boolean;
}
