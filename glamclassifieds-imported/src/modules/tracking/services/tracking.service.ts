import { Injectable, NotFoundException } from '@nestjs/common';
import { TrackingRepository } from '../repositories/tracking.repository';
import { CreateTrackingLinkDto, RegisterClickDto } from '../dto/tracking.dto';
import { IDashboardStats, ITrackingLink } from '../interfaces/tracking.interface';

@Injectable()
export class TrackingService {
  constructor(private readonly trackingRepository: TrackingRepository) {}

  private generateCode(length = 6): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  async createTrackingLink(creatorId: string, dto: CreateTrackingLinkDto): Promise<{ code: string; url: string }> {
    let code: string;
    let isUnique = false;
    
    // Generate unique code (simulated retry)
    do {
      code = this.generateCode();
      const existing = await this.trackingRepository.findLinkByCode(code);
      if (!existing) isUnique = true;
    } while (!isUnique);

    await this.trackingRepository.createTrackingLink({
      creatorId,
      name: dto.name,
      destinationType: dto.destination_type,
      destinationId: dto.destination_id,
    }, code);

    // In a real environment, URL base comes from Config
    const url = `https://thesex.online/l/${code}`;
    return { code, url };
  }

  async handleRedirect(code: string, query: RegisterClickDto): Promise<{ url: string; visitorId: string; sessionId: string }> {
    const link = await this.trackingRepository.findLinkByCode(code);
    if (!link) {
      throw new NotFoundException('Tracking link not found');
    }

    const visitor = await this.trackingRepository.getVisitor(query.visitor_id);
    const session = await this.trackingRepository.getSession(visitor.id, query.session_id);

    await this.trackingRepository.registerClick({
      visitorId: visitor.id,
      sessionId: session.id,
      trackingLinkId: link.id,
      ip: query.ip || null,
      userAgent: query.user_agent || null,
      referer: query.referer || null,
      utmSource: query.utm_source || null,
      utmMedium: query.utm_medium || null,
      utmCampaign: query.utm_campaign || null,
      timestamp: new Date(),
    });

    const destinationUrl = this.resolveDestinationUrl(link);

    return {
      url: destinationUrl,
      visitorId: visitor.id,
      sessionId: session.id,
    };
  }

  private resolveDestinationUrl(link: ITrackingLink): string {
    // Basic resolution based on entity type. In production, could query the entity slug/status.
    switch (link.destinationType) {
      case 'post':
        return `/post/${link.destinationId}`;
      case 'profile':
        return `/profile/${link.destinationId}`;
      case 'checkout':
        return `/checkout/${link.destinationId}`;
      default:
        return `/`;
    }
  }

  async getDashboardStats(creatorId: string): Promise<IDashboardStats> {
    const links = await this.trackingRepository.findLinksByCreatorId(creatorId);
    const linkIds = links.map(l => l.id);
    
    const clicks = await this.trackingRepository.getClicksByLinks(linkIds);

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    
    const yesterdayEnd = new Date(todayStart);
    yesterdayEnd.setMilliseconds(-1);

    const clicksToday = clicks.filter(c => c.timestamp >= todayStart).length;
    const clicksYesterday = clicks.filter(c => c.timestamp >= yesterdayStart && c.timestamp <= yesterdayEnd).length;

    return {
      totalLinks: links.length,
      totalClicks: clicks.length,
      clicksToday,
      clicksYesterday,
    };
  }
}
