// Verifies module-settings form orchestration so save/reset and error mapping behavior is stable.
import { act, renderHook } from '@testing-library/react';
import type { FormEvent } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../api/client';
import { useModuleSettingsForm } from './useModuleSettingsForm';

const mocks = vi.hoisted(() => ({
  updateMutateAsync: vi.fn(),
  logError: vi.fn(),
}));

vi.mock('../../utils/logger', () => ({
  logError: mocks.logError,
}));

vi.mock('../queries/useModulesQueries', () => ({
  useUpdateModuleMutation: () => ({
    mutateAsync: mocks.updateMutateAsync,
  }),
}));

describe('useModuleSettingsForm', () => {
  const module = {
    id: 10,
    title: 'Module A',
    description: 'Original description',
    variantContext: 'course-1',
  };

  beforeEach(() => {
    mocks.updateMutateAsync.mockReset();
    mocks.logError.mockReset();
  });

  it('initializes from module and resets back to persisted values', () => {
    const onSaved = vi.fn();
    const { result } = renderHook(() =>
      useModuleSettingsForm({ module, isOpen: true, onSaved }),
    );

    expect(result.current.title).toBe('Module A');

    act(() => {
      result.current.setTitle('Changed');
      result.current.setDescription('Changed desc');
      result.current.handleReset();
    });

    expect(result.current.title).toBe('Module A');
    expect(result.current.description).toBe('Original description');
  });

  it('requires non-empty title before submit', async () => {
    const onSaved = vi.fn();
    const { result } = renderHook(() =>
      useModuleSettingsForm({ module, isOpen: true, onSaved }),
    );

    act(() => {
      result.current.setTitle('   ');
    });

    await act(async () => {
      await result.current.handleSubmit({ preventDefault: vi.fn() } as unknown as FormEvent);
    });

    expect(result.current.error).toBe('Title is required.');
    expect(mocks.updateMutateAsync).not.toHaveBeenCalled();
  });

  it('submits trimmed payload, calls onSaved, and marks status as saved', async () => {
    const onSaved = vi.fn();
    const updated = {
      id: 10,
      title: 'New Title',
      description: null,
      variantContext: null,
    };
    mocks.updateMutateAsync.mockResolvedValue(updated);

    const { result } = renderHook(() =>
      useModuleSettingsForm({ module, isOpen: true, onSaved }),
    );

    act(() => {
      result.current.setTitle('  New Title  ');
      result.current.setDescription('   ');
      result.current.setVariantContext('   ');
    });

    await act(async () => {
      await result.current.handleSubmit({ preventDefault: vi.fn() } as unknown as FormEvent);
    });

    expect(mocks.updateMutateAsync).toHaveBeenCalledWith({
      title: 'New Title',
      description: null,
      variantContext: null,
    });
    expect(onSaved).toHaveBeenCalledWith(updated);
    expect(result.current.status).toBe('Saved');
    expect(result.current.isSaving).toBe(false);
  });

  it('maps ApiError status to safe user message and logs details', async () => {
    const onSaved = vi.fn();
    const error = new ApiError({
      message: 'Forbidden',
      status: 403,
      code: 'FORBIDDEN',
      data: {},
    });
    mocks.updateMutateAsync.mockRejectedValue(error);

    const { result } = renderHook(() =>
      useModuleSettingsForm({ module, isOpen: true, onSaved }),
    );

    await act(async () => {
      await result.current.handleSubmit({ preventDefault: vi.fn() } as unknown as FormEvent);
    });

    expect(result.current.error).toBe("You don't have permission to edit this module.");
    expect(mocks.logError).toHaveBeenCalledWith(error, {
      feature: 'modules',
      action: 'update',
      moduleId: 10,
    });
    expect(result.current.isSaving).toBe(false);
  });
});
