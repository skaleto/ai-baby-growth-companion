import { useEffect, useState } from "react";
import { Row, Col, Card, Statistic, App, Spin } from "antd";
import { TeamOutlined, CrownOutlined, InboxOutlined, ThunderboltOutlined } from "@ant-design/icons";
import { api } from "../api";

export default function Overview() {
  const [d, setD] = useState(null);
  const { message } = App.useApp();

  useEffect(() => { api("/overview").then(setD).catch((e) => message.error(e.message)); }, [message]);

  const cards = [
    { t: "家庭总数", v: d?.families, icon: <TeamOutlined />, color: "#2f7957", bg: "rgba(47,121,87,.1)" },
    { t: "Pro 家庭", v: d?.proFamilies, icon: <CrownOutlined />, color: "#9a6533", bg: "rgba(154,101,51,.1)" },
    { t: "待处理申请", v: d?.pendingApplications, icon: <InboxOutlined />, color: "#3f6f97", bg: "rgba(63,111,151,.1)" },
    { t: "近 30 天 Token", v: d?.monthlyTokensTotal, icon: <ThunderboltOutlined />, color: "#5a6864", bg: "#eef1f0" },
  ];

  if (!d) return <Spin style={{ display: "block", marginTop: 80 }} />;

  return (
    <Row gutter={[16, 16]}>
      {cards.map((c) => (
        <Col xs={12} lg={6} key={c.t}>
          <Card styles={{ body: { display: "flex", gap: 14, alignItems: "center" } }}>
            <div style={{ width: 46, height: 46, borderRadius: 12, display: "grid", placeItems: "center", background: c.bg, color: c.color, fontSize: 22 }}>{c.icon}</div>
            <Statistic title={c.t} value={c.v ?? 0} valueStyle={{ fontWeight: 700 }} />
          </Card>
        </Col>
      ))}
    </Row>
  );
}
