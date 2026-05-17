export type MilestoneCategory = "motor" | "cognitive" | "social" | "language" | "feeding";

export type GrowthMilestone = {
  id: string;
  ageMonthMin: number;
  ageMonthMax: number;
  category: MilestoneCategory;
  title: string;
  hint: string;
};

export const MILESTONE_CATEGORY_LABEL: Record<MilestoneCategory, string> = {
  motor: "大动作",
  cognitive: "认知",
  social: "社交",
  language: "语言",
  feeding: "进食",
};

export const MILESTONE_CATEGORY_COLOR: Record<MilestoneCategory, string> = {
  motor: "#7eafd8",
  cognitive: "#b894d4",
  social: "#e8a45e",
  language: "#8ac4a8",
  feeding: "#d88276",
};

/**
 * 0-12 月常见发育里程碑参考。来源：WHO 0–6 岁儿童发育里程碑参考 + 国内儿保科普共识。
 * 每个孩子节奏不同，提前/落后 1-2 个月都很正常；本列表只供日常关注，不构成诊断建议。
 */
export const GROWTH_MILESTONES: GrowthMilestone[] = [
  { id: "m-track-eye", ageMonthMin: 0, ageMonthMax: 2, category: "cognitive", title: "眼神追物", hint: "能用视线追随移动的玩具或人脸。" },
  { id: "m-lift-head", ageMonthMin: 0, ageMonthMax: 3, category: "motor", title: "趴着抬头", hint: "俯卧时短暂把头抬离床面。" },
  { id: "m-social-smile", ageMonthMin: 1, ageMonthMax: 3, category: "social", title: "应答微笑", hint: "看到熟悉的家人会回应式微笑。" },
  { id: "m-coo", ageMonthMin: 1, ageMonthMax: 3, category: "language", title: "发出咿呀声", hint: "发出元音类的「啊、哦」等声音。" },

  { id: "m-roll-over", ageMonthMin: 3, ageMonthMax: 6, category: "motor", title: "翻身", hint: "从仰卧翻到俯卧（或反过来）。" },
  { id: "m-grasp", ageMonthMin: 3, ageMonthMax: 5, category: "motor", title: "主动抓握", hint: "看到喜欢的东西主动伸手抓住。" },
  { id: "m-laugh-out", ageMonthMin: 3, ageMonthMax: 5, category: "social", title: "笑出声", hint: "被逗时发出咯咯的笑声。" },
  { id: "m-respond-name", ageMonthMin: 4, ageMonthMax: 7, category: "cognitive", title: "对名字有反应", hint: "听到自己名字会转头看人。" },

  { id: "m-sit-alone", ageMonthMin: 6, ageMonthMax: 8, category: "motor", title: "独坐", hint: "不需要支撑能独立坐稳一会儿。" },
  { id: "m-first-tooth", ageMonthMin: 4, ageMonthMax: 10, category: "feeding", title: "长出第一颗牙", hint: "多数从下门牙先萌出。" },
  { id: "m-babble", ageMonthMin: 6, ageMonthMax: 9, category: "language", title: "重复音节", hint: "发出 ba-ba、ma-ma 等连串音节。" },
  { id: "m-pass-toy", ageMonthMin: 6, ageMonthMax: 9, category: "motor", title: "两手传物", hint: "左右手互相传递玩具。" },
  { id: "m-peek-a-boo", ageMonthMin: 7, ageMonthMax: 10, category: "social", title: "玩躲猫猫", hint: "对躲猫猫游戏笑出来或主动配合。" },
  { id: "m-find-hidden", ageMonthMin: 8, ageMonthMax: 12, category: "cognitive", title: "找藏起来的玩具", hint: "看着东西被藏起来后会主动去找。" },

  { id: "m-pull-stand", ageMonthMin: 8, ageMonthMax: 11, category: "motor", title: "扶物站起", hint: "抓住家具或大人能自己站起来。" },
  { id: "m-self-feed", ageMonthMin: 8, ageMonthMax: 12, category: "feeding", title: "自己抓食物", hint: "用手指捏起小块食物送进嘴里。" },
  { id: "m-cruise", ageMonthMin: 9, ageMonthMax: 12, category: "motor", title: "扶走", hint: "扶着家具或大人能向前迈步。" },
  { id: "m-wave-bye", ageMonthMin: 9, ageMonthMax: 12, category: "social", title: "挥手再见", hint: "看到大人挥手会模仿挥手。" },
  { id: "m-first-word", ageMonthMin: 9, ageMonthMax: 14, category: "language", title: "说第一个有意义的字", hint: "比如 mama / baba 指特定的人。" },
  { id: "m-point", ageMonthMin: 10, ageMonthMax: 14, category: "cognitive", title: "用手指指物", hint: "用食指指向感兴趣的东西。" },
];

export const milestoneTag = (id: string) => `milestone:${id}`;

export const milestoneIdFromTags = (tags: string[] | undefined): string | undefined => {
  if (!tags) return undefined;
  for (const tag of tags) {
    if (tag.startsWith("milestone:")) return tag.slice("milestone:".length);
  }
  return undefined;
};
