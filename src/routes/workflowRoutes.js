import express from 'express';
import Workflow from '../models/Workflow.js';

const router = express.Router();

// Get all workflows
router.get('/', async (req, res) => {
    try {
        const workflows = await Workflow.find().sort({ updated_at: -1 });
        res.json({ success: true, data: workflows });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get single workflow
router.get('/:id', async (req, res) => {
    try {
        const workflow = await Workflow.findById(req.params.id);
        if (!workflow) return res.status(404).json({ success: false, error: 'Workflow not found' });
        res.json({ success: true, data: workflow });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create workflow
router.post('/', async (req, res) => {
    try {
        const workflow = new Workflow(req.body);
        await workflow.save();
        res.json({ success: true, data: workflow });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update workflow
router.put('/:id', async (req, res) => {
    try {
        const workflow = await Workflow.findByIdAndUpdate(req.params.id, req.body, { returnDocument: 'after' });
        res.json({ success: true, data: workflow });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete workflow
router.delete('/:id', async (req, res) => {
    try {
        await Workflow.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'Workflow deleted' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

import WorkflowEngine from '../services/workflowEngine.js';

// ... (existing routes)

// Run workflow
router.post('/:id/run', async (req, res) => {
    try {
        const workflow = await Workflow.findById(req.params.id);
        if (!workflow) return res.status(404).json({ success: false, error: 'Workflow not found' });

        // Runtime config from dashboard
        const {
            account_group_id,
            proxy_group_id = null,
            target_statuses = ['active'],
            new_password = '',
            limit,
            threads = 1,
            startup_delay = 0,
            start_node_id = null,   // Resume: bat dau tu node cu the
            ws_endpoint = null,   // Resume: dung lai browser session
        } = req.body;

        const executionId = await WorkflowEngine.execute(workflow, {
            account_group_id,
            proxy_group_id,
            target_statuses,
            new_password,
            limit: limit ? parseInt(limit) : null,
            threads: parseInt(threads) || 1,
            startup_delay: parseInt(startup_delay) || 0,
            start_node_id,
            ws_endpoint,
        });

        res.json({
            success: true,
            executionId,
            message: `Da khoi chay quy trinh "${workflow.name}" thanh cong!`
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// List all executions (active + recent)
router.get('/executions/all', (req, res) => {
    const list = [];
    for (const [id, exec] of WorkflowEngine.activeExecutions.entries()) {
        list.push({
            executionId: id,
            workflowName: exec.workflowName || exec.workflow?.name || '—',
            workflowId: exec.workflowId || exec.workflow?._id,
            status: exec.status,
            started_at: exec.started_at,
            ended_at: exec.ended_at,
            options: exec.options,
            logCount: exec.logs?.length || 0,
        });
    }
    // Mới nhất lên đầu
    list.sort((a, b) => new Date(b.started_at) - new Date(a.started_at));
    res.json({ success: true, data: list });
});

// Stop workflow execution
router.post('/execution/:id/stop', (req, res) => {
    const success = WorkflowEngine.stop(req.params.id);
    if (!success) return res.status(404).json({ success: false, error: 'Không tìm thấy tiến trình đang chạy hoặc tiến trình đã kết thúc.' });

    res.json({
        success: true,
        message: 'Đã gửi yêu cầu dừng quy trình.'
    });
});

// Get execution status/logs — phan trang de tranh response khong lo
router.get('/execution/:id/logs', (req, res) => {
    const execution = WorkflowEngine.activeExecutions.get(req.params.id);
    if (!execution) return res.status(404).json({ success: false, error: 'Execution not found' });

    // Phan trang: ?page=1&limit=200&threadId=xxx
    const limit = Math.min(parseInt(req.query.limit) || 200, 500);
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const threadFilter = req.query.threadId || null;

    let allLogs = execution.logs;
    if (threadFilter) {
        allLogs = allLogs.filter(l => l.threadId === threadFilter);
    }

    const total = allLogs.length;
    const offset = (page - 1) * limit;
    const logs = allLogs.slice(offset, offset + limit);

    // Thread metadata chỉ (không có logs[])
    const threads = {};
    for (const [tid, t] of Object.entries(execution.threads || {})) {
        threads[tid] = {
            user: t.user,
            index: t.index,
            total: t.total,
            status: t.status,
            started_at: t.started_at,
            ended_at: t.ended_at,
            error: t.error,
        };
    }

    res.json({
        success: true,
        status: execution.status,
        logs,
        total,
        page,
        limit,
        hasMore: offset + limit < total,
        threads,
        started_at: execution.started_at,
        ended_at: execution.ended_at,
    });
});

// Get logs of a specific thread (lazy load khi user click ThreadCard)
router.get('/execution/:id/thread-logs/:threadId', (req, res) => {
    const execution = WorkflowEngine.activeExecutions.get(req.params.id);
    if (!execution) return res.status(404).json({ success: false, error: 'Execution not found' });

    const threadId = req.params.threadId;
    const limit = Math.min(parseInt(req.query.limit) || 200, 500);
    const page = Math.max(parseInt(req.query.page) || 1, 1);

    // Loc trong global logs array theo threadId
    const threadLogs = execution.logs.filter(l => l.threadId === threadId);
    const total = threadLogs.length;
    const offset = (page - 1) * limit;

    res.json({
        success: true,
        threadId,
        logs: threadLogs.slice(offset, offset + limit),
        total,
        page,
        hasMore: offset + limit < total,
    });
});

export default router;
