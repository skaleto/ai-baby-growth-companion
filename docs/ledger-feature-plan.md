# 小宝账本功能迭代记录

## Summary

账本从“扫码查商品”重构为“手动速记 + AI 多轮确认记账”。账本数据仍按家庭共享，照护人可新增、编辑、删除，仅查看成员只读。AI 和聊天页都不自动入账，只生成待确认支出草稿；用户确认后才写入家庭账本。

## Scope

- 前端 `账本` Tab 保留 `本月 / 年度 / 明细` 视图，新增底部智能记账面板。
- 智能记账面板支持文字、订单截图、小票、支付截图和商品照片，缺少必备字段时继续追问。
- 手动表单保留商品/用途、金额、分类、日期、数量、单价、商家、品牌、规格、备注，删除条码输入、扫码按钮、查询按钮和商品候选。
- 聊天页自然语言或图片记账统一生成待确认支出卡，不再走自动保存路径。
- Android/iOS 删除原生条码扫描插件、CameraX/ML Kit 条码依赖和相机权限；原生媒体选择继续保留。
- 后端删除商品库查询接口和 product lookup 代码，新库不再创建 `product_lookup_cache`。

## Data Model

`ExpenseItem` 字段：

- 必填：`id/title/amount/currency/category/date`
- 可选：`quantity/unitPrice/merchant/note`
- 可选详情：`brand/spec/attachmentIds`
- 元数据：`source/createdAt/updatedAt`

`source` 只保留：

- `manual`：用户在账本页手动创建或历史条码/web 来源迁移后的记录
- `agent`：AI 生成待确认草稿并由用户确认后的记录

## AI 记账策略

- 商品/用途、金额、分类、日期齐全时，只生成 `pending expenseItem`。
- 日期未明确时默认今天；用户表达“前几天/上周”但无法确定具体日期时追问。
- 商品实物照片没有实际支付金额时必须追问，不允许用参考价入账。
- 订单、小票、支付截图可以提取金额，但仍必须展示草稿并等待用户确认。
- 旧 `barcode`、`productImageUrl` 字段由幂等迁移从账本记录和待确认草稿中清理。

## UI 要求

- 账本页保持清爽、固定视口，页面主体不随意整体滚动。
- 智能记账使用底部抽屉，消息、附件和草稿列表在抽屉内部滚动。
- 草稿卡只展示必要编辑项，确认后立即进入家庭账本。

## Verification

- 后端 `mvn test` 覆盖支出语义抽取、EffectPolicy 待确认边界、家庭共享和只读权限。
- 前端 `npm run build` 覆盖类型和生产构建。
- Android debug 构建覆盖移除扫码后的原生工程。
- iOS simulator debug 构建覆盖移除扫码后的 Swift/Xcode 工程。
