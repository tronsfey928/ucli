import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  listOAS, listGroups, createOAS, updateOAS, deleteOAS, probeOAS, getErrorMessage,
  type OASEntry, type Group, type AuthType, type OASProbeResult, type OASEndpoint,
} from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
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

const AUTH_TYPES: AuthType[] = ['none', 'bearer', 'api_key', 'basic', 'oauth2_cc']

// ─── Auth fields state ───────────────────────────────────────────────────────

interface OASAuthFields {
  bearerToken: string
  apiKeyKey: string
  apiKeyIn: 'header' | 'query'
  apiKeyName: string
  basicUsername: string
  basicPassword: string
  oauth2TokenUrl: string
  oauth2ClientId: string
  oauth2ClientSecret: string
  oauth2Scopes: string
}

const EMPTY_AUTH_FIELDS: OASAuthFields = {
  bearerToken: '',
  apiKeyKey: '',
  apiKeyIn: 'header',
  apiKeyName: 'X-API-Key',
  basicUsername: '',
  basicPassword: '',
  oauth2TokenUrl: '',
  oauth2ClientId: '',
  oauth2ClientSecret: '',
  oauth2Scopes: '',
}

function parseOASAuthFields(config: Record<string, unknown>): OASAuthFields {
  const f = { ...EMPTY_AUTH_FIELDS }
  const t = config['type'] as string
  if (t === 'bearer') {
    f.bearerToken = String(config['token'] ?? '')
  } else if (t === 'api_key') {
    f.apiKeyKey = String(config['key'] ?? '')
    f.apiKeyIn = (config['in'] === 'query' ? 'query' : 'header')
    f.apiKeyName = String(config['name'] ?? 'X-API-Key')
  } else if (t === 'basic') {
    f.basicUsername = String(config['username'] ?? '')
    f.basicPassword = String(config['password'] ?? '')
  } else if (t === 'oauth2_cc') {
    f.oauth2TokenUrl = String(config['tokenUrl'] ?? '')
    f.oauth2ClientId = String(config['clientId'] ?? '')
    f.oauth2ClientSecret = String(config['clientSecret'] ?? '')
    const scopes = config['scopes']
    f.oauth2Scopes = Array.isArray(scopes) ? scopes.join(', ') : ''
  }
  return f
}

function buildOASAuthConfig(authType: AuthType, f: OASAuthFields): Record<string, unknown> {
  switch (authType) {
    case 'bearer':
      return { type: 'bearer', token: f.bearerToken }
    case 'api_key':
      return { type: 'api_key', key: f.apiKeyKey, in: f.apiKeyIn, name: f.apiKeyName }
    case 'basic':
      return { type: 'basic', username: f.basicUsername, password: f.basicPassword }
    case 'oauth2_cc': {
      const scopes = f.oauth2Scopes
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
      return { type: 'oauth2_cc', tokenUrl: f.oauth2TokenUrl, clientId: f.oauth2ClientId, clientSecret: f.oauth2ClientSecret, scopes }
    }
    default:
      return { type: 'none' }
  }
}

// ─── Form ────────────────────────────────────────────────────────────────────

type FormMode = 'create' | 'edit'

interface OASForm {
  groupId: string
  name: string
  description: string
  remoteUrl: string
  baseEndpoint: string
  authType: AuthType
  cacheTtl: string
  enabled: boolean
}

const EMPTY_FORM: OASForm = {
  groupId: '',
  name: '',
  description: '',
  remoteUrl: '',
  baseEndpoint: '',
  authType: 'none',
  cacheTtl: '3600',
  enabled: true,
}

export default function OASPage() {
  const { t } = useI18n()
  const [entries, setEntries] = useState<OASEntry[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [mode, setMode] = useState<FormMode>('create')
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<OASForm>(EMPTY_FORM)
  const [authFields, setAuthFields] = useState<OASAuthFields>(EMPTY_AUTH_FIELDS)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const [deleteTarget, setDeleteTarget] = useState<OASEntry | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Probe state
  const [probing, setProbing] = useState(false)
  const [probeResult, setProbeResult] = useState<OASProbeResult | null>(null)
  const [importUrl, setImportUrl] = useState('')

  async function load() {
    try {
      const [e, g] = await Promise.all([listOAS(), listGroups()])
      setEntries(e)
      setGroups(g)
    } catch {
      toast.error(t('oas_load_error'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  function openCreate() {
    setMode('create')
    setEditId(null)
    setForm({ ...EMPTY_FORM, groupId: groups[0]?.id ?? '' })
    setAuthFields(EMPTY_AUTH_FIELDS)
    setFormError('')
    setProbeResult(null)
    setImportUrl('')
    setDialogOpen(true)
  }

  function openEdit(entry: OASEntry) {
    setMode('edit')
    setEditId(entry.id)
    setForm({
      groupId: entry.groupId,
      name: entry.name,
      description: entry.description ?? '',
      remoteUrl: entry.remoteUrl,
      baseEndpoint: entry.baseEndpoint ?? '',
      authType: entry.authType,
      cacheTtl: String(entry.cacheTtl),
      enabled: entry.enabled,
    })
    setAuthFields(parseOASAuthFields(entry.authConfig as Record<string, unknown>))
    setFormError('')
    setProbeResult(null)
    setImportUrl('')
    setDialogOpen(true)
  }

  function setField<K extends keyof OASForm>(key: K, value: OASForm[K]) {
    setForm(f => ({ ...f, [key]: value }))
    if (key === 'authType') {
      setAuthFields(EMPTY_AUTH_FIELDS)
    }
  }

  function setAuth<K extends keyof OASAuthFields>(key: K, value: OASAuthFields[K]) {
    setAuthFields(f => ({ ...f, [key]: value }))
  }

  async function handleProbe() {
    const url = importUrl.trim() || form.remoteUrl.trim()
    if (!url) return
    setProbing(true)
    setProbeResult(null)
    try {
      const result = await probeOAS(url)
      setProbeResult(result)
      // Auto-fill form fields from spec
      if (mode === 'create') {
        const autoName = (result.title || '').toLowerCase().replace(/[^a-z0-9\-_]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 100)
        setForm(f => ({
          ...f,
          name: f.name || autoName,
          description: f.description || result.description || '',
          remoteUrl: f.remoteUrl || url,
          baseEndpoint: f.baseEndpoint || (result.servers[0] ?? ''),
        }))
        if (!form.remoteUrl) {
          setImportUrl('')
        }
      }
      toast.success(t('oas_probe_success'))
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, t('oas_probe_error')))
    } finally {
      setProbing(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')
    setSaving(true)
    try {
      const payload = {
        groupId: form.groupId,
        name: form.name.trim(),
        description: form.description.trim(),
        remoteUrl: form.remoteUrl.trim(),
        baseEndpoint: form.baseEndpoint.trim() || undefined,
        authType: form.authType,
        authConfig: buildOASAuthConfig(form.authType, authFields),
        cacheTtl: parseInt(form.cacheTtl, 10) || 3600,
      }

      if (mode === 'create') {
        await createOAS(payload)
        toast.success(t('oas_create_success'))
      } else {
        await updateOAS(editId!, { ...payload, enabled: form.enabled })
        toast.success(t('oas_update_success'))
      }
      setDialogOpen(false)
      void load()
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, `Failed to ${mode} OAS entry`))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteOAS(deleteTarget.id)
      toast.success(t('oas_delete_success'))
      setDeleteTarget(null)
      void load()
    } catch {
      toast.error(t('oas_delete_error'))
    } finally {
      setDeleting(false)
    }
  }

  const groupName = (id: string) => groups.find(g => g.id === id)?.name ?? id.slice(0, 8)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t('oas_title')}</h2>
          <p className="text-sm text-muted-foreground">{t('oas_subtitle')}</p>
        </div>
        <Button onClick={openCreate} disabled={groups.length === 0}>
          <i className="ri-upload-cloud-line" />
          {t('oas_import')}
        </Button>
      </div>

      {groups.length === 0 && !loading && (
        <div className="rounded-md border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800 flex items-center gap-2">
          <i className="ri-alert-line" />
          {t('oas_group_required')}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <i className="ri-loader-4-line animate-spin text-2xl text-muted-foreground" />
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-lg border border-dashed py-12 text-center text-muted-foreground">
          <i className="ri-file-code-line text-3xl block mb-2" />
          <p className="text-sm">{t('oas_no_entries')}</p>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('oas_col_name')}</TableHead>
                <TableHead>{t('oas_col_group')}</TableHead>
                <TableHead>{t('oas_col_auth')}</TableHead>
                <TableHead>{t('oas_col_status')}</TableHead>
                <TableHead>{t('oas_col_remote_url')}</TableHead>
                <TableHead>{t('oas_col_updated')}</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map(entry => (
                <TableRow key={entry.id}>
                  <TableCell className="font-mono font-medium">{entry.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{groupName(entry.groupId)}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{entry.authType}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={entry.enabled ? 'success' : 'secondary'}>
                      {entry.enabled ? t('common_enabled') : t('common_disabled')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                    {entry.remoteUrl}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{formatDate(entry.updatedAt)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" onClick={() => openEdit(entry)}>
                            <i className="ri-edit-line" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t('common_edit')}</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => setDeleteTarget(entry)}
                          >
                            <i className="ri-delete-bin-line" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t('common_delete')}</TooltipContent>
                      </Tooltip>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{mode === 'create' ? t('oas_dialog_create_title') : t('oas_dialog_edit_title')}</DialogTitle>
            <DialogDescription>
              {mode === 'create' ? t('oas_dialog_create_desc') : t('oas_dialog_edit_desc')}
            </DialogDescription>
          </DialogHeader>

          {/* Auto-import from URL */}
          {mode === 'create' && (
            <div className="space-y-1.5 rounded-md border border-dashed p-3 bg-muted/30">
              <Label className="text-xs text-muted-foreground">{t('oas_probe_import_url')}</Label>
              <div className="flex gap-2">
                <Input
                  placeholder={t('oas_probe_import_url_placeholder')}
                  value={importUrl}
                  onChange={e => setImportUrl(e.target.value)}
                  type="url"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={probing || !importUrl.trim()}
                  onClick={handleProbe}
                  className="shrink-0"
                >
                  {probing ? <i className="ri-loader-4-line animate-spin" /> : <i className="ri-download-cloud-line" />}
                  {probing ? t('oas_probe_fetching') : t('oas_probe_fetch')}
                </Button>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="oname">{t('oas_field_name')} <span className="text-destructive">{t('common_required')}</span></Label>
                <Input
                  id="oname"
                  placeholder="payments-api"
                  value={form.name}
                  onChange={e => setField('name', e.target.value)}
                  required
                  disabled={mode === 'edit'}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t('oas_field_group')} <span className="text-destructive">{t('common_required')}</span></Label>
                <Select value={form.groupId} onValueChange={v => setField('groupId', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('oas_select_group')} />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map(g => (
                      <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="odesc">{t('oas_field_desc')}</Label>
              <Input
                id="odesc"
                placeholder="Optional description"
                value={form.description}
                onChange={e => setField('description', e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ourl">{t('oas_field_remote_url')} <span className="text-destructive">{t('common_required')}</span></Label>
              <div className="flex gap-2">
                <Input
                  id="ourl"
                  placeholder="https://api.example.com/openapi.json"
                  type="url"
                  value={form.remoteUrl}
                  onChange={e => setField('remoteUrl', e.target.value)}
                  required
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={probing || !form.remoteUrl.trim()}
                  onClick={handleProbe}
                  className="shrink-0"
                >
                  {probing ? <i className="ri-loader-4-line animate-spin" /> : <i className="ri-search-eye-line" />}
                  {probing ? t('oas_probe_fetching') : t('oas_probe_fetch')}
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="obase">{t('oas_field_base_endpoint')}</Label>
              <Input
                id="obase"
                placeholder="https://api.example.com (optional)"
                type="url"
                value={form.baseEndpoint}
                onChange={e => setField('baseEndpoint', e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{t('oas_field_auth_type')} <span className="text-destructive">{t('common_required')}</span></Label>
                <Select value={form.authType} onValueChange={v => setField('authType', v as AuthType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AUTH_TYPES.map(tp => (
                      <SelectItem key={tp} value={tp}>{tp}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ottl">{t('oas_field_cache_ttl')}</Label>
                <Input
                  id="ottl"
                  type="number"
                  min="0"
                  placeholder="3600"
                  value={form.cacheTtl}
                  onChange={e => setField('cacheTtl', e.target.value)}
                />
              </div>
            </div>

            {/* ── Structured auth fields ── */}
            {form.authType === 'bearer' && (
              <div className="space-y-1.5">
                <Label htmlFor="o-bearer-token">{t('oas_auth_bearer_token')} <span className="text-destructive">{t('common_required')}</span></Label>
                <Input
                  id="o-bearer-token"
                  type="password"
                  placeholder="eyJhbGci..."
                  value={authFields.bearerToken}
                  onChange={e => setAuth('bearerToken', e.target.value)}
                  required
                />
              </div>
            )}

            {form.authType === 'api_key' && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="o-apikey-key">{t('oas_auth_api_key')} <span className="text-destructive">{t('common_required')}</span></Label>
                  <Input
                    id="o-apikey-key"
                    type="password"
                    placeholder="sk-..."
                    value={authFields.apiKeyKey}
                    onChange={e => setAuth('apiKeyKey', e.target.value)}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>{t('oas_auth_api_key_in')} <span className="text-destructive">{t('common_required')}</span></Label>
                    <Select value={authFields.apiKeyIn} onValueChange={v => setAuth('apiKeyIn', v as 'header' | 'query')}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="header">{t('oas_auth_api_key_in_header')}</SelectItem>
                        <SelectItem value="query">{t('oas_auth_api_key_in_query')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="o-apikey-name">{t('oas_auth_api_key_name')} <span className="text-destructive">{t('common_required')}</span></Label>
                    <Input
                      id="o-apikey-name"
                      placeholder="X-API-Key"
                      value={authFields.apiKeyName}
                      onChange={e => setAuth('apiKeyName', e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>
            )}

            {form.authType === 'basic' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="o-basic-user">{t('oas_auth_basic_username')} <span className="text-destructive">{t('common_required')}</span></Label>
                  <Input
                    id="o-basic-user"
                    placeholder="admin"
                    value={authFields.basicUsername}
                    onChange={e => setAuth('basicUsername', e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="o-basic-pass">{t('oas_auth_basic_password')} <span className="text-destructive">{t('common_required')}</span></Label>
                  <Input
                    id="o-basic-pass"
                    type="password"
                    placeholder="••••••••"
                    value={authFields.basicPassword}
                    onChange={e => setAuth('basicPassword', e.target.value)}
                    required
                  />
                </div>
              </div>
            )}

            {form.authType === 'oauth2_cc' && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="o-oauth2-url">{t('oas_auth_oauth2_token_url')} <span className="text-destructive">{t('common_required')}</span></Label>
                  <Input
                    id="o-oauth2-url"
                    type="url"
                    placeholder="https://auth.example.com/oauth/token"
                    value={authFields.oauth2TokenUrl}
                    onChange={e => setAuth('oauth2TokenUrl', e.target.value)}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="o-oauth2-id">{t('oas_auth_oauth2_client_id')} <span className="text-destructive">{t('common_required')}</span></Label>
                    <Input
                      id="o-oauth2-id"
                      placeholder="client-id"
                      value={authFields.oauth2ClientId}
                      onChange={e => setAuth('oauth2ClientId', e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="o-oauth2-secret">{t('oas_auth_oauth2_client_secret')} <span className="text-destructive">{t('common_required')}</span></Label>
                    <Input
                      id="o-oauth2-secret"
                      type="password"
                      placeholder="••••••••"
                      value={authFields.oauth2ClientSecret}
                      onChange={e => setAuth('oauth2ClientSecret', e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="o-oauth2-scopes">
                    {t('oas_auth_oauth2_scopes')}
                    <span className="text-muted-foreground ml-1 font-normal text-xs">— {t('oas_auth_oauth2_scopes_hint')}</span>
                  </Label>
                  <Input
                    id="o-oauth2-scopes"
                    placeholder="read:api, write:api"
                    value={authFields.oauth2Scopes}
                    onChange={e => setAuth('oauth2Scopes', e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* Probe results — endpoints list */}
            {probeResult && (
              <div className="rounded-md border bg-muted/30 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium">
                    {t('oas_probe_endpoints')} ({probeResult.endpoints.length})
                  </Label>
                  {probeResult.title && (
                    <Badge variant="outline" className="text-xs">{probeResult.title} v{probeResult.version}</Badge>
                  )}
                </div>
                {probeResult.endpoints.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t('oas_probe_no_endpoints')}</p>
                ) : (
                  <div className="max-h-40 overflow-y-auto rounded border bg-background">
                    <table className="w-full text-xs">
                      <tbody>
                        {probeResult.endpoints.map((ep, i) => (
                          <tr key={i} className="border-b last:border-0">
                            <td className="px-2 py-1 w-16">
                              <Badge variant={
                                ep.method === 'GET' ? 'secondary' :
                                ep.method === 'POST' ? 'default' :
                                ep.method === 'DELETE' ? 'destructive' : 'outline'
                              } className="text-[10px] font-mono">
                                {ep.method}
                              </Badge>
                            </td>
                            <td className="px-2 py-1 font-mono text-muted-foreground">{ep.path}</td>
                            <td className="px-2 py-1 text-muted-foreground truncate max-w-[200px]">{ep.summary}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {mode === 'edit' && (
              <div className="flex items-center gap-2">
                <Switch
                  id="oenabled"
                  checked={form.enabled}
                  onCheckedChange={v => setField('enabled', v)}
                />
                <Label htmlFor="oenabled" className="cursor-pointer">{t('oas_field_enabled')}</Label>
              </div>
            )}

            {formError && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <i className="ri-error-warning-line" />
                {formError}
              </p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>{t('common_cancel')}</Button>
              <Button type="submit" disabled={saving}>
                {saving && <i className="ri-loader-4-line animate-spin" />}
                {mode === 'create' ? t('common_import') : t('common_save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('oas_delete_title')}</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{deleteTarget?.name}</strong>. {t('oas_delete_desc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common_cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting && <i className="ri-loader-4-line animate-spin" />}
              {t('common_delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
