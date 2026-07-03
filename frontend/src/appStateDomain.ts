// 评审 P7:本文件已从「1027 行、82 导出、跨 ~10 关注点的上帝文件」拆成 domain/ 下的内聚子模块,
// 这里只保留纯 re-export barrel——所有既有 `import { ... } from "./appStateDomain"` 的 23 处消费方零改动继续编译。
// 具体实现按关注点分布在 domain/*.ts:
//   coerce        类型强制/取值原语(textValue/numberValue/stringList/...)
//   localAppState localStorage 遗留缓存探测/清理/迁移标记
//   dateTime      中文口语时间解析 + 本地日期键 + 日历/年龄格式化
//   media         附件/记录人/相册项归一化
//   expense       支出记账归一化
//   profile       宝宝档案归一化 + 年龄派生
//   care          护理日志/事件归一化 + 去重 + 标题标签单一来源
//   reminder      提醒解析/归一化/排期
//   growth        成长事件/体格测量归一化
//   misc          聊天/记忆/会话摘要/Pro 试用/待生效副作用(聚合层)
// 依赖是单向 DAG(barrel 不参与):coerce/localAppState → dateTime → media/profile → expense/care/growth/reminder → misc。
// 红线:domain/ 子模块之间只允许直接 import 兄弟子模块或外部纯模块,绝不 import 本 barrel(否则成环)。

export * from "./domain/coerce";
export * from "./domain/localAppState";
export * from "./domain/dateTime";
export * from "./domain/media";
export * from "./domain/expense";
export * from "./domain/profile";
export * from "./domain/care";
export * from "./domain/reminder";
export * from "./domain/growth";
export * from "./domain/misc";
