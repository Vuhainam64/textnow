import api from '../lib/api'

export const AccountsService = {
    getGroups: () => api.get('/groups/accounts'),
    createGroup: (data) => api.post('/groups/accounts', data),
    updateGroup: (id, data) => api.put(`/groups/accounts/${id}`, data),
    deleteGroup: (id, deleteAccounts) => api.delete(`/groups/accounts/${id}?deleteAccounts=${deleteAccounts}`),
    clearGroupMembers: (id) => api.delete(`/groups/accounts/${id}/members`),
    assignToGroup: (data) => api.post('/groups/accounts/assign', data),

    getAccounts: (params) => api.get('/accounts', { params }),
    createAccount: (data) => api.post('/accounts', data),
    updateAccount: (id, data) => api.put(`/accounts/${id}`, data),
    deleteAccount: (id) => api.delete(`/accounts/${id}`),
    importAccounts: (data) => api.post('/accounts/import', data)
}

export const ProxiesService = {
    getGroups: () => api.get('/groups/proxies'),
    createGroup: (data) => api.post('/groups/proxies', data),
    updateGroup: (id, data) => api.put(`/groups/proxies/${id}`, data),
    deleteGroup: (id) => api.delete(`/groups/proxies/${id}`),
    assignToGroup: (data) => api.post('/groups/proxies/assign', data),

    getProxies: (params) => api.get('/proxies', { params }),
    createProxy: (data) => api.post('/proxies', data),
    updateProxy: (id, data) => api.put(`/proxies/${id}`, data),
    deleteProxy: (id) => api.delete(`/proxies/${id}`),
    importProxies: (data) => api.post('/proxies/import', data),
}

export const MLXService = {
    getFolders: () => api.get('/mlx/folders'),
    createFolder: (data) => api.post('/mlx/folders', data),
    updateFolder: (data) => api.put('/mlx/folders', data),
    deleteFolder: (ids) => api.delete('/mlx/folders', { data: { ids } }),
    cleanupFolder: (folder_id) => api.post('/mlx/folders/cleanup', { folder_id }),

    searchProfiles: (data) => api.post('/mlx/profiles/search', data),
    createProfile: (data) => api.post('/mlx/profiles/create', data),
    removeProfiles: (ids) => api.post('/mlx/profiles/remove', { ids })
}

export const DashboardService = {
    getAccountStats: () => api.get('/accounts/stats'),
    getProxyStats: () => api.get('/proxies/stats'),
}
