# 成长指标功能实现记录

## 当前落地范围

本轮按产品范围收敛为基础数据落地：

- 宝宝档案补充 `gender`、`birthWeight`、`birthHeight`。
- 记录 tab 新增「成长」子视图。
- 照护人可手动录入身高、体重、头围，字段为测量项、数值、日期、备注。
- 成长测量按指标分组展示历史，并显示相对上一条的增量。
- 成长测量通过 `growthMeasurements` 集合走现有 app state payloadJson 链路，家庭共享，照护人可写，仅查看成员只读。

## 明确不在本期

本期不做百分位、参考曲线、WHO/国标数据内嵌、AI 自动抽取、测量提醒模板、PDF 导出、早产儿矫正。曲线和参考数据需要可复现的数据生成脚本、授权确认与锚点测试，后续作为独立需求处理。

## 实现要点

- 前端类型增加 `BabyGender`、`GrowthMeasurement` 与 `growthMeasurements` 快照字段。
- 档案表单与 onboarding 表单支持选择性别；档案编辑支持填写出生体重与出生身长。
- 成长录入使用 `GROWTH_MEASUREMENT_META` 中的合理范围校验，避免异常值进入列表。
- 本地存储清理和 legacy 导入检测包含 `baby-companion-growth-measurements`。
- 后端新增 `growth_measurement` 记录表、实体、mapper、service，并在 `AppStateService` 中接入 read/replace/upsert/delete/clear。
- `AgentBabyProfile` 与 runtime profile enrichment 会传递性别、出生体重、出生身长，便于后续 Agent 能力扩展。

## 验证要求

- `bash harness/init.sh`
- `npm run verify:frontend`
- `mvn -f backend/pom.xml test`
- `npm run mobile:sync`
- `npm run build:ios:debug`
- `npm run build:android:debug`

其中 `npm run smoke:frontend` 已覆盖记录 tab 的成长子视图：确认基础 MVP 不渲染参考曲线、异常身高不会入库、有效身高和备注可以添加并显示。
