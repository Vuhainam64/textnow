import { useEffect, useState, useCallback } from 'react'
import { AccountsService } from '../../services/apiService'
import { showToast } from '../../components/Toast'

/**
 * Hook quản lý danh sách accounts, search, filter, pagination, import
 */
export function useAccounts({ selectedGroup }) {
    const [accounts, setAccounts] = useState([])
    const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 })
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [stats, setStats] = useState([])
    const [importLoading, setImportLoading] = useState(false)
    const [importProgress, setImportProgress] = useState(null)
    const [exportLoading, setExportLoading] = useState(false)

    const buildParams = useCallback((extra = {}) => {
        const p = { search: search || undefined, status: statusFilter || undefined, ...extra }
        if (selectedGroup === '__ungrouped__') p.group_id = 'null'
        else if (selectedGroup !== '__all__') p.group_id = selectedGroup
        return p
    }, [search, statusFilter, selectedGroup])

    const load = useCallback(async (page = 1) => {
        setLoading(true)
        try {
            const res = await AccountsService.getAccounts(buildParams({ page, limit: 15 }))
            setAccounts(res.data)
            setPagination(res.pagination)
        } catch { /* offline */ } finally { setLoading(false) }
    }, [buildParams])

    const loadStats = useCallback(async () => {
        try {
            const res = await AccountsService.getStats(buildParams())
            setStats(res.data?.stats || [])
        } catch { /* offline */ }
    }, [buildParams])

    useEffect(() => { load(1); loadStats() }, [load, loadStats])

    const createAccount = async (data) => { await AccountsService.createAccount(data); load(1) }
    const updateAccount = async (id, data) => { await AccountsService.updateAccount(id, data); load(pagination.page) }

    const deleteAccount = async (id) => {
        try { await AccountsService.deleteAccount(id); showToast('Đã xoá tài khoản'); load(pagination.page); loadStats() }
        catch (e) { showToast(e.message, 'error') }
    }

    const deleteAll = async () => {
        try {
            const res = await AccountsService.deleteAccountsBulk(buildParams())
            showToast(res.message); load(1); loadStats()
        } catch (e) { showToast(e.message, 'error') }
    }

    const importAccounts = async (text, groupId) => {
        if (!text.trim()) return
        setImportLoading(true); setImportProgress(null)
        try {
            const list = text.trim().split('\n').filter(Boolean).map(line => {
                const parts = line.split('|').map(p => p.trim())
                if (parts.length === 6) {
                    const [tnUser, tnPass, hmUser, hmPass, hmToken, hmClientId] = parts
                    return { textnow_user: tnUser, textnow_pass: tnPass, hotmail_user: hmUser, hotmail_pass: hmPass, hotmail_token: hmToken, hotmail_client_id: hmClientId, status: 'pending' }
                } else if (parts.length === 4) {
                    const [hmUser, hmPass, hmToken, hmClientId] = parts
                    return { textnow_user: hmUser, textnow_pass: hmPass, hotmail_user: hmUser, hotmail_pass: hmPass, hotmail_token: hmToken, hotmail_client_id: hmClientId, status: 'pending' }
                }
                if (line.includes(':')) {
                    const [textnow_user, textnow_pass, hotmail_user, hotmail_pass] = line.split(':')
                    return { textnow_user, textnow_pass, hotmail_user, hotmail_pass, status: 'pending' }
                }
                return null
            }).filter(Boolean)

            if (list.length === 0) { showToast('Không có dữ liệu hợp lệ để nhập', 'warning'); return }

            const gid = groupId || undefined
            const BATCH = 500
            let totalInserted = 0
            for (let i = 0; i < list.length; i += BATCH) {
                setImportProgress({ done: i, total: list.length, inserted: totalInserted })
                const res = await AccountsService.importAccounts({ accounts: list.slice(i, i + BATCH), group_id: gid })
                totalInserted += res.inserted || 0
            }
            setImportProgress({ done: list.length, total: list.length, inserted: totalInserted })
            showToast(`✅ Đã nhập ${totalInserted} tài khoản`)
            load(1)
            return true
        } catch (e) { showToast(e.message, 'error') }
        finally { setImportLoading(false); setImportProgress(null) }
    }

    const exportAccounts = async ({ status, groupId, deleteAfter }) => {
        setExportLoading(true)
        try {
            const gid = groupId !== '__all__' && groupId !== '__ungrouped__' ? groupId
                : groupId === '__ungrouped__' ? 'null' : undefined
            const res = await fetch('/api/accounts/export', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: status.length > 0 ? status : undefined, group_id: gid, deleteAfter })
            })
            if (!res.ok) throw new Error(await res.text())
            const blob = await res.blob()
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a'); a.href = url
            a.download = `accounts_export_${Date.now()}.txt`; a.click()
            URL.revokeObjectURL(url)
            showToast('✅ Xuất thành công!')
            if (deleteAfter) { load(1); loadStats() }
            return true
        } catch (e) { showToast(e.message, 'error') }
        finally { setExportLoading(false) }
    }

    return {
        accounts, pagination, loading,
        search, setSearch, statusFilter, setStatusFilter, stats,
        importLoading, importProgress, exportLoading,
        load, reload: load,
        createAccount, updateAccount, deleteAccount, deleteAll,
        importAccounts, exportAccounts,
    }
}
