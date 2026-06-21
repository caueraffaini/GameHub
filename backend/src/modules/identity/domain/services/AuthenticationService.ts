import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { IAuthenticationUseCase, LoginResult, RefreshResult } from '../../ports/inbound/IAuthenticationUseCase';
import { IUserRepositoryPort, IUserRepositoryPortToken } from '../../ports/outbound/IUserRepositoryPort';
import { PrivateUserDTO } from '../models/User';
import { JwtHelper } from './JwtHelper';

@Injectable()
export class AuthenticationService implements IAuthenticationUseCase {
  private readonly jwtSecret = process.env.JWT_SECRET || 'gamehub_super_secret_key_12345';
  private readonly refreshSecret = process.env.REFRESH_SECRET || 'gamehub_refresh_secret_key_12345';

  constructor(
    @Inject(IUserRepositoryPortToken)
    private readonly userRepo: IUserRepositoryPort,
  ) {}

  async login(nusp: string, pin: string): Promise<LoginResult> {
    const user = await this.userRepo.findByNusp(nusp);
    if (!user || user.isDeleted) {
      throw new UnauthorizedException('Invalid NUSP or PIN');
    }

    const isValid = await user.validatePin(pin);
    if (!isValid) {
      throw new UnauthorizedException('Invalid NUSP or PIN');
    }

    const payload = {
      sub: user.id,
      roles: ['STUDENT'], // Default role for demonstration, can be loaded from user entities
      instituteId: user.instituteId,
      courseId: user.courseId,
    };

    const accessToken = JwtHelper.sign(payload, this.jwtSecret, 15); // 15 mins
    const refreshToken = JwtHelper.sign({ sub: user.id }, this.refreshSecret, 10080); // 7 days (10080 mins)

    return {
      accessToken,
      refreshToken,
      user: PrivateUserDTO.fromEntity(user),
    };
  }

  async refresh(refreshToken: string): Promise<RefreshResult> {
    try {
      const payload = JwtHelper.verify(refreshToken, this.refreshSecret);
      const user = await this.userRepo.findById(payload.sub);
      if (!user || user.isDeleted) {
        throw new UnauthorizedException('User no longer exists or is deleted');
      }

      const newPayload = {
        sub: user.id,
        roles: ['STUDENT'],
        instituteId: user.instituteId,
        courseId: user.courseId,
      };

      const accessToken = JwtHelper.sign(newPayload, this.jwtSecret, 15);
      const newRefreshToken = JwtHelper.sign({ sub: user.id }, this.refreshSecret, 10080);

      return {
        accessToken,
        refreshToken: newRefreshToken,
      };
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }
}
