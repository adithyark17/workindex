export function decodeCursor(value: string | null): number {
  if (!value) return 0;
  try {
    const parsed = Number(Buffer.from(value, "base64url").toString("utf8"));
    return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
  } catch { return 0; }
}

export function encodeCursor(offset: number) {
  return Buffer.from(String(offset), "utf8").toString("base64url");
}
