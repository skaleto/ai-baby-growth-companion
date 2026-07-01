// 鉴权前的早返回屏(自 App.tsx 上帝类拆出——架构债 D1 轮,分类法 D12:整屏进 screens/)。
// 三屏:确认登录中(AuthSplash)/ 登录(LoginScreen)/ 首次引导(OnboardingScreen)。
// 仅在鉴权完成前展示,不在主界面热渲染路径里,故 React.memo + 普通 props 即可,无需 ref 稳定器。
// DOM 结构与拆分前逐字一致(CSS/快照测试不感知);函数闭包仍在 App 侧定义并透传。
import { memo, type Dispatch, type FormEvent, type ReactNode, type SetStateAction } from "react";
import {
  FEEDING_SELECT_OPTIONS,
  GENDER_SELECT_OPTIONS,
  REGION_SELECT_OPTIONS,
  ROLE_OPTIONS,
  STAGE_SELECT_OPTIONS,
  type SelectOption,
} from "../appOptions";
import { initialProfile } from "../data";
import { suggestedFamilyName } from "../appStateDomain";
import { AppDateField } from "../components/appWheelFields";
import { StorySelect, selectOptionsWithCurrent } from "../components/StorySelect";
import { AuthScene } from "../components/AuthScene";
import { AuthBrand } from "../components/AuthBrand";
import { StorybookScene } from "../components/StorybookScene";
import companionIcon from "../assets/storybook-icons/companion.png";
import type { AuthFamily, AuthMember, AuthUser } from "../authApi";
import type { BabyProfile } from "../types";

export type AuthSplashProps = {
  systemWeakNoticeView: ReactNode;
};

export const AuthSplash = memo(function AuthSplash({ systemWeakNoticeView }: AuthSplashProps) {
  return (
    <main className="app-shell auth-shell auth-splash">
      <AuthScene />
      {systemWeakNoticeView}
      <div className="auth-splash-content">
        <AuthBrand />
        <p className="auth-splash-status">正在确认登录状态...</p>
        <span className="loading-stars auth-loading" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      </div>
    </main>
  );
});

export type LoginScreenProps = {
  systemWeakNoticeView: ReactNode;
  handleLoginSubmit: (event: FormEvent) => void;
  loginPhone: string;
  setLoginPhone: Dispatch<SetStateAction<string>>;
  loginInviteCode: string;
  setLoginInviteCode: Dispatch<SetStateAction<string>>;
  loginExistingMember: AuthMember | null;
  inviteRoleHint: string;
  inviteFamilyName: string;
  loginRoleName: "" | (typeof ROLE_OPTIONS)[number];
  loginRoleOptions: Array<SelectOption<"" | (typeof ROLE_OPTIONS)[number]>>;
  setLoginRoleName: Dispatch<SetStateAction<"" | (typeof ROLE_OPTIONS)[number]>>;
  isCheckingInviteRoles: boolean;
  loginCaregiver: boolean | null;
  setLoginCaregiver: Dispatch<SetStateAction<boolean | null>>;
  loginError: string;
  isLoggingIn: boolean;
  loginReady: boolean;
};

export const LoginScreen = memo(function LoginScreen({
  systemWeakNoticeView,
  handleLoginSubmit,
  loginPhone,
  setLoginPhone,
  loginInviteCode,
  setLoginInviteCode,
  loginExistingMember,
  inviteRoleHint,
  inviteFamilyName,
  loginRoleName,
  loginRoleOptions,
  setLoginRoleName,
  isCheckingInviteRoles,
  loginCaregiver,
  setLoginCaregiver,
  loginError,
  isLoggingIn,
  loginReady,
}: LoginScreenProps) {
  return (
    <main className="app-shell auth-shell">
      {systemWeakNoticeView}
      <section className="auth-panel">
        <StorybookScene />
        <div>
          <p className="eyebrow">本地家庭私有部署</p>
          <h1>欢迎回来</h1>
          <p>用手机号和家庭邀请码登录，宝宝记录只保存在你连接的本地后端。</p>
        </div>
        <form className="auth-form" onSubmit={handleLoginSubmit}>
          <label>
            <span>手机号</span>
            <input
              inputMode="tel"
              autoComplete="tel"
              placeholder="请输入 11 位手机号"
              value={loginPhone}
              onChange={(event) => setLoginPhone(event.target.value)}
            />
          </label>
          <label>
            <span>邀请码</span>
            <input
              autoCapitalize="characters"
              autoComplete="one-time-code"
              placeholder="输入家庭邀请码"
              value={loginInviteCode}
              onChange={(event) => setLoginInviteCode(event.target.value)}
            />
          </label>
          {loginExistingMember ? (
            <div className="auth-join-options compact" aria-label="已注册家庭身份">
              <div>
                <strong>已识别家庭身份</strong>
                <small>
                  {inviteRoleHint || `你已经是${inviteFamilyName || "这个家庭"}的成员，本次登录会沿用原身份。`}
                </small>
              </div>
            </div>
          ) : (
            <div className="auth-join-options" aria-label="加入家庭身份设置">
              <div>
                <strong>加入家庭前先确认身份</strong>
                <small>新手机号第一次使用家庭邀请码时，会按这里的选择加入{inviteFamilyName || "对应家庭"}。</small>
              </div>
              <label>
                <span>家庭身份</span>
                <StorySelect
                  ariaLabel="家庭身份"
                  value={loginRoleName}
                  options={loginRoleOptions}
                  onChange={setLoginRoleName}
                />
                {isCheckingInviteRoles || inviteRoleHint ? (
                  <small className="auth-role-hint">
                    {isCheckingInviteRoles ? "正在确认家庭身份..." : inviteRoleHint}
                  </small>
                ) : null}
              </label>
              <div className="auth-permission-choice">
                <span>权限</span>
                <div className="auth-choice-row" role="radiogroup" aria-label="是否照护人">
                  <button
                    type="button"
                    className={loginCaregiver === true ? "selected" : ""}
                    aria-pressed={loginCaregiver === true}
                    onClick={() => setLoginCaregiver(true)}
                  >
                    <strong>照护人</strong>
                    <small>可聊天记录、上传和完成提醒</small>
                  </button>
                  <button
                    type="button"
                    className={loginCaregiver === false ? "selected" : ""}
                    aria-pressed={loginCaregiver === false}
                    onClick={() => setLoginCaregiver(false)}
                  >
                    <strong>仅查看</strong>
                    <small>只能查看家庭记录和提醒</small>
                  </button>
                </div>
              </div>
            </div>
          )}
          {loginError ? <p className="auth-error">{loginError}</p> : null}
          <button type="submit" disabled={isLoggingIn || !loginReady}>
            {isLoggingIn ? "登录中..." : "登录"}
          </button>
        </form>
      </section>
    </main>
  );
});

export type OnboardingScreenProps = {
  systemWeakNoticeView: ReactNode;
  canCaregive: boolean;
  authFamily: AuthFamily | null;
  authMember: AuthMember | null;
  authUser: AuthUser | null;
  handleLogout: () => void | Promise<void>;
  onboardingStep: number;
  setOnboardingStep: Dispatch<SetStateAction<number>>;
  onboardingDraft: BabyProfile;
  setOnboardingDraft: Dispatch<SetStateAction<BabyProfile>>;
  onboardingFamilyName: string;
  setOnboardingFamilyName: Dispatch<SetStateAction<string>>;
  onboardingAllergiesText: string;
  setOnboardingAllergiesText: Dispatch<SetStateAction<string>>;
  onboardingFamilyNameTouchedRef: { current: boolean };
  saveOnboardingProfile: (event: FormEvent) => void;
  loginError: string;
  profile: BabyProfile;
};

export const OnboardingScreen = memo(function OnboardingScreen({
  systemWeakNoticeView,
  canCaregive,
  authFamily,
  authMember,
  authUser,
  handleLogout,
  onboardingStep,
  setOnboardingStep,
  onboardingDraft,
  setOnboardingDraft,
  onboardingFamilyName,
  setOnboardingFamilyName,
  onboardingAllergiesText,
  setOnboardingAllergiesText,
  onboardingFamilyNameTouchedRef,
  saveOnboardingProfile,
  loginError,
  profile,
}: OnboardingScreenProps) {
  if (!canCaregive) {
    return (
      <main className="app-shell auth-shell">
        {systemWeakNoticeView}
        <section className="auth-panel onboarding-panel">
          <StorybookScene />
            <div className="onboarding-head">
            <div className="brand-mark">
              <img className="storybook-brand-icon" src={companionIcon} alt="" />
            </div>
            <div>
              <p className="eyebrow">{authFamily?.name ?? "小宝家"}</p>
              <h1>等待照护人完成设置</h1>
            </div>
          </div>
          <p className="viewer-empty-copy">
            你当前是{authMember?.roleName ?? "家庭成员"}，仅可查看家庭记录。等照护人设置好小宝资料后，你刷新就能查看记录、提醒和趋势。
          </p>
          <button className="profile-logout-button" type="button" onClick={() => void handleLogout()}>
            退出登录{(authUser?.maskedPhone ?? authUser?.phone) ? `（${authUser?.maskedPhone ?? authUser?.phone}）` : ""}
          </button>
        </section>
      </main>
    );
  }
  const progress = onboardingStep + 1;
  return (
    <main className="app-shell auth-shell">
      {systemWeakNoticeView}
      <section className="auth-panel onboarding-panel">
        <StorybookScene />
        <div className="onboarding-head">
          <div className="brand-mark">
            <img className="storybook-brand-icon" src={companionIcon} alt="" />
          </div>
          <div>
            <p className="eyebrow">首次设置</p>
            <h1>先认识一下小宝</h1>
          </div>
          <span>{progress}/3</span>
        </div>
        <form className="auth-form onboarding-form" onSubmit={saveOnboardingProfile}>
          {onboardingStep === 0 ? (
            <>
              <label>
                <span>小宝昵称</span>
                <input
                  placeholder="比如：小宝"
                  value={onboardingDraft.nickname}
                  onChange={(event) => setOnboardingDraft((current) => ({ ...current, nickname: event.target.value }))}
                />
              </label>
              <label>
                <span>家庭名称</span>
                <input
                  placeholder="比如：芊芊家"
                  value={onboardingFamilyName}
                  onChange={(event) => {
                    onboardingFamilyNameTouchedRef.current = true;
                    setOnboardingFamilyName(event.target.value);
                  }}
                  onBlur={() => {
                    if (!onboardingFamilyName.trim()) {
                      onboardingFamilyNameTouchedRef.current = false;
                      setOnboardingFamilyName(suggestedFamilyName(onboardingDraft.nickname || initialProfile.nickname));
                    }
                  }}
                />
              </label>
              <label>
                <span>阶段</span>
                <StorySelect
                  ariaLabel="小宝阶段"
                  value={onboardingDraft.stage}
                  options={STAGE_SELECT_OPTIONS}
                  onChange={(stage) =>
                    setOnboardingDraft((current) => ({
                      ...current,
                      stage,
                    }))
                  }
                />
              </label>
              <label>
                <span>性别</span>
                <StorySelect
                  ariaLabel="小宝性别"
                  value={onboardingDraft.gender}
                  options={GENDER_SELECT_OPTIONS}
                  onChange={(gender) => setOnboardingDraft((current) => ({ ...current, gender }))}
                />
              </label>
              <label>
                <span>{onboardingDraft.stage === "born" ? "出生日期" : "预产期"}</span>
                <AppDateField
                  value={onboardingDraft.stage === "born" ? onboardingDraft.birthDate : onboardingDraft.expectedDate}
                  onChange={(value) =>
                    setOnboardingDraft((current) =>
                      current.stage === "born"
                        ? { ...current, birthDate: value }
                        : { ...current, expectedDate: value },
                    )
                  }
                />
              </label>
            </>
          ) : null}
          {onboardingStep === 1 ? (
            <>
              <label>
                <span>所在地区</span>
                <StorySelect
                  ariaLabel="所在地区"
                  value={onboardingDraft.region}
                  options={selectOptionsWithCurrent(REGION_SELECT_OPTIONS, onboardingDraft.region)}
                  onChange={(region) => setOnboardingDraft((current) => ({ ...current, region }))}
                />
              </label>
              <label>
                <span>喂养方式</span>
                <StorySelect
                  ariaLabel="喂养方式"
                  value={onboardingDraft.feeding}
                  options={selectOptionsWithCurrent(FEEDING_SELECT_OPTIONS, onboardingDraft.feeding)}
                  onChange={(feeding) => setOnboardingDraft((current) => ({ ...current, feeding }))}
                />
              </label>
            </>
          ) : null}
          {onboardingStep === 2 ? (
            <>
              <label>
                <span>过敏信息</span>
                <input value={onboardingAllergiesText} onChange={(event) => setOnboardingAllergiesText(event.target.value)} />
              </label>
              <div className="profile-form-note">
                <strong>家庭照护人</strong>
                <span>{profile.caregivers.join("、") || "会按加入家庭的成员自动生成"}</span>
                <small>照护人来自家庭邀请码成员，不需要在这里手动填写。</small>
              </div>
              <p className="onboarding-note">这些资料会帮 AI 更稳地整理记录，你之后也能在“我的”里修改。</p>
            </>
          ) : null}
          {loginError ? <p className="auth-error">{loginError}</p> : null}
          <div className="onboarding-actions">
            {onboardingStep > 0 ? (
              <button type="button" className="quiet" onClick={() => setOnboardingStep((step) => Math.max(0, step - 1))}>
                上一步
              </button>
            ) : null}
            {onboardingStep < 2 ? (
              <button type="button" onClick={() => setOnboardingStep((step) => Math.min(2, step + 1))}>
                下一步
              </button>
            ) : (
              <button type="submit">完成设置</button>
            )}
          </div>
        </form>
      </section>
    </main>
  );
});
