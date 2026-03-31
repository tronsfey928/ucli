import { SetMetadata } from '@nestjs/common'

export const REQUIRED_SCOPES_KEY = 'requiredScopes'

/**
 * Decorator that specifies which scopes are required to access an endpoint.
 * The GroupTokenGuard checks the JWT's `scope` claim against these values.
 * If no scopes are specified, the endpoint is accessible to any valid token.
 */
export const RequiredScopes = (...scopes: string[]) => SetMetadata(REQUIRED_SCOPES_KEY, scopes)
