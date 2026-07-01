// 会话(登录鉴权 / 邀请码登录 / 引导建档 / 资料编辑 / 家庭成员管理 / Pro 内测 / AI 用量)
// 一族的状态与逻辑。
//
// 从 App.tsx 这个巨型组件里原样抽出 session 一族的 state / refs / effect / 处理函数,
// 行为与抽出前逐字节一致——只是搬家,不改运行时语义。登录/引导/资料编辑/家庭成员管理/
// Pro 内测/AI 用量必须与从前完全一致地工作。
//
// 调用约定(Option B,沿用 ledger / reminders / records):App.tsx「提前」调用本 hook,并把返回值
// 解构回与原来同名的局部变量,因此 App.tsx 里其余引用一律照常编译。
//
// 排序约束(与 ledger/reminders/records 的关键差异):本 hook 产出 `authMember`,而 App 的
// `const canCaregive = authMember?.caregiver ?? true;` 必须读到它,且 canCaregive 又被
// ledger/reminders/records/album 各 hook 消费——故本 hook 必须在 canCaregive **之前**调用
// (排在所有 useXxxState 之前)。因此「在 hook 调用点之后才定义」的依赖集合比 records 大:
// canCaregive 本身、records hook 的 setRecordsEntryDrawer / setRecordsAssistantOpen、reminders
// hook 的 openReminderManagement,连同 showSystemWeakNotice / persistRecord /
// loadStateFromBackend / applyEmptyAppSnapshot 一律经 `lateRef` 注入(沿用 records 的
// recordsLateRef 模式);App 在它们都就绪后每次渲染都无条件刷新该 ref。它们只在事件处理函数 /
// effect 回调里于「点击/触发时」读取,call-time 不需要,故迟绑定不改运行时语义。
// 真正 call-time 需要的早期依赖(profile 用作 useState 初值与 profileDraft-sync effect 的 dep;
// setProfile / setActiveMobileTab / setStorageStatus / backendReadyRef / legacyLocalStateRef
// 都在调用点之前定义)按值传入。
//
// 留在 App.tsx 未迁(orchestration / 跨切面,见任务约束):
//  - `const canCaregive = ...`:众多 feature 依赖,读本 hook 解构出的 authMember;
//  - `bootstrapAuth` + 冷启动 boot useEffect / AUTH_EXPIRED 处理 / token 定时刷新:它们编排
//    auth + STORE 加载(loadStateFromBackend / applyAppSnapshot / cacheBackendState),只调用
//    本 hook 解构出的 session setters(setAuthStatus / setAuthUser / setOnboardingRequired …);
//  - `<LoginScreen/>` / `<OnboardingScreen/>` / `<ProfileScreen/>` 挂载与 prop 接线:读解构回的同名值。
import {
  type FormEvent,
  type MutableRefObject,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { type MobileTab, ROLE_OPTIONS, ROLE_SELECT_OPTIONS, UNIQUE_ROLE_OPTIONS } from "../../appOptions";
import { initialProfile } from "../../data";
import { blankProfile, clearLocalAppState, hasCompleteProfile, normalizeProTrialStatus, splitListText, suggestedFamilyName } from "../../appStateDomain";
import { appConfirm } from "../../components/appDialogs";
import { clearCachedSnapshot } from "../../appStateCache";
import { readAiUsageSummary, redeemProCode, submitProTrialApplication, type AppStateCollection, type AppStateResponse } from "../../appStateApi";
import {
  AuthFamily,
  AuthMember,
  AuthUser,
  clearAuthToken,
  getAuthToken,
  readInviteRoleOptions,
  loginWithInvite,
  logoutCurrentUser,
  readFamilyMembers,
  removeFamilyMember,
  resetFamilyInviteCode,
  updateFamilyMemberCaregiver,
  updateFamilyName,
  type FamilyMember,
  type FamilyMembersResponse,
} from "../../authApi";
import type { AiUsageSummary, BabyProfile, ProTrialStatus } from "../../types";
import type { AiUsageStatus, AuthStatus } from "../../appContracts";

// 在 hook 调用点之后才定义的依赖统一经 lateRef 注入(见顶部排序约束):
//  - canCaregive:App 在本 hook 之后才算出(它读本 hook 产出的 authMember);事件处理里读取。
//  - setRecordsEntryDrawer / setRecordsAssistantOpen:来自更晚调用的 useRecordsState(handleLogout 用)。
//      handleLogout 只调用 setRecordsEntryDrawer(null) / setRecordsAssistantOpen(false),按最小结构声明。
//  - openReminderManagement:来自更晚调用的 useRemindersState(profileScreenHandlers 包里用)。
//  - showSystemWeakNotice / persistRecord / loadStateFromBackend / applyEmptyAppSnapshot:App-local,定义更晚。
export type SessionLateDeps = {
  canCaregive: boolean;
  setRecordsEntryDrawer: (value: null) => void;
  setRecordsAssistantOpen: (value: false) => void;
  openReminderManagement: () => void;
  showSystemWeakNotice: (message: string, tone?: "info" | "success" | "warning", durationMs?: number) => void;
  persistRecord: <T,>(
    collection: AppStateCollection,
    id: string,
    item: T,
    options?: { applyResponse?: boolean; mode?: "merge" | "replace" },
  ) => Promise<AppStateResponse>;
  loadStateFromBackend: (
    options?: { importLegacy: boolean; onboardingRequired?: boolean; accountKey?: string | null },
  ) => Promise<AppStateResponse>;
  applyEmptyAppSnapshot: () => void;
};

export type UseSessionStateDeps = {
  profile: BabyProfile;
  setProfile: (action: SetStateAction<BabyProfile>) => void;
  setStorageStatus: (status: "loading" | "ready" | "offline") => void;
  setActiveMobileTab: (action: SetStateAction<MobileTab>) => void;
  backendReadyRef: MutableRefObject<boolean>;
  legacyLocalStateRef: MutableRefObject<boolean>;
  lateRef: MutableRefObject<SessionLateDeps>;
};

export function useSessionState({
  profile,
  setProfile,
  setStorageStatus,
  setActiveMobileTab,
  backendReadyRef,
  legacyLocalStateRef,
  lateRef,
}: UseSessionStateDeps) {
  const [authStatus, setAuthStatus] = useState<AuthStatus>(() => (getAuthToken() ? "checking" : "unauthenticated"));
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authFamily, setAuthFamily] = useState<AuthFamily | null>(null);
  const [authMember, setAuthMember] = useState<AuthMember | null>(null);
  const [proTrial, setProTrial] = useState<ProTrialStatus>(() => normalizeProTrialStatus(null));
  const [aiUsageSummary, setAiUsageSummary] = useState<AiUsageSummary | null>(null);
  const [aiUsageStatus, setAiUsageStatus] = useState<AiUsageStatus>("idle");
  const [familyMembers, setFamilyMembers] = useState<FamilyMembersResponse | null>(null);
  const [familyMembersStatus, setFamilyMembersStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [familyMemberBusyUserId, setFamilyMemberBusyUserId] = useState<string | null>(null);
  const [resetInviteCodeValue, setResetInviteCodeValue] = useState<string | null>(null);
  const [isApplyingProTrial, setIsApplyingProTrial] = useState(false);
  const [redeemCodeInput, setRedeemCodeInput] = useState("");
  const [isRedeemingProCode, setIsRedeemingProCode] = useState(false);
  const [onboardingRequired, setOnboardingRequired] = useState(false);
  const [loginPhone, setLoginPhone] = useState("");
  const [loginInviteCode, setLoginInviteCode] = useState("");
  const [loginRoleName, setLoginRoleName] = useState<"" | (typeof ROLE_OPTIONS)[number]>("");
  const [loginCaregiver, setLoginCaregiver] = useState<boolean | null>(null);
  const [loginExistingMember, setLoginExistingMember] = useState<AuthMember | null>(null);
  const [loginError, setLoginError] = useState("");
  const [occupiedInviteRoles, setOccupiedInviteRoles] = useState<string[]>([]);
  const [inviteRoleHint, setInviteRoleHint] = useState("");
  const [inviteFamilyName, setInviteFamilyName] = useState("");
  const [isCheckingInviteRoles, setIsCheckingInviteRoles] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [onboardingDraft, setOnboardingDraft] = useState<BabyProfile>({
    ...blankProfile,
    allergies: ["暂未发现"],
    caregivers: initialProfile.caregivers,
  });
  const [onboardingFamilyName, setOnboardingFamilyName] = useState(suggestedFamilyName(initialProfile.nickname));
  const onboardingFamilyNameTouchedRef = useRef(false);
  const [onboardingAllergiesText, setOnboardingAllergiesText] = useState("暂未发现");
  const [isProfileEditing, setIsProfileEditing] = useState(false);
  const [profileDraft, setProfileDraft] = useState<BabyProfile>(profile);
  const [allergiesText, setAllergiesText] = useState(profile.allergies.join("、"));

  const loginRoleOptions = useMemo(
    () =>
      ROLE_SELECT_OPTIONS.map((option) => {
        const occupied = option.value && occupiedInviteRoles.includes(option.value);
        return occupied
          ? { ...option, disabled: true, hint: "已被家庭成员使用" }
          : option;
      }),
    [occupiedInviteRoles],
  );
  const loginSelectedRoleOccupied = Boolean(loginRoleName && occupiedInviteRoles.includes(loginRoleName));
  const loginCredentialsReady = loginPhone.trim().replace(/\s+/g, "").length === 11 && loginInviteCode.trim().replace(/\s+/g, "").length >= 6;
  const loginReady = loginExistingMember
    ? loginCredentialsReady
    : Boolean(loginCredentialsReady && loginRoleName && loginCaregiver !== null && !loginSelectedRoleOccupied);

  const refreshAiUsageSummary = useCallback(async (options: { quiet?: boolean } = {}) => {
    setAiUsageStatus("loading");
    try {
      const summary = await readAiUsageSummary(30);
      setAiUsageSummary(summary);
      setAiUsageStatus("ready");
      if (!options.quiet) lateRef.current.showSystemWeakNotice("AI 用量已刷新。", "success");
    } catch (error) {
      setAiUsageStatus("error");
      if (!options.quiet) {
        lateRef.current.showSystemWeakNotice(error instanceof Error ? error.message : "AI 用量读取失败。", "warning");
      }
    }
  }, []);

  const refreshFamilyMembers = useCallback(async (options: { quiet?: boolean } = {}) => {
    setFamilyMembersStatus("loading");
    try {
      const data = await readFamilyMembers();
      setFamilyMembers(data);
      setFamilyMembersStatus("ready");
    } catch (error) {
      setFamilyMembersStatus("error");
      if (!options.quiet) {
        lateRef.current.showSystemWeakNotice(error instanceof Error ? error.message : "家庭成员读取失败。", "warning");
      }
    }
  }, []);

  const handleToggleMemberCaregiver = async (member: FamilyMember) => {
    if (member.self) return;
    const next = !member.caregiver;
    setFamilyMemberBusyUserId(member.userId);
    try {
      await updateFamilyMemberCaregiver(member.userId, next);
      lateRef.current.showSystemWeakNotice(next ? "已设为照护人。" : "已设为仅查看，对方需重新登录。", "success");
      await refreshFamilyMembers({ quiet: true });
    } catch (error) {
      lateRef.current.showSystemWeakNotice(error instanceof Error ? error.message : "权限调整失败。", "warning");
    } finally {
      setFamilyMemberBusyUserId(null);
    }
  };

  const handleRemoveFamilyMember = async (member: FamilyMember) => {
    if (member.self) return;
    if (!(await appConfirm({ title: "移除成员", content: `确定移除「${member.roleName}」吗？对方会被退出登录，需重新用邀请码加入。`, danger: true }))) return;
    setFamilyMemberBusyUserId(member.userId);
    try {
      await removeFamilyMember(member.userId);
      lateRef.current.showSystemWeakNotice("已移除该成员。", "success");
      await refreshFamilyMembers({ quiet: true });
    } catch (error) {
      lateRef.current.showSystemWeakNotice(error instanceof Error ? error.message : "移除失败。", "warning");
    } finally {
      setFamilyMemberBusyUserId(null);
    }
  };

  const handleResetFamilyInviteCode = async () => {
    if (!(await appConfirm({ title: "重置邀请码", content: "重置后旧邀请码立即失效（已加入的成员不受影响）。确定重置？" }))) return;
    setFamilyMemberBusyUserId("__reset__");
    try {
      const result = await resetFamilyInviteCode();
      setResetInviteCodeValue(result.inviteCode);
      lateRef.current.showSystemWeakNotice("邀请码已重置，请把新码发给家人。", "success");
    } catch (error) {
      lateRef.current.showSystemWeakNotice(error instanceof Error ? error.message : "重置邀请码失败。", "warning");
    } finally {
      setFamilyMemberBusyUserId(null);
    }
  };

  const applyForProTrial = async (source: string) => {
    setIsApplyingProTrial(true);
    try {
      const status = await submitProTrialApplication(source);
      setProTrial(normalizeProTrialStatus(status));
      lateRef.current.showSystemWeakNotice("已收到 Pro 内测申请，开通后会在 App 内提示你。", "success");
    } catch (error) {
      lateRef.current.showSystemWeakNotice(error instanceof Error ? error.message : "申请失败，请稍后再试。", "warning");
    } finally {
      setIsApplyingProTrial(false);
    }
  };

  const redeemProTrialCode = async () => {
    const code = redeemCodeInput.trim();
    if (!code || isRedeemingProCode) return;
    setIsRedeemingProCode(true);
    try {
      const status = await redeemProCode(code);
      setProTrial(normalizeProTrialStatus(status));
      setRedeemCodeInput("");
      lateRef.current.showSystemWeakNotice("内测码兑换成功，Pro 已开通。", "success");
    } catch (error) {
      lateRef.current.showSystemWeakNotice(error instanceof Error ? error.message : "兑换失败，请稍后再试。", "warning");
    } finally {
      setIsRedeemingProCode(false);
    }
  };

  useEffect(() => {
    const normalizedCode = loginInviteCode.trim();
    const compactCode = normalizedCode.replace(/\s+/g, "");
    const compactPhone = loginPhone.trim().replace(/\s+/g, "");
    if (compactCode.length < 6) {
      setOccupiedInviteRoles([]);
      setInviteRoleHint("");
      setInviteFamilyName("");
      setLoginExistingMember(null);
      setIsCheckingInviteRoles(false);
      return undefined;
    }

    let cancelled = false;
    setIsCheckingInviteRoles(true);
    const timer = window.setTimeout(() => {
      readInviteRoleOptions(normalizedCode, compactPhone.length === 11 ? compactPhone : undefined)
        .then((result) => {
          if (cancelled) return;
          const occupied = result.occupiedRoles.filter((role) =>
            (UNIQUE_ROLE_OPTIONS as readonly string[]).includes(role),
          );
          const familyName = result.familyName || "小宝家";
          setOccupiedInviteRoles(occupied);
          setInviteFamilyName(familyName);
          setLoginExistingMember(result.existingMember ? result.member ?? null : null);
          if (result.existingMember && result.member) {
            setInviteRoleHint(`已是 ${familyName} 的成员：${result.member.roleName} · ${result.member.caregiver ? "照护人" : "仅查看"}`);
          } else {
            setInviteRoleHint(
              occupied.length
                ? `${familyName} 已有：${occupied.join("、")}`
                : `${familyName} 可选择家庭身份`,
            );
          }
        })
        .catch((error) => {
          if (cancelled) return;
          setOccupiedInviteRoles([]);
          setInviteFamilyName("");
          setLoginExistingMember(null);
          setInviteRoleHint(error instanceof Error ? error.message : "邀请码暂时无法确认");
        })
        .finally(() => {
          if (!cancelled) setIsCheckingInviteRoles(false);
        });
    }, 260);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [loginInviteCode, loginPhone]);

  useEffect(() => {
    if (loginRoleName && occupiedInviteRoles.includes(loginRoleName)) {
      setLoginRoleName("");
    }
  }, [loginRoleName, occupiedInviteRoles]);

  useEffect(() => {
    if (!onboardingRequired || onboardingFamilyNameTouchedRef.current) return;
    const existingFamilyName = authFamily?.name?.trim() ?? "";
    const nextFamilyName =
      existingFamilyName && existingFamilyName !== "小宝家"
        ? existingFamilyName
        : suggestedFamilyName(onboardingDraft.nickname || initialProfile.nickname);
    setOnboardingFamilyName(nextFamilyName);
  }, [authFamily?.name, onboardingDraft.nickname, onboardingRequired]);

  useEffect(() => {
    if (authStatus !== "authenticated") {
      setAiUsageSummary(null);
      setAiUsageStatus("idle");
      return;
    }
    void refreshAiUsageSummary({ quiet: true });
    void refreshFamilyMembers({ quiet: true });
  }, [authStatus, refreshAiUsageSummary, refreshFamilyMembers]);

  useEffect(() => {
    setProfileDraft(profile);
    setAllergiesText(profile.allergies.join("、"));
  }, [profile]);

  const handleProfileSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!lateRef.current.canCaregive) return;
    const allergies = splitListText(allergiesText);

    const nextProfile: BabyProfile = {
      ...profileDraft,
      nickname: profileDraft.nickname.trim() || initialProfile.nickname,
      birthDate: profileDraft.birthDate || initialProfile.birthDate,
      expectedDate: profileDraft.expectedDate || initialProfile.expectedDate,
      region: profileDraft.region.trim(),
      feeding: profileDraft.feeding.trim(),
      allergies: allergies.length ? allergies : ["暂未发现"],
      caregivers: profile.caregivers.length ? profile.caregivers : initialProfile.caregivers,
    };
    setProfile(nextProfile);
    void lateRef.current.persistRecord("profile", "default", nextProfile, { applyResponse: true }).catch(() => undefined);
    setIsProfileEditing(false);
    setActiveMobileTab("profile");
  };

  const handleLoginSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (isLoggingIn) return;
    setLoginError("");
    if (!loginExistingMember && (!loginRoleName || loginCaregiver === null)) {
      setLoginError("请先选择家庭身份和是否照护人。");
      return;
    }
    setIsLoggingIn(true);
    try {
      const response = await loginWithInvite(
        loginPhone,
        loginInviteCode,
        loginExistingMember ? undefined : loginRoleName,
        loginExistingMember ? undefined : loginCaregiver,
      );
      setAuthUser(response.user);
      setAuthFamily(response.family);
      setAuthMember(response.member);
      await lateRef.current.loadStateFromBackend({
        importLegacy: response.member.caregiver && response.legacyImportAllowed && legacyLocalStateRef.current,
        onboardingRequired: response.onboardingRequired,
        accountKey: response.user.id,
      });
      setAuthStatus("authenticated");
      setActiveMobileTab("records");
      legacyLocalStateRef.current = false;
    } catch (error) {
      clearAuthToken();
      setLoginError(error instanceof Error ? error.message : "登录失败，请稍后再试。");
      setAuthStatus("unauthenticated");
      setStorageStatus("loading");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await logoutCurrentUser();
    backendReadyRef.current = false;
    setAuthUser(null);
    setAuthFamily(null);
    setAuthMember(null);
    setAuthStatus("unauthenticated");
    setOnboardingRequired(false);
    setStorageStatus("loading");
    setIsProfileEditing(false);
    lateRef.current.setRecordsEntryDrawer(null);
    lateRef.current.setRecordsAssistantOpen(false);
    setActiveMobileTab("records");
    setInviteFamilyName("");
    setLoginExistingMember(null);
    setOnboardingFamilyName(suggestedFamilyName(initialProfile.nickname));
    onboardingFamilyNameTouchedRef.current = false;
    clearLocalAppState();
    void clearCachedSnapshot(); // 退出登录清秒开缓存(账号隔离红线:下一个登录账号不得看到上一个的快照)
    legacyLocalStateRef.current = false;
    lateRef.current.applyEmptyAppSnapshot();
  };

  const saveOnboardingProfile = async (event: FormEvent) => {
    event.preventDefault();
    if (!lateRef.current.canCaregive) return;
    const allergies = splitListText(onboardingAllergiesText);
    const completedProfile: BabyProfile = {
      ...onboardingDraft,
      nickname: onboardingDraft.nickname.trim() || "小宝",
      birthDate: onboardingDraft.birthDate,
      expectedDate: onboardingDraft.expectedDate,
      region: onboardingDraft.region.trim(),
      feeding: onboardingDraft.feeding.trim(),
      allergies: allergies.length ? allergies : ["暂未发现"],
      caregivers: profile.caregivers.length ? profile.caregivers : initialProfile.caregivers,
    };

    if (!hasCompleteProfile(completedProfile)) {
      setOnboardingStep(0);
      return;
    }

    try {
      const nextFamilyName = (onboardingFamilyName.trim() || suggestedFamilyName(completedProfile.nickname)).slice(0, 30);
      const updatedFamily = await updateFamilyName(nextFamilyName);
      await lateRef.current.persistRecord("profile", "default", completedProfile, { applyResponse: true });
      setAuthFamily(updatedFamily);
      setOnboardingRequired(false);
      setActiveMobileTab("records");
      backendReadyRef.current = true;
      setStorageStatus("ready");
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "保存小宝资料失败，请稍后再试。");
    }
  };

  const resetProfileDraft = () => {
    setProfileDraft(profile);
    setAllergiesText(profile.allergies.join("、"));
  };

  const startProfileEditing = () => {
    if (!lateRef.current.canCaregive) return;
    resetProfileDraft();
    setIsProfileEditing(true);
  };

  const cancelProfileEditing = () => {
    resetProfileDraft();
    setIsProfileEditing(false);
  };

  // openReminderManagement 来自更晚调用的 useRemindersState,经 lateRef 注入;包一层稳定壳,
  // 让下方 profileHandlersRef / profileScreenHandlers 的结构与原 App.tsx 逐字节一致。
  const openReminderManagement = () => lateRef.current.openReminderManagement();

  // ProfileScreen(memo)的函数 props:ref 间接,引用恒稳。
  const profileHandlersRef = useRef({
    startProfileEditing, cancelProfileEditing, handleProfileSubmit, handleLogout,
    handleToggleMemberCaregiver, handleRemoveFamilyMember, handleResetFamilyInviteCode,
    openReminderManagement, refreshAiUsageSummary, applyForProTrial, redeemProTrialCode,
  });
  profileHandlersRef.current = {
    startProfileEditing, cancelProfileEditing, handleProfileSubmit, handleLogout,
    handleToggleMemberCaregiver, handleRemoveFamilyMember, handleResetFamilyInviteCode,
    openReminderManagement, refreshAiUsageSummary, applyForProTrial, redeemProTrialCode,
  };
  const [profileScreenHandlers] = useState(() => ({
    startProfileEditing: () => profileHandlersRef.current.startProfileEditing(),
    cancelProfileEditing: () => profileHandlersRef.current.cancelProfileEditing(),
    handleProfileSubmit: (event: FormEvent) => profileHandlersRef.current.handleProfileSubmit(event),
    handleLogout: () => { void profileHandlersRef.current.handleLogout(); },
    handleToggleMemberCaregiver: (member: FamilyMember) => { void profileHandlersRef.current.handleToggleMemberCaregiver(member); },
    handleRemoveFamilyMember: (member: FamilyMember) => { void profileHandlersRef.current.handleRemoveFamilyMember(member); },
    handleResetFamilyInviteCode: () => { void profileHandlersRef.current.handleResetFamilyInviteCode(); },
    openReminderManagement: () => profileHandlersRef.current.openReminderManagement(),
    refreshAiUsageSummary: (options?: { quiet?: boolean }) => { void profileHandlersRef.current.refreshAiUsageSummary(options); },
    applyForProTrial: (source: string) => { void profileHandlersRef.current.applyForProTrial(source); },
    redeemProTrialCode: () => { void profileHandlersRef.current.redeemProTrialCode(); },
  }));

  return {
    authStatus,
    setAuthStatus,
    authUser,
    setAuthUser,
    authFamily,
    setAuthFamily,
    authMember,
    setAuthMember,
    proTrial,
    setProTrial,
    aiUsageSummary,
    setAiUsageSummary,
    aiUsageStatus,
    setAiUsageStatus,
    familyMembers,
    setFamilyMembers,
    familyMembersStatus,
    setFamilyMembersStatus,
    familyMemberBusyUserId,
    setFamilyMemberBusyUserId,
    resetInviteCodeValue,
    setResetInviteCodeValue,
    isApplyingProTrial,
    setIsApplyingProTrial,
    redeemCodeInput,
    setRedeemCodeInput,
    isRedeemingProCode,
    setIsRedeemingProCode,
    onboardingRequired,
    setOnboardingRequired,
    loginPhone,
    setLoginPhone,
    loginInviteCode,
    setLoginInviteCode,
    loginRoleName,
    setLoginRoleName,
    loginCaregiver,
    setLoginCaregiver,
    loginExistingMember,
    setLoginExistingMember,
    loginError,
    setLoginError,
    occupiedInviteRoles,
    setOccupiedInviteRoles,
    inviteRoleHint,
    setInviteRoleHint,
    inviteFamilyName,
    setInviteFamilyName,
    isCheckingInviteRoles,
    setIsCheckingInviteRoles,
    isLoggingIn,
    setIsLoggingIn,
    onboardingStep,
    setOnboardingStep,
    onboardingDraft,
    setOnboardingDraft,
    onboardingFamilyName,
    setOnboardingFamilyName,
    onboardingFamilyNameTouchedRef,
    onboardingAllergiesText,
    setOnboardingAllergiesText,
    isProfileEditing,
    setIsProfileEditing,
    profileDraft,
    setProfileDraft,
    allergiesText,
    setAllergiesText,
    loginRoleOptions,
    loginSelectedRoleOccupied,
    loginCredentialsReady,
    loginReady,
    refreshAiUsageSummary,
    refreshFamilyMembers,
    handleToggleMemberCaregiver,
    handleRemoveFamilyMember,
    handleResetFamilyInviteCode,
    applyForProTrial,
    redeemProTrialCode,
    handleProfileSubmit,
    handleLoginSubmit,
    handleLogout,
    saveOnboardingProfile,
    resetProfileDraft,
    startProfileEditing,
    cancelProfileEditing,
    profileScreenHandlers,
  };
}
