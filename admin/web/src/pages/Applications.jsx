import { useEffect, useState } from "react";
import { Card, Table, Button, Popconfirm, Space, App } from "antd";
import { api } from "../api";

export default function Applications() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const { message } = App.useApp();

  const load = () => {
    setLoading(true);
    api("/applications").then((d) => setRows(d.items)).catch((e) => message.error(e.message)).finally(() => setLoading(false));
  };
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (familyId, kind) => {
    try {
      await api(`/applications/${familyId}/${kind}`, { method: "POST" });
      message.success(kind === "approve" ? "已开通 Pro（90 天）" : "已驳回");
      load();
    } catch (e) { message.error(e.message); }
  };

  const columns = [
    { title: "手机号", dataIndex: "phone", render: (v) => v || "—" },
    { title: "来源", dataIndex: "source", render: (v) => v || "—" },
    { title: "申请时间", dataIndex: "created_at", render: (v) => (v ? v.slice(0, 16).replace("T", " ") : "—") },
    {
      title: "操作", key: "op", align: "right", width: 180,
      render: (_, r) => (
        <Space>
          <Popconfirm title="给该家庭开通 Pro 90 天？" okText="批准" onConfirm={() => act(r.family_id, "approve")}>
            <Button type="primary" size="small">批准</Button>
          </Popconfirm>
          <Popconfirm title="驳回该申请？" okText="驳回" okButtonProps={{ danger: true }} onConfirm={() => act(r.family_id, "reject")}>
            <Button size="small" danger>驳回</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card title="待处理内测申请">
      <Table rowKey="id" loading={loading} columns={columns} dataSource={rows}
        pagination={{ pageSize: 10, hideOnSinglePage: true }} locale={{ emptyText: "没有待处理的申请" }} />
    </Card>
  );
}
