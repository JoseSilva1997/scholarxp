// API helpers for module invites: keep link creation/redeem calls centralized so UI stays lean.
import type { 
  CreateInvitePayload, 
  UpdateInvitePayload, 
  RedeemInviteResponse, 
  CreateModuleInviteResponse,
  ModuleInviteResponse
} from '@scholarxp/api-contracts';
import { apiFetch } from '@/shared/api/client';

// Creates a module invitation link with expiry and usage constraints supplied by the tutor.
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

// Lists active and historical invites for the module invite-management panel.
export async function listModuleInvites(moduleId: number): Promise<ModuleInviteResponse[]> {
  // Listing stays scoped to a module so invite reads use the same authorization path as writes.
  return apiFetch<ModuleInviteResponse[]>(`/modules/${moduleId}/invites`, {
    method: 'GET',
  });
}

// Updates mutable invite controls such as revocation and limits without changing the token.
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

// Removes or revokes an invite through the backend so future redemptions are blocked.
export async function deleteModuleInvite(
  moduleId: number,
  inviteId: number,
): Promise<ModuleInviteResponse> {
  // Delete lets instructors clean up old links; backend returns sanitized invite for audit UI if needed.
  return apiFetch<ModuleInviteResponse>(`/modules/${moduleId}/invites/${inviteId}`, {
    method: 'DELETE',
  });
}

// Redeems a student invite token and returns the enrollment outcome for route-level feedback.
export async function redeemInvite(token: string): Promise<RedeemInviteResponse> {
  // Student join endpoint; keeps token client-side while backend hashes for lookup.
  return apiFetch<RedeemInviteResponse>('/invites/redeem', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
}
