import { Controller, Post, Body, Req, Res, Inject, HttpStatus, UnauthorizedException } from '@nestjs/common';
import { IAuthenticationUseCase, IAuthenticationUseCaseToken } from '../../ports/inbound/IAuthenticationUseCase';

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(IAuthenticationUseCaseToken)
    private readonly authUseCase: IAuthenticationUseCase,
  ) {}

  @Post('login')
  async login(
    @Body() body: { nusp: string; pin: string },
    @Req() req: any,
    @Res() res: any,
  ) {
    const { nusp, pin } = body;
    const result = await this.authUseCase.login(nusp, pin);

    const isMobile = this.checkIfMobile(req);

    if (!isMobile && res.cookie) {
      // Set HttpOnly secure cookie for web client mode
      res.cookie('refresh_token', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });
      return res.status(HttpStatus.OK).send({
        accessToken: result.accessToken,
        user: result.user,
      });
    }

    // Mobile mode or fallback: return both tokens in JSON response
    return res.status(HttpStatus.OK).send({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: result.user,
    });
  }

  @Post('refresh')
  async refresh(@Req() req: any, @Res() res: any) {
    let token = req.headers['x-refresh-token'] || req.body?.refreshToken;

    if (!token && req.cookies && req.cookies['refresh_token']) {
      token = req.cookies['refresh_token'];
    }

    if (!token && req.headers['cookie']) {
      // Manual cookie parsing if not parsed by middleware
      const cookieStr = req.headers['cookie'];
      const match = cookieStr.match(/refresh_token=([^;]+)/);
      if (match) {
        token = match[1];
      }
    }

    if (!token) {
      throw new UnauthorizedException('Refresh token not provided');
    }

    try {
      const result = await this.authUseCase.refresh(token);
      const isMobile = this.checkIfMobile(req);

      if (!isMobile && res.cookie) {
        res.cookie('refresh_token', result.refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 7 * 24 * 60 * 60 * 1000,
        });
        return res.status(HttpStatus.OK).send({
          accessToken: result.accessToken,
        });
      }

      return res.status(HttpStatus.OK).send({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      });
    } catch (e) {
      throw new UnauthorizedException(e.message || 'Unauthorized refresh');
    }
  }

  private checkIfMobile(req: any): boolean {
    const userAgent = req.headers['user-agent'] || '';
    const isCapacitor = req.headers['x-platform'] || ''; // Custom shell header
    return (
      isCapacitor !== '' ||
      /android/i.test(userAgent) ||
      /iphone|ipad|ipod/i.test(userAgent)
    );
  }
}
