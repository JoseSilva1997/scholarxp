// Module API helpers: fetch modules and module details with session cookies included.
import { apiFetch } from './client';
import type { ModuleSummary } from '../types/module';

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
