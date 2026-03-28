import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  listMCP, listGroups, createMCP, updateMCP, deleteMCP, getErrorMessage,
  type McpEntry, type Group, type McpTransport, type McpAuthConfig,
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

// ─── Auth types & KV pairs ───────────────────────────────────────────────────

type McpAuthType = 'none' | 'http_headers' | 'env'

interface KVPair { key: string; value: string }

function parseAuthConfig(config: McpAuthConfig): { authType: McpAuthType; kvPairs: KVPair[] } {
  if (config.type === 'http_headers') {
    return {
      authType: 'http_headers',
      kvPairs: Object.entries(config.headers ?? {}).map(([key, value]) => ({ key, value })),
    }
  }
  if (config.type === 'env') {
    return {
      authType: 'env',
      kvPairs: Object.entries(config.env ?? {}).map(([key, value]) => ({ key, value })),
    }
  }
  return { authType: 'none', kvPairs: [] }
}

function buildAuthConfig(authType: McpAuthType, kvPairs: KVPair[]): McpAuthConfig {
  const entries = kvPairs.filter(p => p.key.trim()).reduce<Record<string, string>>((acc, p) => {
    acc[p.key.trim()] = p.value
    return acc
  }, {})
  if (authType === 'http_headers') return { type: 'http_headers', headers: entries }
  if (authType === 'env') return { type: 'env', env: entries }
  return { type: 'none' }
}

// ─── Form ────────────────────────────────────────────────────────────────────

type FormMode = 'create' | 'edit'

interface MCPForm {
  groupId: string
  name: string
  description: string
  transport: McpTransport
  serverUrl: string
  command: string
  authType: McpAuthType
  authKvPairs: KVPair[]
  enabled: boolean
}

const EMPTY_FORM: MCPForm = {
  groupId: '',
  name: '',
  description: '',
  transport: 'http',
  serverUrl: '',
  command: '',
  authType: 'none',
  authKvPairs: [],
  enabled: true,
}

export default function MCPPage() {
  const { t } = useI18n()
  const [entries, setEntries] = useState<McpEntry[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [mode, setMode] = useState<FormMode>('create')
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<MCPForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const [deleteTarget, setDeleteTarget] = useState<McpEntry | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function load() {
    try {
      const [e, g] = await Promise.all([listMCP(), listGroups()])
      setEntries(e)
      setGroups(g)
    } catch {
      toast.error(t('mcp_load_error'))
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

  function openEdit(entry: McpEntry) {
    setMode('edit')
    setEditId(entry.id)
    const { authType, kvPairs } = parseAuthConfig(entry.authConfig)
    setForm({
      groupId: entry.groupId,
      name: entry.name,
      description: entry.description ?? '',
      transport: entry.transport,
      serverUrl: entry.serverUrl ?? '',
      command: entry.command ?? '',
      authType,
      authKvPairs: kvPairs,
      enabled: entry.enabled,
    })
    setFormError('')
    setDialogOpen(true)
  }

  function setField<K extends keyof MCPForm>(key: K, value: MCPForm[K]) {
    if (key === 'authType') {
      setForm(f => ({ ...f, authType: value as McpAuthType, authKvPairs: [] }))
    } else {
      setForm(f => ({ ...f, [key]: value }))
    }
  }

  function addKvRow() {
    setForm(f => ({ ...f, authKvPairs: [...f.authKvPairs, { key: '', value: '' }] }))
  }

  function removeKvRow(i: number) {
    setForm(f => ({ ...f, authKvPairs: f.authKvPairs.filter((_, idx) => idx !== i) }))
  }

  function setKvRow(i: number, field: 'key' | 'value', val: string) {
    setForm(f => {
      const pairs = f.authKvPairs.map((p, idx) => idx === i ? { ...p, [field]: val } : p)
      return { ...f, authKvPairs: pairs }
    })
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
        transport: form.transport,
        serverUrl: form.serverUrl.trim() || undefined,
        command: form.command.trim() || undefined,
        authConfig: buildAuthConfig(form.authType, form.authKvPairs),
      }

      if (mode === 'create') {
        await createMCP(payload)
        toast.success(t('mcp_create_success'))
      } else {
        await updateMCP(editId!, { ...payload, enabled: form.enabled })
        toast.success(t('mcp_update_success'))
      }
      setDialogOpen(false)
      void load()
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, `Failed to ${mode} MCP server`))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteMCP(deleteTarget.id)
      toast.success(t('mcp_delete_success'))
      setDeleteTarget(null)
      void load()
    } catch {
      toast.error(t('mcp_delete_error'))
    } finally {
      setDeleting(false)
    }
  }

  const groupName = (id: string) => groups.find(g => g.id === id)?.name ?? id.slice(0, 8)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t('mcp_title')}</h2>
          <p className="text-sm text-muted-foreground">{t('mcp_subtitle')}</p>
        </div>
        <Button onClick={openCreate} disabled={groups.length === 0}>
          <i className="ri-add-line" />
          {t('mcp_add')}
        </Button>
      </div>

      {groups.length === 0 && !loading && (
        <div className="rounded-md border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800 flex items-center gap-2">
          <i className="ri-alert-line" />
          {t('mcp_group_required')}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <i className="ri-loader-4-line animate-spin text-2xl text-muted-foreground" />
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-lg border border-dashed py-12 text-center text-muted-foreground">
          <i className="ri-robot-line text-3xl block mb-2" />
          <p className="text-sm">{t('mcp_no_entries')}</p>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('mcp_col_name')}</TableHead>
                <TableHead>{t('mcp_col_group')}</TableHead>
                <TableHead>{t('mcp_col_transport')}</TableHead>
                <TableHead>{t('mcp_col_status')}</TableHead>
                <TableHead>{t('mcp_col_target')}</TableHead>
                <TableHead>{t('mcp_col_updated')}</TableHead>
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
                    <Badge variant="outline">{entry.transport}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={entry.enabled ? 'success' : 'secondary'}>
                      {entry.enabled ? t('common_enabled') : t('common_disabled')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                    {entry.serverUrl ?? entry.command ?? '—'}
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
            <DialogTitle>{mode === 'create' ? t('mcp_dialog_create_title') : t('mcp_dialog_edit_title')}</DialogTitle>
            <DialogDescription>
              {mode === 'create' ? t('mcp_dialog_create_desc') : t('mcp_dialog_edit_desc')}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="mname">{t('mcp_field_name')} <span className="text-destructive">{t('common_required')}</span></Label>
                <Input
                  id="mname"
                  placeholder="my-mcp-server"
                  value={form.name}
                  onChange={e => setField('name', e.target.value)}
                  required
                  disabled={mode === 'edit'}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t('mcp_field_group')} <span className="text-destructive">{t('common_required')}</span></Label>
                <Select value={form.groupId} onValueChange={v => setField('groupId', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('mcp_select_group')} />
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
              <Label htmlFor="mdesc">{t('mcp_field_desc')}</Label>
              <Input
                id="mdesc"
                placeholder="Optional description"
                value={form.description}
                onChange={e => setField('description', e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t('mcp_field_transport')} <span className="text-destructive">{t('common_required')}</span></Label>
              <Select value={form.transport} onValueChange={v => setField('transport', v as McpTransport)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="http">{t('mcp_transport_http')}</SelectItem>
                  <SelectItem value="stdio">{t('mcp_transport_stdio')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.transport === 'http' ? (
              <div className="space-y-1.5">
                <Label htmlFor="murl">{t('mcp_field_server_url')} <span className="text-destructive">{t('common_required')}</span></Label>
                <Input
                  id="murl"
                  placeholder="https://mcp.example.com/sse"
                  type="url"
                  value={form.serverUrl}
                  onChange={e => setField('serverUrl', e.target.value)}
                  required={form.transport === 'http'}
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="mcmd">{t('mcp_field_command')} <span className="text-destructive">{t('common_required')}</span></Label>
                <Input
                  id="mcmd"
                  placeholder="npx -y my-mcp-server"
                  value={form.command}
                  onChange={e => setField('command', e.target.value)}
                  required={form.transport === 'stdio'}
                />
              </div>
            )}

            {/* ── Auth type ── */}
            <div className="space-y-1.5">
              <Label>{t('mcp_field_auth_type')} <span className="text-destructive">{t('common_required')}</span></Label>
              <Select value={form.authType} onValueChange={v => setField('authType', v as McpAuthType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('mcp_auth_none')}</SelectItem>
                  <SelectItem value="http_headers">{t('mcp_auth_http_headers')}</SelectItem>
                  <SelectItem value="env">{t('mcp_auth_env')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* ── KV editor for http_headers / env ── */}
            {(form.authType === 'http_headers' || form.authType === 'env') && (
              <div className="space-y-2">
                {form.authKvPairs.map((pair, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <Input
                      placeholder={t('mcp_auth_kv_key')}
                      value={pair.key}
                      onChange={e => setKvRow(i, 'key', e.target.value)}
                      className="flex-1"
                    />
                    <Input
                      placeholder={t('mcp_auth_kv_value')}
                      value={pair.value}
                      onChange={e => setKvRow(i, 'value', e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removeKvRow(i)}
                    >
                      <i className="ri-delete-bin-line" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addKvRow}
                  className="w-full"
                >
                  <i className="ri-add-line" />
                  {t('mcp_auth_add_row')}
                </Button>
              </div>
            )}

            {mode === 'edit' && (
              <div className="flex items-center gap-2">
                <Switch
                  id="menabled"
                  checked={form.enabled}
                  onCheckedChange={v => setField('enabled', v)}
                />
                <Label htmlFor="menabled" className="cursor-pointer">{t('mcp_field_enabled')}</Label>
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
                {mode === 'create' ? t('mcp_add_server') : t('mcp_save_changes')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('mcp_delete_title')}</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{deleteTarget?.name}</strong>. {t('mcp_delete_desc')}
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
