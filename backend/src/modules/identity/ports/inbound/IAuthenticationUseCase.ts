import { PrivateUserDTO } from '../../domain/models/User';

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: PrivateUserDTO;
}

export interface RefreshResult {
  accessToken: string;
  refreshToken: string;
}

export interface IAuthenticationUseCase {
  login(nusp: string, pin: string): Promise<LoginResult>;
  refresh(refreshToken: string): Promise<RefreshResult>;
}

export const IAuthenticationUseCaseToken = Symbol('IAuthenticationUseCase');
