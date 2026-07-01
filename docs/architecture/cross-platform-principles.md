# 跨端架构准则与目标结构(North Star)

> 创建:2026-06-12 · 来源:2026-06-12 代码结构 review(Opus)
> 读者:在本仓库做结构性改动 / 加新功能 / 拆单体的所有 agent 与开发者
> 定位:这是「好的结构长什么样」的参照系。**具体债项与还债进度在 [tech-debt.md](tech-debt.md);本文是它的设计依据。**
> 用法:加功能前先看 §3「目标结构」与 §4「扩展性杠杆」——决定新代码放哪、怎么放才不增债。

---

## 1. 技术栈现实:三条边界决定一切

三个独立可部署单元、**多语言**:
- 前端 `frontend/`(React + TS,Capacitor 混合,~17.6k 行)
- 后端 `backend/`(Spring Boot + Java,~17.6k 行 / 248 文件)
- 管理后台 `admin/`(Node + better-sqlite3)

打包形态:**Capacitor 混合**(同一份 Web 代码跑浏览器 + iOS WebView + Android WebView),发布走 **OTA 热更新**。

> **核心判断**:跨端项目的难点不在任一单元内部,而在**三条边界**。SE 准则在这种项目里 90% 的价值集中于治理这三条:
> 1. **前端 ↔ 后端**:语言不通,类型不能共享,契约靠人肉同步 → 最易静默漂移
> 2. **Web ↔ 原生**:同一代码两种运行时 → 平台分叉若散落则到处 `if(isNative)`
> 3. **OTA 包 ↔ 线上后端**:版本必须对齐 → 详见 AGENTS.md(已是模范,本文不展开)

---

## 2. 八条准则 × 本仓库打分(2026-06-12 实测)

| 准则 | 为什么对「跨端」尤其重要 | 现状(实测) | 评 | 债项 |
|---|---|---|---|---|
| ① 契约单一事实源 | FE/BE 异构,契约最易静默漂移 | 后端无 OpenAPI、前端无 zod;`types.ts`(459行)手抄 DTO,响应 `JSON.parse` 后直接 `as` 强转 | 🔴 零防护网 | **D10** |
| ② 平台差异封装在端口层 | 同一代码两运行时 | 已有 6 个原生封装(nativeAlarm/mobileUpdates/haptics…),**但 App.tsx 仍裸调 Capacitor 12 处** | 🟡 80%,有泄漏 | **D11** |
| ③ 业务逻辑框架无关、可纯测 | 逻辑要能脱 React/DOM/Capacitor 测 | `appStateDomain.ts`(1011行)import React `SetStateAction` + 摸 `window.localStorage`/`location`,四关注点混揉 | 🟡 领域不纯 | D6 |
| ④ 垂直切片 > 水平上帝对象 | 功能要能独立演进 | App.tsx = **9690 行 = 前端 55%**(详见 §3 诊断) | 🔴 上帝类 | **D1** |
| ⑤ 一致的模块分类法 | 找文件靠规则不靠记忆 | `components/` 与 `views/` 边界含糊(AlbumScreen 在 components,GrowthEntry/Ledger 在 views) | 🟡 规则不清 | **D12** |
| ⑥ 每条边界都有契约测试 | 边界正是 mock 掩盖问题处 | 前端测试全 mock 后端;OTA 有守卫(✅);原生边界无测试 | 🟡 OTA 优,FE/BE 缺 | D8/D10 |
| ⑦ 后端分层 | — | controller→service→persistence,dto/auth/config/exception 齐,~71 行/文件 | 🟢 教科书级 | — |
| ⑧ OTA 安全作为一等约束 | 混合 App 命脉 | base-url 注入硬校验、版本只升不降、localhost grep 守卫 | 🟢 模范 | 见 AGENTS.md |

**结论**:后端分层(⑦)与 OTA 纪律(⑧)是本项目亮点,勿动。所有结构债集中在**前端三条边界**。

---

## 3. 上帝类诊断与目标结构(准则 ④)

### 3.1 诊断:App.tsx 是教科书级上帝类(2026-06-12 实测)

| 指标 | 数值 | 含义 |
|---|---|---|
| 行数 | 9690 | 前端的 55% |
| 顶层函数/handler | **185** | 一个组件体里 185 个职责单元 |
| Hooks 总量 | **226**(98 state + 63 ref + 35 memo + 30 effect) | 一个作用域扛全部 |
| `profile` 引用 | 110 次 | 跨域耦合脊柱 |
| `reminders` / `careLogs` 引用 | 51 / 42 次 | 同上 |
| `kind` 分支点 | ~39 处(含记录类型/附件类型) | 加一种记录类型 ≈ 散弹式改多处 |

不是"大文件",是**单一作用域揉了 ~10 个职责**(auth / records / album / ledger / reminders / voice / AI chat / preview / 原生桥接 / OTA),靠共享可变状态隐式联通。

### 3.2 SOLID 坏味道 → 准则映射

- **违反 SRP**:185 函数共享一个闭包,任意 state 变动重渲染整树(D1 性能根因)。
- **违反 OCP(散弹式修改)**:加记录类型 / AI 模型 / Tab,要在 ~39 处分支与内联 `resolveAgentModelForMessage` 字符串逻辑里逐个加 case → 见 §4 注册表化(**D13**)。
- **违反 DIP + 内容耦合**:功能间不通过接口,而通过"都能摸到同一个 `profile`/`reminders`"联通(内容耦合,最强耦合);且直接依赖具体 `Capacitor`/`fetch`/`localStorage`。

### 3.3 目标结构:薄壳 + 垂直切片 + 注册表

```
App.tsx(目标 <800 行:只做组装)
├── SessionContext          ← 真正全局的少数态(auth/profile/canCaregive,被引用 110×/51×)
│                              用 Context,杜绝 props 钻探(LedgerView 现钻 20+ props)
├── features/
│   ├── records/  useRecordsState() + RecordsScreen + 抽屉   ← 状态/handler/UI 内聚一处
│   ├── album/    useAlbumState()   + AlbumScreen(已拆 ✅)
│   ├── ledger/   useLedgerState()  + LedgerView
│   ├── reminders/ useRemindersState() + ...
│   └── chat/     useChatState()    + AI 助手
├── platform/   原生端口层(把 App 里 12 处裸 Capacitor 收编 → D11)
└── recordTypes.ts  ← 注册表:消灭 39 处 kind 分支(D13)
```

**关键招式「领域 hook」**:每个功能的状态 + 操作封装进 `useXxxState()`,App 只持有真正全局的 `profile`/`auth`。功能间不再共享作用域 = **内容耦合降为接口耦合**。即 D6,与 D1 拆分同一改动面,一起做。

**分类法(配 D12)**:`screens/`(或 `features/<x>/`)放整屏;`components/` 只放跨功能可复用件。一条规则,拆分时归位。

---

## 4. 扩展性杠杆:把"改代码"变成"加数据"(准则 ④/OCP)

「高可扩展性」的本质 = 加功能时**扩展(加条目)而非修改(改散落分支)**。本仓库两个最痛的扩展点:

### 4.1 记录类型注册表(D13,最高 ROI)

39 处 `kind` 分支里,记录类型分发是典型散弹式修改。提成数据表:

```ts
// recordTypes.ts —— 加一种记录类型 = 加一个条目,其余文件零改动(开闭原则)
export const RECORD_TYPES: Record<RecordKind, RecordTypeDef> = {
  feeding: { label: "喂奶", icon: MilkIcon, unit: "ml",
             fields: [{ key: "amount", control: "stepper", min: 0, max: 300 }],
             toTimelineText: e => `${e.amount}ml`,
             toAlbumCategory: () => "feeding" },
  sleep:   { label: "睡眠", icon: SleepIcon, fields: [...], toTimelineText: e => durationOf(e) },
  // ← 未来加"用药/体温/里程碑",只在这里加一行
};
```

之后 `kind === "feeding" ? … : kind === "sleep" ? …` 全部塌缩成 `RECORD_TYPES[kind].toTimelineText(e)` 一次查表。

### 4.2 AI 模型路由策略表

`resolveAgentModelForMessage`(App.tsx:2110)的内联字符串判断 → 策略表 `MODEL_POLICIES`(按"有无视觉附件/文本特征"映射到模型),加模型 = 加一条策略,不改分发逻辑。

---

## 5. 防止上帝类重新长回来(纪律)

> **D1 状态(2026-07-01 完成)**:App.tsx **9690 → 3684 行(−62%)**,拆成「容器 + 8 个领域 hook(`features/*/useXxxState`)+ 视图组件(`screens/*`)+ 服务端 store(`useAppStore`)+ 契约类型层(`appContracts.ts`)」。`useState` 104 → 15;`features/`·`screens/` 对 App 的反向依赖 6 → 0;打字重渲 30 → 0(composer external store)。App 现为纯消费者/编排器,不再是上帝类。

1. **架构守卫(CI 门)**:`npm run test:architecture-guard`(已进 `verify:frontend`)——把"上帝类纪律"泛化到整个 `frontend/src`,不只 App.tsx。三条规则:
   - **R1 行数棘轮**:每个文件 ≤ 其上限(大文件在 `scripts/test-architecture-guard.mjs` 的 `CEILINGS` 里逐个钉,其余默认 ≤400),**只许降不许升**。合理增长→在同一改动里有意识调高并注明;新文件超限→拆或登记。
   - **R2 分层单向依赖**:`features/`·`screens/`·`views/`·`components/` **不得从 `App` import**(值或类型)。共享类型走 `appContracts.ts`,共享逻辑走 `utils/`。
   - **R3 useState 密度**:单文件 ≤40 个 useState(上帝类最直观信号,拆前 App 有 104)。
   - 业界对标:ESLint `max-lines`/`max-lines-per-function`/`complexity`、`import/no-cycle`、dependency-cruiser/eslint-plugin-boundaries、《Building Evolutionary Architectures》fitness functions。本仓库无 ESLint,用 fitness-function 测试等效实现。
2. **每拆一块**:跑 `npm run verify:frontend` + 加 memo-guard(像 `test-records-memo` 守 records/app 打字重渲 =0 那样)。
3. **新功能默认垂直切片**:新功能进 `features/<name>/`(state hook + screen + 局部 API),除非确属跨功能复用件才进 `components/`。
4. **边界三连**:碰 FD/BE 响应 → 过 D10 校验器;碰原生 → 走 platform 端口层(D11);碰记录类型 → 改注册表(D13),不加新分支。

---

## 6. 排序建议(不大爆炸,骑在已规划工作上)

1. **D10 契约校验器**(独立、便宜、堵稳定性雷)——可随时插队;
2. **拆 RecordsScreen + `useRecordsState`**(D1 下一步,单文件最大减重,验证领域 hook 模式);
3. **SessionContext**(D6,消 props 钻探);
4. **记录类型注册表**(D13,动 records 时顺带,灭 39 分支);
5. **platform 端口层**(D11,收编 12 处裸 Capacitor);
6. 分类法归位(D12)随手做。

> Records 拆分是这一路最复杂的一块(185 函数里相当一部分在 records/voice/AI 链路),值得单独开一轮专注做,不与其它项混批。
