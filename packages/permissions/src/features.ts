// Capability catalog centralizes feature identifiers so backend/frontend share one typed vocabulary.
export const features = {
  modules: {
    create: 'modules_create',
    setInstitution: 'modules_set_institution',
    toggleStudentView: 'modules_toggle_student_view',
    settings: 'modules_settings',
    invitations: 'modules_invitations',
    invitationsRedemption: 'modules_invitations_redemption',
    manageContent: 'modules_manage_content',
  },
  navigation: {
    modules: 'navigation_modules',
    quests: 'navigation_quests',
    profile: 'navigation_profile',
  },
} as const;

// Utility type flattens nested feature objects into a union of their string values.
type NestedValueOf<T> = T extends string
  ? T
  : {
      [K in keyof T]: NestedValueOf<T[K]>;
    }[keyof T];

export type FeatureKey = NestedValueOf<typeof features>;
