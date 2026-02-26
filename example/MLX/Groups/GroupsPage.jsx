import { useState, useEffect } from 'react';
import * as Antd from 'antd';
const { Table, Button, Modal, Form, Input, message, Card, Typography, Space, Tooltip } = Antd;
import { ReloadOutlined, PlusOutlined, EditOutlined, DeleteOutlined, FolderOutlined, ClearOutlined } from '@ant-design/icons';
import { mlxAPI } from '../../../api';

const { Title, Text } = Typography;

export function GroupsPage() {
    const [folders, setFolders] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingFolder, setEditingFolder] = useState(null);
    const [form] = Form.useForm();

    const fetchFolders = async () => {
        try {
            setLoading(true);
            const res = await mlxAPI.getFolders();
            if (res.data.success) {
                setFolders(res.data.data);
            }
        } catch (error) {
            message.error('Failed to fetch folders');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchFolders();
    }, []);

    const handleEdit = (record) => {
        setEditingFolder(record);
        form.setFieldsValue({
            name: record.name,
            comment: record.comment || ''
        });
        setIsModalOpen(true);
    };

    const handleDelete = async (id) => {
        try {
            const res = await mlxAPI.removeFolder({ ids: [id] });
            if (res.data.success) {
                message.success('Folder removed');
                fetchFolders();
            }
        } catch (error) {
            message.error('Failed to remove folder');
        }
    };

    const handleClearProfiles = async (record) => {
        try {
            const res = await mlxAPI.cleanupFolder({
                folder_id: record.folder_id,
                name: record.name
            });
            if (res.data.success) {
                message.success('Cleanup task created. Monitor progress in Task History.');
            }
        } catch (error) {
            message.error('Failed to create cleanup task');
        }
    };

    const handleOk = async () => {
        try {
            const values = await form.validateFields();
            if (editingFolder) {
                const res = await mlxAPI.updateFolder({
                    folder_id: editingFolder.folder_id,
                    name: values.name,
                    comment: values.comment
                });
                if (res.data.success) {
                    message.success('Folder updated');
                    setIsModalOpen(false);
                    setEditingFolder(null);
                    fetchFolders();
                }
            }
        } catch (error) {
            message.error('Failed to save folder');
        }
    };

    const columns = [
        {
            title: 'Name',
            dataIndex: 'name',
            key: 'name',
            render: (text) => <Text strong><FolderOutlined className="text-blue-500 !mr-2" />{text}</Text>
        },
        {
            title: 'Comments',
            dataIndex: 'comment',
            key: 'comment',
        },
        {
            title: 'Profile Count',
            dataIndex: 'profiles_count',
            key: 'profiles_count',
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (_, record) => (
                <Space>
                    <Tooltip title="Edit Folder">
                        <Button icon={<EditOutlined />} onClick={() => handleEdit(record)} />
                    </Tooltip>
                    <Antd.Popconfirm
                        title="DANGEROUS ACTION"
                        description={`Delete ALL profiles in group "${record.name}"? This cannot be undone.`}
                        onConfirm={() => handleClearProfiles(record)}
                        okText="Yes, Clear All"
                        cancelText="No"
                        okButtonProps={{ danger: true }}
                    >
                        <Tooltip title="Clear All Profiles in Group">
                            <Button icon={<ClearOutlined />} danger />
                        </Tooltip>
                    </Antd.Popconfirm>
                    <Antd.Popconfirm title="Delete this folder?" onConfirm={() => handleDelete(record.folder_id)}>
                        <Tooltip title="Delete Folder">
                            <Button icon={<DeleteOutlined />} danger />
                        </Tooltip>
                    </Antd.Popconfirm>
                </Space>
            )
        }
    ];

    return (
        <div className="max-w-7xl mx-auto !p-6">
            <div className="!mb-8 flex justify-between items-center">
                <div>
                    <Title level={2} className="m-0 flex items-center gap-3">
                        <FolderOutlined className="text-blue-600" />
                        MLX Groups
                    </Title>
                    <Text type="secondary">Manage your MLX profile folders</Text>
                </div>
                <Space>
                    <Tooltip title="Refresh Groups">
                        <Button icon={<ReloadOutlined />} onClick={fetchFolders} loading={loading}>Refresh</Button>
                    </Tooltip>
                    {/* No Create Button since no API provided yet */}
                </Space>
            </div>

            <Card className="shadow-sm" variant="borderless">
                <Table
                    dataSource={folders}
                    columns={columns}
                    rowKey="folder_id"
                    loading={loading}
                    pagination={{ pageSize: 10 }}
                />
            </Card>

            <Modal
                title="Edit Folder"
                open={isModalOpen}
                onOk={handleOk}
                onCancel={() => { setIsModalOpen(false); setEditingFolder(null); }}
            >
                <Form form={form} layout="vertical">
                    <Form.Item name="name" label="Name" rules={[{ required: true }]}>
                        <Input />
                    </Form.Item>
                    <Form.Item name="comment" label="Comment">
                        <Input.TextArea />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    );
}
