import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { CryptoModule } from '../crypto/crypto.module'
import { AdminOASController } from './admin-oas.controller'
import { ClientOASController } from './client-oas.controller'
import { OASService } from './oas.service'

@Module({
  imports: [AuthModule, CryptoModule],
  controllers: [AdminOASController, ClientOASController],
  providers: [OASService],
})
export class OASModule {}
