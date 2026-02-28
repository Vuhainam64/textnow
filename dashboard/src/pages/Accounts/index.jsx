import { useState } from 'react'
import { useAccounts } from './hooks/useAccounts'
import { useGroups } from './hooks/useGroups'
import AccountsTable from './components/AccountsTable'
import GroupsSidebar from './components/GroupsSidebar'
import AccountForm from './components/AccountForm'
import AssignModal from './components/AssignModal'
import ImportModal from './ImportModal'
import ExportModal from './ExportModal'
import Modal from '../../components/Modal'
import ConfirmModal from '../../components/MLX/ConfirmModal'
import GroupForm from '../../components/GroupForm'

export default function Accounts() {
    const [selectedGroup, setSelectedGroup] = useState('__all__')

    // ── Data hooks ──────────────────────────────────────────
    const accounts = useAccounts({ selectedGroup })
    const groupsHook = useGroups({ selectedGroup })

    // ── UI state (chỉ là mở/đóng modal) ────────────────────
    const [showAdd, setShowAdd] = useState(false)
    const [editing, setEditing] = useState(null)
    const [showImport, setShowImport] = useState(false)
    const [importText, setImportText] = useState('')
    const [showExport, setShowExport] = useState(false)
    const [exportStatus, setExportStatus] = useState([])
    const [exportDeleteAfter, setExportDeleteAfter] = useState(false)
    const [deleteAccountTarget, setDeleteAccountTarget] = useState(null)
    const [showDeleteAll, setShowDeleteAll] = useState(false)
    const [showGroupForm, setShowGroupForm] = useState(false)
    const [editingGroup, setEditingGroup] = useState(null)
    const [deleteGroupTarget, setDeleteGroupTarget] = useState(null)
    const [deleteGroupMode, setDeleteGroupMode] = useState('ungroup')
    const [deleteGroupLoading, setDeleteGroupLoading] = useState(false)
    const [clearMembersTarget, setClearMembersTarget] = useState(null)
    const [clearMembersLoading, setClearMembersLoading] = useState(false)
    const [showAssign, setShowAssign] = useState(false)

    // ── Handlers ────────────────────────────────────────────
    const handleCreate = async (data) => { await accounts.createAccount(data); groupsHook.reload() }
    const handleUpdate = async (data) => { await accounts.updateAccount(editing._id, data) }

    const handleImport = async () => {
        const gid = selectedGroup !== '__all__' && selectedGroup !== '__ungrouped__' ? selectedGroup : undefined
        const ok = await accounts.importAccounts(importText, gid)
        if (ok) { setShowImport(false); setImportText(''); groupsHook.reload() }
    }

    const handleExport = async () => {
        const ok = await accounts.exportAccounts({ status: exportStatus, groupId: selectedGroup, deleteAfter: exportDeleteAfter })
        if (ok) setShowExport(false)
    }

    const confirmDeleteGroup = async () => {
        setDeleteGroupLoading(true)
        try {
            await groupsHook.deleteGroup(deleteGroupTarget._id, deleteGroupMode)
            if (selectedGroup === deleteGroupTarget._id) setSelectedGroup('__all__')
            setDeleteGroupTarget(null)
        } finally { setDeleteGroupLoading(false) }
    }

    const confirmClearMembers = async () => {
        setClearMembersLoading(true)
        const ok = await groupsHook.clearMembers(clearMembersTarget._id)
        if (ok) { setClearMembersTarget(null); accounts.reload(1) }
        setClearMembersLoading(false)
    }

    return (
        <div className="p-6 flex gap-5 h-full">

            {/* ── Modals ──────────────────────────────────────────── */}
            {deleteAccountTarget && (
                <ConfirmModal
                    title="Xoá tài khoản"
                    description="Xoá vĩnh viễn tài khoản này? Thao tác không thể hoàn tác."
                    danger
                    onConfirm={() => { accounts.deleteAccount(deleteAccountTarget); setDeleteAccountTarget(null) }}
                    onClose={() => setDeleteAccountTarget(null)}
                />
            )}
            {showDeleteAll && (
                <ConfirmModal
                    title="Xoá tất cả tài khoản"
                    description={`Bạn có chắc chắn muốn xoá toàn bộ ${accounts.pagination.total} tài khoản đang hiển thị theo bộ lọc hiện tại không?`}
                    danger
                    onConfirm={() => { accounts.deleteAll(); setShowDeleteAll(false) }}
                    onClose={() => setShowDeleteAll(false)}
                />
            )}

            <ExportModal
                show={showExport}
                onClose={() => setShowExport(false)}
                exportStatus={exportStatus}
                setExportStatus={setExportStatus}
                exportDeleteAfter={exportDeleteAfter}
                setExportDeleteAfter={setExportDeleteAfter}
                exportLoading={accounts.exportLoading}
                onExport={handleExport}
                currentGroup={groupsHook.currentGroup}
            />

            <ImportModal
                show={showImport}
                onClose={() => { setShowImport(false); setImportText('') }}
                importText={importText}
                setImportText={setImportText}
                importLoading={accounts.importLoading}
                importProgress={accounts.importProgress}
                onImport={handleImport}
                currentGroup={groupsHook.currentGroup}
            />

            {(showGroupForm || editingGroup) && (
                <Modal title={editingGroup ? 'Sửa nhóm' : 'Tạo nhóm mới'} onClose={() => { setShowGroupForm(false); setEditingGroup(null) }}>
                    <GroupForm
                        initial={editingGroup}
                        onSave={editingGroup
                            ? (data) => groupsHook.updateGroup(editingGroup._id, data)
                            : groupsHook.createGroup}
                        onClose={() => { setShowGroupForm(false); setEditingGroup(null) }}
                    />
                </Modal>
            )}

            {deleteGroupTarget && (
                <Modal title={`Xóa nhóm "${deleteGroupTarget.name}"`} onClose={() => setDeleteGroupTarget(null)}>
                    <div className="space-y-4">
                        <p className="text-sm text-slate-400">
                            Nhóm có <span className="text-white font-medium">{deleteGroupTarget.account_count}</span> tài khoản. Chọn cách xử lý:
                        </p>
                        <div className="space-y-2">
                            {[
                                { v: 'ungroup', label: 'Giữ tài khoản, chuyển về "Chưa có nhóm"', sub: 'An toàn hơn' },
                                { v: 'delete', label: 'Xóa luôn toàn bộ tài khoản trong nhóm', sub: 'Không thể hoàn tác!' }
                            ].map(opt => (
                                <label key={opt.v} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all
                                    ${deleteGroupMode === opt.v
                                        ? opt.v === 'delete' ? 'border-red-500/40 bg-red-500/10' : 'border-blue-500/40 bg-blue-500/10'
                                        : 'border-white/10 hover:border-white/20'}`}>
                                    <input type="radio" value={opt.v} checked={deleteGroupMode === opt.v}
                                        onChange={e => setDeleteGroupMode(e.target.value)} className="mt-0.5 accent-blue-500" />
                                    <div>
                                        <p className={`text-sm font-medium ${opt.v === 'delete' && deleteGroupMode === 'delete' ? 'text-red-400' : 'text-slate-200'}`}>{opt.label}</p>
                                        <p className="text-xs text-slate-500 mt-0.5">{opt.sub}</p>
                                    </div>
                                </label>
                            ))}
                        </div>
                        <div className="flex justify-end gap-2 pt-1">
                            <button onClick={() => setDeleteGroupTarget(null)} className="px-4 py-2 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-all">Huỷ</button>
                            <button onClick={confirmDeleteGroup} disabled={deleteGroupLoading}
                                className={`px-5 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-60 transition-all ${deleteGroupMode === 'delete' ? 'bg-red-600 hover:bg-red-500' : 'bg-blue-600 hover:bg-blue-500'}`}>
                                {deleteGroupLoading ? 'Đang xóa...' : 'Xác nhận xóa'}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {clearMembersTarget && (
                <Modal title={`Xóa tài khoản trong "${clearMembersTarget.name}"`} onClose={() => setClearMembersTarget(null)}>
                    <div className="space-y-4">
                        <p className="text-sm text-slate-400">
                            Xóa toàn bộ <span className="text-white font-medium">{clearMembersTarget.account_count}</span> tài khoản trong nhóm? Nhóm vẫn được giữ lại.
                        </p>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setClearMembersTarget(null)} className="px-4 py-2 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-all">Huỷ</button>
                            <button onClick={confirmClearMembers} disabled={clearMembersLoading}
                                className="px-5 py-2 rounded-xl text-sm font-medium bg-red-600 hover:bg-red-500 text-white disabled:opacity-60 transition-all">
                                {clearMembersLoading ? 'Đang xóa...' : `Xóa ${clearMembersTarget.account_count} tài khoản`}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            <AssignModal
                show={showAssign}
                onClose={() => setShowAssign(false)}
                ungroupedCount={groupsHook.ungroupedCount}
                groups={groupsHook.groups}
                onConfirm={groupsHook.assignUngrouped}
            />

            {showAdd && (
                <Modal title="Thêm tài khoản mới" onClose={() => setShowAdd(false)}>
                    <AccountForm groups={groupsHook.groups} groupId={selectedGroup !== '__all__' && selectedGroup !== '__ungrouped__' ? selectedGroup : ''} onSave={handleCreate} onClose={() => setShowAdd(false)} />
                </Modal>
            )}
            {editing && (
                <Modal title="Chỉnh sửa tài khoản" onClose={() => setEditing(null)}>
                    <AccountForm initial={editing} groups={groupsHook.groups} groupId={editing.group_id} onSave={handleUpdate} onClose={() => setEditing(null)} />
                </Modal>
            )}

            {/* ── Layout ─────────────────────────────────────────── */}
            <GroupsSidebar
                groups={groupsHook.groups}
                ungroupedCount={groupsHook.ungroupedCount}
                selectedGroup={selectedGroup}
                totalAccounts={accounts.pagination.total}
                onSelectGroup={setSelectedGroup}
                onNewGroup={() => setShowGroupForm(true)}
                onEdit={g => setEditingGroup(g)}
                onClearMembers={g => setClearMembersTarget(g)}
                onDeleteGroup={g => { setDeleteGroupMode('ungroup'); setDeleteGroupTarget(g) }}
                onAssign={() => setShowAssign(true)}
            />

            <AccountsTable
                accounts={accounts.accounts}
                groups={groupsHook.groups}
                loading={accounts.loading}
                pagination={accounts.pagination}
                stats={accounts.stats}
                search={accounts.search}
                setSearch={accounts.setSearch}
                statusFilter={accounts.statusFilter}
                setStatusFilter={accounts.setStatusFilter}
                selectedGroup={selectedGroup}
                currentGroup={groupsHook.currentGroup}
                onAdd={() => setShowAdd(true)}
                onEdit={setEditing}
                onDelete={id => setDeleteAccountTarget(id)}
                onDeleteAll={() => setShowDeleteAll(true)}
                onImport={() => setShowImport(true)}
                onExport={() => { setShowExport(true); setExportStatus([]); setExportDeleteAfter(false) }}
                onPageChange={accounts.load}
            />
        </div>
    )
}
