/**
 * Converts a keyboard event into the canonical combo string used by the Rust
 * HotkeyManager (e.g. "Control+Shift+1", "Space", "F10").
 * Returns null for pure modifier presses.
 */
export function comboFromEvent(e: KeyboardEvent | React.KeyboardEvent): string | null {
  const key = e.key;
  if (["Control", "Shift", "Alt", "Meta"].includes(key)) return null;

  const parts: string[] = [];
  if (e.ctrlKey) parts.push("Control");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");
  if (e.metaKey) parts.push("Meta");

  let name = key;
  if (key === " ") name = "Space";
  else if (key.length === 1) name = key.toUpperCase();
  parts.push(name);
  return parts.join("+");
}
