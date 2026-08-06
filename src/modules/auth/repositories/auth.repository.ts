import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ISession } from '../interfaces/auth.interface';

// In a real application, this would interact with the database via Kysely
// and Redis for session management. For the scope of this implementation,
// we'll mock the repository layer as requested by the test strategy.

@Injectable()
export class AuthRepository {
  private sessions = new Map<string, ISession>();
  private members = new Map<string, any>(); // Mock member table

  async createMember(data: any): Promise<any> {
    const member = {
      id: randomUUID(),
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.members.set(member.email, member);
    return member;
  }

  async findMemberByEmail(email: string): Promise<any | null> {
    return this.members.get(email) || null;
  }

  async createSession(memberId: string, deviceInfo: string): Promise<ISession> {
    const session: ISession = {
      id: randomUUID(),
      memberId,
      deviceInfo,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    };
    this.sessions.set(session.id, session);
    return session;
  }

  async findSessionById(sessionId: string): Promise<ISession | null> {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    if (session.expiresAt < new Date()) {
      this.sessions.delete(sessionId);
      return null;
    }
    return session;
  }

  async revokeSession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }
}
