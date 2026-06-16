# 疫苗接种清单设计（Vaccine Checklist Design）

- 日期：2026-06-16
- 状态：设计已确认，待写实现计划
- 范围：给「小宝记」加一个疫苗接种清单 + 介绍参考——一类(全国统一基础) + 省级增补(先 5 省) + 二类(自费可选,带各省精确参考价);按宝宝月龄给每针算窗口状态、可打钩"已接种"、到点轻提醒"别漏别晚"。
- 发布载体：**纯前端,走 OTA,零后端部署**。疫苗数据托管 OSS(可不发版更新),追踪与省份存进 `profile`(JSON 直存,后端零改动)。

## 1. 目标与非目标

**目标(v1)**:
1. **疫苗清单**:一类(免费,全国统一)+ 省级增补(北京/上海/广东/浙江/江苏)+ 二类(自费可选);每针含 苗名/剂次/月龄窗口/类别/简介(预防什么)/推荐度。
2. **窗口状态**(按宝宝月龄):`已接种 / 现在可约(在窗口)/ 即将到窗口 / 窗口将过·尽快约 / 已过期未打·建议补`。
3. **打钩追踪**:点「已接种」记一笔(日期),状态随之更新;跨设备同步、卸载重登不丢。
4. **轻提醒**:入口角标「本阶段 N 针待安排」+ 每针窗口状态;**不给每针塞响铃闹钟**。
5. **二类各省精确参考价**:`苗 × 省 ×(国产/进口档)→ 价`,标 `asOf` + 「以接种点为准」。
6. **数据可不发版更新**:疫苗程序/价格放 OSS JSON,改了重传即全网生效。

**非目标(v1 不做,留 v2)**:每针独立科普长文/详情页;到点系统推送通知(先只做 App 内状态,留 v1.1);五联 vs 单苗的智能替代推荐;超过 5 省;HPV/老年苗等非新生儿苗。

**调研结论**(为什么这么分层):一类(国家免疫规划)全国统一,2025 起百白破程序已全国调整;法规允许各省在执行时**增补**免费苗(故"免费那份"省间不同,北京/广东等有本省版);二类自费自愿、各地价格/优先级不同。详见对话调研记录与官方来源。

## 2. 现状(可复用,不要重造)

| 复用点 | 位置 |
|---|---|
| 静态数据集 + view + 打钩追踪 + 免责 的**成熟范式** | `frontend/src/data/growthMilestones.ts` + `frontend/src/views/MilestonesView.tsx`(`achieveMilestone`/`milestoneIdFromTags`,按月龄算状态) |
| `profile` 为**不透明 JSON 直存**(可加字段,后端零改动) | `backend/.../dto/app/AppStateDto.java`(`profile` 是 `JsonNode`);`AppStateService` profile case 存 payload JSON;白名单已含 "profile" |
| OSS 托管 + 前端拉取缓存范式 | OTA 用的 OSS(`upload-mobile-update-oss.sh`);`frontend/src/mediaCache.ts`(拉取+缓存+兜底) |
| 健康/疫苗**免责文案** | `App.tsx`「健康、疫苗…以医生和社区医院安排为准」;`legalContent.ts`;`category:"vaccine"` 提醒分类 + Syringe 图标 |

**缺口**:无疫苗清单数据、无清单页、无窗口状态、无价格数据。

## 3. 架构

```
我的/健康区入口 → 全屏 <VaccineView/>
   │ 读
   ├─ profile.birthDate → 月龄;profile.vaccineRegion → 选中省;profile.vaccineRecords[] → 已接种
   ├─ vaccineData(OSS JSON + 内置兜底 + 缓存) → 疫苗程序 + 价格
   │ 派生(纯函数 vaccineStatus.ts)
   │   每针 5 态 by 月龄 × 窗口 × 是否已接种
   │ 写(打钩"已接种"/撤销)
   └─→ 改 profile.vaccineRecords[] → persist profile(走现有 profile 存取,后端零改动)
```

**新增文件**:
- `frontend/src/data/vaccineSchedule.fallback.ts`(纯,内置兜底基线数据)。
- `frontend/src/vaccineData.ts`(端口/数据层):启动从 OSS 拉 `vaccine-data.json`,按 `version` 决定是否更新缓存(localStorage),离线/首启回退到内置兜底;导出 `getVaccineData()`。
- `frontend/src/vaccineStatus.ts`(纯):`computeDoseStatus({ ageMonths, window, doneDate }) → DoseStatus`;`vaccineDosesForRegion(data, region)`(叠加省级增补、过滤)。
- `frontend/src/views/VaccineView.tsx`(清单页,照 MilestonesView)。
- `frontend/src/components/VaccineEntryCard.tsx`(入口卡 + 「本阶段 N 针待安排」角标)。
- `frontend/src/components/RegionPicker.tsx`(接种地省份选择,写 `profile.vaccineRegion`)。
- `frontend/src/styles/mobile-app.css` 追加样式。
- `frontend/src/App.tsx`:挂入口 + 全屏 view + profile 字段读写接线。

**OSS 数据对象**:`vaccine-data.json`(公开读,疫苗信息非敏感)放现有 OSS,如 `baby-companion/data/vaccine-data.json`;运营脚本 `scripts/upload-vaccine-data.mjs` 上传(照 `upload-mobile-update-oss.sh` 套路)。

## 4. 数据结构(OSS JSON,内置同构兜底)

```ts
type VaccineDoseClass = "nip" | "provincial" | "optional"; // 一类 / 省级增补 / 二类自费
type RegionCode = "national" | "BJ" | "SH" | "GD" | "ZJ" | "JS";
type VaccineDose = {
  id: string;            // 唯一,如 "dtap-2" "pcv13-1"
  vaccine: string;       // "百白破" "13价肺炎"
  doseNo: number;        // 第几剂
  ageMonthMin: number; ageMonthMax: number; // 窗口
  klass: VaccineDoseClass;
  region: RegionCode;    // national 或某省(省级增补/部分二类按省)
  intro: string;         // 预防什么(一行)
  recommend?: "recommended" | "optional"; // 二类推荐度
};
type VaccinePrice = { doseVaccine: string; region: RegionCode; tier?: "domestic" | "imported"; price: number };
type VaccineData = {
  version: string;       // 如 "2026-06"
  asOf: string;          // "2026年6月"
  doses: VaccineDose[];  // 一类 national + 各省 provincial + 二类 optional
  prices: VaccinePrice[];// 二类各省价(一类不入价)
};
```

`vaccineSchedule.fallback.ts` 导出一份**同构的内置 `VaccineData`**(至少一类 national 全量 + 5 省增补 + 二类基础),保证离线/首启/拉取失败时可用。

## 5. 清单页 + 窗口状态

`vaccineStatus.ts`(纯函数,可 node 测)。5 态**互斥**,按以下顺序判定:
```
computeDoseStatus({ ageMonths, ageMonthMin, ageMonthMax, doneDate }) →
  "done" | "overdue" | "closing" | "due" | "upcoming"
// done    : 有 doneDate(已接种)
// overdue : 未打 且 age > max(已过窗口,建议补)
// closing : 未打 且 min ≤ age ≤ max 且 (max - age) ≤ 1 月(窗口将过,尽快约)
// due     : 未打 且 min ≤ age ≤ max 且 (max - age) > 1 月(现在可约)
// upcoming: 未打 且 age < min(还没到;(min - age) ≤ 1 月时 UI 标"即将到窗口")
// ageMonths 为 null(没填生日)→ 全部按 upcoming 当纯参考,不强调
```
`VaccineView`:读 `vaccineDosesForRegion(data, region)` → 每针算状态 → 按状态/月龄排序;一类、二类分区;二类显示价格 + 简介 + 推荐度;每针「已接种 / 撤销」按钮(canCaregive)。顶部摘要「当前月龄 + 本阶段待安排 N」。

## 6. 省份 & 追踪(都进 profile,纯 OTA)

- **省份**:`profile.vaccineRegion: RegionCode`(默认缺省= `national` 只显一类);RegionPicker 改它 → 走现有 profile 持久化(后端零改动、同步)。
- **追踪**:`profile.vaccineRecords: { doseId: string; date: string }[]`;打钩 = push 一条;撤销 = 移除;同样走 profile 持久化。
- 前端 `types.ts` 的 `BabyProfile` 加这两个可选字段;**后端零改动**(profile 是 JSON 直存)。
- 并发:打钩重写整个 profile(疫苗记录少 + 低频,末写胜出风险可接受,与现有 profile 编辑一致)。

## 7. 轻提醒(你要的"别漏别晚",不重)

- **入口角标**:`VaccineEntryCard` 显示「本阶段 N 针待安排」(N = `due` + `closing` + `overdue` 计数)。
- **每针窗口状态**即提醒本身(5 态高亮),不给每针建响铃提醒。
- v1.1 可选:进新窗口时发一条温和系统通知(复用 `category:"vaccine"` 提醒,**非响铃**),v1 先不做。

## 8. 价格(各省精确参考价)

- 二类每苗:`{省 ×(国产/进口档)→ 价}`,UI 显「¥X(国产)/ ¥Y(进口)· 2026年6月 · 各点略有差异,以接种点为准」;一类不标价。
- 某苗某省**缺价 → 显「咨询接种点」**,不瞎填。
- 价格随数据 OSS 更新(改了重传 JSON,不发版)。

## 9. 错误处理 / 降级 + 免责

- **没填生日** → 清单当纯参考显示,不算窗口状态;引导去设生日。
- **没选省** → 只显一类 national + 提示「选所在省查看增补与自费价」。
- **OSS 拉取失败 / 离线 / 首启** → 用缓存,再回退内置兜底,不白屏。
- **某苗缺价** → 「咨询接种点」。
- **全程免责**:页面挂「以当地接种点 / 居住地疾控安排为准,本清单仅供参考,不构成医疗建议」(复用现有文案风格)。

## 10. 测试

- `vaccineSchedule.fallback.ts` + 数据结构:node 单测(doseId 唯一、窗口合法 min≤max、每条 region/klass 合法、二类 prices 引用的苗都存在或可降级)。
- `vaccineStatus.ts`:node 单测(done/due/upcoming/closing/overdue 边界 + 无生日 + 区域叠加 `vaccineDosesForRegion`)。
- `VaccineView` DOM smoke(web):开页、选省看增补叠加、打钩→状态变 done、缺价显「咨询接种点」、无生日降级。
- 复用现有 app-state 契约测试不回归(profile 加字段不破坏)。

## 11. 内容任务 + 风险(与代码并行)

1. **疫苗程序数据**:一类(核对官方 2025 程序,百白破新程序)+ 5 省增补 + 二类基础,落 `vaccineSchedule.fallback.ts` 与首版 OSS JSON,标 `asOf`。
2. **各省二类精确价格**:**实现首步先验 5 省价格来源/可得性**(像哄睡音乐先验本地音源);拿不到精确的该苗退「咨询接种点」或区间。**只用可核实来源**,标日期。
3. **维护**:程序/价格会变 → 改 OSS JSON 即全网更新,不发版。

## 12. 发布

- **纯 OTA**:前端代码 + 内置兜底数据走 OTA;OSS 上传首版 `vaccine-data.json`(公开读)。
- **零后端部署、不发原生包**(省份/追踪进 profile,数据走 OSS)。
