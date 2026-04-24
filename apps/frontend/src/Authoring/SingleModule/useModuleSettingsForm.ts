// Manages the state and interactions for the module settings form.
// The hook keeps all validation, side-effects, and mutation logic out of the
// panel component so the UI can remain focused on layout and presentation.
import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '@/shared/api/client';
import { useUpdateModuleMutation } from '@/Authoring/queries/useModulesQueries';
import type { ModuleSummary } from '@/shared/types/module';
import { logError } from '@/utils/logger';

// values passed from the parent panel. `isOpen` drives when to re-init the
// form; `onSaved` is a callback invoked after a successful update.
type UseModuleSettingsFormParams = {
  module: ModuleSummary | null;
  isOpen: boolean;
  onSaved: (updated: ModuleSummary) => void;
};

// The public API the panel consumes. It gives controlled input state,
// indicators, and handlers so the component doesn't need to replicate logic.
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
  // internal form fields and UI flags. We reset these when the module data
  // changes so the form always reflects the latest persisted state.
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [variantContext, setVariantContext] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  // mutation hook tied to the current module; passing null disables it.
  const updateModuleMutation = useUpdateModuleMutation(module?.id ?? null);

  // whenever we get a fresh module or the panel re-opens, we reset the
  // inputs to match the saved record. this keeps the form in sync with
  // external updates (e.g. another user edited the module).
  useEffect(() => {
    if (!module) return;
    // Re-initialize form values when the panel opens or when module data gets refreshed externally.
    setTitle(module.title ?? '');
    setDescription(module.description ?? '');
    setVariantContext(module.variantContext ?? '');
    setError(null);
    setStatus(null);
  }, [module, isOpen]);

  // user hit the "reset" button. Rather than wiping the inputs, we
  // restore them to the last known saved values so accidental clears are
  // easy to undo.
  const handleReset = useCallback(() => {
    if (!module) return;
    // Reset back to last persisted module snapshot instead of just clearing fields.
    setTitle(module.title ?? '');
    setDescription(module.description ?? '');
    setVariantContext(module.variantContext ?? '');
    setError(null);
    setStatus(null);
  }, [module]);

  // form submission drives the update mutation. validation is simple and
  // performed client-side to keep the panel responsive. errors from the
  // server are translated into user-friendly messages and logged.
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
