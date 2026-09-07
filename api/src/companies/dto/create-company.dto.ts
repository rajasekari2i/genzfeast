import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

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

  @IsString()
  @IsNotEmpty()
  mobile!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  address!: string;
}
