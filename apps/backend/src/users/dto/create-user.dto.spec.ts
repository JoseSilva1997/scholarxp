// Validates CreateUserDto to ensure service-level creation receives normalized inputs.
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateUserDto } from './create-user.dto';

describe('CreateUserDto validation', () => {
  it('trims names and lowercases email', async () => {
    const dto = plainToInstance(CreateUserDto, {
      firstName: '  Jane ',
      lastName: ' Doe  ',
      email: ' Jane.Doe@Example.com ',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.firstName).toBe('Jane');
    expect(dto.lastName).toBe('Doe');
    expect(dto.email).toBe('jane.doe@example.com');
  });

  it('allows optional email but enforces name characters', async () => {
    const dto = plainToInstance(CreateUserDto, {
      firstName: 'Jane',
      lastName: 'Doe-Ann',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('rejects invalid characters in names', async () => {
    const dto = plainToInstance(CreateUserDto, {
      firstName: 'Jane123',
      lastName: 'Doe@',
      email: 'jane@example.com',
    });

    const errors = await validate(dto);
    const firstNameError = errors.find((e) => e.property === 'firstName');
    const lastNameError = errors.find((e) => e.property === 'lastName');

    expect(firstNameError?.constraints).toBeDefined();
    expect(lastNameError?.constraints).toBeDefined();
  });
});

