import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { listGroups, createGroup, deleteGroup, getErrorMessage, type Group } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from '@/components/ui/table'
import { formatDate } from '@/lib/utils'
import { useI18n } from '@/lib/i18n'

export default function GroupsPage() {
  const { t } = useI18n()
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)

  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<Group | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function load() {
    try {
      setGroups(await listGroups())
    } catch {
      toast.error(t('groups_load_error'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await createGroup({ name: name.trim(), description: description.trim() })
      toast.success(t('groups_create_success'))
      setCreateOpen(false)
      setName('')
      setDescription('')
      void load()
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, t('groups_create_error')))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteGroup(deleteTarget.id)
      toast.success(t('groups_delete_success'))
      setDeleteTarget(null)
      void load()
    } catch {
      toast.error(t('groups_delete_error'))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t('groups_title')}</h2>
          <p className="text-sm text-muted-foreground">{t('groups_subtitle')}</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <i className="ri-add-line" />
          {t('groups_new')}
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <i className="ri-loader-4-line animate-spin text-2xl text-muted-foreground" />
        </div>
      ) : groups.length === 0 ? (
        <div className="rounded-lg border border-dashed py-12 text-center text-muted-foreground">
          <i className="ri-group-line text-3xl block mb-2" />
          <p className="text-sm">{t('groups_no_groups')}</p>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('groups_col_name')}</TableHead>
                <TableHead>{t('groups_col_desc')}</TableHead>
                <TableHead>{t('groups_col_created')}</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map(g => (
                <TableRow key={g.id}>
                  <TableCell className="font-mono font-medium">{g.name}</TableCell>
                  <TableCell className="text-muted-foreground max-w-xs truncate">
                    {g.description || <span className="italic text-xs">—</span>}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">{formatDate(g.createdAt)}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => setDeleteTarget(g)}
                    >
                      <i className="ri-delete-bin-line" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('groups_dialog_title')}</DialogTitle>
            <DialogDescription>{t('groups_dialog_desc')}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="gname">{t('groups_field_name')} <span className="text-destructive">{t('common_required')}</span></Label>
              <Input
                id="gname"
                placeholder={t('groups_name_placeholder')}
                value={name}
                onChange={e => setName(e.target.value)}
                required
                pattern="[a-zA-Z0-9\-_ ]+"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gdesc">{t('groups_field_desc')}</Label>
              <Textarea
                id="gdesc"
                placeholder={t('groups_desc_placeholder')}
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={2}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>{t('common_cancel')}</Button>
              <Button type="submit" disabled={saving}>
                {saving && <i className="ri-loader-4-line animate-spin" />}
                {t('common_create')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('groups_delete_title')}</DialogTitle>
            <DialogDescription>
              {t('groups_delete_warning')} <strong>{deleteTarget?.name}</strong> {t('groups_delete_desc')}
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
