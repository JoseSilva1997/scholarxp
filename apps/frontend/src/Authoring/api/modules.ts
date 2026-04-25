import type { 
  ClosePracticeSessionResponse,
  CreateModulePayload,
  UpdateModulePayload,
  CreateModuleUnitMinimalPayload,
  UpdateModuleUnitPayload,
  UpdateModuleUnitStatusPayload,
  CreateModuleUnitQuestionGroupPayload,
  UpdateModuleUnitQuestionGroupNamePayload,
  ModuleDeletionImpactResponse,
  ModuleSummaryResponse,
  ModuleUnitResponse,
  ModuleUnitEditorResponse,
  ModuleUnitGroupResponse,
  ModuleUnitPracticeRoomResponse,
  GetModuleUnitPracticeRoomQuery,
  SubmitAttemptPayload,
  SubmitAttemptResponse,
} from '@scholarxp/api-contracts';
import { apiFetch, getApiBaseUrl, getCsrfToken } from '@/shared/api/client';

export async function listModules(): Promise<ModuleSummaryResponse[]> {
  return apiFetch<ModuleSummaryResponse[]>('/module', {
    method: 'GET',
  });
}

export async function getModuleById(id: number): Promise<ModuleSummaryResponse> {
  return apiFetch<ModuleSummaryResponse>(`/module/${id}`, {
    method: 'GET',
  });
}

export async function getModuleDeletionImpact(
  id: number,
): Promise<ModuleDeletionImpactResponse> {
  return apiFetch<ModuleDeletionImpactResponse>(`/module/${id}/deletion-impact`, {
    method: 'GET',
  });
}

export async function createModule(
  payload: CreateModulePayload,
): Promise<ModuleSummaryResponse> {
  return apiFetch<ModuleSummaryResponse>('/module', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateModule(
  id: number,
  payload: UpdateModulePayload,
): Promise<ModuleSummaryResponse> {
  return apiFetch<ModuleSummaryResponse>(`/module/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function archiveModule(id: number): Promise<ModuleSummaryResponse> {
  return apiFetch<ModuleSummaryResponse>(`/module/${id}`, {
    method: 'DELETE',
  });
}

export async function createModuleUnit(moduleId: number, payload: CreateModuleUnitMinimalPayload): Promise<ModuleUnitResponse> {
  return apiFetch<ModuleUnitResponse>(`/module/${moduleId}/units`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateModuleUnit(
  moduleUnitId: number,
  payload: UpdateModuleUnitPayload,
): Promise<ModuleUnitResponse> {
  return apiFetch<ModuleUnitResponse>(`/module-unit/${moduleUnitId}`, {
    method: 'PATCH',
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

export async function getModuleUnitEditor(moduleId: number, moduleUnitId: number): Promise<ModuleUnitEditorResponse> {
  return apiFetch<ModuleUnitEditorResponse>(`/module/${moduleId}/unit/${moduleUnitId}/editor`, {
    method: 'GET',
  });
}

export async function getPracticeRoom(
  moduleId: number,
  moduleUnitId: number,
  query: GetModuleUnitPracticeRoomQuery = {},
): Promise<ModuleUnitPracticeRoomResponse> {
  const searchParams = new URLSearchParams();
  if (query.sessionId !== undefined) {
    // Session id in query lets reloads resume the same backend session instead of creating a new one.
    searchParams.set('sessionId', String(query.sessionId));
  }
  if (query.sessionType !== undefined) {
    // Session type is only used for fresh entry flows such as retry; resumed rooms use the persisted session id.
    searchParams.set('sessionType', query.sessionType);
  }
  const queryString = searchParams.toString();
  return apiFetch<ModuleUnitPracticeRoomResponse>(
    `/module/${moduleId}/unit/${moduleUnitId}/practice-room${
      queryString ? `?${queryString}` : ''
    }`,
    {
      method: 'GET',
    },
  );
}

export async function submitPracticeRoomAttempt(
  moduleId: number,
  moduleUnitId: number,
  payload: SubmitAttemptPayload,
): Promise<SubmitAttemptResponse> {
  return apiFetch<SubmitAttemptResponse>(
    `/module/${moduleId}/unit/${moduleUnitId}/practice-room/attempts`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );
}

export async function closePracticeRoomSession(
  moduleId: number,
  moduleUnitId: number,
  sessionId: string,
): Promise<ClosePracticeSessionResponse> {
  return apiFetch<ClosePracticeSessionResponse>(
    buildPracticeRoomSessionClosePath(moduleId, moduleUnitId, sessionId),
    {
      method: 'POST',
    },
  );
}

// Keepalive close is best-effort for unload/pagehide where async mutation completion is not guaranteed.
export function closePracticeRoomSessionKeepalive(
  moduleId: number,
  moduleUnitId: number,
  sessionId: string,
): boolean {
  const csrfToken = getCsrfToken();
  if (!csrfToken) {
    return false;
  }

  const url = `${getApiBaseUrl()}${buildPracticeRoomSessionClosePath(moduleId, moduleUnitId, sessionId)}`;
  void fetch(url, {
    method: 'POST',
    credentials: 'include',
    keepalive: true,
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': csrfToken,
    },
  });
  return true;
}

export async function createModuleUnitQuestionGroup(
  moduleId: number,
  moduleUnitId: number,
  payload: CreateModuleUnitQuestionGroupPayload,
) {
  return apiFetch<ModuleUnitGroupResponse>(`/module/${moduleId}/unit/${moduleUnitId}/question-groups`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function deleteModuleUnitQuestionGroup(
  moduleId: number,
  moduleUnitId: number,
  questionGroupId: number,
) {
  return apiFetch<void>(
    `/module/${moduleId}/unit/${moduleUnitId}/question-groups/${questionGroupId}`,
    {
      method: 'DELETE',
    },
  );
}

export async function updateModuleUnitQuestionGroupName(
  moduleId: number,
  moduleUnitId: number,
  questionGroupId: number,
  payload: UpdateModuleUnitQuestionGroupNamePayload,
) {
  return apiFetch<ModuleUnitGroupResponse>(
    `/module/${moduleId}/unit/${moduleUnitId}/question-groups/${questionGroupId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
  );
}

function buildPracticeRoomSessionClosePath(
  moduleId: number,
  moduleUnitId: number,
  sessionId: string,
) {
  return `/module/${moduleId}/unit/${moduleUnitId}/practice-room/session/${sessionId}/close`;
}
