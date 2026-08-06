// Saying what actually went wrong.
//
// "Can't reach the server" was the message for every failure, and it has
// hidden three unrelated bugs in this app already — a missing table, a
// malformed cookie, and a query the database refused. A crew standing in
// a dead zone and a developer looking at a broken query both deserve to
// be told which one they are.

export function describeError(cause: unknown): string {
  const error = cause as { message?: string; code?: string } | null;
  const message = error?.message ?? "";

  // supabase-js surfaces a genuine connectivity failure as a fetch error
  // with no database code attached.
  if (!message || (!error?.code && /fetch|network|load failed/i.test(message))) {
    return "Can't reach the server — check your signal.";
  }
  return `The server refused that request: ${message}`;
}
