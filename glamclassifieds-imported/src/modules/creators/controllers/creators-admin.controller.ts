import { Controller, Get, Headers } from '@nestjs/common';
import { CreatorsService } from '../services/creators.service';
import { CreatorsRepository } from '../repositories/creators.repository';
import { AdminAuthProvider } from '../../core/providers/admin-auth.provider';

@Controller('admin/creators')
export class CreatorsAdminController {
  constructor(
    private readonly creatorsService: CreatorsService,
    private readonly creatorsRepository: CreatorsRepository,
    private readonly adminAuth: AdminAuthProvider
  ) {}

  @Get()
  async listAllCreators(@Headers('authorization') authHeader: string) {
    this.adminAuth.validateAdmin(authHeader);
    return this.creatorsRepository.findAll();
  }
}
