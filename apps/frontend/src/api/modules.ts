// Module API helpers: fetch modules and module details with session cookies included.
import { apiFetch } from './client';
import type {
  ModuleSummary,
  ModuleUnitEditorDto,
  ModuleUnitResponse,
  ModuleUnitStatus,
} from '../types/module';

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
  payload: Pick<ModuleSummary, 'title' | 'variantContext' | 'description' | 'institutionId'>,
): Promise<ModuleSummary> {
  return apiFetch<ModuleSummary>('/module', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateModule(
  id: number,
  payload: Partial<
    Pick<ModuleSummary, 'title' | 'variantContext' | 'description' | 'institutionId'>
  >,
): Promise<ModuleSummary> {
  return apiFetch<ModuleSummary>(`/module/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function createModuleUnit(moduleId: number, title: string): Promise<ModuleUnitResponse> {
  return apiFetch<ModuleUnitResponse>(`/module/${moduleId}/units`, {
    method: 'POST',
    body: JSON.stringify({ title }),
  });
}

export async function updateModuleUnitStatus(
  moduleUnitId: number,
  status: ModuleUnitStatus,
): Promise<ModuleUnitResponse> {
  return apiFetch<ModuleUnitResponse>(`/module-unit/${moduleUnitId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
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
