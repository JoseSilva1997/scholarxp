// Module unit authoring workspace UI for adding questions, variants, and context before wiring backend.
import { useMemo, useState } from 'react';
import MainSection from '../../components/MainSection';
import styles from './ModuleUnitEditor.module.css';

type QuestionType = 'mcq' | 'trueFalse';

type Variant = {
  id: string;
  label: string;
};

type Question = {
  id: string;
  title: string;
  type: QuestionType;
  variants: Variant[];
};

type QuestionGroup = {
  id: string;
  title: string;
  questions: Question[];
};

type QuestionForm = {
  stem: string;
  type: QuestionType;
  options: { value: string; isCorrect: boolean; id: string }[];
  explanations: string[];
  hint: string;
};

// Helpers keep ids predictable for now; will be replaced by backend ids later.
let nextId = 1;
const makeId = () => `${nextId++}`;

export default function ModuleUnitEditor() {
  const [variantInstructions, setVariantInstructions] = useState('');
  const [groups, setGroups] = useState<QuestionGroup[]>([
    {
      id: makeId(),
      title: 'Introduction to Linked Lists',
      questions: [
        {
          id: makeId(),
          title: 'Question 1',
          type: 'mcq',
          variants: [
            { id: makeId(), label: 'Variant 1' },
            { id: makeId(), label: 'Variant 2' },
            { id: makeId(), label: 'Variant 3' },
          ],
        },
        {
          id: makeId(),
          title: 'Question 2',
          type: 'trueFalse',
          variants: [
            { id: makeId(), label: 'Variant 1' },
            { id: makeId(), label: 'Variant 2' },
          ],
        },
      ],
    },
  ]);

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set([groups[0]?.id]));

  const [selected, setSelected] = useState<{ groupId: string; questionId: string | null; variantId: string | null } | null>(
    groups[0] ? { groupId: groups[0].id, questionId: groups[0].questions[0]?.id ?? null, variantId: null } : null,
  );

  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);

  const initialForm: QuestionForm = useMemo(
    () => ({
      stem: 'In a standard Java implementation of a singly linked list, what is the time complexity of inserting a new element at the beginning of the list?',
      type: 'mcq',
      options: [
        { id: makeId(), value: 'O(n log n)', isCorrect: false },
        { id: makeId(), value: 'O(n)', isCorrect: false },
        { id: makeId(), value: 'O(log n)', isCorrect: false },
        { id: makeId(), value: 'O(1)', isCorrect: true },
      ],
      explanations: [
        'This complexity is common for efficient sorting algorithms (like Merge Sort), not for basic insertion operations in a linear data structure.',
        "This would imply you need to traverse the entire list (visiting every node), which isn't necessary for a head insertion.",
        'Logarithmic time is typical for tree-based structures (like a Binary Search Tree), but linked list insertions do not involve dividing the search space.',
        "That's right! Inserting at the head only requires updating the new node's next pointer and the head reference, regardless of the list size.",
      ],
      hint: "Think about how many nodes you need to visit to change the 'head' reference.",
    }),
    [],
  );

  const [form, setForm] = useState<QuestionForm>(initialForm);

  const selectedQuestion = useMemo(() => {
    if (!selected) return null;
    const group = groups.find((g) => g.id === selected.groupId);
    if (!group) return null;
    return group.questions.find((q) => q.id === selected.questionId) ?? null;
  }, [groups, selected]);

  const handleAddGroup = () => {
    const newGroup: QuestionGroup = {
      id: makeId(),
      title: `New Group ${groups.length + 1}`,
      questions: [],
    };
    setGroups((prev) => [...prev, newGroup]);
    setExpandedGroups((prev) => new Set([...prev, newGroup.id]));
    setSelected({ groupId: newGroup.id, questionId: null, variantId: null });
  };

  const handleToggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) {
        newSet.delete(groupId);
      } else {
        newSet.add(groupId);
      }
      return newSet;
    });
  };

  const handleUpdateGroupTitle = (groupId: string, newTitle: string) => {
    setGroups((prev) => prev.map((group) => (group.id === groupId ? { ...group, title: newTitle } : group)));
  };

  const handleAddQuestion = (groupId: string) => {
    setGroups((prev) =>
      prev.map((group) => {
        if (group.id !== groupId) return group;
        const newQuestion: Question = {
          id: makeId(),
          title: `Question ${group.questions.length + 1}`,
          type: 'mcq',
          variants: [],
        };
        return { ...group, questions: [...group.questions, newQuestion] };
      }),
    );
    setSelected({ groupId, questionId: null, variantId: null });
  };

  const handleAddVariant = (groupId: string, questionId: string) => {
    setGroups((prev) =>
      prev.map((group) => {
        if (group.id !== groupId) return group;
        return {
          ...group,
          questions: group.questions.map((q) =>
            q.id === questionId
              ? {
                  ...q,
                  variants: [...q.variants, { id: makeId(), label: `Variant ${q.variants.length + 1}` }],
                }
              : q,
          ),
        };
      }),
    );
    setSelected({ groupId, questionId, variantId: null });
  };

  const setCorrectOption = (id: string) => {
    setForm((prev) => ({
      ...prev,
      options: prev.options.map((opt) => ({ ...opt, isCorrect: opt.id === id })),
    }));
  };

  const handleOptionChange = (id: string, value: string) => {
    setForm((prev) => ({
      ...prev,
      options: prev.options.map((opt) => (opt.id === id ? { ...opt, value } : opt)),
    }));
  };

  const handleExplanationChange = (index: number, value: string) => {
    setForm((prev) => {
      const explanations = [...prev.explanations];
      explanations[index] = value;
      return { ...prev, explanations };
    });
  };

  const handleTypeChange = (type: QuestionType) => {
    setForm((prev) => ({ ...prev, type }));
  };

  return (
    <MainSection className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
            <h1 className={styles.pageTitle}>Unit Title</h1>
        </div>
        <button type="button" className={styles.saveButton}>
          Save
        </button>
      </div>

      <div className={styles.grid}>
        <div className={styles.leftColumn}>
          <div className={styles.sectionHeader}>
            <h2>Questions</h2>
          </div>

          {groups.map((group) => (
            <div key={group.id} className={styles.groupCard}>
              <button
                type="button"
                className={styles.groupHeader}
                onClick={() => handleToggleGroup(group.id)}
              >
                {editingGroupId === group.id ? (
                  <input
                    type="text"
                    value={group.title}
                    onChange={(e) => handleUpdateGroupTitle(group.id, e.target.value)}
                    onBlur={() => setEditingGroupId(null)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') setEditingGroupId(null);
                    }}
                    className={styles.groupTitleInput}
                    autoFocus
                  />
                ) : (
                  <h3 onClick={(e) => { e.stopPropagation(); setEditingGroupId(group.id); }}>{group.title}</h3>
                )}
                <span className={styles.expandIcon}>
                  {expandedGroups.has(group.id) ? '▼' : '▶'}
                </span>
              </button>
              {expandedGroups.has(group.id) && (
                <div className={styles.questionList}>
                  {group.questions.map((question) => {
                    const isSelected = selected?.groupId === group.id && selected?.questionId === question.id;
                    return (
                      <div key={question.id} className={styles.questionItem}>
                        <button
                          type="button"
                          className={`${styles.questionBlock} ${isSelected ? styles.selected : ''}`}
                          onClick={() => setSelected({ groupId: group.id, questionId: question.id, variantId: null })}
                        >
                          <span className={styles.questionLabel}>{question.title}</span>
                          <span className={styles.questionType}>{question.type === 'mcq' ? 'MCQ' : 'True/False'}</span>
                        </button>
                        <div className={styles.variantList}>
                          {question.variants.map((variant) => (
                            <button
                              key={variant.id}
                              type="button"
                              className={`${styles.variantBlock} ${selected?.questionId === question.id ? styles.selectedVariant : ''} ${selected?.variantId === variant.id ? styles.selectedVariantFull : ''}`}
                              onClick={() => setSelected({ groupId: group.id, questionId: question.id, variantId: variant.id })}
                            >
                              {variant.label}
                            </button>
                          ))}
                          <button
                            type="button"
                            className={styles.addVariantButton}
                            onClick={() => handleAddVariant(group.id, question.id)}
                            aria-label="Add variant"
                          >
                            <div className={styles.addVariantIcon}>+</div>
                            Variant
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  <button
                    type="button"
                    className={styles.addQuestion}
                    onClick={() => handleAddQuestion(group.id)}
                  >
                    <div className={styles.addQuestionIcon}>+</div>
                    Add Question
                  </button>
                </div>
              )}
            </div>
          ))}

          <button type="button" className={styles.addGroup} onClick={handleAddGroup}>
            <div className={styles.addGroupIcon}>+</div>
            New Group
          </button>

          <div className={styles.variantInstructions}>
            <div className={styles.sectionHeader}>
              <h2>Variant generation instructions</h2>
            </div>
            <textarea
              value={variantInstructions}
              onChange={(e) => setVariantInstructions(e.target.value)}
              placeholder="Describe how variants should change context, numbers, or wording while keeping concepts aligned."
            />
          </div>
        </div>

        <div className={styles.rightColumn}>
          <div className={styles.sectionHeader}>
            <h2>Question Editor</h2>
            {selectedQuestion ? (
            <div className={styles.editingMeta}>
              <strong>{selectedQuestion.title}</strong>
            </div>
          ) : (
            <div className={styles.editingMeta}>
              <span className={styles.editingLabel}>Pick a question to edit</span>
            </div>
          )}
          </div>
          <div className={styles.typeToggle}>
            <button
              type="button"
              className={`${styles.typeChip} ${form.type === 'mcq' ? styles.typeChipActive : ''}`}
              onClick={() => handleTypeChange('mcq')}
            >
              Multiple Choice
            </button>
            <button
              type="button"
              className={`${styles.typeChip} ${form.type === 'trueFalse' ? styles.typeChipActive : ''}`}
              onClick={() => handleTypeChange('trueFalse')}
            >
              True/False
            </button>
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

          <div className={styles.optionsSection}>
            <h3>Answer Options</h3>
            <div className={styles.optionsGrid}>
            {form.options.map((option, index) => (
              <div key={option.id} className={styles.optionCard}>
                <div className={styles.optionHeader}>
                  <span className={styles.optionLabel}>Option {index + 1}</span>
                  <label className={styles.correctToggle}>
                    <input
                      type="radio"
                      name="correct"
                      checked={option.isCorrect}
                      onChange={() => setCorrectOption(option.id)}
                    />
                    <span>Correct</span>
                  </label>
                </div>
                <input
                  value={option.value}
                  onChange={(e) => handleOptionChange(option.id, e.target.value)}
                  placeholder="Enter option text..."
                  className={styles.optionInput}
                  maxLength={100}
                />
                <label className={styles.explanationLabel}>
                  Explanation
                  <textarea
                    value={form.explanations[index] ?? ''}
                    onChange={(e) => handleExplanationChange(index, e.target.value)}
                    placeholder="Explain why this option is correct or incorrect..."
                    maxLength={250}
                  />
                </label>
              </div>
            ))}
          </div>
          </div>

          <label className={styles.label}>
            💡 Hint (Optional)
            <textarea
              value={form.hint}
              onChange={(e) => setForm((prev) => ({ ...prev, hint: e.target.value }))}
              placeholder="Provide a hint to help students..."
              maxLength={300}
            />
          </label>

          <div className={styles.formActions}>
            <button type="button" className={styles.secondaryButton}>
              Generate Variant
            </button>
            <button type="button" className={styles.primaryButton}>
              Save Question
            </button>
          </div>
        </div>
      </div>
    </MainSection>
  );
}
