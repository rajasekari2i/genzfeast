import type { Company } from '@prisma/client';

/** Wire shape of specs/015-contact-us-page contracts/openapi.yaml's ContactUs schema. */
export interface ContactUsResponse {
  contact_person: string;
  phone_number: string;
  email: string;
  address: string;
  operating_hours: string | null;
}

/** A narrower, read-only projection of the caller's own `companies` row — never the full Company shape (which includes is_open/is_sms, System-Admin-only concerns). */
export function toContactUsResponse(
  company: Pick<Company, 'contactPerson' | 'mobile' | 'email' | 'address' | 'operatingHours'>,
): ContactUsResponse {
  return {
    contact_person: company.contactPerson,
    phone_number: company.mobile,
    email: company.email,
    address: company.address,
    operating_hours: company.operatingHours,
  };
}
