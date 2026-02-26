/**
 * Proxy.js - Model proxy
 * ----------------------
 * Lưu trữ danh sách proxy dùng cho các luồng tự động hoá.
 *
 * Các trường:
 * - type     : Loại proxy (http | https | socks4 | socks5)
 * - host     : Địa chỉ host của proxy
 * - port     : Cổng proxy
 * - username : Tên đăng nhập proxy (tuỳ chọn)
 * - password : Mật khẩu proxy (tuỳ chọn)
 * - status   : Trạng thái (active | inactive | dead)
 */

import mongoose from 'mongoose';

const proxySchema = new mongoose.Schema(
    {
        type: {
            type: String,
            enum: ['http', 'https', 'socks4', 'socks5'],
            default: 'http',
        },
        host: {
            type: String,
            required: true,
            trim: true,
        },
        port: {
            type: Number,
            required: true,
            min: 1,
            max: 65535,
        },
        username: {
            type: String,
            trim: true,
            default: null,
        },
        password: {
            type: String,
            default: null,
        },
        status: {
            type: String,
            enum: ['active', 'inactive', 'dead'],
            default: 'active',
            index: true,
        },
        group_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ProxyGroup',
            default: null,
            index: true,
        },
    },
    {
        timestamps: {
            createdAt: 'created_at',
            updatedAt: 'updated_at',
        },
        collection: 'proxies',
    }
);

// Index composite để tránh trùng lặp proxy
proxySchema.index({ host: 1, port: 1 }, { unique: true });

const Proxy = mongoose.model('Proxy', proxySchema);

export default Proxy;
