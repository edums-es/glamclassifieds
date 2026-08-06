import { Controller, Post, Get, Body, Param, Query, Headers, UnauthorizedException, Res, UsePipes } from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { TrackingService } from '../services/tracking.service';
import { CreateTrackingLinkSchema, CreateTrackingLinkDto, RegisterClickSchema } from '../dto/tracking.dto';
import { ZodValidationPipe } from '@/shared/observability/zod-validation.pipe';

@Controller('tracking')
export class TrackingController {
  constructor(private readonly trackingService: TrackingService) {}

  private getUserIdFromHeader(authHeader?: string): string {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid authorization header');
    }
    return authHeader.split(' ')[1];
  }

  @Post('links')
  @UsePipes(new ZodValidationPipe(CreateTrackingLinkSchema))
  async createLink(
    @Headers('authorization') authHeader: string,
    @Body() dto: CreateTrackingLinkDto
  ) {
    const creatorId = this.getUserIdFromHeader(authHeader);
    return this.trackingService.createTrackingLink(creatorId, dto);
  }

  @Get('dashboard/:creatorId')
  async getDashboard(
    @Param('creatorId') creatorId: string,
    @Headers('authorization') authHeader: string
  ) {
    const requestorId = this.getUserIdFromHeader(authHeader);
    if (requestorId !== creatorId) {
      throw new UnauthorizedException('You can only view your own tracking dashboard');
    }
    return this.trackingService.getDashboardStats(creatorId);
  }
}

@Controller('l')
export class TrackingRedirectController {
  constructor(private readonly trackingService: TrackingService) {}

  @Get(':code')
  async redirect(
    @Param('code') code: string,
    @Query() query: any,
    @Res() res: FastifyReply
  ) {
    // Manually validating query for redirect to avoid pipe throwing 400 and breaking navigation
    const validatedQuery = RegisterClickSchema.safeParse(query);
    const clickData = validatedQuery.success ? validatedQuery.data : {};

    try {
      const { url, visitorId, sessionId } = await this.trackingService.handleRedirect(code, clickData);
      
      // We would normally set Cookies here for visitor_id and session_id
      // res.setCookie('tso_vid', visitorId);
      // res.setCookie('tso_sid', sessionId);

      return res.redirect(302, url);
    } catch (error) {
      return res.redirect(302, '/'); // Fallback gracefully if not found
    }
  }
}
