// FE/BE 契约防护(评审 P6,呼应 appStateContract 的 D10 防线)——鉴权/家庭一族。
//
// 登录链路(用户刚经历过"确认家庭身份"故障)与家庭成员页对后端数组字段有裸访问:
//   - useSessionState:`result.occupiedRoles.filter(...)`(邀请码角色解析)
//   - ProfileScreen:`familyMembers.members.map(...)` / `.length`
// 后端一旦省略/回 null,这些 `.filter/.map/.length` 会在深处白屏。本模块在 authApi 拿到响应后把这些
// 数组字段归一为数组、布尔字段归一为布尔;登录响应的 user/family/member 对象**不臆造默认值**
// (登录网关若真缺这些字段,伪造会静默放行错误权限,比抛错更危险——留给调用方失败)。
//
// 纯模块红线:仅 `import type`(编译期擦除)引用 authApi 的响应类型,绝不 import 其运行时代码
// (authApi 依赖 window/localStorage/import.meta.env,非纯);可被 esbuild 逻辑测试在 Node 打包。
import type { AuthMember, FamilyMember, FamilyMembersResponse, InviteRoleOptionsResponse } from "./authApi";

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as UnknownRecord) : {};

const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

const asText = (value: unknown): string => (typeof value === "string" ? value : "");

const asMemberOrNull = (value: unknown): AuthMember | null => {
  if (!value || typeof value !== "object") return null;
  const record = value as UnknownRecord;
  return { roleName: asText(record.roleName), caregiver: Boolean(record.caregiver) };
};

/** 邀请码角色选项:三组角色数组恒为字符串数组,existingMember 恒为布尔,member 缺失 → null。 */
export const normalizeInviteRoleOptions = (raw: unknown): InviteRoleOptionsResponse => {
  const value = asRecord(raw);
  return {
    familyName: asText(value.familyName),
    occupiedRoles: asStringArray(value.occupiedRoles),
    uniqueRoles: asStringArray(value.uniqueRoles),
    repeatableRoles: asStringArray(value.repeatableRoles),
    existingMember: Boolean(value.existingMember),
    member: asMemberOrNull(value.member),
  };
};

/** 家庭成员列表:members 恒为数组(逐条保留后端字段,仅剔除非对象条目),canManage 恒为布尔。 */
export const normalizeFamilyMembers = (raw: unknown): FamilyMembersResponse => {
  const value = asRecord(raw);
  const members = Array.isArray(value.members)
    ? value.members.filter((item): item is FamilyMember => Boolean(item) && typeof item === "object")
    : [];
  return { members, canManage: Boolean(value.canManage) };
};
