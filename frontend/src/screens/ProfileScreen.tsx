// 我的页(自 App.tsx 上帝类拆出——架构债 D1/Records 轮,D12:整屏进 screens/)。
// React.memo + 稳定 handlers;DOM 与拆分前逐字一致。props 偏多(auth/Pro/AI 用量/家庭管理
// 四个子域)——D6 SessionContext 落地后 profile/auth/canCaregive 走 context 再瘦身。
import { memo, type Dispatch, type FormEvent, type SetStateAction } from "react";
import { Bell, ChevronRight, PencilLine, RefreshCw, Save, Sparkles, Trash2, Users, X } from "lucide-react";
import { AiDataNotice } from "../components/AiDataNotice";
import { StorySelect, selectOptionsWithCurrent } from "../components/StorySelect";
import { AppDateField } from "../components/appWheelFields";
import { FEEDING_SELECT_OPTIONS, GENDER_SELECT_OPTIONS, REGION_SELECT_OPTIONS, STAGE_SELECT_OPTIONS } from "../appOptions";
import { ageLabel, displayProfileValue, formatFullDate, stageLabel } from "../appStateDomain";
import { aiUsageFeatureLabel, aiUsageModelLabel, formatTokenCount } from "../utils/aiUsage";
import { apiBaseUrl } from "../authApi";
import type { AiUsageSummary, BabyProfile, ProTrialStatus } from "../types";
import type { AuthFamily, AuthMember, AuthUser, FamilyMember, FamilyMembersResponse } from "../authApi";
import type { LegalDocId } from "../legalContent";
import type { RuntimeVersionInfo } from "../App";
import companionAvatarIcon from "../assets/storybook-icons/companion-avatar.png";
import profileIcon from "../assets/storybook-icons/profile.png";

export type ProfileScreenHandlers = {
  startProfileEditing: () => void;
  cancelProfileEditing: () => void;
  handleProfileSubmit: (event: FormEvent) => void;
  handleLogout: () => void;
  handleToggleMemberCaregiver: (member: FamilyMember) => void;
  handleRemoveFamilyMember: (member: FamilyMember) => void;
  handleResetFamilyInviteCode: () => void;
  openReminderManagement: () => void;
  refreshAiUsageSummary: (options?: { quiet?: boolean }) => void;
  applyForProTrial: (source: string) => void;
  redeemProTrialCode: () => void;
};

export type ProfileScreenProps = {
  profile: BabyProfile;
  profileDraft: BabyProfile;
  isProfileEditing: boolean;
  allergiesText: string;
  canCaregive: boolean;
  actionableReminderCount: number;
  authUser: AuthUser | null;
  authFamily: AuthFamily | null;
  authMember: AuthMember | null;
  familyMembers: FamilyMembersResponse | null;
  familyMembersStatus: "idle" | "loading" | "ready" | "error";
  familyMemberBusyUserId: string | null;
  resetInviteCodeValue: string | null;
  proTrial: ProTrialStatus;
  isApplyingProTrial: boolean;
  isRedeemingProCode: boolean;
  redeemCodeInput: string;
  aiUsageSummary: AiUsageSummary | null;
  aiUsageStatus: "idle" | "loading" | "ready" | "error";
  runtimeVersion: RuntimeVersionInfo;
  setProfileDraft: Dispatch<SetStateAction<BabyProfile>>;
  setAllergiesText: Dispatch<SetStateAction<string>>;
  setRedeemCodeInput: Dispatch<SetStateAction<string>>;
  setSettingsLegalDoc: Dispatch<SetStateAction<LegalDocId | null>>;
  handlers: ProfileScreenHandlers;
};

export const ProfileScreen = memo(function ProfileScreen({
  profile,
  profileDraft,
  isProfileEditing,
  allergiesText,
  canCaregive,
  actionableReminderCount,
  authUser,
  authFamily,
  authMember,
  familyMembers,
  familyMembersStatus,
  familyMemberBusyUserId,
  resetInviteCodeValue,
  proTrial,
  isApplyingProTrial,
  isRedeemingProCode,
  redeemCodeInput,
  aiUsageSummary,
  aiUsageStatus,
  runtimeVersion,
  setProfileDraft,
  setAllergiesText,
  setRedeemCodeInput,
  setSettingsLegalDoc,
  handlers,
}: ProfileScreenProps) {
  const {
    startProfileEditing,
    cancelProfileEditing,
    handleProfileSubmit,
    handleLogout,
    handleToggleMemberCaregiver,
    handleRemoveFamilyMember,
    handleResetFamilyInviteCode,
    openReminderManagement,
    refreshAiUsageSummary,
    applyForProTrial,
    redeemProTrialCode,
  } = handlers;
  // 派生值屏内计算(若由 App 内联传入,每渲染新引用会击穿 memo)。
  const proApplicationPending = proTrial.application?.status === "pending";
  const proStatusText = proTrial.enabled ? "Pro 内测已开通" : proApplicationPending ? "Pro 内测申请中" : "可申请 Pro 内测";
  const aiUsageTopFeatures = Array.isArray(aiUsageSummary?.byFeature) ? aiUsageSummary.byFeature.slice(0, 3) : [];
  const aiUsageTopModel = Array.isArray(aiUsageSummary?.byModel) ? aiUsageSummary.byModel[0] : undefined;
  return (
        <section className="profile-screen tab-content-enter" aria-label="我的">
          <>
          <div className="screen-head">
            <div className="screen-heading-with-icon">
              <img className="screen-head-icon" src={profileIcon} alt="" />
              <div>
                <p className="eyebrow">我的</p>
                <h2>小宝信息</h2>
              </div>
            </div>
            {isProfileEditing ? (
              <button className="screen-action-button quiet" type="button" onClick={cancelProfileEditing}>
                取消
              </button>
            ) : canCaregive ? (
              <button className="screen-action-button" type="button" onClick={startProfileEditing}>
                <PencilLine size={16} />
                编辑
              </button>
            ) : (
              <span className="readonly-pill">仅查看</span>
            )}
          </div>

          <section className="profile-panel app-profile-card">
            <div className="baby-photo">
              <div className="photo-sky" />
              <div className="photo-baby">
                <img className="storybook-photo-icon" src={companionAvatarIcon} alt="" />
              </div>
            </div>
            <div className="profile-copy">
              <h2>{profile.nickname}</h2>
              <p>{stageLabel(profile.stage)} · {ageLabel(profile.birthDate)} · {displayProfileValue(profile.region)}</p>
            </div>
            <div className="profile-highlights">
              <div>
                <span>喂养</span>
                <strong>{displayProfileValue(profile.feeding)}</strong>
              </div>
              <div>
                <span>照护人</span>
                <strong>{profile.caregivers.length} 位</strong>
              </div>
            </div>
          </section>

          {!isProfileEditing ? (
            <section className="profile-detail-card">
              <div className="profile-detail-row">
                <span>阶段</span>
                <strong>{stageLabel(profile.stage)}</strong>
              </div>
              <div className="profile-detail-row">
                <span>出生日期</span>
                <strong>{formatFullDate(profile.birthDate)}</strong>
              </div>
              <div className="profile-detail-row">
                <span>预产期</span>
                <strong>{formatFullDate(profile.expectedDate)}</strong>
              </div>
              <div className="profile-detail-row">
                <span>地区</span>
                <strong>{displayProfileValue(profile.region)}</strong>
              </div>
              <div className="profile-detail-row">
                <span>家庭</span>
                <strong>{authFamily?.name ?? "小宝家"}</strong>
              </div>
              <div className="profile-detail-row">
                <span>我的身份</span>
                <strong>{authMember?.roleName ?? "家庭成员"} · {canCaregive ? "照护人" : "仅查看"}</strong>
              </div>
              <div className="profile-detail-row profile-version-row">
                <span>OTA 版本</span>
                <strong>{runtimeVersion.otaVersion}</strong>
              </div>
              <div className="profile-detail-row profile-version-row">
                <span>运行状态</span>
                <strong>{runtimeVersion.status} · {runtimeVersion.platform}</strong>
              </div>
              <div className="profile-detail-row profile-version-row">
                <span>原生版本</span>
                <strong>{runtimeVersion.nativeVersion}</strong>
              </div>
              <div className="profile-detail-row profile-version-row">
                <span>后端接口</span>
                <strong>{apiBaseUrl}</strong>
              </div>
              <div className="profile-detail-group">
                <span>过敏信息</span>
                <div className="profile-chip-list">
                  {profile.allergies.map((item) => (
                    <strong key={item}>{item}</strong>
                  ))}
                </div>
              </div>
              <div className="profile-detail-group family-member-group">
                <span>家庭照护人</span>
                <div className="profile-chip-list">
                  {profile.caregivers.map((item) => (
                    <strong key={item}>{item}</strong>
                  ))}
                </div>
              </div>
              <button type="button" className="profile-reminder-card" onClick={openReminderManagement}>
                <span className="profile-reminder-card__icon" aria-hidden="true">
                  <Bell size={18} />
                </span>
                <span className="profile-reminder-card__copy">
                  <strong>提醒管理</strong>
                  <small>
                    {actionableReminderCount > 0
                      ? `${actionableReminderCount} 个未完成待办，到点会提醒`
                      : "暂无未完成待办，可以管理疫苗、喂药和照护事项"}
                  </small>
                </span>
                <ChevronRight size={17} aria-hidden="true" />
              </button>
              <section className="profile-pro-card">
                <div className="daily-summary-head">
                  <div>
                    <span className="section-kicker">Pro 内测</span>
                    <h3>{proStatusText}</h3>
                  </div>
                  <span className={`pro-status-pill ${proTrial.enabled ? "enabled" : proApplicationPending ? "pending" : ""}`}>
                    {proTrial.enabled ? "家庭共享" : proApplicationPending ? "等待开通" : "可申请"}
                  </span>
                </div>
                <p>Pro 内测：图片/视频整理、账本 AI 等所有 AI 助手记录均不限次。Free 用户每月可免费体验，用完后申请内测即可继续。</p>
                {!proTrial.enabled && typeof proTrial.freeCallsRemaining === "number" ? (
                  <p className="pro-free-quota-note">
                    本月免费 AI 体验还剩 <b>{proTrial.freeCallsRemaining}</b>
                    {typeof proTrial.freeMonthlyQuota === "number" ? ` / ${proTrial.freeMonthlyQuota}` : ""} 次
                  </p>
                ) : null}
                <div className="ai-usage-panel" aria-label="AI 用量">
                  <div className="ai-usage-head">
                    <div>
                      <span>近 {aiUsageSummary?.days ?? 30} 天 AI 用量</span>
                      <strong>{aiUsageStatus === "loading" && !aiUsageSummary ? "读取中" : `${formatTokenCount(aiUsageSummary?.totalTokens)} tokens`}</strong>
                    </div>
                    <button
                      type="button"
                      className="ai-usage-refresh"
                      onClick={() => void refreshAiUsageSummary({ quiet: false })}
                      disabled={aiUsageStatus === "loading"}
                      aria-label="刷新 AI 用量"
                      title="刷新 AI 用量"
                    >
                      <RefreshCw size={16} />
                    </button>
                  </div>
                  {aiUsageSummary ? (
                    <>
                      <div className="ai-usage-metrics">
                        <span>
                          <small>调用</small>
                          <b>{formatTokenCount(aiUsageSummary.requestCount)}</b>
                        </span>
                        <span>
                          <small>输入</small>
                          <b>{formatTokenCount(aiUsageSummary.inputTokens)}</b>
                        </span>
                        <span>
                          <small>输出</small>
                          <b>{formatTokenCount(aiUsageSummary.outputTokens)}</b>
                        </span>
                      </div>
                      {aiUsageTopFeatures.length ? (
                        <div className="ai-usage-breakdown">
                          {aiUsageTopFeatures.map((item) => (
                            <span key={item.key}>
                              {aiUsageFeatureLabel(item.feature)}
                              <b>{formatTokenCount(item.totalTokens)}</b>
                            </span>
                          ))}
                        </div>
                      ) : null}
                      <p className="ai-usage-note">
                        {aiUsageTopModel ? `主要模型：${aiUsageModelLabel(aiUsageTopModel)}` : "还没有可统计的 AI 调用。"}
                        {aiUsageSummary.unmeteredRequestCount > 0 ? ` 另有 ${aiUsageSummary.unmeteredRequestCount} 次流式调用暂未回传 token。` : ""}
                      </p>
                    </>
                  ) : (
                    <p className="ai-usage-note">{aiUsageStatus === "error" ? "用量暂时读取失败，可以稍后刷新。" : "正在读取家庭 AI 用量。"}</p>
                  )}
                </div>
                {/* R1 (REQ-PRO-001): Pro gating 已启用，非 Pro 家庭展示申请入口 */}
                {!proTrial.enabled ? (
                  <>
                    <div className="pro-redeem-row">
                      <input
                        className="pro-redeem-input"
                        type="text"
                        autoCapitalize="characters"
                        placeholder="输入内测码"
                        value={redeemCodeInput}
                        onChange={(event) => setRedeemCodeInput(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") void redeemProTrialCode();
                        }}
                        disabled={isRedeemingProCode}
                        aria-label="输入内测码"
                      />
                      <button
                        className="pro-redeem-button"
                        type="button"
                        onClick={() => void redeemProTrialCode()}
                        disabled={isRedeemingProCode || !redeemCodeInput.trim()}
                      >
                        {isRedeemingProCode ? "兑换中" : "兑换"}
                      </button>
                    </div>
                    <button
                      className="screen-action-button"
                      type="button"
                      onClick={() => void applyForProTrial("profile")}
                      disabled={isApplyingProTrial || proApplicationPending}
                    >
                      <Sparkles size={16} />
                      {proApplicationPending ? "已提交申请" : "没有码？申请 Pro 内测"}
                    </button>
                  </>
                ) : null}
              </section>
              <section className="profile-detail-card family-members-card" aria-label="家庭成员">
                <div className="family-members-head">
                  <span className="section-kicker"><Users size={14} aria-hidden="true" /> 家庭成员</span>
                  {familyMembers?.canManage ? (
                    <button
                      type="button"
                      className="family-invite-reset"
                      onClick={() => void handleResetFamilyInviteCode()}
                      disabled={familyMemberBusyUserId === "__reset__"}
                    >
                      <RefreshCw size={14} aria-hidden="true" /> 重置邀请码
                    </button>
                  ) : null}
                </div>
                {familyMembersStatus === "loading" && !familyMembers ? (
                  <p className="family-members-empty">正在加载家庭成员…</p>
                ) : familyMembers && familyMembers.members.length ? (
                  <ul className="family-members-list">
                    {familyMembers.members.map((member) => (
                      <li key={member.userId} className="family-member-row">
                        <div className="family-member-main">
                          <strong>{member.roleName}{member.self ? "（我）" : ""}</strong>
                          <small>{member.maskedPhone || "—"} · {member.caregiver ? "照护人" : "仅查看"}</small>
                        </div>
                        {familyMembers.canManage && !member.self ? (
                          <div className="family-member-actions">
                            <button
                              type="button"
                              onClick={() => void handleToggleMemberCaregiver(member)}
                              disabled={familyMemberBusyUserId === member.userId}
                            >
                              {member.caregiver ? "设为仅查看" : "设为照护人"}
                            </button>
                            <button
                              type="button"
                              className="family-member-remove"
                              onClick={() => void handleRemoveFamilyMember(member)}
                              disabled={familyMemberBusyUserId === member.userId}
                              aria-label={`移除 ${member.roleName}`}
                            >
                              <Trash2 size={15} aria-hidden="true" />
                            </button>
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="family-members-empty">
                    还没有其他成员。{familyMembers?.canManage ? "把邀请码发给家人即可加入。" : ""}
                  </p>
                )}
                {resetInviteCodeValue ? (
                  <div className="family-invite-result">
                    <span>新邀请码（仅显示这一次，请发给家人）</span>
                    <strong>{resetInviteCodeValue}</strong>
                  </div>
                ) : null}
              </section>
              {canCaregive ? (
                <button className="profile-edit-button" type="button" onClick={startProfileEditing}>
                  <PencilLine size={18} />
                  编辑小宝资料
                </button>
              ) : (
                <p className="readonly-copy">当前身份可以查看家庭共享记录，不能修改小宝资料或写入照护日志。</p>
              )}
              <section className="profile-detail-card profile-legal-card" aria-label="隐私与说明">
                <div className="profile-legal-links">
                  <button type="button" className="profile-legal-link" onClick={() => setSettingsLegalDoc("privacy")}>
                    <span>隐私政策</span>
                    <ChevronRight size={16} aria-hidden="true" />
                  </button>
                  <button type="button" className="profile-legal-link" onClick={() => setSettingsLegalDoc("terms")}>
                    <span>用户协议</span>
                    <ChevronRight size={16} aria-hidden="true" />
                  </button>
                  <button type="button" className="profile-legal-link" onClick={() => setSettingsLegalDoc("children")}>
                    <span>儿童信息说明</span>
                    <ChevronRight size={16} aria-hidden="true" />
                  </button>
                </div>
                <div className="profile-legal-ai-row">
                  <span>AI 会怎么用你的记录</span>
                  <AiDataNotice />
                </div>
              </section>
              <button className="profile-logout-button" type="button" onClick={() => void handleLogout()}>
                退出登录{(authUser?.maskedPhone ?? authUser?.phone) ? `（${authUser?.maskedPhone ?? authUser?.phone}）` : ""}
              </button>
            </section>
          ) : (
            <form className="profile-form" onSubmit={handleProfileSubmit}>
              <label>
                <span>昵称</span>
                <input
                  value={profileDraft.nickname}
                  onChange={(event) => setProfileDraft((current) => ({ ...current, nickname: event.target.value }))}
                />
              </label>
              <label>
                <span>阶段</span>
                <StorySelect
                  ariaLabel="小宝阶段"
                  value={profileDraft.stage}
                  options={STAGE_SELECT_OPTIONS}
                  onChange={(stage) =>
                    setProfileDraft((current) => ({ ...current, stage }))
                  }
                />
              </label>
              <label>
                <span>性别</span>
                <StorySelect
                  ariaLabel="小宝性别"
                  value={profileDraft.gender}
                  options={GENDER_SELECT_OPTIONS}
                  onChange={(gender) => setProfileDraft((current) => ({ ...current, gender }))}
                />
              </label>
              <label>
                <span>出生日期</span>
                <AppDateField
                  value={profileDraft.birthDate}
                  onChange={(value) => setProfileDraft((current) => ({ ...current, birthDate: value }))}
                />
              </label>
              <label>
                <span>预产期</span>
                <AppDateField
                  value={profileDraft.expectedDate}
                  onChange={(value) =>
                    setProfileDraft((current) => ({ ...current, expectedDate: value }))
                  }
                />
              </label>
              <label>
                <span>出生体重（kg）</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  placeholder="选填，用于生长曲线起点"
                  value={profileDraft.birthWeight ?? ""}
                  onChange={(event) =>
                    setProfileDraft((current) => ({
                      ...current,
                      birthWeight: event.target.value ? Number(event.target.value) : undefined,
                    }))
                  }
                />
              </label>
              <label>
                <span>出生身长（cm）</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  min="0"
                  placeholder="选填，用于生长曲线起点"
                  value={profileDraft.birthHeight ?? ""}
                  onChange={(event) =>
                    setProfileDraft((current) => ({
                      ...current,
                      birthHeight: event.target.value ? Number(event.target.value) : undefined,
                    }))
                  }
                />
              </label>
              <label>
                <span>地区</span>
                <StorySelect
                  ariaLabel="地区"
                  value={profileDraft.region}
                  options={selectOptionsWithCurrent(REGION_SELECT_OPTIONS, profileDraft.region)}
                  onChange={(region) => setProfileDraft((current) => ({ ...current, region }))}
                />
              </label>
              <label>
                <span>喂养方式</span>
                <StorySelect
                  ariaLabel="喂养方式"
                  value={profileDraft.feeding}
                  options={selectOptionsWithCurrent(FEEDING_SELECT_OPTIONS, profileDraft.feeding)}
                  onChange={(feeding) => setProfileDraft((current) => ({ ...current, feeding }))}
                />
              </label>
              <label>
                <span>过敏信息</span>
                <input value={allergiesText} onChange={(event) => setAllergiesText(event.target.value)} />
              </label>
              <div className="profile-form-note">
                <strong>家庭照护人</strong>
                <span>{profile.caregivers.join("、") || "暂无照护人"}</span>
                <small>照护人来自家庭成员，不能在小宝资料里手动修改。</small>
              </div>
              <div className="profile-form-actions">
                <button className="cancel-profile-button" type="button" onClick={cancelProfileEditing}>
                  <X size={18} />
                  取消
                </button>
                <button className="save-profile-button" type="submit">
                  <Save size={18} />
                  保存
                </button>
              </div>
            </form>
          )}
          </>
        </section>
  );
});
