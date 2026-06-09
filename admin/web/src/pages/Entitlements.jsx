import { useState } from "react";
import { Card, Table, Button, Input, Tag, Space, Popconfirm, App } from "antd";
import { api } from "../api";

export default function Entitlements() {
  const [rows, setRows] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastPhone, setLastPhone] = useState("");
  const { message } = App.useApp();

  const search = async (phone) => {
    const p = (phone || "").trim();
    if (!p) return;
    setLastPhone(p);
    setLoading(true);
    try { const d = await api(`/entitlements/family?phone=${encodeURIComponent(p)}`); setRows(d.items); }
    catch (e) { message.error(e.message); }
    finally { setLoading(false); }
  };

  const grant = async (familyId) => {
    try { await api("/entitlements", { method: "POST", body: JSON.stringify({ familyId, days: 90 }) }); message.success("已开通 / 续期 90 天"); search(lastPhone); }
    catch (e) { message.error(e.message); }
  };
  const revoke = async (familyId) => {
    try { await api(`/entitlements/${familyId}/revoke`, { method: "POST" }); message.success("已撤销 Pro"); search(lastPhone); }
    catch (e) { message.error(e.message); }
  };

  const columns = [
    { title: "家庭 ID", dataIndex: "family_id", render: (v) => <span style={{ fontFamily: "monospace", fontSize: 12 }}>{v}</span> },
    { title: "角色", dataIndex: "role_name", render: (v) => v || "—" },
    {
      title: "状态", key: "st",
      render: (_, r) => {
        const pro = r.entitlement?.enabled === "true";
        return pro
          ? <Tag color="green">Pro · 至 {r.entitlement.expires_at ? r.entitlement.expires_at.slice(0, 10) : "永久"}</Tag>
          : <Tag>Free</Tag>;
      },
    },
    { title: "本月 AI 次数", dataIndex: "usedThisMonth" },
    {
      title: "操作", key: "op", align: "right", width: 200,
      render: (_, r) => {
        const pro = r.entitlement?.enabled === "true";
        return (
          <Space>
            <Button size="small" type="primary" onClick={() => grant(r.family_id)}>{pro ? "续 90 天" : "开通 90 天"}</Button>
            {pro && (
              <Popconfirm title="撤销该家庭 Pro 权益？" okText="撤销" okButtonProps={{ danger: true }} onConfirm={() => revoke(r.family_id)}>
                <Button size="small" danger>撤销</Button>
              </Popconfirm>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <Card title="Pro 权益管理">
      <Input.Search placeholder="输入用户手机号查询其家庭" enterButton="查询" allowClear
        style={{ maxWidth: 380 }} loading={loading} onSearch={search} />
      {rows !== null && (
        <Table style={{ marginTop: 16 }} rowKey="family_id" loading={loading} columns={columns} dataSource={rows}
          pagination={false} locale={{ emptyText: "没找到这个手机号对应的家庭" }} />
      )}
    </Card>
  );
}
