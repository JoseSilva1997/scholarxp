// Authoring module API client: centralizes module, unit, group, and practice-room HTTP calls for tutor workflows.
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

// Lists modules visible to the current user; API authorization determines tutor/student scope.
export async function listModules(): Promise<ModuleSummaryResponse[]> {
  return apiFetch<ModuleSummaryResponse[]>('/module', {
    method: 'GET',
  });
}

// Fetches a single module summary for detail-page rendering and settings edits.
export async function getModuleById(id: number): Promise<ModuleSummaryResponse> {
  return apiFetch<ModuleSummaryResponse>(`/module/${id}`, {
    method: 'GET',
  });
}

// Reads archive/deletion impact before a tutor confirms a potentially destructive module action.
export async function getModuleDeletionImpact(
  id: number,
): Promise<ModuleDeletionImpactResponse> {
  return apiFetch<ModuleDeletionImpactResponse>(`/module/${id}/deletion-impact`, {
    method: 'GET',
  });
}

// Creates a tutor-owned module from the modal form payload.
export async function createModule(
  payload: CreateModulePayload,
): Promise<ModuleSummaryResponse> {
  return apiFetch<ModuleSummaryResponse>('/module', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// Updates module metadata while preserving server-owned fields in the returned summary.
export async function updateModule(
  id: number,
  payload: UpdateModulePayload,
): Promise<ModuleSummaryResponse> {
  return apiFetch<ModuleSummaryResponse>(`/module/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

// Archives a module through the delete endpoint; the backend owns the soft-delete semantics.
export async function archiveModule(id: number): Promise<ModuleSummaryResponse> {
  return apiFetch<ModuleSummaryResponse>(`/module/${id}`, {
    method: 'DELETE',
  });
}

// Creates a minimal lesson/unit shell that tutors can later populate in the unit editor.
export async function createModuleUnit(moduleId: number, payload: CreateModuleUnitMinimalPayload): Promise<ModuleUnitResponse> {
  return apiFetch<ModuleUnitResponse>(`/module/${moduleId}/units`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// Updates unit metadata such as title without changing publication status.
export async function updateModuleUnit(
  moduleUnitId: number,
  payload: UpdateModuleUnitPayload,
): Promise<ModuleUnitResponse> {
  return apiFetch<ModuleUnitResponse>(`/module-unit/${moduleUnitId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

// Changes a unit's lifecycle status while relying on backend validation for publish constraints.
export async function updateModuleUnitStatus(
  moduleUnitId: number,
  payload: UpdateModuleUnitStatusPayload,
): Promise<ModuleUnitResponse> {
  return apiFetch<ModuleUnitResponse>(`/module-unit/${moduleUnitId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

// Loads all units for the module detail page and editor navigation.
export async function getModuleUnits(moduleId: number): Promise<ModuleUnitResponse[]> {
  return apiFetch<ModuleUnitResponse[]>(`/module/${moduleId}/units`, {
    method: 'GET',
  });
}

// Fetches the full nested editor model for a unit, including groups, questions, and variants.
export async function getModuleUnitEditor(moduleId: number, moduleUnitId: number): Promise<ModuleUnitEditorResponse> {
  return apiFetch<ModuleUnitEditorResponse>(`/module/${moduleId}/unit/${moduleUnitId}/editor`, {
    method: 'GET',
  });
}

// Opens or resumes a practice-room session for a module unit based on optional session routing data.
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

// Submits a learner answer attempt and returns the backend-scored result.
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

// Explicitly closes an active practice-room session when normal async requests can complete.
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

// Sends a best-effort close request during unload/pagehide where async mutation completion is not guaranteed.
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

// Creates a question group inside a unit editor; groups structure questions for tutor authoring.
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

// Deletes a persisted question group; local drafts are handled by editor state instead.
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

// Renames a question group while keeping the module/unit route scope explicit.
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

// Builds the shared close-session path so normal and keepalive flows cannot drift apart.
function buildPracticeRoomSessionClosePath(
  moduleId: number,
  moduleUnitId: number,
  sessionId: string,
) {
  return `/module/${moduleId}/unit/${moduleUnitId}/practice-room/session/${sessionId}/close`;
}
