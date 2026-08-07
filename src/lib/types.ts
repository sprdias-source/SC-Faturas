export type AccountType = 'despesa' | 'receita'

export interface Account {
  id: string
  household_id: string
  name: string
  type: AccountType
  parent_id: string | null
  color: string
  created_at: string
}

export type EntryKind = 'previsto' | 'importado'
export type EntryStatus = 'pendente' | 'classificado' | 'confirmado'

export interface EntrySplit {
  id: string
  entry_id: string
  account_id: string
  percent: number
  amount: number
}

export interface Entry {
  id: string
  household_id: string
  kind: EntryKind
  date: string
  description: string
  amount: number
  type: AccountType
  status: EntryStatus
  source_import_id: string | null
  matched_entry_id: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface Import {
  id: string
  household_id: string
  filename: string
  file_type: 'pdf' | 'ofx'
  card_or_bank_label: string | null
  due_date: string | null
  total_amount: number | null
  entries_count: number
  storage_path: string | null
  imported_by: string
  created_at: string
}

export interface HouseholdMember {
  household_id: string
  user_id: string
  display_name: string
  avatar_color: string
  joined_at: string
}

export interface NotificationSettings {
  user_id: string
  household_id: string
  notify_visual: boolean
  notify_sound: boolean
  notify_only_new: boolean
  updated_at: string
}

export interface ActivityLogRow {
  id: string
  household_id: string
  user_id: string
  action: string
  detail: string | null
  created_at: string
}
