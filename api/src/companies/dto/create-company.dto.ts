import { IsEmail, IsNotEmpty, IsString, Matches } from 'class-validator';

/**
 * Field names are snake_case to match contracts/openapi.yaml's
 * CompanyCreateRequest wire format exactly — CompaniesService translates
 * to Prisma's camelCase fields, never passes these through untranslated
 * (coding_standard.md §4.1).
 */
export class CreateCompanyDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  contact_person!: string;

  // specs/015-contact-us-page FR-007/research.md §8 — every save of this
  // field is validated, not just PATCH; a company created with a malformed
  // number would otherwise carry it forward unvalidated.
  @Matches(/^\d{10}$/, { message: 'mobile must be a 10-digit mobile number' })
  mobile!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  address!: string;
}
