import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtHelper } from '../../../domain/services/JwtHelper';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly jwtSecret = process.env.JWT_SECRET || 'gamehub_super_secret_key_12345';

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];
    if (!authHeader) {
      throw new UnauthorizedException('Authorization header missing');
    }

    const [type, token] = authHeader.split(' ');
    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('Invalid authorization format');
    }

    try {
      const payload = JwtHelper.verify(token, this.jwtSecret);
      request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid token or expired');
    }
  }
}
