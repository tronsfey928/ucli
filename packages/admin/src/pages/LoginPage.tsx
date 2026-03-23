import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ping } from '@/lib/api'
import { setAuth } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function LoginPage() {
  const navigate = useNavigate()
  const [serverUrl, setServerUrl] = useState('http://localhost:3000')
  const [adminSecret, setAdminSecret] = useState('')
  const [loading, setLoading] = useState(false)
  const [urlError, setUrlError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const url = serverUrl.trim().replace(/\/$/, '')
    const secret = adminSecret.trim()
    if (!url || !secret) return
    try {
      new URL(url)
      setUrlError('')
    } catch {
      setUrlError('Please enter a valid URL (e.g. http://localhost:3000)')
      return
    }
    setLoading(true)
    try {
      await ping(url, secret)
      setAuth({ serverUrl: url, adminSecret: secret })
      toast.success('Connected successfully')
      navigate('/dashboard', { replace: true })
    } catch {
      toast.error('Connection failed — check the server URL and admin secret')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo / brand */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <i className="ri-hexagon-line text-2xl text-primary" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold">OAS Gateway</h1>
            <p className="text-sm text-muted-foreground">Admin Dashboard</p>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Connect to server</CardTitle>
            <CardDescription>Enter your server URL and admin secret to continue.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="serverUrl">Server URL</Label>
                <Input
                  id="serverUrl"
                  placeholder="http://localhost:3000"
                  value={serverUrl}
                  onChange={e => { setServerUrl(e.target.value); setUrlError('') }}
                  autoComplete="url"
                  required
                />
                {urlError && <p className="text-xs text-destructive">{urlError}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="adminSecret">Admin Secret</Label>
                <Input
                  id="adminSecret"
                  type="password"
                  placeholder="••••••••"
                  value={adminSecret}
                  onChange={e => setAdminSecret(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <i className="ri-loader-4-line animate-spin" />
                    Connecting…
                  </>
                ) : (
                  <>
                    <i className="ri-arrow-right-line" />
                    Connect
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
