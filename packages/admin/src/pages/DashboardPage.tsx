import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getStats, listOAS, type Stats, type OASEntry } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { relativeTime } from '@/lib/utils'
import { useI18n } from '@/lib/i18n'

function StatCard({ icon, label, value, sub }: { icon: string; label: string; value: number | string; sub?: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <i className={`${icon} text-lg text-muted-foreground`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  )
}

export default function DashboardPage() {
  const { t, lang } = useI18n()
  const [stats, setStats] = useState<Stats | null>(null)
  const [recentOAS, setRecentOAS] = useState<OASEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void Promise.allSettled([getStats(), listOAS()]).then(([statsResult, oasResult]) => {
      if (statsResult.status === 'fulfilled') setStats(statsResult.value)
      if (oasResult.status === 'fulfilled') setRecentOAS(oasResult.value.slice(0, 5))
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <i className="ri-loader-4-line animate-spin text-2xl text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t('dash_title')}</h2>
        <p className="text-muted-foreground text-sm">{t('dash_subtitle')}</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard icon="ri-group-line" label={t('dash_groups')} value={stats?.groups ?? 0} sub={t('dash_groups_sub')} />
        <StatCard icon="ri-file-code-line" label={t('dash_oas')} value={stats?.oasEntries ?? 0} sub={t('dash_oas_sub')} />
        <StatCard icon="ri-key-line" label={t('dash_tokens')} value={stats?.activeTokens ?? 0} sub={t('dash_tokens_sub')} />
      </div>

      {/* Recent OAS entries */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm">{t('dash_recent_oas')}</h3>
          <Link to="/oas" className="text-xs text-primary hover:underline">{t('dash_view_all')}</Link>
        </div>

        {recentOAS.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground text-sm">
              <i className="ri-file-code-line text-3xl block mb-2" />
              {t('dash_no_oas')}{' '}
              <Link to="/oas" className="text-primary hover:underline">{t('dash_add_one')}</Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {recentOAS.map(entry => (
              <Card key={entry.id}>
                <CardContent className="flex items-center gap-4 py-3">
                  <i className="ri-file-code-line text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-medium truncate">{entry.name}</span>
                      <Badge variant={entry.enabled ? 'success' : 'secondary'} className="shrink-0">
                        {entry.enabled ? t('common_enabled') : t('common_disabled')}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{entry.remoteUrl}</p>
                  </div>
                  <div className="text-xs text-muted-foreground shrink-0">{relativeTime(entry.createdAt, lang)}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Quick links */}
      <div>
        <h3 className="font-semibold text-sm mb-3">{t('dash_quick_actions')}</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { to: '/groups', icon: 'ri-add-circle-line', label: t('dash_new_group'), desc: t('dash_new_group_desc') },
            { to: '/oas', icon: 'ri-upload-cloud-line', label: t('dash_import_oas'), desc: t('dash_import_oas_desc') },
            { to: '/tokens', icon: 'ri-key-2-line', label: t('dash_issue_token'), desc: t('dash_issue_token_desc') },
          ].map(({ to, icon, label, desc }) => (
            <Link key={to} to={to}>
              <Card className="hover:bg-accent/50 transition-colors cursor-pointer h-full">
                <CardContent className="py-4 flex items-start gap-3">
                  <i className={`${icon} text-lg text-primary mt-0.5`} />
                  <div>
                    <div className="font-medium text-sm">{label}</div>
                    <div className="text-xs text-muted-foreground">{desc}</div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
