// 内测阶段的精简版静态法律/说明文本。
// 这里只放“要点摘要”，正式完整文本以 docs/commercialization/privacy-policy-draft.md
// 和 terms-draft.md 为准；正式上架前需替换为审阅过的完整法律文本。
// TODO(legal): 替换为正式隐私政策 / 用户协议 / 儿童信息说明完整文本。

export type LegalDocId = "privacy" | "terms" | "children";

export interface LegalDoc {
  id: LegalDocId;
  title: string;
  // 低焦虑、口语化的要点摘要；不出现任何内部字段名。
  sections: { heading: string; paragraphs: string[] }[];
  footnote: string;
}

const FOOTNOTE = "以上为内测阶段的要点摘要，方便你快速了解。完整条款会在正式版本中提供。";

export const LEGAL_DOCS: Record<LegalDocId, LegalDoc> = {
  privacy: {
    id: "privacy",
    title: "隐私政策（摘要）",
    sections: [
      {
        heading: "我们会用到哪些信息",
        paragraphs: [
          "为了帮你记录和陪伴宝宝成长，我们会用到你填写的宝宝资料、你记录的日常照护内容、成长情况、相册里的照片视频，以及你和 AI 的对话。",
          "我们也会记录登录信息和基础的运行信息（比如版本、平台），用来保证 App 正常使用。",
        ],
      },
      {
        heading: "我们怎么使用这些信息",
        paragraphs: [
          "这些信息用于：帮你的家庭一起记录、提供提醒和相册、整理成长趋势，以及让 AI 帮你整理和陪伴。",
          "我们不会把宝宝的信息用于广告推荐或商业画像。",
        ],
      },
      {
        heading: "你的掌控",
        paragraphs: [
          "记录都保存在你连接的家庭后端里，家庭成员之间共享；你和 AI 的对话只属于你的账号。",
          "你删除的内容不会再进入后续的 AI 整理。内测阶段如需删除账号或数据，可以联系内测负责人。",
        ],
      },
    ],
    footnote: FOOTNOTE,
  },
  terms: {
    id: "terms",
    title: "用户协议（摘要）",
    sections: [
      {
        heading: "这是什么",
        paragraphs: [
          "这是一款帮家庭记录和陪伴宝宝成长的工具，提供记录、提醒、相册、成长趋势和 AI 辅助整理。",
          "它不是医疗服务，不提供诊断或用药建议。遇到发热、用药、疫苗或异常情况，请咨询医生或正规机构。",
        ],
      },
      {
        heading: "内测阶段说明",
        paragraphs: [
          "当前是小范围内测版本，可能不太稳定，AI 也可能会理解错。请把它当成帮手，重要的健康决定还是要听医生的。",
          "使用即表示你理解这些情况，并愿意提供一些反馈帮我们改进。",
        ],
      },
      {
        heading: "你的责任",
        paragraphs: [
          "请只邀请获得授权的家庭成员加入，不上传违法或不当内容，也不要把 AI 的回复当作医学依据。",
        ],
      },
    ],
    footnote: FOOTNOTE,
  },
  children: {
    id: "children",
    title: "儿童信息说明",
    sections: [
      {
        heading: "关于宝宝的信息",
        paragraphs: [
          "这款产品由家长或照护人使用，记录的对象通常是你的宝宝。请确保你是宝宝的监护人，或已获得监护人同意来记录和管理这些信息。",
        ],
      },
      {
        heading: "我们的做法",
        paragraphs: [
          "我们会尽量只收集记录和陪伴所需要的信息，不会把宝宝的信息用于广告或商业画像。",
          "你随时可以删除照片、视频或记录；删除的内容不会再进入后续的 AI 整理。",
        ],
      },
    ],
    footnote: FOOTNOTE,
  },
};

// AI 数据使用说明（短文案，info 入口里展示）。
export const AI_DATA_NOTICE_TITLE = "AI 会怎么用你的记录";
export const AI_DATA_NOTICE_PARAGRAPHS = [
  "为了帮你整理和陪伴，AI 会读取你的照护记录、成长情况、相册里的附件，以及你们的对话。",
  "整理结果只用于帮你做记录整理和一般科普，不能替代医生。",
  "你删除的记录不会再进入后续的整理。",
];
