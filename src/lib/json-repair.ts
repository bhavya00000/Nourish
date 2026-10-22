// Recovering usable JSON from AI replies that were cut off.

/**
 * A reply cut off mid-way — `{"items":[{…},{"name":"da` — still holds every
 * item before the cut. Keep up to the last complete object or array and close
 * whatever was left open. Returns null when nothing complete survives.
 */
export function closeTruncatedJson(text: string): string | null {
  const stack: string[] = [];
  let inString = false;
  let escaped = false;
  let cut = -1;
  let openAtCut: string[] = [];

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{" || ch === "[") stack.push(ch === "{" ? "}" : "]");
    else if (ch === "}" || ch === "]") {
      if (stack.pop() !== ch) return null;
      if (!stack.length) return text.slice(0, i + 1);
      cut = i + 1;
      openAtCut = [...stack];
    }
  }

  if (cut === -1) return null;
  const candidate = text.slice(0, cut) + openAtCut.reverse().join("");
  try {
    JSON.parse(candidate);
    return candidate;
  } catch {
    return null;
  }
}
