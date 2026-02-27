/**
 * dashboardRoutes.js - API tổng hợp cho Dashboard
 * Endpoint duy nhất: GET /api/dashboard/stats
 * Trả về stats account, proxy, workflow và executions gần đây
 */
import express from 'express';
import Account from '../models/Account.js';
import Proxy from '../models/Proxy.js';
import Workflow from '../models/Workflow.js';
import WorkflowEngine from '../services/workflowEngine.js';

const router = express.Router();

router.get('/stats', async (req, res) => {
    try {
        const [accStats, prxStats, workflowCount] = await Promise.all([
            Account.aggregate([
                { $group: { _id: '$status', count: { $sum: 1 } } }
            ]),
            Proxy.aggregate([
                { $group: { _id: '$status', count: { $sum: 1 } } }
            ]),
            Workflow.countDocuments(),
        ]);

        // Flatten stats thành object dễ dùng
        const acc = {};
        let accTotal = 0;
        for (const s of accStats) { acc[s._id] = s.count; accTotal += s.count; }

        const prx = {};
        let prxTotal = 0;
        for (const s of prxStats) { prx[s._id] = s.count; prxTotal += s.count; }

        // Executions: in-memory từ WorkflowEngine
        const executions = [];
        for (const [id, exec] of WorkflowEngine.activeExecutions.entries()) {
            executions.push({
                executionId: id,
                workflowName: exec.workflow?.name || '—',
                status: exec.status,
                started_at: exec.started_at,
                ended_at: exec.ended_at,
                threadCount: Object.keys(exec.threads || {}).length,
                options: {
                    threads: exec.options?.threads || 1,
                    target_statuses: exec.options?.target_statuses || [],
                },
            });
        }
        executions.sort((a, b) => new Date(b.started_at) - new Date(a.started_at));

        res.json({
            success: true,
            data: {
                accounts: { total: accTotal, ...acc },
                proxies: { total: prxTotal, ...prx },
                workflows: { total: workflowCount },
                executions: executions.slice(0, 10),   // 10 gần nhất
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

export default router;
