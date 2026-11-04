import { Global, Module } from '@nestjs/common';
import { RolesController } from './roles.controller.js';
import { RolesService } from './roles.service.js';

@Global()
@Module({ controllers: [RolesController], providers: [RolesService], exports: [RolesService] })
export class RolesModule {}
