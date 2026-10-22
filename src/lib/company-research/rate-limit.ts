/** Best-effort instance-local prototype protection; not a durable distributed quota. */
const windows = new Map<string, { count: number; resetAt: number }>();
export function checkCompanyResearchLimit(key: string, now = Date.now()) {
  for (const [id, entry] of windows) if (entry.resetAt <= now) windows.delete(id);
  const entry = windows.get(key);
  if (!entry && windows.size >= 1000) return { allowed: false, retryAfter: 300 };
  const current = entry ?? { count: 0, resetAt: now + 300_000 };
  current.count++;
  windows.set(key, current);
  return { allowed: current.count <= 3, retryAfter: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) };
}
