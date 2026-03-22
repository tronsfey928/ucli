import { Module } from '@nestjs/common'
import { CryptoModule } from '../crypto/crypto.module'
import { AdminGuard } from './admin.guard'
import { GroupTokenGuard } from './group-token.guard'

@Module({
  imports: [CryptoModule],
  providers: [AdminGuard, GroupTokenGuard],
  exports: [AdminGuard, GroupTokenGuard],
})
export class AuthModule {}
