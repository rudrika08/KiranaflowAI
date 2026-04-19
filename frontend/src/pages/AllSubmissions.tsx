import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, MapPin, Search, Store } from 'lucide-react'
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

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function AllSubmissions() {
  const [submissions, setSubmissions] = useState<SubmissionListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const navigate = useNavigate()

  useEffect(() => {
    submissionsApi.list()
      .then(r => setSubmissions(r.data))
      .catch(() => setSubmissions([]))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    return submissions.filter(s => {
      const statusMatch = statusFilter === 'all' || s.status === statusFilter
      const name = (s.store_name || 'Unnamed Store').toLowerCase()
      const id = s.id.toLowerCase()
      const query = search.trim().toLowerCase()
      const queryMatch = !query || name.includes(query) || id.includes(query)
      return statusMatch && queryMatch
    })
  }, [submissions, search, statusFilter])

  return (
    <div className="fade-in">
      <div className="page-header">
        <h2>All Submissions</h2>
        <p>Browse and filter all kirana analysis requests</p>
      </div>

      <div className="page-body">
        <div className="card">
          <div className="flex items-center justify-between mb-4" style={{ gap: 12, flexWrap: 'wrap' }}>
            <div className="card-title" style={{ marginBottom: 0 }}>Submission Registry</div>
            <div className="flex items-center" style={{ gap: 10, flexWrap: 'wrap' }}>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-muted)' }} />
                <input
                  className="form-input"
                  placeholder="Search store or ID"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ minWidth: 220, paddingLeft: 32, height: 36 }}
                />
              </div>

              <select
                className="label-select"
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                style={{ height: 36, minWidth: 140 }}
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="validating">Validating</option>
                <option value="processing">Processing</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center" style={{ padding: 48, gap: 12 }}>
              <div className="spinner" />
              <span className="text-muted text-sm">Loading submissions...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 24px' }}>
              <Store size={40} style={{ color: 'var(--text-muted)', margin: '0 auto 12px' }} />
              <p style={{ color: 'var(--text-secondary)', fontSize: 15, fontWeight: 500 }}>
                No submissions match your filters
              </p>
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
                  {filtered.map(s => (
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
                          {s.id.slice(0, 8)}...
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
                        ) : <span className="text-muted text-xs">-</span>}
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
