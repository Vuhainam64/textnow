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
            limit,          // số acc muốn chạy, undefined/'' = tất cả
            threads = 1,
            startup_delay = 0,
        } = req.body;

        const executionId = await WorkflowEngine.execute(workflow, {
            account_group_id,
            proxy_group_id,
            target_statuses,
            new_password,
            limit: limit ? parseInt(limit) : null,
            threads: parseInt(threads) || 1,
            startup_delay: parseInt(startup_delay) || 0,
        });

        res.json({
            success: true,
            executionId,
            message: `Đã khởi chạy quy trình "${workflow.name}" thành công!`
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
            workflowName: exec.workflow?.name || '—',
            workflowId: exec.workflow?._id,
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

// Get execution status/logs
router.get('/execution/:id/logs', (req, res) => {
    const execution = WorkflowEngine.activeExecutions.get(req.params.id);
    if (!execution) return res.status(404).json({ success: false, error: 'Execution not found' });

    res.json({
        success: true,
        status: execution.status,
        logs: execution.logs,
        threads: execution.threads || {},
        started_at: execution.started_at,
        ended_at: execution.ended_at,
    });
});

export default router;
