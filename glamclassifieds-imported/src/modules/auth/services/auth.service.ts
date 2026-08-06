import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { AuthRepository } from '../repositories/auth.repository';
import { SignupDto, LoginDto } from '../dto/auth.dto';
import { IAuthTokens, IJwtPayload } from '../interfaces/auth.interface';

@Injectable()
export class AuthService {
  private readonly jwtSecret = process.env.JWT_SECRET || 'super-secret-key-for-dev-only';
  private readonly jwtExpiresIn = 15 * 60; // 15 minutes in seconds

  constructor(private readonly authRepository: AuthRepository) {}

  async signup(dto: SignupDto, deviceInfo: string): Promise<IAuthTokens> {
    const existingMember = await this.authRepository.findMemberByEmail(dto.email);
    if (existingMember) {
      throw new ConflictException('Email already in use');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 12);
    
    const member = await this.authRepository.createMember({
      email: dto.email,
      name: dto.name,
      passwordHash: hashedPassword,
    });

    return this.generateTokens(member.id, member.email, deviceInfo);
  }

  async login(dto: LoginDto, deviceInfo: string): Promise<IAuthTokens> {
    const member = await this.authRepository.findMemberByEmail(dto.email);
    
    if (!member) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, member.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.generateTokens(member.id, member.email, deviceInfo);
  }

  async refreshToken(refreshTokenId: string, deviceInfo: string): Promise<IAuthTokens> {
    const session = await this.authRepository.findSessionById(refreshTokenId);
    
    if (!session) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Revoke old session and create a new one (Token Rotation)
    await this.authRepository.revokeSession(refreshTokenId);
    
    // In a real scenario we'd fetch the member to get the email
    // For this mock, we'll use a placeholder email
    const memberEmail = `user-${session.memberId}@example.com`; 
    
    return this.generateTokens(session.memberId, memberEmail, deviceInfo);
  }

  async logout(refreshTokenId: string): Promise<void> {
    await this.authRepository.revokeSession(refreshTokenId);
  }

  private async generateTokens(memberId: string, email: string, deviceInfo: string): Promise<IAuthTokens> {
    const payload: IJwtPayload = { sub: memberId, email };
    
    const accessToken = jwt.sign(payload, this.jwtSecret, { 
      expiresIn: this.jwtExpiresIn 
    });

    const session = await this.authRepository.createSession(memberId, deviceInfo);

    return {
      accessToken,
      refreshToken: session.id, // Using UUIDv7 session ID as refresh token
      expiresIn: this.jwtExpiresIn,
    };
  }
}
