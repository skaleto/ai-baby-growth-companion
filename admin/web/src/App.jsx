import { useEffect, useState } from "react";
import { Layout, Menu, Button, Typography, Space } from "antd";
import {
  AppstoreOutlined, InboxOutlined, TagsOutlined, SafetyCertificateOutlined,
  ReloadOutlined, LogoutOutlined,
} from "@ant-design/icons";
import { getToken, setToken, adminPhone } from "./api";
import Login from "./pages/Login.jsx";
import Overview from "./pages/Overview.jsx";
import Applications from "./pages/Applications.jsx";
import RedeemCodes from "./pages/RedeemCodes.jsx";
import Entitlements from "./pages/Entitlements.jsx";

const { Sider, Header, Content } = Layout;

const PAGES = {
  overview: { title: "概览", icon: <AppstoreOutlined />, label: "概览", Comp: Overview },
  applications: { title: "内测申请", icon: <InboxOutlined />, label: "内测申请", Comp: Applications },
  codes: { title: "兑换码", icon: <TagsOutlined />, label: "兑换码", Comp: RedeemCodes },
  entitlements: { title: "Pro 权益", icon: <SafetyCertificateOutlined />, label: "Pro 权益", Comp: Entitlements },
};

export default function App() {
  const [authed, setAuthed] = useState(!!getToken());
  const [tab, setTab] = useState("overview");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const onUnauth = () => setAuthed(false);
    window.addEventListener("admin-unauth", onUnauth);
    return () => window.removeEventListener("admin-unauth", onUnauth);
  }, []);

  if (!authed) return <Login onSuccess={() => { setAuthed(true); setTab("overview"); }} />;

  const Page = PAGES[tab].Comp;
  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider theme="light" width={232} breakpoint="lg" collapsedWidth={64}
        style={{ borderRight: "1px solid #eef1ef", position: "sticky", top: 0, height: "100vh" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "18px 18px 14px" }}>
          <div style={brandLogo}>小宝</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, lineHeight: 1.1 }}>小宝记</div>
            <div style={{ color: "#8a9893", fontSize: 12 }}>管理后台</div>
          </div>
        </div>
        <Menu mode="inline" selectedKeys={[tab]} onClick={(e) => setTab(e.key)}
          style={{ borderInlineEnd: "none" }}
          items={Object.entries(PAGES).map(([k, v]) => ({ key: k, icon: v.icon, label: v.label }))} />
      </Sider>
      <Layout>
        <Header style={{ background: "#fff", borderBottom: "1px solid #eef1ef", padding: "0 24px",
          display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 9 }}>
          <Typography.Title level={4} style={{ margin: 0 }}>{PAGES[tab].title}</Typography.Title>
          <Space>
            <span style={{ color: "#8a9893" }}>{adminPhone()}</span>
            <Button icon={<ReloadOutlined />} onClick={() => setReloadKey((k) => k + 1)}>刷新</Button>
            <Button icon={<LogoutOutlined />} danger onClick={() => { setToken(""); setAuthed(false); }}>退出</Button>
          </Space>
        </Header>
        <Content style={{ padding: 24 }}>
          <Page key={reloadKey} />
        </Content>
      </Layout>
    </Layout>
  );
}

const brandLogo = {
  width: 38, height: 38, borderRadius: 11, display: "grid", placeItems: "center",
  background: "linear-gradient(135deg,#2f7957,#5bb389)", color: "#fff", fontWeight: 800, fontSize: 13,
};
