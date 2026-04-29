import { GlobalRole } from '@prisma/client';
import { features } from '@scholarxp/permissions';
import { AuthorizationService } from './authorization.service';

describe('AuthorizationService', () => {
  const service = new AuthorizationService();

  const teacherUser = {
    id: 10,
    globalRole: GlobalRole.teacher,
  } as any;

  it('allows global capability when shared matrix allows it', () => {
    const allowed = service.canActivate({
      user: teacherUser,
      rule: { capability: features.modules.create },
    });

    expect(allowed).toBe(true);
  });

  it('denies immediately when the shared capability matrix disallows the role', () => {
    const allowed = service.canActivate({
      user: {
        id: 11,
        globalRole: GlobalRole.student,
      } as any,
      rule: { capability: features.modules.create },
    });

    expect(allowed).toBe(false);
  });

  it('allows module scope for teacher when creator', () => {
    const allowed = service.canActivate({
      user: teacherUser,
      rule: { capability: features.modules.settings, scope: 'module' },
      moduleContext: {
        moduleId: 5,
        moduleCreatedByUserId: 10,
        moduleArchivedAt: null,
        roleInModule: null,
      },
    });

    expect(allowed).toBe(true);
  });

  it('allows module scope for admins even without membership', () => {
    const allowed = service.canActivate({
      user: {
        id: 99,
        globalRole: GlobalRole.admin,
      } as any,
      rule: { capability: features.modules.settings, scope: 'module' },
      moduleContext: {
        moduleId: 5,
        moduleCreatedByUserId: 10,
        moduleArchivedAt: null,
        roleInModule: null,
      },
    });

    expect(allowed).toBe(true);
  });

  it('allows module scope for teacher membership even when not creator', () => {
    const allowed = service.canActivate({
      user: teacherUser,
      rule: { capability: features.modules.settings, scope: 'module' },
      moduleContext: {
        moduleId: 5,
        moduleCreatedByUserId: 99,
        moduleArchivedAt: null,
        roleInModule: 'teacher',
      },
    });

    expect(allowed).toBe(true);
  });

  it('allows module scope for enrolled students with a student capability', () => {
    const allowed = service.canActivate({
      user: {
        id: 21,
        globalRole: GlobalRole.student,
      } as any,
      rule: { capability: features.navigation.modules, scope: 'module' },
      moduleContext: {
        moduleId: 5,
        moduleCreatedByUserId: 10,
        moduleArchivedAt: null,
        roleInModule: 'student',
      },
    });

    expect(allowed).toBe(true);
  });

  it('denies unsupported authorization scopes', () => {
    const allowed = service.canActivate({
      user: teacherUser,
      rule: {
        capability: features.modules.create,
        scope: 'institution' as never,
      },
    });

    expect(allowed).toBe(false);
  });

  it('denies module scope when context is missing', () => {
    const allowed = service.canActivate({
      user: teacherUser,
      rule: { capability: features.modules.settings, scope: 'module' },
    });

    expect(allowed).toBe(false);
  });

  it('allows self scope when user id matches target id', () => {
    const allowed = service.canActivate({
      user: {
        id: 21,
        globalRole: GlobalRole.pending,
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
      } as any,
      rule: { capability: features.users.selectOwnRole, scope: 'self' },
      selfTargetUserId: 99,
    });

    expect(allowed).toBe(false);
  });

  it('denies self scope when no target id was resolved', () => {
    const allowed = service.canActivate({
      user: {
        id: 21,
        globalRole: GlobalRole.pending,
      } as any,
      rule: { capability: features.users.selectOwnRole, scope: 'self' },
    });

    expect(allowed).toBe(false);
  });
});
