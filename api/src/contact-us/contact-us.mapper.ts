import type { Company } from '@prisma/client';

/** Wire shape of specs/015-contact-us-page contracts/openapi.yaml's ContactUs schema. */
export interface ContactUsResponse {
  /** Added by specs/016-feedback-management — see contracts/openapi.yaml's comment on this field. */
  company_name: string;
  contact_person: string;
  phone_number: string;
  email: string;
  address: string;
  operating_hours: string | null;
}

/** A narrower, read-only projection of the caller's own `companies` row — never the full Company shape (which includes is_open/is_sms, System-Admin-only concerns). */
export function toContactUsResponse(
  company: Pick<Company, 'name' | 'contactPerson' | 'mobile' | 'email' | 'address' | 'operatingHours'>,
): ContactUsResponse {
  return {
    company_name: company.name,
    contact_person: company.contactPerson,
    phone_number: company.mobile,
    email: company.email,
    address: company.address,
    operating_hours: company.operatingHours,
  };
}
