import { User } from '../../domain/models/User';

describe('User Domain Model Invariants', () => {
  let user: User;

  beforeEach(() => {
    user = new User({
      id: 'user-uuid-123',
      nusp: '12345678',
      nickname: 'testuser',
      email: 'test@usp.br',
      fullName: 'Test USP User',
      birthDate: new Date('2000-01-01'),
      instituteId: 'inst-uuid',
      courseId: 'course-uuid',
      availabilityStatus: 'OFFLINE',
      isDeleted: false,
    });
  });

  describe('PIN Hashing & Validation Logic', () => {
    it('should successfully set and hash a valid 4-digit PIN', async () => {
      await user.updatePin('1234');
      expect(user.pinHash).toBeDefined();
      expect(user.pinHash).toContain('$argon2');
    });

    it('should throw error when updating PIN with non-4-digit value', async () => {
      await expect(user.updatePin('123')).rejects.toThrow('PIN must be exactly 4 digits');
      await expect(user.updatePin('12345')).rejects.toThrow('PIN must be exactly 4 digits');
      await expect(user.updatePin('abcd')).rejects.toThrow('PIN must be exactly 4 digits');
      await expect(user.updatePin('')).rejects.toThrow('PIN must be exactly 4 digits');
    });

    it('should validate a correct PIN successfully', async () => {
      await user.updatePin('4321');
      expect(await user.validatePin('4321')).toBe(true);
    });

    it('should fail validation for an incorrect PIN', async () => {
      await user.updatePin('4321');
      expect(await user.validatePin('1111')).toBe(false);
    });

    it('should fail validation if input PIN is not 4 digits', async () => {
      await user.updatePin('4321');
      expect(await user.validatePin('432')).toBe(false);
      expect(await user.validatePin('43210')).toBe(false);
      expect(await user.validatePin('aaaa')).toBe(false);
    });

    it('should fail validation if pinHash is malformed', async () => {
      user.pinHash = 'invalidhash';
      expect(await user.validatePin('1234')).toBe(false);
    });
  });

  describe('Avatar URL Constraints', () => {
    it('should allow valid http/https URLs', () => {
      user.updateAvatar('https://usp.br/avatar.png');
      expect(user.avatarUrl).toBe('https://usp.br/avatar.png');

      user.updateAvatar('http://example.com/pic.jpg');
      expect(user.avatarUrl).toBe('http://example.com/pic.jpg');
    });

    it('should throw error on invalid URL schemas', () => {
      expect(() => user.updateAvatar('ftp://usp.br/avatar.png')).toThrow('Invalid URL format for avatar');
      expect(() => user.updateAvatar('invalid-url')).toThrow('Invalid URL format for avatar');
    });

    it('should allow clearing the avatarUrl with empty or undefined values', () => {
      user.updateAvatar('');
      expect(user.avatarUrl).toBe('');
    });
  });

  describe('Identity Scrubbing (Anonymization)', () => {
    it('should anonymize all private fields correctly', () => {
      user.updateAvatar('https://usp.br/avatar.png');
      user.availabilityStatus = 'AVAILABLE';
      
      user.scrubIdentity('anon999');

      expect(user.isDeleted).toBe(true);
      expect(user.nusp).toBe('deleted_nusp_anon999');
      expect(user.nickname).toBe('deleted_user_anon999');
      expect(user.email).toBe('deleted_email_anon999@anonymized.usp.br');
      expect(user.fullName).toBe('Deleted User');
      expect(user.avatarUrl).toBeUndefined();
      expect(user.availabilityStatus).toBe('OFFLINE');
    });
  });
});
