import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { CryptoModule } from '../crypto/crypto.module'
import { GroupsModule } from '../groups/groups.module'
import { TokensController } from './tokens.controller'
import { TokensService } from './tokens.service'

@Module({
  imports: [AuthModule, CryptoModule, GroupsModule],
  controllers: [TokensController],
  providers: [TokensService],
  exports: [TokensService],
})
export class TokensModule {}
