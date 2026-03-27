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
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate } from '@/lib/utils'
import { useI18n } from '@/lib/i18n'

export default function TokensPage() {
  const { t } = useI18n()
  const [groups, setGroups] = useState<Group[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState<string>('')
  const [tokens, setTokens] = useState<Token[]>([])
  const [loading, setLoading] = useState(true)
  const [tokensLoading, setTokensLoading] = useState(false)

  const [issueOpen, setIssueOpen] = useState(false)
  const [tokenName, setTokenName] = useState('')
  const [ttlSec, setTtlSec] = useState('86400')
  const [issuing, setIssuing] = useState(false)
  const [issuedJwt, setIssuedJwt] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

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
      .catch(() => toast.error(t('tokens_load_error')))
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
      const updated = await listTokens(selectedGroupId)
      setTokens(updated)
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, t('tokens_issue_error')))
    } finally {
      setIssuing(false)
    }
  }

  async function handleRevoke() {
    if (!revokeTarget) return
    setRevoking(true)
    try {
      await revokeToken(revokeTarget.id)
      toast.success(t('tokens_revoke_success'))
      setRevokeTarget(null)
      const updated = await listTokens(selectedGroupId)
      setTokens(updated)
    } catch {
      toast.error(t('tokens_revoke_error'))
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

  function tokenStatus(token: Token): { label: string; variant: 'success' | 'destructive' | 'warning' | 'secondary' } {
    if (token.revokedAt) return { label: t('tokens_status_revoked'), variant: 'destructive' }
    if (token.expiresAt && new Date(token.expiresAt) < new Date()) return { label: t('tokens_status_expired'), variant: 'warning' }
    return { label: t('tokens_status_active'), variant: 'success' }
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
          <h2 className="text-2xl font-bold tracking-tight">{t('tokens_title')}</h2>
          <p className="text-sm text-muted-foreground">{t('tokens_subtitle')}</p>
        </div>
        <Button onClick={() => { setIssueOpen(true); setIssuedJwt(null) }} disabled={!selectedGroupId}>
          <i className="ri-key-2-line" />
          {t('tokens_issue')}
        </Button>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-md border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800 flex items-center gap-2">
          <i className="ri-alert-line" />
          {t('tokens_group_required')}
        </div>
      ) : (
        <>
          {/* Group selector */}
          <div className="flex items-center gap-3">
            <Label className="shrink-0 text-sm">{t('tokens_group_label')}</Label>
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
              <p className="text-sm">{t('tokens_no_tokens')}</p>
            </div>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('tokens_col_name')}</TableHead>
                    <TableHead>{t('tokens_col_status')}</TableHead>
                    <TableHead>{t('tokens_col_expires')}</TableHead>
                    <TableHead>{t('tokens_col_created')}</TableHead>
                    <TableHead className="w-20" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tokens.map(tk => {
                    const { label, variant } = tokenStatus(tk)
                    return (
                      <TableRow key={tk.id}>
                        <TableCell className="font-mono font-medium">{tk.name}</TableCell>
                        <TableCell>
                          <Badge variant={variant}>{label}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {tk.expiresAt ? formatDate(tk.expiresAt) : <span className="italic">{t('tokens_never')}</span>}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatDate(tk.createdAt)}</TableCell>
                        <TableCell>
                          {!tk.revokedAt && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => setRevokeTarget(tk)}
                                >
                                  <i className="ri-forbid-line" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>{t('common_revoke')}</TooltipContent>
                            </Tooltip>
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
                <DialogTitle>{t('tokens_issue_title')}</DialogTitle>
                <DialogDescription>
                  {t('tokens_issue_desc_prefix')} <strong>{groups.find(g => g.id === selectedGroupId)?.name}</strong>.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleIssue} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="tname">{t('tokens_field_name')} <span className="text-destructive">{t('common_required')}</span></Label>
                  <Input
                    id="tname"
                    placeholder="agent-prod"
                    value={tokenName}
                    onChange={e => setTokenName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tttl">{t('tokens_field_ttl')}</Label>
                  <Input
                    id="tttl"
                    type="number"
                    min="0"
                    placeholder="86400"
                    value={ttlSec}
                    onChange={e => setTtlSec(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">{t('tokens_ttl_hint')}</p>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={closeIssueDialog}>{t('common_cancel')}</Button>
                  <Button type="submit" disabled={issuing}>
                    {issuing && <i className="ri-loader-4-line animate-spin" />}
                    {t('common_issue')}
                  </Button>
                </DialogFooter>
              </form>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-green-700">
                  <i className="ri-checkbox-circle-line text-lg" />
                  {t('tokens_issued_title')}
                </DialogTitle>
                <DialogDescription>
                  {t('tokens_issued_desc')}
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
                  {copied ? t('tokens_copied') : t('tokens_copy')}
                </Button>
              </div>
              <DialogFooter>
                <Button onClick={closeIssueDialog}>{t('tokens_done')}</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Revoke confirm */}
      <AlertDialog open={!!revokeTarget} onOpenChange={open => !open && setRevokeTarget(null)}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('tokens_revoke_title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('tokens_revoke_desc_prefix')} <strong>{revokeTarget?.name}</strong>{t('tokens_revoke_desc_suffix')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common_cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleRevoke}
              disabled={revoking}
            >
              {revoking && <i className="ri-loader-4-line animate-spin" />}
              {t('common_revoke')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
