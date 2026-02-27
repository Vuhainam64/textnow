import React, { useState, useCallback, useEffect } from 'react';
import { WorkflowsService } from '../../services/apiService';
import WorkflowList from './components/WorkflowList';
import WorkflowEditor from './components/WorkflowEditor';

export default function WorkflowBuilder() {
    const [view, setView] = useState('list'); // 'list' | 'editor'
    const [workflows, setWorkflows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentWorkflow, setCurrentWorkflow] = useState(null);

    const loadWorkflows = useCallback(async () => {
        setLoading(true);
        try {
            const res = await WorkflowsService.getAll();
            setWorkflows(res.data || []);
        } catch (e) {
            console.error('Lỗi tải danh sách quy trình', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadWorkflows();
    }, [loadWorkflows]);

    const handleEdit = (workflow) => {
        setCurrentWorkflow(workflow);
        setView('editor');
    };

    const handleCreate = (newWorkflow) => {
        setCurrentWorkflow(newWorkflow);
        setView('editor');
        loadWorkflows();
    };

    if (view === 'editor' && currentWorkflow) {
        return (
            <WorkflowEditor
                workflow={currentWorkflow}
                onBack={() => {
                    setView('list');
                    setCurrentWorkflow(null);
                    loadWorkflows();
                }}
                onUpdate={loadWorkflows}
            />
        );
    }

    return (
        <WorkflowList
            workflows={workflows}
            loading={loading}
            onEdit={handleEdit}
            onCreate={handleCreate}
            onDeleteSuccess={loadWorkflows}
            onUpdateSuccess={loadWorkflows}
        />
    );
}
