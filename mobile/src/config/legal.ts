/**
 * The developer's own policy pages, not a tenant's.
 *
 * Deliberately hardcoded rather than exposed through react-native-config
 * like API_BASE_URL/COMPANY_ID: those are per-build, per-canteen values, but
 * these documents belong to Sapthagiri Catering as the publisher and are the
 * same for every branded build. Putting them in `.env` would mean every new
 * canteen's build carries its own copy, free to drift from the live site.
 *
 * Google Play's User Data policy requires the privacy policy to be reachable
 * from inside the app as well as from the store listing — ProfileScreen's
 * Legal card is that path. DELETE_ACCOUNT_URL is the public page Play's Data
 * safety form points at for deletion requests.
 */
export const PRIVACY_POLICY_URL = 'https://genzfeast.in/#privacy';
export const TERMS_OF_SERVICE_URL = 'https://genzfeast.in/#terms';
export const DELETE_ACCOUNT_URL = 'https://genzfeast.in/#delete-account';
