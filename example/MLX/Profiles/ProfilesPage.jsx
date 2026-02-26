import { useState, useEffect, useCallback } from 'react';
import * as Antd from 'antd';
const { Table, Button, Input, message, Card, Typography, Space, Tag, Tooltip } = Antd;
import {
    ReloadOutlined,
    DeleteOutlined,
    SearchOutlined,
    UserOutlined,
    GlobalOutlined,
    CalendarOutlined,
    CloseOutlined
} from '@ant-design/icons';
import { mlxAPI } from '../../../api';

const { Title, Text } = Typography;

export function ProfilesPage() {
    const [profiles, setProfiles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [total, setTotal] = useState(0);
    const [searchText, setSearchText] = useState('');
    const [pagination, setPagination] = useState({ current: 1, pageSize: 15 });
    const [selectedRowKeys, setSelectedRowKeys] = useState([]);

    const fetchProfiles = useCallback(async () => {
        try {
            setLoading(true);
            const offset = (pagination.current - 1) * pagination.pageSize;
            const res = await mlxAPI.searchProfiles({
                offset,
                limit: pagination.pageSize,
                search_text: searchText,
                storage_type: "all",
                is_removed: false,
                order_by: "created_at",
                sort: "desc"
            });

            if (res.data.success) {
                setProfiles(res.data.data.profiles || []);
                setTotal(res.data.data.total_count || 0);
            }
        } catch (error) {
            message.error('Failed to fetch profiles');
        } finally {
            setLoading(false);
        }
    }, [pagination.current, pagination.pageSize, searchText]);

    useEffect(() => {
        fetchProfiles();
    }, [fetchProfiles]);

    const handleSearch = (value) => {
        setSearchText(value);
        setPagination({ ...pagination, current: 1 });
    };

    const handleDelete = async (ids) => {
        try {
            const res = await mlxAPI.removeProfiles({ ids });
            if (res.data.success) {
                message.success(`${ids.length} profile(s) removed`);
                setSelectedRowKeys([]);
                fetchProfiles();
            }
        } catch (error) {
            message.error('Failed to remove profiles');
        }
    };

    const columns = [
        {
            title: 'Profile Name',
            dataIndex: 'name',
            key: 'name',
            render: (text) => (
                <Space>
                    <UserOutlined className="text-blue-500" />
                    <Text strong>{text}</Text>
                </Space>
            )
        },
        {
            title: 'Browser',
            dataIndex: 'browser_type',
            key: 'browser_type',
            render: (type) => <Tag color="orange">{type?.toUpperCase()}</Tag>
        },
        {
            title: 'OS',
            dataIndex: 'os_type',
            key: 'os_type',
            render: (os) => <Tag color="blue">{os === 'windows' ? 'Windows' : os}</Tag>
        },
        {
            title: 'Created',
            dataIndex: 'created_at',
            key: 'created_at',
            render: (date) => (
                <Tooltip title={new Date(date).toLocaleString()}>
                    <Space>
                        <CalendarOutlined className="text-gray-400" />
                        <Text type="secondary">{new Date(date).toLocaleDateString()}</Text>
                    </Space>
                </Tooltip>
            )
        },
        {
            title: 'Actions',
            key: 'actions',
            render: (_, record) => (
                <Antd.Popconfirm
                    title="Delete profile?"
                    description="This action cannot be undone."
                    onConfirm={() => handleDelete([record.id])}
                    okText="Yes"
                    cancelText="No"
                    okButtonProps={{ danger: true }}
                >
                    <Tooltip title="Delete Profile">
                        <Button type="text" icon={<DeleteOutlined />} danger />
                    </Tooltip>
                </Antd.Popconfirm>
            )
        }
    ];

    const rowSelection = {
        selectedRowKeys,
        onChange: (keys) => setSelectedRowKeys(keys),
    };

    return (
        <div className="max-w-7xl mx-auto !p-6">
            <div className="!mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <Title level={2} className="m-0 flex items-center gap-3">
                        <GlobalOutlined className="text-blue-600" />
                        MLX Profiles
                    </Title>
                    <Text type="secondary">Manage your MLX browser profiles with ease</Text>
                </div>

                <Space wrap>
                    <Input
                        placeholder="Search profiles..."
                        prefix={<SearchOutlined />}
                        allowClear
                        onPressEnter={(e) => handleSearch(e.target.value)}
                        style={{ width: 250 }}
                        onChange={(e) => !e.target.value && handleSearch('')}
                    />
                    <Tooltip title="Refresh Profile List">
                        <Button
                            icon={<ReloadOutlined />}
                            onClick={fetchProfiles}
                            loading={loading}
                        >
                            Refresh
                        </Button>
                    </Tooltip>
                    {selectedRowKeys.length > 0 && (
                        <Antd.Popconfirm
                            title={`Clear selected ${selectedRowKeys.length} profiles?`}
                            description="This is a permanent destructive action."
                            onConfirm={() => handleDelete(selectedRowKeys)}
                            okText="Delete All Selected"
                            cancelText="No"
                            okButtonProps={{ danger: true }}
                        >
                            <Tooltip title={`Delete ${selectedRowKeys.length} selected profiles`}>
                                <Button type="primary" danger icon={<CloseOutlined />}>
                                    Bulk Delete ({selectedRowKeys.length})
                                </Button>
                            </Tooltip>
                        </Antd.Popconfirm>
                    )}
                </Space>
            </div>

            <Card className="shadow-sm" variant="borderless">
                <Table
                    rowSelection={rowSelection}
                    dataSource={profiles}
                    columns={columns}
                    rowKey="id"
                    loading={loading}
                    pagination={{
                        ...pagination,
                        total,
                        showSizeChanger: true,
                        pageSizeOptions: ['15', '30', '50', '100'],
                        showTotal: (total) => `Total ${total} profiles`
                    }}
                    onChange={(pag) => setPagination(pag)}
                />
            </Card>
        </div>
    );
}
