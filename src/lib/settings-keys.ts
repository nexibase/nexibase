/** Retired settings cannot be read back into an old admin form or saved again. */
export function isRetiredSetting(key: string): boolean {
  return key.startsWith('consent_')
}
