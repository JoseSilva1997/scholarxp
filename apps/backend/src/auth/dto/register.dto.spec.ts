// Validates RegisterDto transformations to keep account creation inputs normalized and strict.
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RegisterDto } from './register.dto';

describe('RegisterDto validation', () => {
  it('trims and normalizes email to lowercase', async () => {
    const dto = plainToInstance(RegisterDto, {
      firstName: 'Jane',
      lastName: 'Doe',
      email: '  Jane.Doe@Example.com  ',
      password: 'password123',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.email).toBe('jane.doe@example.com');
  });

  it('rejects names with digits or symbols', async () => {
    const dto = plainToInstance(RegisterDto, {
      firstName: 'Jane1',
      lastName: 'Doe$',
      email: 'jane@example.com',
      password: 'password123',
    });

    const errors = await validate(dto);

    const firstNameError = errors.find((e) => e.property === 'firstName');
    const lastNameError = errors.find((e) => e.property === 'lastName');

    expect(firstNameError?.constraints).toBeDefined();
    expect(lastNameError?.constraints).toBeDefined();
  });

  it('enforces password minimum length', async () => {
    const dto = plainToInstance(RegisterDto, {
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@example.com',
      password: 'short',
    });

    const errors = await validate(dto);

    const passwordError = errors.find((e) => e.property === 'password');

    expect(passwordError?.constraints).toBeDefined();
  });
});

