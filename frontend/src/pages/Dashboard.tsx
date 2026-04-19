import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, MapPin, Store, Upload } from 'lucide-react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from 'recharts'
import { submissionsApi } from '../api/client'
import type { SubmissionListItem } from '../api/client'
const STATUS_BADGE: Record<string, string> = {
  pending: 'badge-amber',
  validating: 'badge-amber',
  processing: 'badge-blue',
  completed: 'badge-green',
  failed: 'badge-red',
  flagged: 'badge-red',
}

const RISK_BADGE: Record<string, string> = {
  low: 'badge-green',
  medium: 'badge-amber',
  high: 'badge-red',
  critical: 'badge-red',
}

const REC_COLOR: Record<string, string> = {
  APPROVE: 'var(--accent-green)',
  APPROVE_WITH_MONITORING: 'var(--accent-blue)',
  REFER_FOR_FIELD_VISIT: 'var(--accent-amber)',
  REJECT: 'var(--accent-red)',
}

const CHART_COLORS = {
  blue: '#4f8ef7',
  violet: '#8b5cf6',
  teal: '#22d3ee',
  green: '#10b981',
  amber: '#f59e0b',
  red: '#ef4444',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function Dashboard() {
  const [submissions, setSubmissions] = useState<SubmissionListItem[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    submissionsApi.list()
      .then(r => setSubmissions(r.data))
      .catch(() => setSubmissions([]))
      .finally(() => setLoading(false))
  }, [])

  const completed = submissions.filter(s => s.status === 'completed').length
  const processing = submissions.filter(s => ['processing', 'validating', 'pending'].includes(s.status)).length
  const flagged = submissions.filter(s => s.risk_level && ['high', 'critical'].includes(s.risk_level)).length
  const approved = submissions.filter(s => s.recommendation === 'APPROVE').length
  const recentSubmissions = submissions.slice(0, 5)

  const riskData = [
    { name: 'Low', value: submissions.filter(s => s.risk_level === 'low').length, color: CHART_COLORS.green },
    { name: 'Medium', value: submissions.filter(s => s.risk_level === 'medium').length, color: CHART_COLORS.amber },
    { name: 'High/Critical', value: submissions.filter(s => ['high', 'critical'].includes(s.risk_level || '')).length, color: CHART_COLORS.red },
  ].filter(d => d.value > 0)

  const recommendationData = [
    { name: 'Approve', value: submissions.filter(s => s.recommendation === 'APPROVE').length, color: CHART_COLORS.green },
    {
      name: 'Approve + Monitor',
      value: submissions.filter(s => s.recommendation === 'APPROVE_WITH_MONITORING').length,
      color: CHART_COLORS.blue,
    },
    {
      name: 'Field Visit',
      value: submissions.filter(s => s.recommendation === 'REFER_FOR_FIELD_VISIT').length,
      color: CHART_COLORS.amber,
    },
    { name: 'Reject', value: submissions.filter(s => s.recommendation === 'REJECT').length, color: CHART_COLORS.red },
    { name: 'Pending', value: submissions.filter(s => !s.recommendation).length, color: CHART_COLORS.violet },
  ]

  const trendData = (() => {
    const days = 7
    const now = new Date()
    const dateSlots: { key: string; label: string; total: number; completed: number; flagged: number }[] = []

    for (let i = days - 1; i >= 0; i -= 1) {
      const d = new Date(now)
      d.setDate(now.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      const label = d.toLocaleDateString('en-IN', { weekday: 'short' })
      dateSlots.push({ key, label, total: 0, completed: 0, flagged: 0 })
    }

    const byDay = new Map(dateSlots.map(slot => [slot.key, slot]))

    submissions.forEach(s => {
      const key = new Date(s.created_at).toISOString().slice(0, 10)
      const slot = byDay.get(key)
      if (!slot) return
      slot.total += 1
      if (s.status === 'completed') slot.completed += 1
      if (['high', 'critical'].includes(s.risk_level || '')) slot.flagged += 1
    })

    return dateSlots
  })()

  return (
    <div className="fade-in">
      <div className="page-header">
        <h2>Credit Intelligence Dashboard</h2>
        <p>AI-driven kirana store analysis for NBFC credit underwriting</p>
      </div>

      <div className="page-body">
        {/* ── Stats ── */}
        <div className="stat-grid">
          <div className="stat-card blue">
            <div className="stat-label">Total Submissions</div>
            <div className="stat-value" style={{ color: 'var(--accent-blue)' }}>
              {submissions.length}
            </div>
            <div className="stat-sub">All time</div>
          </div>

          <div className="stat-card green">
            <div className="stat-label">Completed</div>
            <div className="stat-value" style={{ color: 'var(--accent-green)' }}>
              {completed}
            </div>
            <div className="stat-sub">{approved} approved</div>
          </div>

          <div className="stat-card amber">
            <div className="stat-label">Processing</div>
            <div className="stat-value" style={{ color: 'var(--accent-amber)' }}>
              {processing}
            </div>
            <div className="stat-sub">In pipeline</div>
          </div>

          <div className="stat-card red">
            <div className="stat-label">High Risk Flags</div>
            <div className="stat-value" style={{ color: 'var(--accent-red)' }}>
              {flagged}
            </div>
            <div className="stat-sub">Requires attention</div>
          </div>
        </div>

        <div className="card-title" style={{ marginBottom: 12 }}>Analytics Overview</div>

        <div className="dashboard-charts-grid">
          <div className="card chart-card">
            <div className="card-title" style={{ marginBottom: 14 }}>Submission Trend (Last 7 Days)</div>
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="totalGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART_COLORS.blue} stopOpacity={0.45} />
                      <stop offset="100%" stopColor={CHART_COLORS.blue} stopOpacity={0.03} />
                    </linearGradient>
                    <linearGradient id="completedGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART_COLORS.teal} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={CHART_COLORS.teal} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(79,142,247,0.12)" strokeDasharray="4 4" />
                  <XAxis dataKey="label" tick={{ fill: '#8896b3', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#8896b3', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <RechartsTooltip
                    contentStyle={{
                      background: '#131d35',
                      border: '1px solid rgba(79,142,247,0.3)',
                      borderRadius: 10,
                      color: '#f0f4ff',
                    }}
                  />
                  <Area type="monotone" dataKey="total" stroke={CHART_COLORS.blue} fill="url(#totalGrad)" strokeWidth={2.4} />
                  <Area type="monotone" dataKey="completed" stroke={CHART_COLORS.teal} fill="url(#completedGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card chart-card">
            <div className="card-title" style={{ marginBottom: 14 }}>Risk Distribution</div>
            <div className="chart-wrap">
              {riskData.length === 0 ? (
                <div className="chart-empty">No risk data yet</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={riskData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={95}
                      innerRadius={52}
                      paddingAngle={4}
                    >
                      {riskData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      contentStyle={{
                        background: '#131d35',
                        border: '1px solid rgba(79,142,247,0.3)',
                        borderRadius: 10,
                        color: '#f0f4ff',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="chart-legend-row">
              {riskData.map(item => (
                <div key={item.name} className="chart-legend-item">
                  <span className="legend-dot" style={{ background: item.color }} />
                  <span>{item.name}: {item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card chart-card" style={{ marginBottom: 28 }}>
          <div className="card-title" style={{ marginBottom: 14 }}>Recommendation Mix</div>
          <div className="chart-wrap chart-wrap-sm">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={recommendationData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid stroke="rgba(79,142,247,0.12)" strokeDasharray="4 4" />
                <XAxis dataKey="name" tick={{ fill: '#8896b3', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: '#8896b3', fontSize: 11 }} axisLine={false} tickLine={false} />
                <RechartsTooltip
                  contentStyle={{
                    background: '#131d35',
                    border: '1px solid rgba(79,142,247,0.3)',
                    borderRadius: 10,
                    color: '#f0f4ff',
                  }}
                />
                <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                  {recommendationData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── Submissions Table ── */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="card-title" style={{ marginBottom: 0 }}>Recent Submissions</div>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => navigate('/upload')}
            >
              <Store size={14} /> New Submission
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center" style={{ padding: 48, gap: 12 }}>
              <div className="spinner" />
              <span className="text-muted text-sm">Loading submissions…</span>
            </div>
          ) : submissions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 24px' }}>
              <Store size={40} style={{ color: 'var(--text-muted)', margin: '0 auto 12px' }} />
              <p style={{ color: 'var(--text-secondary)', fontSize: 15, fontWeight: 500 }}>
                No submissions yet
              </p>
              <p className="text-muted text-sm" style={{ marginTop: 4, marginBottom: 20 }}>
                Upload kirana store images to get started
              </p>
              <button className="btn btn-primary" onClick={() => navigate('/upload')}>
                <Upload size={15} /> Create First Submission
              </button>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Store</th>
                    <th>Location</th>
                    <th>Status</th>
                    <th>Risk</th>
                    <th>Recommendation</th>
                    <th>Date</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {recentSubmissions.map(s => (
                    <tr
                      key={s.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/submissions/${s.id}`)}
                    >
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>
                          {s.store_name || 'Unnamed Store'}
                        </div>
                        <div className="text-xs text-muted font-mono">
                          {s.id.slice(0, 8)}…
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center gap-2 text-sm text-muted">
                          <MapPin size={12} />
                          {s.latitude.toFixed(4)}, {s.longitude.toFixed(4)}
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${STATUS_BADGE[s.status] || 'badge-blue'}`}>
                          {s.status}
                        </span>
                      </td>
                      <td>
                        {s.risk_level ? (
                          <span className={`badge ${RISK_BADGE[s.risk_level] || 'badge-blue'}`}>
                            {s.risk_level}
                          </span>
                        ) : <span className="text-muted text-xs">—</span>}
                      </td>
                      <td>
                        {s.recommendation ? (
                          <span style={{
                            fontSize: 12, fontWeight: 600,
                            color: REC_COLOR[s.recommendation] || 'var(--text-secondary)',
                          }}>
                            {s.recommendation.replace(/_/g, ' ')}
                          </span>
                        ) : <span className="text-muted text-xs">Pending</span>}
                      </td>
                      <td className="text-sm text-muted">{formatDate(s.created_at)}</td>
                      <td>
                        <ArrowRight size={14} style={{ color: 'var(--text-muted)' }} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// End of Dashboard.tsx
