import { GlobalRole } from '@prisma/client';
import { features } from '@scholarxp/permissions';
import { AuthorizationService } from './authorization.service';

describe('AuthorizationService', () => {
  const service = new AuthorizationService();

  const teacherUser = {
    id: 10,
    globalRole: GlobalRole.teacher,
    hasInstitutionMembership: false,
  } as any;

  it('allows global capability when shared matrix allows it', () => {
    const allowed = service.canActivate({
      user: teacherUser,
      rule: { capability: features.modules.create },
    });

    expect(allowed).toBe(true);
  });

  it('denies when shared capability check fails', () => {
    const allowed = service.canActivate({
      user: teacherUser,
      rule: { capability: features.modules.setInstitution },
    });

    expect(allowed).toBe(false);
  });

  it('allows module scope for teacher when creator', () => {
    const allowed = service.canActivate({
      user: teacherUser,
      rule: { capability: features.modules.settings, scope: 'module' },
      moduleContext: {
        moduleId: 5,
        moduleInstitutionId: null,
        moduleCreatedByUserId: 10,
        moduleArchivedAt: null,
        roleInModule: null,
        hasInstitutionMatch: false,
      },
    });

    expect(allowed).toBe(true);
  });

  it('denies module scope when context is missing', () => {
    const allowed = service.canActivate({
      user: teacherUser,
      rule: { capability: features.modules.settings, scope: 'module' },
    });

    expect(allowed).toBe(false);
  });

  it('allows module scope for institution admin with institution match', () => {
    const allowed = service.canActivate({
      user: {
        id: 7,
        globalRole: GlobalRole.institution_admin,
        hasInstitutionMembership: true,
      } as any,
      rule: { capability: features.modules.settings, scope: 'module' },
      moduleContext: {
        moduleId: 9,
        moduleInstitutionId: 2,
        moduleCreatedByUserId: 1,
        moduleArchivedAt: null,
        roleInModule: null,
        hasInstitutionMatch: true,
      },
    });

    expect(allowed).toBe(true);
  });

  it('allows self scope when user id matches target id', () => {
    const allowed = service.canActivate({
      user: {
        id: 21,
        globalRole: GlobalRole.pending,
        hasInstitutionMembership: false,
      } as any,
      rule: { capability: features.users.selectOwnRole, scope: 'self' },
      selfTargetUserId: 21,
    });

    expect(allowed).toBe(true);
  });

  it('denies self scope when user id does not match target id', () => {
    const allowed = service.canActivate({
      user: {
        id: 21,
        globalRole: GlobalRole.pending,
        hasInstitutionMembership: false,
      } as any,
      rule: { capability: features.users.selectOwnRole, scope: 'self' },
      selfTargetUserId: 99,
    });

    expect(allowed).toBe(false);
  });
});
