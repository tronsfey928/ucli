import { Module } from '@nestjs/common'
import { JwtService } from './jwt.service'
import { EncryptionService } from './encryption.service'

@Module({
  providers: [JwtService, EncryptionService],
  exports: [JwtService, EncryptionService],
})
export class CryptoModule {}
