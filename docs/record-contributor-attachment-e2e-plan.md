# 记录人展示与账本附件补齐计划

## Summary

记录、账本、相册统一使用“记录人”作为前端展示名词。后端在读取家庭共享数据时根据 `created_by_user_id` 补充记录人信息；账本记录如果只有 `attachmentIds`，读取时自动水合成可预览的 `attachments`。前端在记录时间线、账本明细、相册素材上展示记录人，并在账本明细中展示图片/视频/语音附件入口。

## Scope

- 记录 Tab：当天时间线展示“记录人：角色名”。
- 账本 Tab：支出明细展示“记录人：角色名”；支出关联附件展示缩略图并支持点击预览。
- 相册 Tab：相册素材卡展示标题和“记录人：角色名”。
- 后端：`growthEvents/careLogs/albumItems/expenses` 等家庭共享集合按记录行的创建人补充 `recordedBy`。
- 后端：`attachmentId/attachmentIds` 自动补充附件元数据，避免账本只拿到附件 id 无法展示。
- 云端数据：核查 18915618653 家庭中 8887.24 支出是否有关联附件，并确保上线后可读取展示。

## Cloud Data Finding

- 用户：`18915618653`
- 家庭：`family-eb3f4751-2df9-46b4-920e-6634c4013d50`
- 支出：`expense-1`
- 金额：`8887.24`
- 标题：`芊宝出生住院生产花费`
- 已有关联附件：`attachment-mp2lomag-chc0xt`
- 附件来源：2026-05-12 12:22 左右用户聊天上传的 `IMG_6667.jpg`

结论：该笔账本 payload 已带 `attachmentIds`，不需要直接改生产数据库；本次通过后端读取水合和前端展示即可让附件出现在账本明细里。

## Verification Plan

- `npm run build`
- 后端 `AppStateControllerTests` 覆盖记录人回填、相册 `attachmentId` 水合、账本 `attachmentIds` 水合。
- `npm run verify:frontend` 覆盖移动端 UI 布局与新增展示区域。
- 云端 e2e：
  - 创建/编辑/删除账本支出；
  - 给测试支出追加附件；
  - 验证云端 state 返回 `recordedBy` 和 `attachments`；
  - 验证 UI 账本明细展示记录人并可打开附件预览；
  - 创建记录时间线并验证“记录人”展示。

## Rollback

代码回滚即可恢复旧读取行为。生产数据库未做结构迁移；8887.24 账本记录原本已带附件 id，本次没有直接改动这条历史业务数据。
