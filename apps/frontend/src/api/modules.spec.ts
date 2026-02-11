// Verifies modules API helpers call apiFetch with the correct endpoint and payload contracts.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createModule,
  createModuleUnit,
  getModuleById,
  getModuleUnitEditor,
  getModuleUnits,
  listModules,
  updateModule,
  updateModuleUnitStatus,
  createModuleUnitQuestionGroup,
  deleteModuleUnitQuestionGroup,
  submitPracticeRoomAttempt,
  updateModuleUnitQuestionGroupName,
} from './modules';

const clientMocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
}));

vi.mock('./client', () => ({
  apiFetch: clientMocks.apiFetch,
}));

describe('modules api', () => {
  beforeEach(() => {
    clientMocks.apiFetch.mockReset();
    clientMocks.apiFetch.mockResolvedValue(undefined);
  });

  it('lists modules with GET /module', async () => {
    await listModules();

    expect(clientMocks.apiFetch).toHaveBeenCalledWith('/module', {
      method: 'GET',
    });
  });

  it('gets module detail with GET /module/:id', async () => {
    await getModuleById(42);

    expect(clientMocks.apiFetch).toHaveBeenCalledWith('/module/42', {
      method: 'GET',
    });
  });

  it('creates module with POST /module and json body', async () => {
    const payload = {
      title: 'New Module',
      description: 'intro',
    };

    await createModule(payload);

    expect(clientMocks.apiFetch).toHaveBeenCalledWith('/module', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  });

  it('updates module with PATCH /module/:id and json body', async () => {
    const payload = {
      title: 'Renamed Module',
    };

    await updateModule(9, payload);

    expect(clientMocks.apiFetch).toHaveBeenCalledWith('/module/9', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  });

  it('creates module unit with POST /module/:id/units', async () => {
    const payload = {
      title: 'Unit A',
    };

    await createModuleUnit(11, payload);

    expect(clientMocks.apiFetch).toHaveBeenCalledWith('/module/11/units', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  });

  it('updates unit status with PATCH /module-unit/:id', async () => {
    const payload = {
      status: 'live' as const,
    };

    await updateModuleUnitStatus(77, payload);

    expect(clientMocks.apiFetch).toHaveBeenCalledWith('/module-unit/77', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  });

  it('gets module units with GET /module/:id/units', async () => {
    await getModuleUnits(3);

    expect(clientMocks.apiFetch).toHaveBeenCalledWith('/module/3/units', {
      method: 'GET',
    });
  });

  it('gets module unit editor data with GET /module/:moduleId/unit/:unitId/editor', async () => {
    await getModuleUnitEditor(4, 99);

    expect(clientMocks.apiFetch).toHaveBeenCalledWith('/module/4/unit/99/editor', {
      method: 'GET',
    });
  });

  it('creates question group with POST /module/:moduleId/unit/:unitId/question-groups', async () => {
    const payload = {
      moduleUnitId: 99,
      name: 'Group 1',
      sortOrder: 1,
    };

    await createModuleUnitQuestionGroup(4, 99, payload);

    expect(clientMocks.apiFetch).toHaveBeenCalledWith('/module/4/unit/99/question-groups', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  });

  it('deletes question group with DELETE /module/:moduleId/unit/:unitId/question-groups/:groupId', async () => {
    await deleteModuleUnitQuestionGroup(4, 99, 15);

    expect(clientMocks.apiFetch).toHaveBeenCalledWith('/module/4/unit/99/question-groups/15', {
      method: 'DELETE',
    });
  });

  it('updates question group name with PATCH /module/:moduleId/unit/:unitId/question-groups/:groupId', async () => {
    const payload = {
      name: 'Renamed Group',
    };

    await updateModuleUnitQuestionGroupName(4, 99, 15, payload);

    expect(clientMocks.apiFetch).toHaveBeenCalledWith('/module/4/unit/99/question-groups/15', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  });

  it('submits practice-room attempt with POST /module/:moduleId/unit/:unitId/practice-room/attempts', async () => {
    const payload = {
      moduleUnitId: 99,
      questionUnitId: 200,
      questionContentId: 300,
      sessionId: 55,
      practiceMode: 'PRACTICE_ROOM',
      timeTakenMs: 4200,
      hintUnlocked: true,
      studentAnswer: { selectedOptionIndex: 1 },
    } as const;

    await submitPracticeRoomAttempt(4, 99, payload);

    expect(clientMocks.apiFetch).toHaveBeenCalledWith(
      '/module/4/unit/99/practice-room/attempts',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    );
  });
});
