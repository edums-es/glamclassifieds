import { Controller, Post, Body, HttpCode, HttpStatus, Headers, UsePipes } from '@nestjs/common';
import { AuthService } from '../services/auth.service';
import { SignupSchema, LoginSchema, RefreshTokenSchema, SignupDto, LoginDto, RefreshTokenDto } from '../dto/auth.dto';
import { ZodValidationPipe } from '@/shared/observability/zod-validation.pipe';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @UsePipes(new ZodValidationPipe(SignupSchema))
  async signup(@Body() dto: SignupDto, @Headers('user-agent') userAgent: string) {
    return this.authService.signup(dto, userAgent || 'unknown');
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(LoginSchema))
  async login(@Body() dto: LoginDto, @Headers('user-agent') userAgent: string) {
    return this.authService.login(dto, userAgent || 'unknown');
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(RefreshTokenSchema))
  async refresh(@Body() dto: RefreshTokenDto, @Headers('user-agent') userAgent: string) {
    return this.authService.refreshToken(dto.refreshToken, userAgent || 'unknown');
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UsePipes(new ZodValidationPipe(RefreshTokenSchema))
  async logout(@Body() dto: RefreshTokenDto) {
    await this.authService.logout(dto.refreshToken);
  }
}
