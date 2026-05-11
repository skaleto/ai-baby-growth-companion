# 小宝账本功能迭代记录

## Summary

新增独立底部 Tab `账本`，用于记录家庭为小宝产生的支出。账本数据按家庭共享，照护人可新增、编辑、删除，仅查看成员只读。第一版覆盖手动记账、原生条形码扫码、商品信息候选查询、AI 辅助记账，以及月度/年度支出分析。

## Scope

- 前端新增 `账本` Tab，包含 `本月 / 年度 / 明细` 分段视图。
- 支出表单支持商品名、金额、分类、日期、数量、单价、商家、备注、条形码、品牌、规格、商品图候选。
- 后端新增 `expense_item` 家庭共享记录表，并纳入 `GET /api/app/state`、状态 upsert/delete 和权限控制。
- 后端新增 `product_lookup_cache` 与 `GET /api/products/barcode/{barcode}`，优先缓存，再查 Open Food Facts 和 UPCitemdb 免费源。
- Android/iOS 新增 `BarcodeScanner` 原生插件，扫码结果回填账本表单。
- Agent 新增支出识别：明确“买了什么 + 实际花了多少钱”自动记账；缺商品名或金额时追问；条码和参考价查询不自动入账。

## Data Model

`ExpenseItem` 字段：

- `id/title/amount/currency/category/date`
- `quantity/unitPrice/merchant/note`
- `barcode/brand/spec/productImageUrl/attachmentIds`
- `source/createdAt/updatedAt`

默认分类：

- 奶粉、尿裤、辅食、衣物、玩具、医疗健康、疫苗体检、日用品、教育娱乐、其他

## Product Lookup Policy

- 条码查询只辅助填充商品名、品牌、规格、分类和图片候选。
- 商品查询结果不自动生成消费金额。
- AI 联网或商品参考价只能作为候选信息，真实入账金额必须来自用户输入或确认。
- 免费源命中率和国内商品覆盖有限，后续可接入 TianAPI、探数等国内付费条码源。

## Permissions

- 账本属于家庭共享数据。
- 照护人可新增、编辑、删除账本记录。
- 仅查看成员可浏览账本和分析，不可写入。
- 大额修改和删除在前端需要确认，避免误操作。

## Verification

- 后端 `mvn test` 覆盖支出语义抽取、EffectPolicy 记账边界、家庭共享和只读权限。
- 前端 `npm run build` 覆盖类型和生产构建。
- Android debug 构建覆盖原生扫码插件编译。
- iOS simulator debug 构建覆盖 Swift 扫码插件编译。

## Follow-Ups

- 国内商品条码 API key 配置后可提升国内母婴商品命中率。
- 可扩展发票/OCR、电商订单导入、预算提醒和更多维度支出趋势。
- 真机需验证扫码识别率、摄像头权限文案、不同条码格式和弱网商品查询体验。
