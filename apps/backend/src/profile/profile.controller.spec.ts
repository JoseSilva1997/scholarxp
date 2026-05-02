// Verifies ProfileController delegates authenticated profile reads to role-specific services.
import { Test, type TestingModule } from '@nestjs/testing';
import { AuthorizationGuard } from '../auth/guards/authorization.guard';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { ProfileController } from './profile.controller';
import { StudentProfileService } from './student-profile.service';
import { TutorProfileService } from './tutor-profile.service';

describe('ProfileController', () => {
  let controller: ProfileController;
  let studentProfileService: { getStudentProfile: jest.Mock };
  let tutorProfileService: { getTutorProfile: jest.Mock };

  const user = { id: 7, globalRole: 'student' };
  const request = { user } as never;

  beforeEach(async () => {
    studentProfileService = {
      getStudentProfile: jest.fn(),
    };
    tutorProfileService = {
      getTutorProfile: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [ProfileController],
      providers: [
        { provide: StudentProfileService, useValue: studentProfileService },
        { provide: TutorProfileService, useValue: tutorProfileService },
      ],
    })
      .overrideGuard(SessionAuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .overrideGuard(AuthorizationGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = moduleRef.get(ProfileController);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('delegates student profile reads with the authenticated user', async () => {
    const response = { profile: { role: 'Student' } };
    studentProfileService.getStudentProfile.mockResolvedValue(response);

    const result = await controller.getStudentProfile(request);

    expect(studentProfileService.getStudentProfile).toHaveBeenCalledWith(user);
    expect(result).toBe(response);
  });

  it('delegates tutor profile reads with the authenticated user', async () => {
    const response = { profile: { role: 'Teacher' } };
    tutorProfileService.getTutorProfile.mockResolvedValue(response);

    const result = await controller.getTutorProfile(request);

    expect(tutorProfileService.getTutorProfile).toHaveBeenCalledWith(user);
    expect(result).toBe(response);
  });
});
