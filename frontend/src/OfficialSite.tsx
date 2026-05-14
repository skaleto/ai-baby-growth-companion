import {
  Apple,
  ArrowRight,
  Bell,
  Bot,
  Camera,
  ChartSpline,
  CheckCircle2,
  Download,
  HeartPulse,
  MessageCircle,
  QrCode,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import type { ComponentType, CSSProperties } from "react";
import heroCompanion from "./assets/landing/hero-companion.png";
import splashMark from "./assets/splash/splash-mark.png";
import "./official-site.css";

type LandingIcon = ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;

const iosDownloadUrl = import.meta.env.VITE_IOS_DOWNLOAD_URL || "#ios-download";
const androidDownloadUrl = import.meta.env.VITE_ANDROID_DOWNLOAD_URL || "#android-download";

const signalItems = [
  { value: "7x24", label: "夜间陪伴" },
  { value: "12+", label: "高频记录" },
  { value: "AI", label: "上下文理解" },
];

const featureTiles: Array<{ icon: LandingIcon; title: string; text: string }> = [
  {
    icon: MessageCircle,
    title: "会聊天，也会记录",
    text: "喂奶、睡眠、便便、体温、辅食都能自然语言写入，AI 自动整理重点。",
  },
  {
    icon: ChartSpline,
    title: "成长曲线更直观",
    text: "身高、体重、头围和月龄趋势放在同一个家庭档案里，少翻表格。",
  },
  {
    icon: Users,
    title: "全家同步一份档案",
    text: "爸妈、老人、月嫂共享宝宝状态，减少反复传话和重复记录。",
  },
  {
    icon: ReceiptText,
    title: "育儿账本不再散落",
    text: "奶粉、纸尿裤、医疗、早教支出按月沉淀，家庭成本一眼看清。",
  },
  {
    icon: Bell,
    title: "提醒真正响起来",
    text: "疫苗、喂药、洗澡、复诊都能设提醒，移动端可走本地闹钟能力。",
  },
  {
    icon: Camera,
    title: "照片变成成长相册",
    text: "日常照片、语音、里程碑自动归档，保留那些容易被忙乱冲散的瞬间。",
  },
];

const timeline = [
  "自然输入：晚上 8 点喝奶 120ml，夜醒 2 次",
  "AI 拆解为照护事件、提醒和可确认记录",
  "家庭档案同步，后续回答带上宝宝近况",
];

const downloadItems: Array<{ icon: LandingIcon; platform: string; note: string; href: string; tone: string }> = [
  {
    icon: Apple,
    platform: "iOS",
    note: "预留 App Store / TestFlight 二维码链接",
    href: iosDownloadUrl,
    tone: "ios",
  },
  {
    icon: Download,
    platform: "Android",
    note: "预留 APK / 应用市场二维码链接",
    href: androidDownloadUrl,
    tone: "android",
  },
];

function OfficialSite() {
  return (
    <main className="official-site">
      <section className="official-hero" aria-label="小宝成长伙伴官网首页">
        <img className="official-hero-image" src={heroCompanion} alt="" />
        <div className="official-hero-scrim" />

        <nav className="official-nav" aria-label="官网导航">
          <a className="official-brand" href="#top" aria-label="小宝成长伙伴">
            <img src={splashMark} alt="" />
            <span>小宝成长伙伴</span>
          </a>
          <div className="official-nav-links">
            <a href="#features">特色</a>
            <a href="#flow">记录流</a>
            <a href="#download">下载</a>
          </div>
        </nav>

        <div className="official-hero-content" id="top">
          <p className="official-kicker">
            <Sparkles size={16} />
            给新手家庭的 AI 育儿记录台
          </p>
          <h1>小宝成长伙伴</h1>
          <p className="official-lead">
            把聊天、照护记录、成长曲线、家庭协作和账本放进同一个清爽空间。深夜不慌，白天少漏，全家都知道小宝今天发生了什么。
          </p>
          <div className="official-actions">
            <a className="official-primary-action" href="#download">
              预留下载入口
              <ArrowRight size={18} />
            </a>
            <a className="official-secondary-action" href="/">
              进入 Web App
            </a>
          </div>
        </div>

        <div className="official-signal-strip" aria-label="产品亮点">
          {signalItems.map((item) => (
            <div className="official-signal" key={item.label}>
              <strong>{item.value}</strong>
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="official-section official-positioning" id="features">
        <div className="official-section-head">
          <p>为什么不只是一个记录本</p>
          <h2>它会把碎片变成家庭可用的信息</h2>
        </div>
        <div className="official-feature-grid">
          {featureTiles.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <article
                className="official-feature-card"
                style={{ "--delay": `${index * 70}ms` } as CSSProperties}
                key={feature.title}
              >
                <Icon size={24} strokeWidth={1.9} />
                <h3>{feature.title}</h3>
                <p>{feature.text}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="official-section official-flow" id="flow">
        <div className="official-section-head">
          <p>从一句话到一份档案</p>
          <h2>AI 负责整理，家人负责陪伴</h2>
        </div>
        <div className="official-flow-stage">
          <div className="official-phone-shell" aria-label="App 记录预览">
            <div className="official-phone-top" />
            <div className="official-chat-bubble parent">今天小宝喝奶 120ml，晚上醒了两次。</div>
            <div className="official-chat-bubble ai">已整理为喂养、睡眠和夜醒记录。</div>
            <div className="official-mini-dashboard">
              <span>今日奶量</span>
              <strong>120 ml</strong>
              <i />
            </div>
            <div className="official-mini-dashboard">
              <span>夜醒</span>
              <strong>2 次</strong>
              <i />
            </div>
          </div>

          <div className="official-flow-copy">
            {timeline.map((item, index) => (
              <div className="official-flow-line" key={item}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <p>{item}</p>
              </div>
            ))}
            <div className="official-privacy-note">
              <ShieldCheck size={20} />
              <p>默认不发送完整手机号；上下文聚焦家庭角色、宝宝档案和近几天记录。</p>
            </div>
          </div>
        </div>
      </section>

      <section className="official-section official-intelligence">
        <div className="official-intelligence-copy">
          <p className="official-kicker compact">
            <Bot size={16} />
            长期摘要记忆
          </p>
          <h2>聊得越久，越懂你家宝宝</h2>
          <p>
            较早聊天会被整理成长期摘要，新的回答会带上宝宝阶段、喂养方式、近期照护记录、待确认事件和家庭角色，让建议更连贯，也不必每次从头解释。
          </p>
        </div>
        <div className="official-orbit" aria-hidden="true">
          <span className="orbit-core">
            <HeartPulse size={30} />
          </span>
          <span className="orbit-dot dot-a">喂养</span>
          <span className="orbit-dot dot-b">睡眠</span>
          <span className="orbit-dot dot-c">账本</span>
          <span className="orbit-dot dot-d">家人</span>
        </div>
      </section>

      <section className="official-section official-download" id="download">
        <div className="official-section-head">
          <p>下载入口</p>
          <h2>iOS 和 Android 二维码位置已预留</h2>
        </div>
        <div className="official-download-grid">
          {downloadItems.map((item) => {
            const Icon = item.icon;
            return (
              <a className={`official-download-card ${item.tone}`} href={item.href} key={item.platform}>
                <div className="official-download-title">
                  <Icon size={22} />
                  <strong>{item.platform}</strong>
                </div>
                <div className="official-qr-frame" aria-hidden="true">
                  <QrCode size={86} strokeWidth={1.2} />
                  <span className="qr-corner top-left" />
                  <span className="qr-corner top-right" />
                  <span className="qr-corner bottom-left" />
                </div>
                <p>{item.note}</p>
              </a>
            );
          })}
        </div>
      </section>
    </main>
  );
}

export default OfficialSite;
