import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { CryptoModule } from '../crypto/crypto.module'
import { AdminMCPController } from './admin-mcp.controller'
import { ClientMCPController } from './client-mcp.controller'
import { MCPService } from './mcp.service'

@Module({
  imports: [AuthModule, CryptoModule],
  controllers: [AdminMCPController, ClientMCPController],
  providers: [MCPService],
})
export class MCPModule {}
