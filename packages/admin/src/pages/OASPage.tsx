import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  listOAS, listGroups, createOAS, updateOAS, deleteOAS, getErrorMessage,
  type OASEntry, type Group, type AuthType,
} from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate } from '@/lib/utils'
import { useI18n } from '@/lib/i18n'

const AUTH_TYPES: AuthType[] = ['none', 'bearer', 'api_key', 'basic', 'oauth2_cc']

const AUTH_PLACEHOLDERS: Record<AuthType, string> = {
  none: '{"type":"none"}',
  bearer: '{"type":"bearer","token":"YOUR_TOKEN"}',
  api_key: '{"type":"api_key","key":"YOUR_KEY","in":"header","name":"X-API-Key"}',
  basic: '{"type":"basic","username":"user","password":"pass"}',
  oauth2_cc: '{"type":"oauth2_cc","tokenUrl":"https://auth.example.com/token","clientId":"id","clientSecret":"secret","scopes":[]}',
}

type FormMode = 'create' | 'edit'

interface OASForm {
  groupId: string
  name: string
  description: string
  remoteUrl: string
  baseEndpoint: string
  authType: AuthType
  authConfig: string
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
  authConfig: '{"type":"none"}',
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
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const [deleteTarget, setDeleteTarget] = useState<OASEntry | null>(null)
  const [deleting, setDeleting] = useState(false)

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
    setFormError('')
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
      authConfig: JSON.stringify(entry.authConfig, null, 2),
      cacheTtl: String(entry.cacheTtl),
      enabled: entry.enabled,
    })
    setFormError('')
    setDialogOpen(true)
  }

  function setField<K extends keyof OASForm>(key: K, value: OASForm[K]) {
    setForm(f => ({ ...f, [key]: value }))
    if (key === 'authType') {
      setForm(f => ({ ...f, authType: value as AuthType, authConfig: AUTH_PLACEHOLDERS[value as AuthType] }))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')

    let parsedAuthConfig: Record<string, unknown>
    try {
      parsedAuthConfig = JSON.parse(form.authConfig) as Record<string, unknown>
    } catch {
      setFormError(t('oas_auth_config_error'))
      return
    }

    setSaving(true)
    try {
      const payload = {
        groupId: form.groupId,
        name: form.name.trim(),
        description: form.description.trim(),
        remoteUrl: form.remoteUrl.trim(),
        baseEndpoint: form.baseEndpoint.trim() || undefined,
        authType: form.authType,
        authConfig: parsedAuthConfig,
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
                      <Button variant="ghost" size="icon" onClick={() => openEdit(entry)}>
                        <i className="ri-edit-line" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setDeleteTarget(entry)}
                      >
                        <i className="ri-delete-bin-line" />
                      </Button>
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
              <Input
                id="ourl"
                placeholder="https://api.example.com/openapi.json"
                type="url"
                value={form.remoteUrl}
                onChange={e => setField('remoteUrl', e.target.value)}
                required
              />
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

            <div className="space-y-1.5">
              <Label htmlFor="oauth">{t('oas_field_auth_config')} <span className="text-destructive">{t('common_required')}</span></Label>
              <Textarea
                id="oauth"
                placeholder={AUTH_PLACEHOLDERS[form.authType]}
                value={form.authConfig}
                onChange={e => setField('authConfig', e.target.value)}
                rows={4}
                className="font-mono text-xs"
                required
              />
            </div>

            {mode === 'edit' && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="oenabled"
                  checked={form.enabled}
                  onChange={e => setField('enabled', e.target.checked)}
                  className="h-4 w-4 rounded"
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
      <Dialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('oas_delete_title')}</DialogTitle>
            <DialogDescription>
              This will permanently delete <strong>{deleteTarget?.name}</strong>. {t('oas_delete_desc')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>{t('common_cancel')}</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting && <i className="ri-loader-4-line animate-spin" />}
              {t('common_delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
