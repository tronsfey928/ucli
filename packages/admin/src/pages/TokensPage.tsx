import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { listGroups, listTokens, issueToken, revokeToken, getErrorMessage, type Group, type Token } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate } from '@/lib/utils'

function tokenStatus(token: Token): { label: string; variant: 'success' | 'destructive' | 'warning' | 'secondary' } {
  if (token.revokedAt) return { label: 'revoked', variant: 'destructive' }
  if (token.expiresAt && new Date(token.expiresAt) < new Date()) return { label: 'expired', variant: 'warning' }
  return { label: 'active', variant: 'success' }
}

export default function TokensPage() {
  const [groups, setGroups] = useState<Group[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState<string>('')
  const [tokens, setTokens] = useState<Token[]>([])
  const [loading, setLoading] = useState(true)
  const [tokensLoading, setTokensLoading] = useState(false)

  // Issue dialog
  const [issueOpen, setIssueOpen] = useState(false)
  const [tokenName, setTokenName] = useState('')
  const [ttlSec, setTtlSec] = useState('86400')
  const [issuing, setIssuing] = useState(false)
  const [issuedJwt, setIssuedJwt] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Revoke confirm
  const [revokeTarget, setRevokeTarget] = useState<Token | null>(null)
  const [revoking, setRevoking] = useState(false)

  useEffect(() => {
    void listGroups()
      .then(gs => {
        setGroups(gs)
        if (gs.length > 0) setSelectedGroupId(gs[0]!.id)
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!selectedGroupId) return
    setTokensLoading(true)
    void listTokens(selectedGroupId)
      .then(setTokens)
      .catch(() => toast.error('Failed to load tokens'))
      .finally(() => setTokensLoading(false))
  }, [selectedGroupId])

  async function handleIssue(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedGroupId) return
    setIssuing(true)
    try {
      const result = await issueToken(selectedGroupId, {
        name: tokenName.trim(),
        ttlSec: parseInt(ttlSec, 10) || undefined,
      })
      setIssuedJwt(result.jwt)
      setTokenName('')
      // Refresh list
      const updated = await listTokens(selectedGroupId)
      setTokens(updated)
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Failed to issue token'))
    } finally {
      setIssuing(false)
    }
  }

  async function handleRevoke() {
    if (!revokeTarget) return
    setRevoking(true)
    try {
      await revokeToken(revokeTarget.id)
      toast.success('Token revoked')
      setRevokeTarget(null)
      const updated = await listTokens(selectedGroupId)
      setTokens(updated)
    } catch {
      toast.error('Failed to revoke token')
    } finally {
      setRevoking(false)
    }
  }

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [copied])

  function handleCopy() {
    if (!issuedJwt) return
    void navigator.clipboard.writeText(issuedJwt).then(() => setCopied(true))
  }

  function closeIssueDialog() {
    setIssueOpen(false)
    setIssuedJwt(null)
    setCopied(false)
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <i className="ri-loader-4-line animate-spin text-2xl text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Tokens</h2>
          <p className="text-sm text-muted-foreground">Group JWTs (RS256) for client authentication</p>
        </div>
        <Button onClick={() => { setIssueOpen(true); setIssuedJwt(null) }} disabled={!selectedGroupId}>
          <i className="ri-key-2-line" />
          Issue Token
        </Button>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-md border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800 flex items-center gap-2">
          <i className="ri-alert-line" />
          Create a group first to issue tokens.
        </div>
      ) : (
        <>
          {/* Group selector */}
          <div className="flex items-center gap-3">
            <Label className="shrink-0 text-sm">Group:</Label>
            <div className="w-56">
              <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {groups.map(g => (
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {tokensLoading ? (
            <div className="flex justify-center py-12">
              <i className="ri-loader-4-line animate-spin text-2xl text-muted-foreground" />
            </div>
          ) : tokens.length === 0 ? (
            <div className="rounded-lg border border-dashed py-12 text-center text-muted-foreground">
              <i className="ri-key-line text-3xl block mb-2" />
              <p className="text-sm">No tokens for this group.</p>
            </div>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="w-20" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tokens.map(t => {
                    const { label, variant } = tokenStatus(t)
                    return (
                      <TableRow key={t.id}>
                        <TableCell className="font-mono font-medium">{t.name}</TableCell>
                        <TableCell>
                          <Badge variant={variant}>{label}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {t.expiresAt ? formatDate(t.expiresAt) : <span className="italic">never</span>}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatDate(t.createdAt)}</TableCell>
                        <TableCell>
                          {!t.revokedAt && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => setRevokeTarget(t)}
                            >
                              <i className="ri-forbid-line" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}

      {/* Issue dialog */}
      <Dialog open={issueOpen} onOpenChange={open => !open && closeIssueDialog()}>
        <DialogContent className="sm:max-w-md">
          {!issuedJwt ? (
            <>
              <DialogHeader>
                <DialogTitle>Issue Token</DialogTitle>
                <DialogDescription>
                  Issue a new RS256-signed JWT for group <strong>{groups.find(g => g.id === selectedGroupId)?.name}</strong>.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleIssue} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="tname">Token name <span className="text-destructive">*</span></Label>
                  <Input
                    id="tname"
                    placeholder="agent-prod"
                    value={tokenName}
                    onChange={e => setTokenName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tttl">TTL (seconds)</Label>
                  <Input
                    id="tttl"
                    type="number"
                    min="0"
                    placeholder="86400"
                    value={ttlSec}
                    onChange={e => setTtlSec(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">0 = never expires</p>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={closeIssueDialog}>Cancel</Button>
                  <Button type="submit" disabled={issuing}>
                    {issuing && <i className="ri-loader-4-line animate-spin" />}
                    Issue
                  </Button>
                </DialogFooter>
              </form>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-green-700">
                  <i className="ri-checkbox-circle-line text-lg" />
                  Token issued!
                </DialogTitle>
                <DialogDescription>
                  Copy your JWT now — <strong>it will not be shown again</strong>.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <Textarea
                  readOnly
                  value={issuedJwt}
                  rows={4}
                  className="font-mono text-xs break-all bg-muted"
                />
                <Button className="w-full" variant="outline" onClick={handleCopy}>
                  <i className={copied ? 'ri-checkbox-circle-line text-green-600' : 'ri-clipboard-line'} />
                  {copied ? 'Copied!' : 'Copy to clipboard'}
                </Button>
              </div>
              <DialogFooter>
                <Button onClick={closeIssueDialog}>Done</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Revoke confirm */}
      <Dialog open={!!revokeTarget} onOpenChange={open => !open && setRevokeTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Revoke token?</DialogTitle>
            <DialogDescription>
              This will immediately revoke <strong>{revokeTarget?.name}</strong>. Any client using this
              token will lose access. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleRevoke} disabled={revoking}>
              {revoking && <i className="ri-loader-4-line animate-spin" />}
              Revoke
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
