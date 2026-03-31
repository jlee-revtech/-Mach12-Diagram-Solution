export interface Profile {
  id: string
  organization_id: string | null
  email: string
  display_name: string | null
  role: 'admin' | 'member'
  created_at: string
}

export interface Organization {
  id: string
  name: string
  slug: string
  created_at: string
}

export interface DiagramRow {
  id: string
  organization_id: string
  title: string
  description: string | null
  process_context: string | null
  canvas_data: { nodes: unknown[]; edges: unknown[] }
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export interface DiagramPermission {
  id: string
  diagram_id: string
  user_id: string
  permission: 'viewer' | 'editor' | 'owner'
  granted_by: string | null
  created_at: string
}

export interface OrgInvite {
  id: string
  organization_id: string
  code: string
  created_by: string | null
  expires_at: string | null
  created_at: string
}

export interface OrgMember {
  id: string
  user_id: string
  organization_id: string
  role: 'admin' | 'member'
  created_at: string
}

export interface OrgWithRole extends Organization {
  role: 'admin' | 'member'
}
