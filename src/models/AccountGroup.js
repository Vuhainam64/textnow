/**
 * AccountGroup.js - Nhóm tài khoản
 * ----------------------------------
 * Cho phép phân loại tài khoản TextNow thành các nhóm
 * để quản lý dễ dàng hơn (VD: T1, T2, Spam, Main...).
 *
 * Mỗi Account có thể thuộc về 1 nhóm (group_id).
 */

import mongoose from 'mongoose';

const accountGroupSchema = new mongoose.Schema(
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
            // Màu đại diện cho nhóm (hex string), dùng để phân biệt trực quan
            type: String,
            default: '#3b82f6', // blue-500
        },
        labels: {
            // Nhãn mục đích: VER, RESET, CHECK LIVE, hoặc tuỳ chỉnh
            type: [String],
            default: [],
        },
    },
    {
        timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
        collection: 'account_groups',
    }
);

const AccountGroup = mongoose.model('AccountGroup', accountGroupSchema);
export default AccountGroup;
