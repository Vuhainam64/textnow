import { useEffect, useState, useCallback } from 'react'
import { AccountsService } from '../../services/apiService'
import { showToast } from '../../components/Toast'

/**
 * Hook quản lý danh sách nhóm tài khoản và phân nhóm
 */
export function useGroups({ selectedGroup }) {
    const [groups, setGroups] = useState([])
    const [ungroupedCount, setUngroupedCount] = useState(0)

    const load = useCallback(async () => {
        try {
            const res = await AccountsService.getGroups()
            setGroups(res.data || [])
            setUngroupedCount(res.ungrouped_count || 0)
        } catch { /* offline */ }
    }, [])

    useEffect(() => { load() }, [load])

    const createGroup = async (data) => { await AccountsService.createGroup(data); load() }
    const updateGroup = async (id, data) => { await AccountsService.updateGroup(id, data); load() }

    const deleteGroup = async (id, mode) => {
        try {
            await AccountsService.deleteGroup(id, { mode })
            showToast('Đã xoá nhóm')
            load()
        } catch (e) { showToast(e.message, 'error') }
    }

    const clearMembers = async (id) => {
        try {
            const res = await AccountsService.clearGroupMembers(id)
            showToast(`Đã xoá ${res.deleted} tài khoản`)
            load()
            return true
        } catch (e) { showToast(e.message, 'error'); return false }
    }

    const assignUngrouped = async (form) => {
        let gid = form.group_id
        if (form.mode === 'new') {
            const res = await AccountsService.createGroup({ name: form.name, description: form.description, color: form.color })
            gid = res.data._id
        }
        if (!gid) { showToast('Vui lòng chọn hoặc tạo nhóm', 'warning'); return false }
        const res = await AccountsService.assignToGroup({ group_id: gid, count: form.count || undefined })
        showToast(`✅ Đã gán ${res.updated} tài khoản vào nhóm`)
        load()
        return true
    }

    const currentGroup = groups.find(g => g._id === selectedGroup) || null

    return { groups, ungroupedCount, currentGroup, reload: load, createGroup, updateGroup, deleteGroup, clearMembers, assignUngrouped }
}
