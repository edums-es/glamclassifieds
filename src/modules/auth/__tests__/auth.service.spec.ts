import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../services/auth.service';
import { AuthRepository } from '../repositories/auth.repository';
import { UnauthorizedException, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('AuthService', () => {
  let service: AuthService;
  let repository: AuthRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AuthService, AuthRepository],
    }).compile();

    service = module.get<AuthService>(AuthService);
    repository = module.get<AuthRepository>(AuthRepository);
  });

  describe('signup', () => {
    it('should create a user and return tokens', async () => {
      const dto = { email: 'test@test.com', password: 'password123', name: 'Test User' };
      const tokens = await service.signup(dto, 'test-device');

      expect(tokens).toHaveProperty('accessToken');
      expect(tokens).toHaveProperty('refreshToken');
      expect(tokens).toHaveProperty('expiresIn');
      
      const member = await repository.findMemberByEmail(dto.email);
      expect(member).toBeDefined();
      expect(member.name).toBe(dto.name);
    });

    it('should throw ConflictException if email exists', async () => {
      const dto = { email: 'test@test.com', password: 'password123', name: 'Test User' };
      await service.signup(dto, 'test-device');
      
      await expect(service.signup(dto, 'test-device')).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('should authenticate user and return tokens', async () => {
      const dto = { email: 'login@test.com', password: 'password123', name: 'Test User' };
      await service.signup(dto, 'test-device');

      const tokens = await service.login({ email: dto.email, password: dto.password }, 'test-device');
      expect(tokens).toHaveProperty('accessToken');
    });

    it('should throw UnauthorizedException on invalid password', async () => {
      const dto = { email: 'login2@test.com', password: 'password123', name: 'Test User' };
      await service.signup(dto, 'test-device');

      await expect(service.login({ email: dto.email, password: 'wrongpassword' }, 'test-device')).rejects.toThrow(UnauthorizedException);
    });
  });
});
