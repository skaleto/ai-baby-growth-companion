import { useEffect, useState } from "react";
import { Card, Table, Button, InputNumber, Space, Popconfirm, Alert, Typography, Form, App } from "antd";
import { api } from "../api";

export default function RedeemCodes() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generated, setGenerated] = useState([]);
  const [form] = Form.useForm();
  const { message } = App.useApp();

  const load = () => {
    setLoading(true);
    api("/redeem-codes").then((d) => setRows(d.items)).catch((e) => message.error(e.message)).finally(() => setLoading(false));
  };
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const gen = async () => {
    const v = await form.validateFields();
    try {
      const r = await api("/redeem-codes", { method: "POST", body: JSON.stringify(v) });
      setGenerated(r.codes);
      message.success(`已生成 ${r.codes.length} 个兑换码`);
      load();
    } catch (e) { message.error(e.message); }
  };

  const disable = async (code) => {
    try { await api(`/redeem-codes/${encodeURIComponent(code)}/disable`, { method: "POST" }); message.success("已停用"); load(); }
    catch (e) { message.error(e.message); }
  };

  const columns = [
    { title: "兑换码", dataIndex: "code", render: (v) => <Typography.Text copyable code>{v}</Typography.Text> },
    { title: "用量", key: "u", render: (_, r) => `${r.used_count}/${r.max_uses}` },
    { title: "过期", dataIndex: "expires_at", render: (v) => (v ? v.slice(0, 10) : "永久") },
    {
      title: "操作", key: "op", align: "right", width: 120,
      render: (_, r) => (
        <Popconfirm title="停用该码（立即失效）？" okText="停用" okButtonProps={{ danger: true }} onConfirm={() => disable(r.code)}>
          <Button size="small" danger>停用</Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <Space direction="vertical" size={16} style={{ display: "flex" }}>
      <Card title="生成兑换码">
        <Form form={form} layout="inline" initialValues={{ count: 20, maxUses: 1, expiresDays: 30 }}>
          <Form.Item label="数量" name="count" rules={[{ required: true }]}><InputNumber min={1} max={200} /></Form.Item>
          <Form.Item label="每码可用次数" name="maxUses" rules={[{ required: true }]}><InputNumber min={1} /></Form.Item>
          <Form.Item label="过期天数（0=永久）" name="expiresDays" rules={[{ required: true }]}><InputNumber min={0} /></Form.Item>
          <Form.Item><Button type="primary" onClick={gen}>生成</Button></Form.Item>
        </Form>
        {generated.length > 0 && (
          <Alert style={{ marginTop: 14 }} type="success" showIcon
            message={`新生成 ${generated.length} 个，可逐个复制或一键复制全部分发`}
            description={<div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>{generated.map((c) => <Typography.Text key={c} code copyable>{c}</Typography.Text>)}</div>}
            action={<Button size="small" onClick={() => { navigator.clipboard?.writeText(generated.join("\n")); message.success("已复制全部"); }}>复制全部</Button>}
          />
        )}
      </Card>
      <Card title="兑换码列表">
        <Table rowKey="code" loading={loading} columns={columns} dataSource={rows} pagination={{ pageSize: 10, hideOnSinglePage: true }} />
      </Card>
    </Space>
  );
}
