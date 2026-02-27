/**
 * Account.js - Model tài khoản
 * ----------------------------
 * Lưu trữ thông tin tài khoản TextNow và Hotmail liên kết.
 *
 * Các trường:
 * - textnow_user    : Tên đăng nhập TextNow
 * - textnow_pass    : Mật khẩu TextNow
 * - hotmail_user    : Email Hotmail dùng để khôi phục / xác thực
 * - hotmail_pass    : Mật khẩu Hotmail
 * - hotmail_token   : Access token Hotmail (Microsoft OAuth)
 * - hotmail_client_id: Client ID của ứng dụng Azure AD
 * - status          : Trạng thái tài khoản (active / inactive / banned / pending)
 * - created_at      : Thời điểm tạo
 * - updated_at      : Thời điểm cập nhật cuối
 */

import mongoose from 'mongoose';

const accountSchema = new mongoose.Schema(
    {
        textnow_user: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            index: true,
        },
        textnow_pass: {
            type: String,
            required: true,
        },
        hotmail_user: {
            type: String,
            trim: true,
            default: null,
        },
        hotmail_pass: {
            type: String,
            default: null,
        },
        hotmail_token: {
            type: String,
            default: null,
        },
        hotmail_client_id: {
            type: String,
            default: null,
        },
        status: {
            type: String,
            enum: ['active', 'inactive', 'banned', 'pending', 'die_mail', 'no_mail', 'Reset Error'],
            default: 'pending',
            index: true,
        },
        group_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'AccountGroup',
            default: null,
            index: true,
        },
    },
    {
        timestamps: {
            createdAt: 'created_at',
            updatedAt: 'updated_at',
        },
        collection: 'accounts',
    }
);

const Account = mongoose.model('Account', accountSchema);

export default Account;
