/**
 * Minimal pub/sub bridging the API client (a plain module, outside React)
 * to AuthContext (the only place session state actually lives). The client
 * emits when any authenticated request comes back 401 (expired/invalid
 * token); AuthContext subscribes once and signs the user out, which flips
 * RootNavigator over to AuthNavigator — landing on Login automatically for
 * every role, since role-based routing itself is driven off `user` being
 * null, not a per-screen check.
 */
type Listener = () => void;

const listeners = new Set<Listener>();

export function onUnauthorized(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitUnauthorized(): void {
  for (const listener of listeners) {
    listener();
  }
}
