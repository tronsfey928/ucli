import { OpenAPIV3 } from 'openapi-types';
import _ from 'lodash';
import { AuthConfig, TokenEnvVar } from '../types/index';

/**
 * Derives an environment variable name from the CLI name and a suffix.
 * e.g.  cliName="my-service" + suffix="TOKEN"  → "MY_SERVICE_TOKEN"
 *       cliName="petstore-v2" + suffix="API_KEY" → "PETSTORE_V2_API_KEY"
 */
function makeEnvVar(cliName: string, suffix: string): string {
  return `${_.snakeCase(cliName).toUpperCase()}_${suffix}`;
}

/**
 * Inspects the securitySchemes block and returns the primary auth configuration.
 *
 * Precedence (first match wins):
 *   bearer with x-cli-token-url  → dynamic (custom token provider)
 *   oauth2 clientCredentials      → oauth2-cc
 *   bearer                        → bearer
 *   apiKey                        → apiKey
 *   basic                         → basic
 *   oauth2 (other flows)          → bearer (treat access token as bearer)
 *   none                          → none
 *
 * All env var names are prefixed with the CLI name in SCREAMING_SNAKE_CASE so
 * multiple generated CLIs can coexist in the same shell environment.
 */
export function extractAuthConfig(
  api: OpenAPIV3.Document,
  cliName: string
): { authConfig: AuthConfig; allAuthSchemes: string[] } {
  const schemes = (api.components?.securitySchemes ?? {}) as Record<
    string,
    OpenAPIV3.SecuritySchemeObject
  >;

  const allAuthSchemes = Object.keys(schemes);
  let authConfig: AuthConfig = { type: 'none', envVar: '' };

  for (const scheme of Object.values(schemes)) {
    const ext = scheme as unknown as Record<string, unknown>;

    // ── dynamic (bearer + x-cli-token-url extension) ─────────────────────────
    if (
      scheme.type === 'http' &&
      (scheme as OpenAPIV3.HttpSecurityScheme).scheme === 'bearer' &&
      typeof ext['x-cli-token-url'] === 'string'
    ) {
      const rawEnvVars = ext['x-cli-token-env-vars'];
      const tokenEnvVars: TokenEnvVar[] = Array.isArray(rawEnvVars)
        ? (rawEnvVars as Array<{ name: string; env: string }>).map((v) => ({
            name: String(v.name),
            env: String(v.env),
          }))
        : [];
      authConfig = {
        type: 'dynamic',
        envVar: '',
        tokenUrl: ext['x-cli-token-url'] as string,
        tokenEnvVars,
      };
      break;
    }

    // ── oauth2 client credentials ─────────────────────────────────────────────
    if (scheme.type === 'oauth2') {
      const oauth2 = scheme as OpenAPIV3.OAuth2SecurityScheme;
      const ccFlow = oauth2.flows.clientCredentials;
      if (ccFlow) {
        authConfig = {
          type: 'oauth2-cc',
          envVar: '',
          tokenUrl: ccFlow.tokenUrl,
          clientIdEnvVar: makeEnvVar(cliName, 'CLIENT_ID'),
          clientSecretEnvVar: makeEnvVar(cliName, 'CLIENT_SECRET'),
          scopesEnvVar: makeEnvVar(cliName, 'SCOPES'),
        };
        break;
      }
      // Other OAuth2 flows — treat resulting access token as bearer
      authConfig = { type: 'bearer', envVar: makeEnvVar(cliName, 'TOKEN') };
      break;
    }

    // ── bearer ────────────────────────────────────────────────────────────────
    if (
      scheme.type === 'http' &&
      (scheme as OpenAPIV3.HttpSecurityScheme).scheme === 'bearer'
    ) {
      authConfig = { type: 'bearer', envVar: makeEnvVar(cliName, 'TOKEN') };
      break;
    }

    // ── apiKey ────────────────────────────────────────────────────────────────
    if (scheme.type === 'apiKey') {
      const ks = scheme as OpenAPIV3.ApiKeySecurityScheme;
      authConfig = {
        type: 'apiKey',
        headerName: ks.name,
        envVar: makeEnvVar(cliName, 'API_KEY'),
      };
      break;
    }

    // ── basic ─────────────────────────────────────────────────────────────────
    if (
      scheme.type === 'http' &&
      (scheme as OpenAPIV3.HttpSecurityScheme).scheme === 'basic'
    ) {
      authConfig = { type: 'basic', envVar: makeEnvVar(cliName, 'CREDENTIALS') };
      break;
    }
  }

  return { authConfig, allAuthSchemes };
}
