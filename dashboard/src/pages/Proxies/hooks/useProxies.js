import { useEffect, useState, useCallback } from 'react'
import { ProxiesService } from '../../services/apiService'
import { showToast } from '../../components/Toast'

export function useProxies({ selectedGroup }) {
    const [proxies, setProxies] = useState([])
    const [groups, setGroups] = useState([])
    const [ungroupedCount, setUngroupedCount] = useState(0)
    const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 })
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [typeFilter, setTypeFilter] = useState('')
    const [importLoading, setImportLoading] = useState(false)
    const [importProgress, setImportProgress] = useState(null)

    const buildParams = useCallback((extra = {}) => {
        const p = { search: search || undefined, status: statusFilter || undefined, type: typeFilter || undefined, ...extra }
        if (selectedGroup === '__ungrouped__') p.group_id = 'null'
        else if (selectedGroup !== '__all__') p.group_id = selectedGroup
        return p
    }, [search, statusFilter, typeFilter, selectedGroup])

    const loadGroups = useCallback(async () => {
        try {
            const res = await ProxiesService.getGroups()
            setGroups(res.data || [])
            setUngroupedCount(res.ungrouped_count || 0)
        } catch { }
    }, [])

    const load = useCallback(async (page = 1) => {
        setLoading(true)
        try {
            const res = await ProxiesService.getProxies(buildParams({ page, limit: 15 }))
            setProxies(res.data); setPagination(res.pagination)
        } catch { } finally { setLoading(false) }
    }, [buildParams])

    useEffect(() => { loadGroups() }, [loadGroups])
    useEffect(() => { load(1) }, [load])

    // Groups
    const createGroup = async (data) => { await ProxiesService.createGroup(data); loadGroups() }
    const updateGroup = async (id, data) => { await ProxiesService.updateGroup(id, data); loadGroups() }
    const deleteGroup = async (id) => {
        try { await ProxiesService.deleteGroup(id); showToast('Đã xoá nhóm proxy'); loadGroups() }
        catch (e) { showToast(e.message, 'error') }
    }
    const assignUngrouped = async (form) => {
        let gid = form.group_id
        if (form.mode === 'new') {
            const res = await ProxiesService.createGroup({ name: form.name, description: form.description, color: form.color })
            gid = res.data._id
        }
        if (!gid) { showToast('Vui lòng chọn hoặc tạo nhóm', 'warning'); return false }
        await ProxiesService.assignToGroup({ group_id: gid, count: form.count || undefined })
        showToast('✅ Phân nhóm thành công'); loadGroups(); load(pagination.page)
        return true
    }

    // Proxies
    const createProxy = async (data) => { await ProxiesService.createProxy(data); load(1); loadGroups() }
    const updateProxy = async (id, data) => { await ProxiesService.updateProxy(id, data); load(pagination.page); loadGroups() }
    const deleteProxy = async (id) => {
        try { await ProxiesService.deleteProxy(id); showToast('Đã xoá proxy'); load(pagination.page) }
        catch (e) { showToast(e.message, 'error') }
    }
    const deleteAll = async () => {
        try { const res = await ProxiesService.deleteProxiesBulk(buildParams()); showToast(res.message); load(1); loadGroups() }
        catch (e) { showToast(e.message, 'error') }
    }

    const importProxies = async ({ text, type, status, groupId }) => {
        if (!text.trim()) return
        setImportLoading(true); setImportProgress(null)
        try {
            const lines = text.trim().split('\n').filter(Boolean)
            const BATCH = 500; let totalInserted = 0
            for (let i = 0; i < lines.length; i += BATCH) {
                setImportProgress({ done: i, total: lines.length, inserted: totalInserted })
                const res = await ProxiesService.importProxies({ raw: lines.slice(i, i + BATCH).join('\n'), group_id: groupId, type, status })
                totalInserted += res.inserted || 0
            }
            setImportProgress({ done: lines.length, total: lines.length, inserted: totalInserted })
            showToast(`✅ Đã nhập ${totalInserted} proxy`)
            load(1); loadGroups()
            return true
        } catch (e) { showToast(e.message, 'error') }
        finally { setImportLoading(false); setImportProgress(null) }
    }

    const currentGroup = groups.find(g => g._id === selectedGroup) || null

    return {
        proxies, groups, ungroupedCount, currentGroup, pagination, loading,
        search, setSearch, statusFilter, setStatusFilter, typeFilter, setTypeFilter,
        importLoading, importProgress,
        load, reload: load,
        createGroup, updateGroup, deleteGroup, assignUngrouped,
        createProxy, updateProxy, deleteProxy, deleteAll, importProxies,
    }
}
