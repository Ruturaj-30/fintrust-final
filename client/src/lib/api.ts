// Talks to the Express API. The browser never holds secrets or roles of its own:
// the server decides everything and returns only what this user may see.

export class ApiError extends Error {
  status: number;
  data: Record<string, unknown>;
  constructor(message: string, status: number, data: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export async function api<T = any>(path: string, opts: { method?: Method; body?: unknown } = {}): Promise<T> {
  const { method = 'GET', body } = opts;
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('Cannot reach the FinTrust server. Is it running (npm start)?', 0, {});
  }
  let data: any = {};
  try { data = await res.json(); } catch { data = {}; }
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/auth/')) {
      sessionStorage.setItem('ft_notice', data.error || 'Please sign in again.');
      window.location.href = '/';
    }
    // The server blocks everything until the person adds a profile photo.
    if (res.status === 403 && data.code === 'PHOTO_REQUIRED' && window.location.pathname !== '/app') window.location.href = '/app';
    throw new ApiError(data.error || `Request failed (${res.status}).`, res.status, data);
  }
  return data as T;
}

// ---- types returned by the API ----------------------------------------
export interface User {
  id: string;
  employee_id: string;
  full_name: string;
  email: string;
  role: string;
  status: 'invited' | 'active' | 'suspended' | 'disabled';
  department: string;
  branch_id: string;
  branch_name: string;
  branch_city?: string;
  designation: string;
  manager_id: string | null;
  manager_name: string;
  phone: string;
  is_locked: boolean;
  has_password: boolean;
  locked_until: string | null;
  last_login_at: string | null;
  password_changed_at: string | null;
  created_at: string;
  active_access?: number;
  signed_in_now?: boolean;
}

export interface Me {
  photoRequired: boolean;
  user: User;
  permissions: string[];
  nav: { id: string; label: string }[];
  organization: string;
  idleMinutes: number;
  demoMode: boolean;
  pendingApprovals: number;
}

export interface Meta {
  roles: { name: string; description: string }[];
  statuses: string[];
  departments: string[];
  branches: { id: string; name: string; city: string }[];
  applications: Application[];
}

export interface Application {
  id: string;
  name: string;
  description: string;
  owner_department: string;
  risk: 'low' | 'medium' | 'high' | 'critical';
  levels: string[];
  my_level?: string | null;
  my_pending?: string | null;
}

export interface AccessRequest {
  id: string;
  user_id: string;
  application_id: string;
  application_name: string;
  application_risk: string;
  access_level: string;
  justification: string;
  status: string;
  created_at: string;
  reviewed_at: string | null;
  reviewer_name: string;
  review_comment: string | null;
  user_name: string;
  user_employee_id: string;
  user_department: string;
  needs_admin: boolean;
  can_review?: boolean;
  review_block?: string;
}

export interface Grant {
  id: string;
  user_id: string;
  application_id: string;
  application_name: string;
  application_risk: string;
  access_level: string;
  status: string;
  granted_at: string;
  granted_by_name: string;
  revoke_reason: string | null;
  user_name: string;
  user_employee_id: string;
  user_department: string;
}

export interface AuditEntry {
  id: number;
  at: string;
  actor_name: string;
  actor_role: string;
  action: string;
  category: string;
  outcome: 'success' | 'failure' | 'denied';
  target_label: string | null;
  details: Record<string, unknown>;
  ip: string;
  hash: string;
}
