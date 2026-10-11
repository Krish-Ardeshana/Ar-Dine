import { PasswordService } from './password.service.js';

describe('PasswordService', () => {
  let service: PasswordService;

  beforeEach(() => {
    service = new PasswordService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should hash a password with non-plaintext output', async () => {
    const raw = 'SuperSecret123!';
    const hash = await service.hashPassword(raw);

    expect(hash).toBeDefined();
    expect(hash).not.toBe(raw);
    expect(hash).toMatch(/^\$2[aby]\$\d+\$/);
  });

  it('should verify matching plaintext password and hash', async () => {
    const raw = 'SuperSecret123!';
    const hash = await service.hashPassword(raw);

    const isMatch = await service.verifyPassword(raw, hash);
    expect(isMatch).toBe(true);
  });

  it('should reject non-matching plaintext password', async () => {
    const raw = 'SuperSecret123!';
    const hash = await service.hashPassword(raw);

    const isMatch = await service.verifyPassword('WrongPassword123!', hash);
    expect(isMatch).toBe(false);
  });

  it('should safely return false when inputs are missing', async () => {
    expect(await service.verifyPassword('', 'hash')).toBe(false);
    expect(await service.verifyPassword('pass', '')).toBe(false);
  });
});
