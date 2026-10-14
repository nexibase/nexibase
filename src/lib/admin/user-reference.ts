/** Numeric database IDs and public UUIDs identify the same User record. */
export function userReferenceWhere(reference: string): { id: number } | { uuid: string } | null {
  if (/^[1-9]\d*$/.test(reference)) {
    const id = Number(reference)
    return Number.isSafeInteger(id) && id <= 2147483647 ? { id } : null
  }
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(reference)) {
    return { uuid: reference.toLowerCase() }
  }
  return null
}
