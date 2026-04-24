// Module unit authoring workspace UI that renders editor state from the page-state hook.
import { useState, useRef, useEffect } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import {
  FiArchive,
  FiCheck,
  FiEdit2,
  FiTrash2,
  FiX,
  FiSettings,
  FiInfo,
} from 'react-icons/fi';
import { VscSparkleFilled } from 'react-icons/vsc';
import {
  FaCirclePlus,
  FaCircleChevronLeft,
  FaCircleChevronRight,
} from 'react-icons/fa6';
import { IconContext } from 'react-icons';
import MainSection from '@/MainApp/MainSection/MainSection';
import {
  QUESTION_TYPE_CONFIGS,
  type QuestionTypeConfig,
  normalizeQuestionType,
} from '@/Authoring/ModuleUnitEditor/components/question-types/QuestionTypeRegistry';
import { useModuleUnitEditorPageState } from '@/Authoring/ModuleUnitEditor/page-state/useModuleUnitEditorPageState';
import ConfirmDeleteModal from '@/Authoring/ModuleUnitEditor/components/ConfirmDeleteModal';
import VariantSettingsModal from '@/Authoring/ModuleUnitEditor/VariantSettingsModal';
import QuestionStructureGuide from '@/Authoring/ModuleUnitEditor/components/QuestionStructureGuide';
import styles from '@/Authoring/ModuleUnitEditor/ModuleUnitEditor.module.css';

export default function ModuleUnitEditor() {
  const { moduleId, unitId } = useParams<{ moduleId: string; unitId: string }>();
  const [searchParams] = useSearchParams();
  const initialQuestionIdParam = searchParams.get('questionId') ?? undefined;
  const {
    parsedModuleId,
    parsedUnitId,
    isLoading,
    error,
    unitTitle,
    variantInstructions,
    setVariantInstructions,
    groups,
    expandedGroups,
    selected,
    setSelected,
    form,
    setForm,
    selectedQuestion,
    canGoPrev,
    canGoNext,
    activeLabel,
    deleteTarget,
    setDeleteTarget,
    deleteCopy,
    isDeleting,
    deleteError,
    setDeleteError,
    isUnitLive,
    saveError,
    isSavingQuestion,
    isSavingVariant,
    isSavingVariantInstructions,
    editingGroupId,
    editingGroupTitle,
    setEditingGroupTitle,
    renamingGroupId,
    editingGroupInputRef,
    formatQuestionLabel,
    formatVariantLabel,
    isQuestionSaved,
    canAddVariant,
    handleNavigate,
    handleToggleGroup,
    handleAddGroup,
    handleAddQuestion,
    handleAddVariant,
    startEditingGroupTitle,
    cancelEditingGroupTitle,
    saveEditingGroupTitle,
    handleOptionChange,
    handleExplanationChange,
    handleDeleteOption,
    setCorrectOption,
    handleTypeChange,
    handleSaveQuestion,
    handleSaveVariantInstructions,
    handleConfirmDelete,
  } = useModuleUnitEditorPageState({
    moduleIdParam: moduleId,
    unitIdParam: unitId,
    initialQuestionIdParam,
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [hintPopoverOpen, setHintPopoverOpen] = useState(false);
  const hintPopoverRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!hintPopoverOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (hintPopoverRef.current && !hintPopoverRef.current.contains(e.target as Node)) {
        setHintPopoverOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [hintPopoverOpen]);
  const activeQuestionType = normalizeQuestionType(form.type);

  const handleGenerateVariant = () => {
    // Generation flow is intentionally stubbed while API/UX contracts are finalized.
    alert('Coming Soon! 😎');
  };

  if (!parsedUnitId || !parsedModuleId) {
    return (
      <MainSection className={styles.page}>
        <div className={styles.topBar}>
          <Link className={styles.backLink} to={`/main/modules/${moduleId}`}>
            ← Back to module
          </Link>
        </div>
        <div className={styles.statusCard} role="alert">
          Module unit not found.
        </div>
      </MainSection>
    );
  }

  return (
    <MainSection className={styles.page}>
      <div className={styles.topBar}>
        <Link className={styles.backLink} to={`/main/modules/${moduleId}`}>
          ← {unitTitle || 'Back to module'}
        </Link>
      </div>
      {isLoading ? (
        <div className={styles.statusCard}>Loading module unit…</div>
      ) : error ? (
        <div className={styles.statusCard} role="alert">
          {error}
        </div>
      ) : (
        <>
          <div className={styles.grid}>
            <aside className={styles.leftColumn}>
              <div className={styles.sectionHeader}>
                <h2>Questions</h2>
                <div className={styles.sectionHeaderActions}>
                  <QuestionStructureGuide />
                  <button
                    type="button"
                    className={styles.iconButton}
                    aria-label="Variant generation settings"
                    onClick={() => setIsSettingsOpen(true)}
                  >
                    <FiSettings aria-hidden />
                  </button>
                </div>
              </div>

              <div className={styles.navigationScrollArea}>
                {groups.map((group) => (

                  <div key={group.id} className={styles.groupCard}>
                    <div className={styles.groupHeader}>
                      <div
                        role="button"
                        tabIndex={0}
                        aria-expanded={expandedGroups.has(group.id)}
                        className={styles.groupToggle}
                        onClick={() => {
                          if (editingGroupId === group.id) return;
                          handleToggleGroup(group.id);
                        }}
                        onKeyDown={(e) => {
                          if (editingGroupId === group.id) return;
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleToggleGroup(group.id);
                          }
                        }}
                      >
                        {editingGroupId === group.id ? (
                          <div
                            className={styles.groupTitleEditRow}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="text"
                              ref={editingGroupInputRef}
                              required
                              value={editingGroupTitle}
                              onChange={(e) => {
                                setEditingGroupTitle(e.target.value);
                                e.currentTarget.setCustomValidity('');
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  void saveEditingGroupTitle(group.id);
                                }
                                if (e.key === 'Escape') {
                                  e.preventDefault();
                                  cancelEditingGroupTitle();
                                }
                              }}
                              className={styles.groupTitleInput}
                              autoFocus
                            />
                            <div className={styles.groupEditControls}>
                              <button
                                type="button"
                                className={styles.iconButton}
                                aria-label={`Save group name ${group.title}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void saveEditingGroupTitle(group.id);
                                }}
                                disabled={
                                  !editingGroupTitle.trim() || renamingGroupId === group.id
                                }
                              >
                                <FiCheck aria-hidden />
                              </button>
                              <button
                                type="button"
                                className={styles.iconButton}
                                aria-label={`Cancel renaming ${group.title}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  cancelEditingGroupTitle();
                                }}
                                disabled={renamingGroupId === group.id}
                              >
                                <FiX aria-hidden />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className={styles.groupTitleRow}>
                            <h3>{group.title}</h3>
                            <button
                              type="button"
                              className={styles.iconButton}
                              aria-label={`Rename group ${group.title}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                startEditingGroupTitle(group.id, group.title);
                              }}
                              disabled={renamingGroupId === group.id}
                            >
                              <FiEdit2 aria-hidden />
                            </button>
                          </div>
                        )}
                        <div className={styles.groupHeaderActions}>
                          <button
                            type="button"
                            className={styles.iconButton}
                            aria-label={`${isUnitLive ? 'Archive' : 'Delete'} group ${group.title}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (editingGroupId === group.id) {
                                cancelEditingGroupTitle();
                              }
                              setDeleteTarget({
                                type: 'group',
                                groupId: group.id,
                                title: group.title,
                              });
                            }}
                          >
                            {isUnitLive ? <FiArchive aria-hidden /> : <FiTrash2 aria-hidden />}
                          </button>
                          <span className={styles.expandIcon}>
                            {expandedGroups.has(group.id) ? '▼' : '▶'}
                          </span>
                        </div>
                      </div>
                    </div>
                    {expandedGroups.has(group.id) && (
                      <div className={styles.questionList}>
                        {group.questions.map((question, questionIndex) => {
                          const isSelected =
                            selected?.groupId === group.id &&
                            selected?.questionId === question.id;
                          const isVariantSelected = Boolean(
                            isSelected && selected?.variantId,
                          );
                          const allowNewVariant = canAddVariant(question);
                          const questionDisplayLabel = formatQuestionLabel(
                            questionIndex,
                            question.isDraft,
                          );
                          return (
                            <div key={question.id} className={styles.questionItem}>
                              <div className={styles.questionRow}>
                                <div
                                  role="button"
                                  tabIndex={0}
                                  className={`${styles.questionBlock} ${isSelected ? styles.selected : ''} ${isVariantSelected ? styles.variantSelected : ''}`}
                                  onClick={() =>
                                    setSelected({
                                      groupId: group.id,
                                      questionId: question.id,
                                      variantId: null,
                                    })
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault();
                                      setSelected({
                                        groupId: group.id,
                                        questionId: question.id,
                                        variantId: null,
                                      });
                                    }
                                  }}
                                >
                                  <span className={styles.questionLabel}>
                                    Question {questionIndex + 1}
                                    {question.isDraft && (
                                      <span className={styles.draftBadge}>(draft)</span>
                                    )}
                                  </span>
                                  <div className={styles.questionMeta}>
                                  <span className={styles.questionType}>
                                      {QUESTION_TYPE_CONFIGS[
                                        normalizeQuestionType(question.type)
                                      ].label}
                                    </span>
                                    <button
                                      type="button"
                                      className={`${styles.iconButton} ${styles.dangerIcon}`}
                                      aria-label={`${isUnitLive ? 'Archive' : 'Delete'} question ${questionDisplayLabel}`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setDeleteTarget({
                                          type: 'question',
                                          groupId: group.id,
                                          questionId: question.id,
                                          title: questionDisplayLabel,
                                        });
                                      }}
                                    >
                                      {isUnitLive ? (
                                        <FiArchive aria-hidden />
                                      ) : (
                                        <FiTrash2 aria-hidden />
                                      )}
                                    </button>
                                  </div>
                                </div>
                              </div>
                              <div className={styles.variantList}>
                                {question.variants.map((variant, variantIndex) => {
                                  const variantDisplayLabel = formatVariantLabel(
                                    variantIndex,
                                    variant.isDraft,
                                  );
                                  return (
                                    <div
                                      key={variant.id}
                                      className={`${styles.variantBlock} ${selected?.variantId === variant.id ? styles.selectedVariantFull : styles.selectedVariant}`}
                                    >
                                      <button
                                        type="button"
                                        className={styles.variantSelectArea}
                                        onClick={() =>
                                          setSelected({
                                            groupId: group.id,
                                            questionId: question.id,
                                            variantId: variant.id,
                                          })
                                        }
                                        title={variantDisplayLabel}
                                      >
                                        <span
                                          className={`${styles.variantStatusDot} ${variant.isDraft ? styles.variantDotDraft : styles.variantDotSaved}`}
                                          aria-hidden="true"
                                        />
                                        Var {variantIndex + 1}
                                        {variant.isDraft && (
                                          <span className={styles.draftBadge}>(draft)</span>
                                        )}
                                      </button>
                                      <button
                                        type="button"
                                        className={styles.variantDeleteBtn}
                                        aria-label={`${isUnitLive ? 'Archive' : 'Delete'} ${variantDisplayLabel}`}
                                        onClick={() =>
                                          setDeleteTarget({
                                            type: 'variant',
                                            groupId: group.id,
                                            questionId: question.id,
                                            variantId: variant.id,
                                            label: variantDisplayLabel,
                                          })
                                        }
                                      >
                                        {isUnitLive ? <FiArchive aria-hidden /> : <FiTrash2 aria-hidden />}
                                      </button>
                                    </div>
                                  );
                                })}
                                <button
                                  type="button"
                                  className={styles.addVariantButton}
                                  onClick={() => handleAddVariant(group.id, question.id)}
                                  aria-label="Add variant"
                                  disabled={isUnitLive || isSavingVariant || !allowNewVariant}
                                >
                                  <IconContext.Provider value={{ className: styles.plusVariantIcon }}>
                                    <FaCirclePlus />
                                  </IconContext.Provider>
                                  Variant
                                </button>
                              </div>
                            </div>
                          );
                        })}
                        {(() => {
                          const lastQuestion = group.questions[group.questions.length - 1];
                          const allowNewQuestion = !lastQuestion || isQuestionSaved(lastQuestion);
                          return (
                            <button
                              type="button"
                              className={styles.addQuestion}
                              onClick={() => handleAddQuestion(group.id)}
                              disabled={isUnitLive || !allowNewQuestion}
                            >
                              <IconContext.Provider
                                value={{ className: styles.plusQuestionIcon }}
                              >
                                <FaCirclePlus />
                              </IconContext.Provider>
                              Question
                            </button>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  className={styles.addGroupBottom}
                  onClick={handleAddGroup}
                  disabled={isUnitLive}
                >
                  <IconContext.Provider value={{ className: styles.plusGroupIcon }}>
                    <FaCirclePlus />
                  </IconContext.Provider>
                  Add Group
                </button>
              </div>
            </aside>

            <main className={styles.rightColumn}>
              <div className={styles.editorArea}>
                <div className={styles.sectionHeader}>
                  <h2>Question Editor</h2>
                  {selectedQuestion ? (
                    <div className={styles.editingMeta}>
                      <button
                        type="button"
                        className={styles.navButton}
                        onClick={() => handleNavigate(-1)}
                        disabled={!canGoPrev}
                        aria-label="Previous question or variant"
                      >
                        <FaCircleChevronLeft className={styles.navIcon} />
                      </button>
                      <strong style={{ fontSize: '14px', color: 'var(--color-text)' }}>
                        {activeLabel}
                      </strong>
                      <button
                        type="button"
                        className={styles.navButton}
                        onClick={() => handleNavigate(1)}
                        disabled={!canGoNext}
                        aria-label="Next question or variant"
                      >
                        <FaCircleChevronRight className={styles.navIcon} />
                      </button>
                    </div>
                  ) : (
                    <div className={styles.editingMeta}>
                      <span className={styles.editingLabel}>Pick a question to edit</span>
                    </div>
                  )}
                </div>

                <div className={styles.formSection}>
                  <label className={styles.label}>Question Type</label>
                  <div className={styles.typeToggle}>
                    {(Object.values(QUESTION_TYPE_CONFIGS) as QuestionTypeConfig[]).map(
                      (config) => (
                        <button
                          key={config.type}
                          type="button"
                          className={`${styles.typeChip} ${activeQuestionType === config.type ? styles.typeChipActive : ''}`}
                          onClick={() => handleTypeChange(config.type)}
                        >
                          {config.label}
                        </button>
                      ),
                    )}
                  </div>

                  <label className={styles.label}>
                    Question Stem
                    <textarea
                      value={form.stem}
                      onChange={(e) => setForm((prev) => ({ ...prev, stem: e.target.value }))}
                      placeholder="Enter the question text here..."
                      maxLength={500}
                    />
                  </label>

                  {(() => {
                    const Config = QUESTION_TYPE_CONFIGS[activeQuestionType];
                    const FormComponent = Config.component;
                    return (
                      <FormComponent
                        options={form.options.map((option, idx) => ({
                          ...option,
                          explanation: form.explanations[idx] ?? '',
                        }))}
                        onChangeOption={handleOptionChange}
                        onChangeExplanation={(id, value) => {
                          const idx = form.options.findIndex((option) => option.id === id);
                          if (idx >= 0) handleExplanationChange(idx, value);
                        }}
                        onSelectCorrect={setCorrectOption}
                        onDeleteOption={handleDeleteOption}
                      />
                    );
                  })()}

                  <label className={styles.label}>
                    <span className={styles.hintLabelRow} ref={hintPopoverRef}>
                      💡 Hint (Optional)
                      <button
                        type="button"
                        className={styles.hintInfoBtn}
                        aria-label="Hint info"
                        onClick={() => setHintPopoverOpen((prev) => !prev)}
                      >
                        <FiInfo aria-hidden="true" />
                      </button>
                      {hintPopoverOpen && (
                        <div className={styles.hintPopover} role="tooltip">
                          Hints are completely optional. Students who use a hint before answering
                          will not earn the streak bonus for that question, and hint usage is
                          factored into how daily practice sets are generated.
                        </div>
                      )}
                    </span>
                    <textarea
                      value={form.hint}
                      onChange={(e) => setForm((prev) => ({ ...prev, hint: e.target.value }))}
                      placeholder="Provide a hint to help students..."
                      maxLength={300}
                      className={styles.hintTextArea}
                    />
                  </label>

                  {saveError ? (
                    <div className={styles.inlineError} role="alert">
                      {saveError}
                    </div>
                  ) : null}
                  {/*TODO: Generate variant button is currently hidden until generate variants is implemented.*/}
                  <div className={styles.formActions}>
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      onClick={handleGenerateVariant}
                    >
                      Generate Variant
                      <VscSparkleFilled className={styles.aiSparkle} />
                    </button>
                    <button
                      type="button"
                      className={styles.saveQuestionButton}
                      onClick={handleSaveQuestion}
                      disabled={isSavingQuestion}
                    >
                      {isSavingQuestion ? 'Saving...' : 'Save Question'}
                    </button>
                  </div>
                </div>
              </div>
            </main>
          </div>
        </>
      )}
      <VariantSettingsModal
        isOpen={isSettingsOpen}
        variantInstructions={variantInstructions}
        isSaving={isSavingVariantInstructions}
        onChangeInstructions={setVariantInstructions}
        onSave={handleSaveVariantInstructions}
        onClose={() => setIsSettingsOpen(false)}
      />
      <ConfirmDeleteModal
        isOpen={Boolean(deleteTarget)}
        title={deleteCopy.title}
        body={deleteCopy.body}
        confirmLabel={deleteCopy.confirmLabel}
        isSubmitting={isDeleting}
        errorMessage={deleteError ?? undefined}
        onCancel={() => {
          setDeleteTarget(null);
          setDeleteError(null);
        }}
        onConfirm={() => void handleConfirmDelete()}
      />
    </MainSection>
  );
}
