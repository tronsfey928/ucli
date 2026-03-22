import { Injectable, OnModuleInit, Logger } from '@nestjs/common'
import {
  SignJWT,
  jwtVerify,
  generateKeyPair,
  importPKCS8,
  importSPKI,
  exportPKCS8,
  exportSPKI,
  type KeyLike,
} from 'jose'
import { AppConfigService } from '../config/app-config.service'

const ALGORITHM = 'RS256'
const ISSUER = 'oas-server'

export interface JwtPayload {
  sub: string
  jti: string
  scope: string
  group: string
  iss: string
  iat: number
  exp?: number
}

@Injectable()
export class JwtService implements OnModuleInit {
  private readonly logger = new Logger(JwtService.name)
  private privateKey!: KeyLike
  private publicKey!: KeyLike

  constructor(private readonly appConfig: AppConfigService) {}

  async onModuleInit(): Promise<void> {
    if (this.appConfig.jwtPrivateKey && this.appConfig.jwtPublicKey) {
      this.privateKey = await importPKCS8(
        Buffer.from(this.appConfig.jwtPrivateKey, 'base64').toString('utf8'),
        ALGORITHM,
      )
      this.publicKey = await importSPKI(
        Buffer.from(this.appConfig.jwtPublicKey, 'base64').toString('utf8'),
        ALGORITHM,
      )
      this.logger.log('JWT keys loaded from environment')
    } else {
      if (this.appConfig.isProd) {
        throw new Error('JWT_PRIVATE_KEY and JWT_PUBLIC_KEY must be set in production')
      }
      this.logger.warn('Generating ephemeral RS256 key pair — DO NOT use in production')
      const { privateKey, publicKey } = await generateKeyPair(ALGORITHM, { modulusLength: 2048 })
      this.privateKey = privateKey
      this.publicKey = publicKey

      const privPem = await exportPKCS8(privateKey)
      const pubPem = await exportSPKI(publicKey)
      this.logger.debug(`JWT_PRIVATE_KEY=${Buffer.from(privPem).toString('base64')}`)
      this.logger.debug(`JWT_PUBLIC_KEY=${Buffer.from(pubPem).toString('base64')}`)
    }
  }

  async sign(opts: {
    groupId: string
    groupName: string
    jti: string
    scopes: string[]
    expiresAt: Date | null
  }): Promise<string> {
    let builder = new SignJWT({ scope: opts.scopes.join(' '), group: opts.groupName })
      .setProtectedHeader({ alg: ALGORITHM })
      .setIssuer(ISSUER)
      .setSubject(opts.groupId)
      .setJti(opts.jti)
      .setIssuedAt()

    if (opts.expiresAt) {
      builder = builder.setExpirationTime(Math.floor(opts.expiresAt.getTime() / 1000))
    }

    return builder.sign(this.privateKey)
  }

  async verify(token: string): Promise<JwtPayload> {
    const { payload } = await jwtVerify(token, this.publicKey, {
      issuer: ISSUER,
      algorithms: [ALGORITHM],
    })
    return payload as unknown as JwtPayload
  }
}
