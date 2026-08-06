import { Injectable } from '@nestjs/common';
import { ITrackingLink, IVisitor, ISession, IClick, ICreateTrackingLinkData } from '../interfaces/tracking.interface';
import { randomUUID } from 'crypto';

@Injectable()
export class TrackingRepository {
  private links = new Map<string, ITrackingLink>();
  private visitors = new Map<string, IVisitor>();
  private sessions = new Map<string, ISession>();
  private clicks = new Map<string, IClick>();

  async createTrackingLink(data: ICreateTrackingLinkData, code: string): Promise<ITrackingLink> {
    const link: ITrackingLink = {
      id: randomUUID(),
      creatorId: data.creatorId,
      code,
      name: data.name,
      destinationType: data.destinationType,
      destinationId: data.destinationId,
      createdAt: new Date(),
    };
    this.links.set(link.id, link);
    return link;
  }

  async findLinkByCode(code: string): Promise<ITrackingLink | null> {
    return Array.from(this.links.values()).find((l) => l.code === code) || null;
  }

  async findLinksByCreatorId(creatorId: string): Promise<ITrackingLink[]> {
    return Array.from(this.links.values()).filter((l) => l.creatorId === creatorId);
  }

  async findAllLinks(): Promise<ITrackingLink[]> {
    return Array.from(this.links.values());
  }

  async getVisitor(visitorId?: string): Promise<IVisitor> {
    if (visitorId && this.visitors.has(visitorId)) {
      return this.visitors.get(visitorId)!;
    }
    const visitor: IVisitor = { id: randomUUID(), createdAt: new Date() };
    this.visitors.set(visitor.id, visitor);
    return visitor;
  }

  async getSession(visitorId: string, sessionId?: string): Promise<ISession> {
    if (sessionId && this.sessions.has(sessionId)) {
      return this.sessions.get(sessionId)!;
    }
    const session: ISession = { id: randomUUID(), visitorId, createdAt: new Date() };
    this.sessions.set(session.id, session);
    return session;
  }

  async registerClick(click: Omit<IClick, 'id'>): Promise<IClick> {
    const newClick: IClick = { id: randomUUID(), ...click };
    this.clicks.set(newClick.id, newClick);
    return newClick;
  }

  async findAllClicks(): Promise<IClick[]> {
    return Array.from(this.clicks.values());
  }

  async getClicksByLinks(linkIds: string[]): Promise<IClick[]> {
    const linkIdSet = new Set(linkIds);
    return Array.from(this.clicks.values()).filter((c) => linkIdSet.has(c.trackingLinkId));
  }
}
