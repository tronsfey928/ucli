/**
 * HTTP client for the oas-server API.
 * Attaches group JWT and handles common error cases.
 */
import axios, { type AxiosInstance } from 'axios'
import type { CLIConfig } from '../config.js'

export interface OASEntryPublic {
  id: string
  name: string
  description: string
  remoteUrl: string
  baseEndpoint: string | null
  authType: 'bearer' | 'api_key' | 'basic' | 'oauth2_cc' | 'none'
  authConfig: Record<string, unknown>
  cacheTtl: number
}

export class ServerClient {
  private http: AxiosInstance

  constructor(cfg: CLIConfig) {
    this.http = axios.create({
      baseURL: cfg.serverUrl.replace(/\/$/, ''),
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        'Content-Type': 'application/json',
      },
      timeout: 15_000,
    })

    this.http.interceptors.response.use(
      (r) => r,
      (err: unknown) => {
        if (axios.isAxiosError(err)) {
          const status = err.response?.status
          const message = (err.response?.data as { message?: string })?.message ?? err.message

          if (status === 401) {
            console.error('Authentication failed. Run: oas-cli configure --server <url> --token <jwt>')
            process.exit(1)
          }

          throw new Error(`Server error ${status ?? 'unknown'}: ${message}`)
        }
        throw err
      },
    )
  }

  async listOAS(): Promise<OASEntryPublic[]> {
    const { data } = await this.http.get<OASEntryPublic[]>('/api/v1/oas')
    return data
  }

  async getOAS(name: string): Promise<OASEntryPublic> {
    const { data } = await this.http.get<OASEntryPublic>(`/api/v1/oas/${encodeURIComponent(name)}`)
    return data
  }
}
