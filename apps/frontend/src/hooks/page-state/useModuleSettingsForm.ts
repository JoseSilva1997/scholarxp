// Encapsulates module-settings form state so panel rendering stays focused on layout and invite controls.
import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../../api/client';
import { useUpdateModuleMutation } from '../queries/useModulesQueries';
import type { ModuleSummary } from '../../types/module';
import { logError } from '../../utils/logger';

type UseModuleSettingsFormParams = {
  module: ModuleSummary | null;
  isOpen: boolean;
  onSaved: (updated: ModuleSummary) => void;
};

type UseModuleSettingsFormResult = {
  title: string;
  setTitle: (value: string) => void;
  description: string;
  setDescription: (value: string) => void;
  variantContext: string;
  setVariantContext: (value: string) => void;
  isSaving: boolean;
  error: string | null;
  status: string | null;
  handleSubmit: (event: React.FormEvent) => Promise<void>;
  handleReset: () => void;
};

export function useModuleSettingsForm({
  module,
  isOpen,
  onSaved,
}: UseModuleSettingsFormParams): UseModuleSettingsFormResult {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [variantContext, setVariantContext] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const updateModuleMutation = useUpdateModuleMutation(module?.id ?? null);

  useEffect(() => {
    if (!module) return;
    // Re-initialize form values when the panel opens or when module data gets refreshed externally.
    setTitle(module.title ?? '');
    setDescription(module.description ?? '');
    setVariantContext(module.variantContext ?? '');
    setError(null);
    setStatus(null);
  }, [module, isOpen]);

  const handleReset = useCallback(() => {
    if (!module) return;
    // Reset back to last persisted module snapshot instead of just clearing fields.
    setTitle(module.title ?? '');
    setDescription(module.description ?? '');
    setVariantContext(module.variantContext ?? '');
    setError(null);
    setStatus(null);
  }, [module]);

  const handleSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (!module || isSaving) return;

      const trimmedTitle = title.trim();
      if (!trimmedTitle) {
        setError('Title is required.');
        return;
      }

      const payload: {
        title: string;
        description?: string | null;
        variantContext?: string | null;
      } = { title: trimmedTitle };

      payload.description = description.trim() ? description.trim() : null;
      payload.variantContext = variantContext.trim() ? variantContext.trim() : null;

      setIsSaving(true);
      setError(null);
      setStatus(null);
      try {
        const updated = await updateModuleMutation.mutateAsync(payload);
        onSaved(updated);
        setStatus('Saved');
      } catch (err) {
        let message = 'Could not save module settings. Please try again.';
        if (err instanceof ApiError) {
          if (err.status === 401) {
            message = 'Your session expired. Please sign in again.';
          } else if (err.status === 403) {
            message = "You don't have permission to edit this module.";
          } else if (err.status === 400) {
            message = err.message;
          }
        }
        setError(message);
        logError(err, { feature: 'modules', action: 'update', moduleId: module.id });
      } finally {
        setIsSaving(false);
      }
    },
    [description, isSaving, module, onSaved, title, updateModuleMutation, variantContext],
  );

  return {
    title,
    setTitle,
    description,
    setDescription,
    variantContext,
    setVariantContext,
    isSaving,
    error,
    status,
    handleSubmit,
    handleReset,
  };
}
