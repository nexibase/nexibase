export type UserDataPolicyKind =
  | 'retain'              // row kept; User is anonymized via join
  | 'retain-via-parent'   // row kept because its parent model is kept
  | 'delete'              // row deleted on withdrawal
  | 'custom'              // handler function handles it

export interface BaseWithdrawalEntry {
  model: string                     // Prisma model name as written in schema
  reason?: string                   // human-readable justification, surfaced in admin audit page
  field?: string                    // user-id column name (defaults to 'userId'); used for counting (retain) and deleting (delete)
}

export interface RetainEntry extends BaseWithdrawalEntry {
  policy: 'retain'
}

export interface RetainViaParentEntry extends BaseWithdrawalEntry {
  policy: 'retain-via-parent'
  parent: string                    // model name whose lifetime governs this one
}

export interface DeleteEntry extends BaseWithdrawalEntry {
  policy: 'delete'
}

export interface CustomEntry extends BaseWithdrawalEntry {
  policy: 'custom'
  handler: string                   // name of exported function from plugin's cleanup module
}

export type WithdrawalPolicyEntry =
  | RetainEntry
  | RetainViaParentEntry
  | DeleteEntry
  | CustomEntry

export interface PluginWithdrawalPolicy {
  plugin: string                    // plugin folder name, or 'core'
  entries: WithdrawalPolicyEntry[]
}
