import createClient from 'openapi-fetch';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { emitUnauthorized } from '../auth/authEvents';

// Generated per-feature types (openapi-typescript) — see ./generated/README.md.
// Import a feature's `paths` type where its endpoints are used, e.g.:
//   import type { paths } from '../api/generated/006-student-browse-cart-checkout';
//   const client = createTypedClient<paths>();

// Base URL: overridden per environment (dev/staging/prod, per Architecture §9)
// via app.json's `extra.apiBaseUrl` or an EXPO_PUBLIC_ env var — never
// hardcoded per coding_standard.md §10.
const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:3000';

const ACCESS_TOKEN_KEY = 'genzfeast.accessToken';
// specs/002-registration-login-jwt-auth contracts/openapi.yaml's Session
// schema: "Store securely (Keychain/Keystore) — never in plain AsyncStorage."
// — the access token above is short-lived (~30 min) and stays in AsyncStorage
// per the existing convention; only the long-lived refresh token needs
// SecureStore.
const REFRESH_TOKEN_KEY = 'genzfeast.refreshToken';
// No screen anywhere in the app previously had a way to know the logged-in
// user's role/company_id at runtime (RootNavigator's SurfacePicker is a
// dev-only stand-in for real role-based routing) — added because the
// Product screens need it to distinguish Company Admin's full CRUD from
// Staff's read+toggle-only view (UI Design §5.5).
const CURRENT_USER_KEY = 'genzfeast.currentUser';

export interface CurrentUser {
  id?: string;
  company_id?: string | null;
  role?: string;
  name?: string;
  username?: string;
}

/**
 * Creates a typed client bound to one feature's generated `paths` type
 * (specs/<feature>/contracts/openapi.yaml). The access token is attached
 * automatically as `Authorization: Bearer <token>` on every request — never
 * stored in component state or passed manually per-call.
 */
export function createTypedClient<Paths extends {}>() {
  const client = createClient<Paths>({ baseUrl: API_BASE_URL });

  client.use({
    async onRequest({ request }) {
      const token = await AsyncStorage.getItem(ACCESS_TOKEN_KEY);
      if (token) {
        request.headers.set('Authorization', `Bearer ${token}`);
      }
      return request;
    },
    // Any authenticated request (one that actually carried a bearer token)
    // coming back 401 means that token is expired/invalid — sign out and
    // land back on Login automatically, for every role, since role-based
    // routing itself is driven off AuthContext's `user` being null (see
    // authEvents.ts). Login/refresh's own 401s (bad credentials) never
    // reach here since those requests carry no Authorization header.
    async onResponse({ request, response }) {
      if (response.status === 401 && request.headers.get('Authorization')) {
        await clearStoredSession();
        emitUnauthorized();
      }
      // Deliberately no return — this middleware only observes the
      // response. openapi-fetch requires onResponse to return either
      // nothing (keep the original) or a genuinely new Response instance;
      // returning the same `response` reference back throws.
    },
  });

  return client;
}

export async function setStoredAccessToken(token: string | null): Promise<void> {
  if (token) {
    await AsyncStorage.setItem(ACCESS_TOKEN_KEY, token);
  } else {
    await AsyncStorage.removeItem(ACCESS_TOKEN_KEY);
  }
}

/** Persists a full login/register response (session + user summary) in one call. */
export async function storeSession(session: {
  access_token?: string;
  refresh_token?: string;
  user?: CurrentUser;
}): Promise<void> {
  if (session.access_token) {
    await setStoredAccessToken(session.access_token);
  }
  if (session.refresh_token) {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, session.refresh_token);
  }
  if (session.user) {
    await AsyncStorage.setItem(CURRENT_USER_KEY, JSON.stringify(session.user));
  }
}

export async function getStoredRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const raw = await AsyncStorage.getItem(CURRENT_USER_KEY);
  return raw ? (JSON.parse(raw) as CurrentUser) : null;
}

export async function clearStoredSession(): Promise<void> {
  await setStoredAccessToken(null);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  await AsyncStorage.removeItem(CURRENT_USER_KEY);
}

export interface UploadFileResult {
  ok: boolean;
  status: number;
  message?: string;
}

/**
 * Multipart file upload via raw XMLHttpRequest — deliberately NOT the typed
 * openapi-fetch client. This Expo SDK's global `fetch` (expo/fetch) has a
 * known, currently-unfixed bug uploading FormData on Android ("Unsupported
 * FormDataPart implementation" — https://github.com/expo/expo/issues/33134);
 * every JSON request is unaffected and keeps using createTypedClient as
 * normal. XHR predates that fetch reimplementation and has supported this
 * exact `{uri, name, type}` FormData shape in React Native for years.
 * Mirrors createTypedClient's own 401 -> sign-out behavior for consistency.
 */
export function uploadFile(
  path: string,
  fieldName: string,
  file: { uri: string; name: string; type: string },
): Promise<UploadFileResult> {
  return new Promise((resolve) => {
    (async () => {
      const token = await AsyncStorage.getItem(ACCESS_TOKEN_KEY);
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_BASE_URL}${path}`);
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }
      xhr.onload = () => {
        let message: string | undefined;
        try {
          message = xhr.responseText ? (JSON.parse(xhr.responseText) as { message?: string }).message : undefined;
        } catch {
          message = undefined;
        }
        if (xhr.status === 401) {
          void clearStoredSession();
          emitUnauthorized();
        }
        resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, message });
      };
      xhr.onerror = () => resolve({ ok: false, status: 0, message: 'Network error while uploading the file.' });
      const formData = new FormData();
      formData.append(fieldName, { uri: file.uri, name: file.name, type: file.type } as unknown as Blob);
      xhr.send(formData);
    })();
  });
}
