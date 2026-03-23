import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getStats, listOAS, type Stats, type OASEntry } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { relativeTime } from '@/lib/utils'

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
  const [stats, setStats] = useState<Stats | null>(null)
  const [recentOAS, setRecentOAS] = useState<OASEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void Promise.all([getStats(), listOAS()])
      .then(([s, entries]) => {
        setStats(s)
        setRecentOAS(entries.slice(0, 5))
      })
      .finally(() => setLoading(false))
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
        <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground text-sm">Overview of your OAS Gateway</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard icon="ri-group-line" label="Groups" value={stats?.groups ?? 0} sub="Logical namespaces" />
        <StatCard icon="ri-file-code-line" label="OAS Entries" value={stats?.oasEntries ?? 0} sub="Registered services" />
        <StatCard icon="ri-key-line" label="Active Tokens" value={stats?.activeTokens ?? 0} sub="Non-revoked JWTs" />
      </div>

      {/* Recent OAS entries */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm">Recent OAS entries</h3>
          <Link to="/oas" className="text-xs text-primary hover:underline">View all →</Link>
        </div>

        {recentOAS.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground text-sm">
              <i className="ri-file-code-line text-3xl block mb-2" />
              No OAS entries yet.{' '}
              <Link to="/oas" className="text-primary hover:underline">Add one →</Link>
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
                        {entry.enabled ? 'enabled' : 'disabled'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{entry.remoteUrl}</p>
                  </div>
                  <div className="text-xs text-muted-foreground shrink-0">{relativeTime(entry.createdAt)}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Quick links */}
      <div>
        <h3 className="font-semibold text-sm mb-3">Quick actions</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { to: '/groups', icon: 'ri-add-circle-line', label: 'New group', desc: 'Create a group namespace' },
            { to: '/oas', icon: 'ri-upload-cloud-line', label: 'Import OAS', desc: 'Register a new service' },
            { to: '/tokens', icon: 'ri-key-2-line', label: 'Issue token', desc: 'Generate a group JWT' },
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
