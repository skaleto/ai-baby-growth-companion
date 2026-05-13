# 小宝记云端自动化测试结果

- 运行时间：2026-05-13T07:52:20.035Z
- Run ID：20260513075220
- API：http://120.55.188.242:8300
- 前端：http://localhost:5173
- 照护人账号：139****9998
- 只读账号：139****9997
- 汇总：10 passed / 0 skipped / 0 failed / 10 total
- JSON 结果：.verification/cloud-feature-e2e/result-20260513075220.json

## 用例结果

| 用例 | 优先级 | 功能 | 结果 | 准出标准 | 备注 |
| --- | --- | --- | --- | --- | --- |
| CLOUD-API-001 | P0 | 云端健康与真实凭证 | passed | 健康 ok；邀请码有效；照护人可登录；已有成员预检命中。 | {"health":"ok","family":"自动化宝宝5638家","role":"其他","authFlow":"existing-member"} |
| AUTH-UI-001 | P0 | 已注册用户登录体验 | passed | 登录页显示已识别身份，不再展示角色和照护人选择。 | {"loggedIn":true} |
| SHELL-LAYOUT-001 | P0 | App 壳、导航与移动适配 | passed | 六个 Tab 可切换，移动视口无横向溢出和控制台错误。 | {"screenshots":[".verification/cloud-feature-e2e/layout-iphone-se-375x667.png",".verification/cloud-feature-e2e/layout-iphone-13-390x844.png",".verification/cloud-feature-e2e/layout-iphone-pro-max-430x932.png",".verification/cloud-feature-e2e/layout-android-compact-360x800.png",".verification/cloud-feature-e2e/layout-a |
| STATE-PERM-001 | P0 | 状态读取与只读权限 | passed | 照护人可读状态；只读账号写入返回 403；只读 UI 不展示写入口。 | {"viewer":"139****9997","writeStatus":403} |
| LEDGER-CRUD-001 | P0 | 账本新增编辑删除 | passed | 新增、编辑、删除均反映到真实云端状态，删除有二次确认。 | {"title":"自动化E2E-20260513075220-奶粉","editedAmount":23.45} |
| REMINDER-CRUD-001 | P0 | 提醒新增完成删除 | passed | 新建提醒、完成确认、删除确认均生效，云端状态同步。 | {"completed":"自动化E2E-20260513075220-完成提醒","deleted":"自动化E2E-20260513075220-删除提醒"} |
| RECORDS-VIEWS-001 | P0 | 记录三视图 | passed | 今日、趋势、日历都可渲染并无横向溢出。 | {"views":["今日","趋势","日历"]} |
| ALBUM-VIEWS-001 | P1 | 相册分类与预览 | passed | 分类可切换；有素材可预览，无素材显示空态。 | {"previewItems":0} |
| PROFILE-VIEW-001 | P0 | 我的页资料 | passed | 资料、身份、照护人、后端接口可见。 | {"backend":"http://120.55.188.242:8300"} |
| CHAT-LIVE-001 | P1 | 真实 Agent 文本链路 | passed | 真实发送文本并收到 AI 回复；不出现服务不可用。 | {"messages":0} |

## 清理记录

- 已清理提醒 reminder-mp3ri3ga-6hvho3
