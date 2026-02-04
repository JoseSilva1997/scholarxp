import type { 
  CreateModulePayload,
  UpdateModulePayload,
  CreateModuleUnitMinimalPayload,
  UpdateModuleUnitStatusPayload,
  ModuleSummaryResponse as ModuleSummary,
  ModuleUnitResponse,
  ModuleUnitEditorResponse as ModuleUnitEditorDto
} from '@scholarxp/api-contracts';
import { apiFetch } from './client';

export async function listModules(): Promise<ModuleSummary[]> {
  return apiFetch<ModuleSummary[]>('/module', {
    method: 'GET',
  });
}

export async function getModuleById(id: number): Promise<ModuleSummary> {
  return apiFetch<ModuleSummary>(`/module/${id}`, {
    method: 'GET',
  });
}

export async function createModule(
  payload: CreateModulePayload,
): Promise<ModuleSummary> {
  return apiFetch<ModuleSummary>('/module', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateModule(
  id: number,
  payload: UpdateModulePayload,
): Promise<ModuleSummary> {
  return apiFetch<ModuleSummary>(`/module/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function createModuleUnit(moduleId: number, payload: CreateModuleUnitMinimalPayload): Promise<ModuleUnitResponse> {
  return apiFetch<ModuleUnitResponse>(`/module/${moduleId}/units`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateModuleUnitStatus(
  moduleUnitId: number,
  payload: UpdateModuleUnitStatusPayload,
): Promise<ModuleUnitResponse> {
  return apiFetch<ModuleUnitResponse>(`/module-unit/${moduleUnitId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function getModuleUnits(moduleId: number): Promise<ModuleUnitResponse[]> {
  return apiFetch<ModuleUnitResponse[]>(`/module/${moduleId}/units`, {
    method: 'GET',
  });
}

export async function getModuleUnitEditor(moduleId: number, moduleUnitId: number): Promise<ModuleUnitEditorDto> {
  return apiFetch<ModuleUnitEditorDto>(`/module/${moduleId}/unit/${moduleUnitId}/editor`, {
    method: 'GET',
  });
}
