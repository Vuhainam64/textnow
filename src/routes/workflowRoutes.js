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

        const executionId = await WorkflowEngine.execute(workflow, { testMode: true });

        res.json({
            success: true,
            executionId,
            message: `Đã khởi chạy quy trình "${workflow.name}" thành công!`
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get execution status/logs
router.get('/execution/:id/logs', (req, res) => {
    const execution = WorkflowEngine.activeExecutions.get(req.params.id);
    if (!execution) return res.status(404).json({ success: false, error: 'Execution not found' });

    res.json({
        success: true,
        status: execution.status,
        logs: execution.logs
    });
});

export default router;
