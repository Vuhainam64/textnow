import mongoose from 'mongoose';

const workflowSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String },
    nodes: { type: Array, default: [] },
    edges: { type: Array, default: [] },
    config: {
        account_group_id: { type: String },
        target_statuses: { type: Array, default: ['active'] },
        proxy_group_id: { type: String },
    },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now }
});

workflowSchema.pre('save', function () {
    this.updated_at = Date.now();
});

export default mongoose.model('Workflow', workflowSchema);
