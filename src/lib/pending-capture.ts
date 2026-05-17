const KEY = "dpotopoto:pending-capture";

export function setPendingCapture(dataUrl: string) {
  try {
    sessionStorage.setItem(KEY, dataUrl);
  } catch {
    // sessionStorage may be unavailable (private mode, etc.) — silently ignore
  }
}

export function consumePendingCapture(): string | null {
  try {
    const v = sessionStorage.getItem(KEY);
    if (v) sessionStorage.removeItem(KEY);
    return v;
  } catch {
    return null;
  }
}

export async function dataUrlToFile(dataUrl: string, filename = `capture-${Date.now()}.jpg`): Promise<File> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], filename, { type: blob.type || "image/jpeg" });
}
