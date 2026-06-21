import * as crypto from 'crypto';

export class JwtHelper {
  static sign(payload: any, secret: string, expiresInMinutes: number): string {
    const header = { alg: 'HS256', typ: 'JWT' };
    const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
    
    const exp = Math.floor(Date.now() / 1000) + (expiresInMinutes * 60);
    const fullPayload = { ...payload, exp };
    const encodedPayload = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
    
    const signature = crypto
      .createHmac('sha256', secret)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest('base64url');
      
    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  static verify(token: string, secret: string): any {
    try {
      const [encodedHeader, encodedPayload, signature] = token.split('.');
      if (!encodedHeader || !encodedPayload || !signature) {
        throw new Error('Invalid token structure');
      }
      const computedSignature = crypto
        .createHmac('sha256', secret)
        .update(`${encodedHeader}.${encodedPayload}`)
        .digest('base64url');
        
      if (computedSignature !== signature) {
        throw new Error('Invalid signature');
      }
      
      const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
      if (payload.exp && payload.exp < Date.now() / 1000) {
        throw new Error('Token expired');
      }
      return payload;
    } catch {
      throw new Error('Token verification failed');
    }
  }
}
