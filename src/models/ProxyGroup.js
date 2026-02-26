/**
 * ProxyGroup.js - Nhóm proxy
 * ---------------------------
 * Cho phép phân loại proxy thành các nhóm
 * để dễ quản lý (VD: VN-ISP, US-DC, Rotating...).
 */

import mongoose from 'mongoose';

const proxyGroupSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            unique: true,
        },
        description: {
            type: String,
            trim: true,
            default: '',
        },
        color: {
            type: String,
            default: '#10b981', // emerald-500
        },
    },
    {
        timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
        collection: 'proxy_groups',
    }
);

const ProxyGroup = mongoose.model('ProxyGroup', proxyGroupSchema);
export default ProxyGroup;
