import { DynamicModule, Logger, Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AppConfigService } from '../config/app-config.service'
import { GROUP_REPO, TOKEN_REPO, OAS_REPO, MCP_REPO } from './storage.tokens'
import { MemoryGroupRepo } from './memory/memory-group.repo'
import { MemoryTokenRepo } from './memory/memory-token.repo'
import { MemoryOASRepo } from './memory/memory-oas.repo'
import { MemoryMCPRepo } from './memory/memory-mcp.repo'
import { TypeORMGroupRepo } from './typeorm/typeorm-group.repo'
import { TypeORMTokenRepo } from './typeorm/typeorm-token.repo'
import { TypeORMOASRepo } from './typeorm/typeorm-oas.repo'
import { TypeORMMCPRepo } from './typeorm/typeorm-mcp.repo'
import { GroupEntity } from './typeorm/entities/group.entity'
import { TokenEntity } from './typeorm/entities/token.entity'
import { OASEntryEntity } from './typeorm/entities/oas-entry.entity'
import { McpEntryEntity } from './typeorm/entities/mcp-entry.entity'

const logger = new Logger('StorageModule')

@Module({})
export class StorageModule {
  static forRoot(): DynamicModule {
    const dbType = (process.env['DB_TYPE'] ?? 'memory') as 'memory' | 'postgres' | 'mysql'

    if (dbType === 'memory') {
      logger.log('Storage adapter: memory (in-process, data lost on restart)')
      return {
        global: true,
        module: StorageModule,
        providers: [
          MemoryGroupRepo,
          MemoryTokenRepo,
          MemoryOASRepo,
          MemoryMCPRepo,
          { provide: GROUP_REPO, useExisting: MemoryGroupRepo },
          { provide: TOKEN_REPO, useExisting: MemoryTokenRepo },
          { provide: OAS_REPO, useExisting: MemoryOASRepo },
          { provide: MCP_REPO, useExisting: MemoryMCPRepo },
        ],
        exports: [GROUP_REPO, TOKEN_REPO, OAS_REPO, MCP_REPO],
      }
    }

    logger.log(`Storage adapter: typeorm/${dbType}`)
    return {
      global: true,
      module: StorageModule,
      imports: [
        TypeOrmModule.forRootAsync({
          inject: [AppConfigService],
          useFactory: (cfg: AppConfigService) => ({
            type: dbType as 'postgres' | 'mysql',
            url: cfg.databaseUrl,
            entities: [GroupEntity, TokenEntity, OASEntryEntity, McpEntryEntity],
            synchronize: cfg.isDev, // auto-create tables in dev; use migrations in prod
            logging: cfg.isDev,
          }),
        }),
        TypeOrmModule.forFeature([GroupEntity, TokenEntity, OASEntryEntity, McpEntryEntity]),
      ],
      providers: [
        TypeORMGroupRepo,
        TypeORMTokenRepo,
        TypeORMOASRepo,
        TypeORMMCPRepo,
        { provide: GROUP_REPO, useExisting: TypeORMGroupRepo },
        { provide: TOKEN_REPO, useExisting: TypeORMTokenRepo },
        { provide: OAS_REPO, useExisting: TypeORMOASRepo },
        { provide: MCP_REPO, useExisting: TypeORMMCPRepo },
      ],
      exports: [GROUP_REPO, TOKEN_REPO, OAS_REPO, MCP_REPO],
    }
  }
}
