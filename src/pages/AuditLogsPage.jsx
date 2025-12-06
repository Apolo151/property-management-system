import { useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import useStore from '../store/useStore'
import SearchInput from '../components/SearchInput'
import FilterSelect from '../components/FilterSelect'

const AuditLogsPage = () => {
  const { auditLogs } = useStore()
  const [searchTerm, setSearchTerm] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [entityFilter, setEntityFilter] = useState('')

  const filteredLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      const matchesSearch =
        log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.entityType.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.entityId.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesAction = !actionFilter || log.action === actionFilter
      const matchesEntity = !entityFilter || log.entityType === entityFilter
      return matchesSearch && matchesAction && matchesEntity
    })
  }, [auditLogs, searchTerm, actionFilter, entityFilter])

  const uniqueActions = useMemo(() => {
    const actions = [...new Set(auditLogs.map((log) => log.action))]
    return actions.map((action) => ({ value: action, label: action }))
  }, [auditLogs])

  const uniqueEntities = useMemo(() => {
    const entities = [...new Set(auditLogs.map((log) => log.entityType))]
    return entities.map((entity) => ({ value: entity, label: entity }))
  }, [auditLogs])

  const getActionColor = (action) => {
    if (action.includes('ADD')) return 'text-green-600'
    if (action.includes('UPDATE')) return 'text-blue-600'
    if (action.includes('DELETE')) return 'text-red-600'
    return 'text-gray-600'
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Audit Logs</h1>
        <p className="text-gray-600 mt-2">Track all system actions and changes</p>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SearchInput
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search by action, entity type, or ID..."
            label="Search"
          />
          <FilterSelect
            value={actionFilter}
            onChange={setActionFilter}
            options={uniqueActions}
            placeholder="All Actions"
            label="Action"
          />
          <FilterSelect
            value={entityFilter}
            onChange={setEntityFilter}
            options={uniqueEntities}
            placeholder="All Entity Types"
            label="Entity Type"
          />
        </div>
      </div>

      {/* Logs Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Timestamp
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Action
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Entity Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Entity ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Details
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {format(parseISO(log.timestamp), 'MMM dd, yyyy HH:mm:ss')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`text-sm font-medium ${getActionColor(log.action)}`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {log.entityType}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {log.entityId}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {log.userId}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {log.details && typeof log.details === 'object' ? (
                      <pre className="text-xs">
                        {JSON.stringify(log.details, null, 2)}
                      </pre>
                    ) : (
                      log.details || '-'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredLogs.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              {auditLogs.length === 0
                ? 'No audit logs yet'
                : 'No logs found matching your filters'}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 text-sm text-gray-600">
        Showing {filteredLogs.length} of {auditLogs.length} audit logs
      </div>
    </div>
  )
}

export default AuditLogsPage

