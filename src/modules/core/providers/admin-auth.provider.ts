import { Injectable, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class AdminAuthProvider {
  validateAdmin(authHeader?: string): void {
    // TODO (Sprint 14): Replace this with proper AdminSessionGuard or JwtAuthGuard
    // Currently relies on the environment variable ADMIN_SECRET_TOKEN
    const adminToken = process.env.ADMIN_SECRET_TOKEN;
    
    if (!adminToken) {
      throw new UnauthorizedException('Admin token not configured in environment');
    }

    if (!authHeader || authHeader !== `Bearer ${adminToken}`) {
      throw new UnauthorizedException('Admin access required');
    }
  }
}
