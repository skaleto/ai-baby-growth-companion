# 小宝记「高级感视觉打磨」设计稿(#37):暖晨光全局体系

- 创建日期:2026-06-20
- 状态:设计已与用户确认 → 待 spec 复核 → 转 writing-plans
- 范围:卡片背景 + 按钮的全局"高级感"升级。纯前端、走 OTA、零后端、零原生。
- 产出方式:全局深度体系用纯 CSS;门面卡的主题点睛用 Codex 产 SVG 多版。

## 目标(一句话)

把当前"自洽但平的暖色奶油盒子"升级成有**光感深度 + 材质层级**的高级感体系,全局统一,但通过分层避免"装饰糊满"和低端安卓掉帧。

## 方向定稿:C1 · 暖晨光

经 Codex 在「柔光质感」方向产 4 版(C1 暖晨光 / C2 冷静光 / C3 双色极光 / C4 纸层无晕),用户选定 **C1 · 暖晨光**:琥珀+珊瑚的径向光晕落卡片右上角(像晨光斜照)+ 分层暖色渐变 + 顶部高光边 + 柔阴影 + 鼠尾草立体按钮。

**关键判断:C1 的"光晕"CSS 原生可做(`radial-gradient`),比 SVG 更轻、可按品类 `var()` 改色、零资源加载。所以底层深度体系全用纯 CSS;"生成美术资源"落在少数门面卡的主题 SVG 点睛上。**

## 核心架构

两层叠加:

1. **全局 CSS 深度体系(统一所有卡片/按钮)** —— 一套新 token(圆角层级 / 阴影分层 / 暖色表面渐变 / 顶部高光边 / 径向光晕 / 按钮系统),按"分层规则"套到现有卡片选择器。
2. **门面卡主题 SVG 点睛(少数高曝光卡)** —— 喂奶闹钟 / 哄睡 / 成长 / 疫苗 等各域入口卡,叠一张 Codex 产的主题矢量装饰(低透明度、可 `currentColor` 改色),给"画面感/温度"。

## 1. Token 体系(新增 CSS 变量,值已定)

落在新文件 `frontend/src/styles/premium-depth.css`,在 `styles.css` 里 **最后** import(在 `warm-theme.css` 之后),保证覆盖生效、模块隔离、易复核易回退。

```css
:root {
  /* 圆角层级 */
  --r-chip: 12px;
  --r-card: 16px;
  --r-hero: 20px;
  --r-modal: 22px;

  /* 阴影分层(柔和模糊、暖色调;注意是 box-shadow 模糊,非 backdrop-filter) */
  --elev-list: 0 4px 12px rgba(106, 78, 48, .05);
  --elev-card: 0 10px 26px rgba(106, 78, 48, .08), 0 3px 8px rgba(106, 78, 48, .05);
  --elev-hero: 0 18px 40px rgba(106, 78, 48, .12), 0 5px 14px rgba(106, 78, 48, .06);
  --elev-btn:  0 8px 18px rgba(55, 123, 100, .30);

  /* 顶部高光边 + 底部暖边(立体感来源,纯 inset 阴影) */
  --edge-light: inset 0 1px 0 rgba(255, 255, 255, .7), inset 0 -1px 0 rgba(234, 223, 208, .55);

  /* 暖色表面渐变 */
  --surface-card: linear-gradient(145deg, #fffaf1 0%, #fffaf1 52%, #f7ecd9 100%);
  --surface-hero: linear-gradient(145deg, #fffdf8 0%, #fffaf1 54%, #f6ead7 100%);

  /* 径向光晕:门面卡用;色由各品类覆盖 --glow */
  --glow: radial-gradient(150px 105px at 82% 8%, rgba(223,169,71,.22), rgba(236,143,125,.10) 48%, transparent 72%);

  /* 按钮系统 */
  --btn-primary-bg: linear-gradient(135deg, #7bb295 0%, #3d8268 72%);
  --btn-primary-edge: inset 0 1px 0 rgba(255, 255, 255, .35);
}
```

说明:
- 阴影颜色统一用现有暖棕 `rgba(106,78,48,*)`,与现状 `--shadow-soft` 同源,只是分了三档强度。
- 主按钮渐变在 Codex 的 `#75a88e→#377b64→#2d3137` 基础上去掉近黑尾(`#2d3137` 太闷),收敛为 `#7bb295→#3d8268`,更干净的高级感。
- `--glow` 默认琥珀;每个品类门面卡覆盖自己的 `--glow`(见 §3)。

## 2. 分层规则(全局统一 ≠ 每张一样)

| 层级 | 卡型 | 圆角 | 表面 | 阴影 | 高光边 | 光晕 | SVG 点睛 |
|---|---|---|---|---|---|---|---|
| 门面 | 喂奶闹钟 / 哄睡 / 成长 / 疫苗 / 账本入口 | `--r-hero` | `--surface-hero` | `--elev-hero` | ✓ | ✓ 品类色 | ✓ Codex 主题图 |
| 标准 | 账本 / 相册总览 / 资料 / 趋势 / 提醒组 | `--r-card` | `--surface-card` | `--elev-card` | ✓ | 极淡或无 | ✗ |
| 列表 | 时间线记录 / 账本明细行 | `--r-card` | 微渐变 | `--elev-list` | 仅顶部高光 | ✗(太小会脏) | ✗ |
| 弹窗 | story-modal 族 | `--r-modal` | 维持现状 | 维持柔阴影 | ✓ | ✗ | ✗ |

原则:门面卡装饰重、给温度;海量列表卡只留微深度,绝不放光晕(小尺寸上光晕会脏)。

## 3. 品类色编码(门面卡光色随域)

| 域 | 强调色 | 门面卡 `--glow` 主色 |
|---|---|---|
| 喂养 | 琥珀 #dfa947 | `rgba(223,169,71,.22)` |
| 睡眠 | 天蓝 #6aa4d9 | `rgba(106,164,217,.20)` |
| 换尿布 | 鼠尾草 #75a88e | `rgba(117,168,142,.18)` |
| 成长 | 珊瑚 #ec8f7d | `rgba(236,143,125,.20)` |
| 疫苗 | 玫瑰 #d87895 | `rgba(216,120,149,.18)` |
| 账本 | 琥珀 #dfa947 | `rgba(223,169,71,.20)` |

光晕第二停色统一用珊瑚 `rgba(236,143,125,.08~.10)` 过渡到透明。小圆点 / 强调线同走该品类色。

## 4. 应用映射(真实 class → 层级)

来自现状摸排(`mobile-app.css` / `warm-theme.css` / `pro-summary.css`):

- **门面(各域入口卡,一域一张)**:喂奶闹钟卡(`FeedingAlarmCard` / `mobile-app.css` 5840 起)、哄睡音乐卡(`SleepMusicCard` / `.sleep-entry-card`)、成长入口卡(`GrowthEntryView` / `.growth-entry-card`)、疫苗入口卡(`VaccineView` / `.vaccine-card`)、账本 AI 入口卡(`.ledger-ai-entry-card`)
  - 注:旧「今日发现 / DailySummaryView」已在本项目删除(task #4),不在门面集内;`album-overview-card` 暂归标准层(相册总览偏信息密度,不当门面)。
- **标准**:`.summary-card` `.ledger-card` `.ledger-summary-card` `.calendar-card` `.trend-card` `.album-overview-card` `.app-profile-card` `.profile-detail-card` `.profile-form` `.reminder-group`
- **列表**:`.record-event-card` `.day-timeline-card` `.expense-item` `.expense-row`
- **按钮**:主 = `.send-button` 族(`.send-button` `.auth-form > button` `.save-profile-button` `.care-log-form button` 等,现有共享规则在 `warm-theme.css` 572–583)+ `.ledger-manual-cta`;次级 = `.screen-action-button`;危险 = `.screen-action-button.danger`(维持现红)

现状基线值(供回归对照):卡片现为 `border-radius:8px` + `rgba(255,250,241,.9)` + `--shadow-soft 0 12px 30px rgba(106,78,48,.09)`;主按钮现为 `linear-gradient(135deg,#69b78d,#4d9279)`。

## 5. 性能红线(硬约束)

- **绝对禁止 `backdrop-filter` / `filter: blur`** 加到卡片或任何滑动/滚动中移动的元素上 —— 依据 `pswp-album.css` 16–18 注释 + 提交 `352c016`:横滑时它每帧重采样身后移动的图片、强制合成层重绘,是相册"滑动卡卡"掉帧主因。
- 深度/光晕**只用** `linear-gradient` / `radial-gradient` / 纯色 `box-shadow`(含 `inset`)—— 这些 GPU 便宜。`box-shadow` 的模糊半径不在禁用之列(现状本就用,`--shadow-soft` 即是)。
- 门面 SVG 点睛:矢量(`path`/`circle`/`radialGradient`),体积小,低透明度(≤ .15 主体),`pointer-events:none`,可 `currentColor` 改色;不引入位图。
- 现有 `backdrop-filter` 用法(tabbar / modal 蒙层 / toast)是静态非滑动元素,保留不动。

## 6. Codex 的第二棒(实现阶段)

门面卡主题 SVG 点睛:实现时让 Codex 为每个门面域(喂奶 / 哄睡 / 成长 / 疫苗 / 账本)各产几版主题矢量装饰(如喂奶=奶瓶微光,哄睡=月亮/星,成长=幼苗/刻度,疫苗=盾/护,账本=小票/币),我筛选 + 接线。严格守 §5 矢量/透明度/性能约束。属"产多版 → 我收敛"。

## 7. 验收

- 用本仓库已有的 `qa:visual` 视觉基线闸门兜底:改前 `qa:baseline:accept` 签基线 → 改后 `qa:visual` 只把"变了的卡"截图送 LLM 复审,确认是"变高级"而非"变丑/掉帧/对比度不足"。
- 人工真机过一遍低端安卓:四屏滚动、相册横滑无新增掉帧。
- 不改任何功能逻辑、不动数据模型、不动后端。

## 非目标(本轮不做)

- 不做 A(植物线描)/ B(极简)方向 —— 已选 C1。
- 不做暗色模式、不做按月龄换主题(留给更大的"视觉系统 Phase 4")。
- 不动信息架构 / 导航 / 文案 / 功能 —— 纯视觉材质层。
- 不做位图插画 / 厚涂美术 —— 只矢量。

## 自审清单(写完回看)

- 占位扫描:token 值、class 列表、品类色全部具体,无 TBD。
- 一致性:token 命名(`--elev-*` `--r-*` `--surface-*` `--glow` `--btn-primary-*`)全文一致;分层规则表与应用映射对得上。
- 范围:单一 spec 可交付(纯样式层),无需拆子项目。
- 歧义:"全局统一"已用分层规则明确为四档,不等于每张卡一样。
