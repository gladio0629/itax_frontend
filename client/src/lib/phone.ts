/** "901234567" → "90 123 45 67" as the user types; the +998 prefix is shown
 * beside the field. Formatting only — the adapter validates the number. */
export function formatPhoneInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 9);
  const parts = [digits.slice(0, 2), digits.slice(2, 5), digits.slice(5, 7), digits.slice(7, 9)];
  return parts.filter(Boolean).join(" ");
}
