import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

const mockUser = {
  id: 1,
  firstName: 'Jane',
  lastName: 'Doe',
  email: 'jane@example.com',
  profilePictureUrl: 'default-profile-pic.png',
  globalRole: 'student',
  isVerified: false,
};

describe('AuthController', () => {
  let controller: AuthController;
  let service: {
    registerByEmail: jest.Mock;
    login: jest.Mock;
    getUserById: jest.Mock;
    loginWithGoogle: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      registerByEmail: jest.fn(),
      login: jest.fn(),
      getUserById: jest.fn(),
      loginWithGoogle: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: service }],
    }).compile();

    controller = moduleRef.get(AuthController);
  });

  afterEach(() => jest.resetAllMocks());

  it('registerByEmail sets session userId and returns user', async () => {
    service.registerByEmail.mockResolvedValue(mockUser);
    const req: any = { session: {} };

    const result = await controller.registerByEmail(
      {
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@example.com',
        password: 'password123',
      },
      req,
    );

    expect(service.registerByEmail).toHaveBeenCalled();
    expect(req.session.userId).toBe(mockUser.id);
    expect(result).toEqual({ user: mockUser });
  });

  it('login sets session userId and returns user', async () => {
    service.login.mockResolvedValue(mockUser);
    const req: any = { session: {} };

    const result = await controller.login(
      { email: 'jane@example.com', password: 'password123' },
      req,
    );

    expect(service.login).toHaveBeenCalled();
    expect(req.session.userId).toBe(mockUser.id);
    expect(result).toEqual({ user: mockUser });
  });

  it('logout destroys session', async () => {
    const destroy = jest.fn((cb: (err?: Error | null) => void) => cb(null));
    const req: any = { session: { destroy } };

    const result = await controller.logout(req);

    expect(destroy).toHaveBeenCalled();
    expect(result).toEqual({ ok: true });
  });

  it('logout rejects when session destroy fails', async () => {
    const destroy = jest.fn((cb: (err?: Error | null) => void) =>
      cb(new Error('fail')),
    );
    const req: any = { session: { destroy } };

    await expect(controller.logout(req)).rejects.toThrow('fail');
  });

  it('me returns null when session missing', async () => {
    const req: any = { session: {} };

    const result = await controller.me(req);

    expect(service.getUserById).not.toHaveBeenCalled();
    expect(result).toEqual({ user: null });
  });

  it('me returns user when session exists', async () => {
    service.getUserById.mockResolvedValue(mockUser);
    const req: any = { session: { userId: mockUser.id } };

    const result = await controller.me(req);

    expect(service.getUserById).toHaveBeenCalledWith(mockUser.id);
    expect(result).toEqual({ user: mockUser });
  });

  describe('google OAuth flow', () => {
    it('googleAuth returns ok (guard handles redirect)', async () => {
      const result = await controller.googleAuth();
      expect(result).toEqual({ ok: true });
    });

    it('googleCallback logs in user, sets session, and redirects', async () => {
      const req: any = {
        user: {
          providerUserId: 'google-123',
          email: 'jane@example.com',
          firstName: 'Jane',
          lastName: 'Doe',
          picture: 'https://example.com/pic.jpg',
        },
        session: {},
      };
      const res: any = { redirect: jest.fn() };
      const redirectTarget = 'http://frontend.local';
      const originalCors = process.env.CORS_ORIGIN;
      process.env.CORS_ORIGIN = redirectTarget;

      service.loginWithGoogle.mockResolvedValue(mockUser);

      await controller.googleCallback(req, res);

      expect(service.loginWithGoogle).toHaveBeenCalledWith(req.user);
      expect(req.session.userId).toBe(mockUser.id);
      expect(res.redirect).toHaveBeenCalledWith(redirectTarget);

      process.env.CORS_ORIGIN = originalCors;
    });
  });
});
