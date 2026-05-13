# 小宝记云端自动化测试用例与准出标准

## 运行目标

本套脚本基于 `docs/feature-inventory.md` 的功能清单生成，默认验证真实云端后端：

- 默认 API：`http://120.55.188.242:8300`
- 默认前端：脚本临时启动本地 Vite，构建出的页面真实请求云端 API
- 测试账号：使用现有云端测试账号，不使用 mock 后端
- 数据策略：脚本只创建带 `自动化E2E-<runId>` 前缀的账本、提醒和聊天数据，并在用例结束后尽量清理

运行前需要提供至少一个照护人测试账号。推荐使用已加入测试家庭的手机号 + 邀请码，这样可以直接覆盖登录页预检：

```bash
E2E_CAREGIVER_PHONE=13800000000 \
E2E_CAREGIVER_INVITE=123456 \
npm run test:cloud-e2e
```

如果只有一个未加入过任何家庭的新测试手机号，可以显式打开新成员入家保护阀。脚本会先用该手机号加入测试家庭，随后再验证“已注册用户再次登录不再要求选择角色和照护人”：

```bash
E2E_CAREGIVER_PHONE=13900001111 \
E2E_CAREGIVER_INVITE=123456 \
E2E_ALLOW_CAREGIVER_ONBOARDING=1 \
E2E_CAREGIVER_ROLE=测试 \
E2E_CAREGIVER_IS_CAREGIVER=true \
npm run test:cloud-e2e
```

如需覆盖只读成员权限，还需提供：

```bash
E2E_VIEWER_PHONE=13800000001 \
E2E_VIEWER_INVITE=123456 \
E2E_ALLOW_VIEWER_ONBOARDING=1 \
E2E_VIEWER_ROLE=亲友 \
E2E_VIEWER_IS_CAREGIVER=false
```

也可以复制模板文件后再运行，避免每次在命令行里粘贴凭证：

```bash
cp scripts/cloud-feature-e2e.env.example scripts/cloud-feature-e2e.env.local
# 编辑 scripts/cloud-feature-e2e.env.local，填入真实云端测试账号
npm run test:cloud-e2e
```

`scripts/cloud-feature-e2e.env.local` 已加入 `.gitignore`，不要提交真实手机号和邀请码。

## 准出总标准

- 云端 `/api/health` 返回 `ok`。
- 照护人测试账号能真实登录，并且已注册用户登录页不再要求选择角色和是否照护人。
- P0 用例全部通过；只读账号未配置时，只读专项记为 `skipped`，不能替代完整准出。
- 所有视口没有横向溢出、白屏、关键按钮不可达、控制台 error 或未捕获异常。
- 账本、提醒等测试新增数据完成后从云端清理；清理失败必须在结果报告中列出。
- 每次运行都留存 JSON 和 Markdown 报告，路径为 `.verification/cloud-feature-e2e/` 和 `docs/automation-test-results.md`。

## 用例清单

| 用例 ID | 优先级 | 功能范围 | 自动化步骤 | 准出标准 |
| --- | --- | --- | --- | --- |
| CLOUD-API-001 | P0 | 云端健康与真实凭证 | 调用 `/api/health`、`/api/auth/invite/roles`、`/api/auth/login`。 | 健康检查为 `ok`；邀请码有效；照护人登录返回 token、family、member；已有成员预检 `existingMember=true`，或在显式打开新成员入家保护阀时完成测试账号入家。 |
| AUTH-UI-001 | P0 | 已注册用户登录体验 | 打开登录页，输入照护人手机号和邀请码，等待角色预检。 | 页面显示“已识别家庭身份”；不显示“加入家庭前先确认身份”；点击登录进入应用。 |
| SHELL-LAYOUT-001 | P0 | App 壳、导航与移动适配 | 在 `375x667`、`390x844`、`430x932`、`360x800`、`412x915`、`432x960` 视口切换 `聊天 / 记录 / 账本 / 相册 / 提醒 / 我的`。 | 每个 Tab 可进入；文档和关键面板无横向溢出；底部导航可见；无 console error/page error。 |
| STATE-PERM-001 | P0 | 真实状态和只读权限 | 照护人读取 `/api/app/state`；如配置只读账号，再登录只读账号并尝试写 `expenses`。 | 状态返回 profile/careLogs/albumItems/expenses 等集合；只读账号写接口返回 403；只读 UI 不展示写入口。 |
| LEDGER-CRUD-001 | P0 | 账本手动记账 | 照护人进入账本，新增一笔支出，切到明细，编辑金额，再删除并确认。 | 新增支出进入明细和统计；编辑后金额更新；删除弹出自定义二次确认；确认后云端不再返回该支出。 |
| REMINDER-CRUD-001 | P0 | 提醒创建、完成、删除 | 照护人创建一次性通知提醒；点击完成并确认；再创建一条提醒并删除确认。 | 提醒卡展示时间模式、提醒方式和状态；完成必须二次确认；删除必须二次确认；删除后云端不再返回该提醒。 |
| RECORDS-VIEWS-001 | P0 | 记录 Tab 三视图 | 进入记录页，切换 `今日 / 趋势 / 日历`。 | 今日总览、近 7 天图表、月历均正常渲染；视图切换后无横向溢出。 |
| ALBUM-VIEWS-001 | P1 | 相册分类与预览入口 | 进入相册，切换分类；若存在素材，打开第一项预览并关闭。 | 分类按钮可切换；有素材时预览弹层可打开关闭；无素材时显示空状态。 |
| PROFILE-VIEW-001 | P0 | 我的页资料和运行信息 | 进入我的页，检查小宝资料、家庭、身份、照护人和后端接口。 | 显示当前家庭、我的身份、家庭照护人、后端接口；照护人账号有编辑入口。 |
| CHAT-LIVE-001 | P1 | 真实 Agent 链路 | 照护人发送“自动化连通性检查”文本消息。 | 用户消息和 AI 回复出现；没有“AI 服务暂时不可用”；脚本运行后尽量删除本轮测试消息。 |

## 不在常规云端 E2E 中强跑的能力

- 原生 Android/iOS 全屏闹铃、系统通知、麦克风权限和相册权限需要真机专项；本脚本只验证 Web 层调度数据和 UI。
- 真实 ASR 不在默认脚本中跑，避免测试环境占用麦克风和依赖实时音频输入。
- AI 医疗高风险、图片/视频理解、OSS 大文件上传可作为专项脚本；常规脚本先覆盖核心 CRUD、权限、导航和 Agent 可用性。
