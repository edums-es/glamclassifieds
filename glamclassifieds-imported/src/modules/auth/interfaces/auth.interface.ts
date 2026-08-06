export interface IJwtPayload {
  sub: string;
  email: string;
  iat?: number;
  exp?: number;
}

export interface IAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface ISession {
  id: string;
  memberId: string;
  deviceInfo: string;
  expiresAt: Date;
}
