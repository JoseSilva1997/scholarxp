// API helpers for module invites: keep link creation/redeem calls centralized so UI stays lean.
import type { 
  CreateInvitePayload, 
  UpdateInvitePayload, 
  RedeemInviteResponse, 
  CreateModuleInviteResponse,
  ModuleInviteResponse
} from '@scholarxp/api-contracts';
import { apiFetch } from '@/shared/api/client';

export async function createModuleInvite(
  moduleId: number,
  payload: CreateInvitePayload,
): Promise<CreateModuleInviteResponse> {
  // Centralizes module-scoped invite creation so we always hit the same route shape.
  return apiFetch<CreateModuleInviteResponse>(`/modules/${moduleId}/invites`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function listModuleInvites(moduleId: number): Promise<ModuleInviteResponse[]> {
  // Listing stays scoped to a module to respect backend gating for institution-less modules.
  return apiFetch<ModuleInviteResponse[]>(`/modules/${moduleId}/invites`, {
    method: 'GET',
  });
}

export async function updateModuleInvite(
  moduleId: number,
  inviteId: number,
  payload: UpdateInvitePayload,
): Promise<ModuleInviteResponse> {
  // Patch allows toggling revoke/expiry/usage caps without rebuilding the invite.
  return apiFetch<ModuleInviteResponse>(`/modules/${moduleId}/invites/${inviteId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteModuleInvite(
  moduleId: number,
  inviteId: number,
): Promise<ModuleInviteResponse> {
  // Delete lets instructors clean up old links; backend returns sanitized invite for audit UI if needed.
  return apiFetch<ModuleInviteResponse>(`/modules/${moduleId}/invites/${inviteId}`, {
    method: 'DELETE',
  });
}

export async function redeemInvite(token: string): Promise<RedeemInviteResponse> {
  // Student join endpoint; keeps token client-side while backend hashes for lookup.
  return apiFetch<RedeemInviteResponse>('/invites/redeem', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
}
