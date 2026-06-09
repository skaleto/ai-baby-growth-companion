import { useState } from "react";
import { Form, Input, Button, Typography, App } from "antd";
import { login, setToken } from "../api";

export default function Login({ onSuccess }) {
  const [loading, setLoading] = useState(false);
  const { message } = App.useApp();

  const onFinish = async (v) => {
    setLoading(true);
    try {
      const token = await login(v.phone, v.password);
      setToken(token);
      onSuccess();
    } catch (e) {
      message.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={wrap}>
      <div style={card}>
        <div style={logo}>小宝</div>
        <Typography.Title level={4} style={{ textAlign: "center", marginBottom: 2 }}>小宝记 管理后台</Typography.Title>
        <Typography.Paragraph style={{ textAlign: "center", color: "#8a9893", marginBottom: 22 }}>内测运营控制台</Typography.Paragraph>
        <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
          <Form.Item label="管理员手机号" name="phone" rules={[{ required: true, message: "请输入手机号" }]}>
            <Input size="large" inputMode="numeric" autoComplete="username" placeholder="手机号" />
          </Form.Item>
          <Form.Item label="密码" name="password" rules={[{ required: true, message: "请输入密码" }]}>
            <Input.Password size="large" autoComplete="current-password" placeholder="密码" />
          </Form.Item>
          <Button type="primary" htmlType="submit" size="large" block loading={loading}>登 录</Button>
        </Form>
      </div>
      <p style={{ color: "#9aa7a2", fontSize: 12, marginTop: 16 }}>© 小宝记 · 仅限授权管理员访问</p>
    </div>
  );
}

const wrap = {
  minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
  background: "radial-gradient(1000px 500px at 50% -10%, #e7f3ec, #eef1f4 55%)",
};
const card = { width: 360, maxWidth: "calc(100vw - 32px)", padding: "34px 30px", background: "#fff", borderRadius: 16, boxShadow: "0 10px 34px rgba(31,42,40,.1)" };
const logo = { width: 54, height: 54, borderRadius: 15, margin: "0 auto 12px", display: "grid", placeItems: "center", background: "linear-gradient(135deg,#2f7957,#5bb389)", color: "#fff", fontWeight: 800 };
