import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  listMCP, listGroups, createMCP, updateMCP, deleteMCP, getErrorMessage,
  type McpEntry, type Group, type McpTransport, type McpAuthConfig,
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

const AUTH_PLACEHOLDERS: Record<string, string> = {
  none: '{"type":"none"}',
  http_headers: '{"type":"http_headers","headers":{"Authorization":"Bearer YOUR_TOKEN"}}',
  env: '{"type":"env","env":{"API_KEY":"YOUR_API_KEY"}}',
}

type FormMode = 'create' | 'edit'

interface MCPForm {
  groupId: string
  name: string
  description: string
  transport: McpTransport
  serverUrl: string
  command: string
  authConfig: string
  enabled: boolean
}

const EMPTY_FORM: MCPForm = {
  groupId: '',
  name: '',
  description: '',
  transport: 'http',
  serverUrl: '',
  command: '',
  authConfig: '{"type":"none"}',
  enabled: true,
}

export default function MCPPage() {
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
      toast.error('Failed to load data')
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
    setForm({
      groupId: entry.groupId,
      name: entry.name,
      description: entry.description ?? '',
      transport: entry.transport,
      serverUrl: entry.serverUrl ?? '',
      command: entry.command ?? '',
      authConfig: JSON.stringify(entry.authConfig, null, 2),
      enabled: entry.enabled,
    })
    setFormError('')
    setDialogOpen(true)
  }

  function setField<K extends keyof MCPForm>(key: K, value: MCPForm[K]) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')

    let parsedAuthConfig: McpAuthConfig
    try {
      parsedAuthConfig = JSON.parse(form.authConfig) as McpAuthConfig
    } catch {
      setFormError('Auth config must be valid JSON')
      return
    }

    setSaving(true)
    try {
      const payload = {
        groupId: form.groupId,
        name: form.name.trim(),
        description: form.description.trim(),
        transport: form.transport,
        serverUrl: form.serverUrl.trim() || undefined,
        command: form.command.trim() || undefined,
        authConfig: parsedAuthConfig,
      }

      if (mode === 'create') {
        await createMCP(payload)
        toast.success('MCP server registered')
      } else {
        await updateMCP(editId!, { ...payload, enabled: form.enabled })
        toast.success('MCP server updated')
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
      toast.success('MCP server deleted')
      setDeleteTarget(null)
      void load()
    } catch {
      toast.error('Failed to delete MCP server')
    } finally {
      setDeleting(false)
    }
  }

  const groupName = (id: string) => groups.find(g => g.id === id)?.name ?? id.slice(0, 8)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">MCP Servers</h2>
          <p className="text-sm text-muted-foreground">Registered MCP servers with encrypted auth configs</p>
        </div>
        <Button onClick={openCreate} disabled={groups.length === 0}>
          <i className="ri-add-line" />
          Add MCP Server
        </Button>
      </div>

      {groups.length === 0 && !loading && (
        <div className="rounded-md border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800 flex items-center gap-2">
          <i className="ri-alert-line" />
          Create a group first before adding MCP servers.
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <i className="ri-loader-4-line animate-spin text-2xl text-muted-foreground" />
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-lg border border-dashed py-12 text-center text-muted-foreground">
          <i className="ri-robot-line text-3xl block mb-2" />
          <p className="text-sm">No MCP servers yet.</p>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Group</TableHead>
                <TableHead>Transport</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Updated</TableHead>
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
                      {entry.enabled ? 'enabled' : 'disabled'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                    {entry.serverUrl ?? entry.command ?? '—'}
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
            <DialogTitle>{mode === 'create' ? 'Add MCP Server' : 'Edit MCP Server'}</DialogTitle>
            <DialogDescription>
              {mode === 'create'
                ? 'Register a new MCP server. Auth config is encrypted at rest.'
                : 'Update the MCP server details.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="mname">Name <span className="text-destructive">*</span></Label>
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
                <Label>Group <span className="text-destructive">*</span></Label>
                <Select value={form.groupId} onValueChange={v => setField('groupId', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select group" />
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
              <Label htmlFor="mdesc">Description</Label>
              <Input
                id="mdesc"
                placeholder="Optional description"
                value={form.description}
                onChange={e => setField('description', e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Transport <span className="text-destructive">*</span></Label>
              <Select value={form.transport} onValueChange={v => setField('transport', v as McpTransport)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="http">http (SSE/streaming)</SelectItem>
                  <SelectItem value="stdio">stdio (subprocess)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.transport === 'http' ? (
              <div className="space-y-1.5">
                <Label htmlFor="murl">Server URL <span className="text-destructive">*</span></Label>
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
                <Label htmlFor="mcmd">Command <span className="text-destructive">*</span></Label>
                <Input
                  id="mcmd"
                  placeholder="npx -y my-mcp-server"
                  value={form.command}
                  onChange={e => setField('command', e.target.value)}
                  required={form.transport === 'stdio'}
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="mauth">
                Auth Config (JSON) <span className="text-destructive">*</span>
                <span className="text-muted-foreground ml-1 font-normal text-xs">
                  — none / http_headers / env
                </span>
              </Label>
              <Textarea
                id="mauth"
                placeholder={form.transport === 'http' ? AUTH_PLACEHOLDERS.http_headers : AUTH_PLACEHOLDERS.env}
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
                  id="menabled"
                  checked={form.enabled}
                  onChange={e => setField('enabled', e.target.checked)}
                  className="h-4 w-4 rounded"
                />
                <Label htmlFor="menabled" className="cursor-pointer">Enabled</Label>
              </div>
            )}

            {formError && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <i className="ri-error-warning-line" />
                {formError}
              </p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>
                {saving && <i className="ri-loader-4-line animate-spin" />}
                {mode === 'create' ? 'Add Server' : 'Save changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete MCP server?</DialogTitle>
            <DialogDescription>
              This will permanently delete <strong>{deleteTarget?.name}</strong>. Clients using this server
              will lose access. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting && <i className="ri-loader-4-line animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
