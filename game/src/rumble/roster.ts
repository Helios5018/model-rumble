export type FighterId =
  | "deepseek"
  | "claude"
  | "gpt"
  | "gemini"
  | "qwen"
  | "grok"
  | "doubao"
  | "glm"
  | "kimi";
export type Skill = "light" | "heavy" | "special" | "utility" | "ultimate";
export interface Character {
  id: FighterId;
  name: string;
  title: string;
  model: string;
  color: string;
  accent: string;
  role: string;
  description: string;
  news: string;
  source: string;
  stats: [number, number, number, number];
  skills: [string, string, string];
  mechanics: [string, string, string];
}
export const ROSTER: Character[] = [
  {
    id: "deepseek",
    name: "DeepSeek",
    title: "深海鲸尾女仆",
    model: "V4.1 Flash",
    color: "#5297ff",
    accent: "#c8f5ff",
    role: "高效游击",
    description:
      "蓝色长卷发，白色小围裙，困困的眼睛还挂着口水。鲸尾一摆，用更少的算力掀起更大的浪。",
    news: "V4.1 Flash：多模态、百万上下文与 KV 缓存压缩。",
    source: "https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash",
    stats: [8, 6, 7, 9],
    skills: ["鲸费暴跌", "缓存瘦身", "鲸落 · 全场开源"],
    mechanics: [
      "吐出三枚低成本水弹，短冷却连续压制",
      "潜水压缩幻觉率 14%，回 18 算力并短暂无敌",
      "召唤巨鲸与五重浪潮，把对手冲出上下文",
    ],
  },
  {
    id: "claude",
    name: "Claude",
    title: "方块小克劳德",
    model: "Opus 5",
    color: "#ee9875",
    accent: "#ffdfb8",
    role: "防守反击",
    description:
      "四条小短腿，方方正正的原则。先说我不能帮助你，再用一套严谨的流程把你送出场。",
    news: "Opus 5：复杂推理、代理任务与可调思考投入。",
    source: "https://www.anthropic.com/news/claude-opus-5",
    stats: [5, 9, 9, 6],
    skills: ["我不能帮助你", "让我再想想", "四脚 · 规则践踏"],
    mechanics: [
      "亮起拒绝屏障，3 秒减伤 75%，强化下一击",
      "0.9 秒思考反击窗口：接住伤害，再原路退回",
      "放大方块身躯，四脚审查盖章，三轮地震击飞",
    ],
  },
  {
    id: "gpt",
    name: "GPT",
    title: "蓝云桌面宠物",
    model: "GPT-6 Astra",
    color: "#74e7ba",
    accent: "#ddffec",
    role: "全能切换",
    description:
      "蓝色云朵脑袋，屏幕上的 >_ 正在待命。平时蹲在桌面陪你，开打就把工具全家桶搬进竞技场。",
    news: "GPT-6 Astra：复杂推理、编码、计算机操作与长任务。",
    source: "https://developers.openai.com/api/docs/models/gpt-6-astra",
    stats: [7, 7, 8, 6],
    skills: ["工具全家桶", "这就帮你做", "Astra · 六手下班"],
    mechanics: [
      "浏览器、代码、终端三连工具弹",
      "切换效率 / 深度思考姿态：速度换伤害",
      "星环展开六只工具手，自动化连击替你下班",
    ],
  },
  {
    id: "gemini",
    name: "Gemini",
    title: "双子哈基米",
    model: "3.7 Flash",
    color: "#9b9bff",
    accent: "#e7cfff",
    role: "高速突袭",
    description:
      "哈基米，哈基米，哈基米。脑内单曲循环，场上双猫同频；Flash 的速度，用来踩最洗脑的拍子。",
    news: "Gemini 3.7 Flash：效率、开发体验与多模态能力。",
    source:
      "https://blog.google/innovation-and-ai/models-and-research/gemini-models/introducing-gemini-3-7-flash/",
    stats: [10, 4, 6, 8],
    skills: ["哈！基！米！", "双子猫猫拳", "曼波 · 多模态蹦迪"],
    mechanics: [
      "三拍音符弹，命中短暂减速，强行单曲循环",
      "Flash 突进猫猫拳，留下一只延迟补刀的星光猫",
      "四彩舞台与洗脑音浪，连续七拍把对手送走",
    ],
  },
  {
    id: "qwen",
    name: "Qwen",
    title: "千问小熊",
    model: "3.8 · LiveTranslate",
    color: "#b58aff",
    accent: "#eddaff",
    role: "分身协同",
    description:
      "白 T 恤，严肃眉头，软乎乎的熊。千问不如一熊，多语言都能听懂，熊掌落下也不需要翻译。",
    news: "Qwen 3.8 LiveTranslate：流式翻译与说话人识别。",
    source: "https://qwen.ai/blog?id=qwen3.8-livetranslate",
    stats: [8, 5, 7, 9],
    skills: ["千问不如一熊", "全世界都说熊声", "开源 · 熊多力量大"],
    mechanics: [
      "开源两只白衣小熊分身，自动发射熊掌",
      "LiveTranslate 熊吼音波，命中吸走 12 算力",
      "三只超频小熊齐上阵，熊掌弹幕覆盖战场",
    ],
  },
  {
    id: "grok",
    name: "Grok",
    title: "火星马老板",
    model: "4.6 · Grok Bot",
    color: "#e6eaf5",
    accent: "#8cbdff",
    role: "过载爆发",
    description:
      "黑 T 恤，火星梦，发布会永不散场。火箭可以炸，热搜不能停——下一次一定成功回收。",
    news: "Grok 4.6 与 Grok Bot：编码、代理与持续任务。",
    source: "https://x.ai/news/grok-4-6",
    stats: [6, 8, 10, 4],
    skills: ["星舰试射", "推文治公司", "筷子夹 · 成功回收"],
    mechanics: [
      "三枚星舰散射：爆炸也是宝贵的数据",
      "热搜过载 4 秒，加速增伤但自增 8% 幻觉率",
      "标记对手，三枚星舰垂直回收，筷子夹冲击落地",
    ],
  },
  {
    id: "doubao",
    name: "Doubao",
    title: "国民豆包",
    model: "Seed 2.1 · Seedance 2.5",
    color: "#ffb77a",
    accent: "#fff0c9",
    role: "节奏连击",
    description:
      "你熟悉的短发女孩，今天不只陪你聊天。上一秒认真哄你，下一秒把你的出糗剪成全网爆款。",
    news: "Seedance 2.5：30 秒叙事、精准参考和视频编辑。",
    source: "https://seed.bytedance.com/en/models",
    stats: [9, 5, 6, 10],
    skills: ["这题包在我身上", "豆包哄哄你", "Seedance · 全网都是你"],
    mechanics: [
      "语音气泡贴脸，命中后弹幕二次爆破",
      "温柔回血 8% 幻觉率，回 20 算力并加速",
      "长镜头弹幕追着拍，给对手安排七连爆款",
    ],
  },
  {
    id: "glm",
    name: "GLM",
    title: "牛来 · 手搓战神",
    model: "5.3",
    color: "#efb44e",
    accent: "#ffdf9b",
    role: "工程守备",
    description:
      "这个世界，终究是手搓的。橙色小牛带着侧目走来；可以绊倒，但代码必须站起来。",
    news: "GLM-5.3：开放权重、编码和安全研究能力。",
    source: "https://huggingface.co/zai-org/GLM-5.3",
    stats: [4, 10, 8, 7],
    skills: ["只能手搓，请见谅", "不是哥们 · 绊倒了", "中国牛会飞"],
    mechanics: [
      "当场手搓低模石墙，挡住 25 点弹道伤害",
      "假装绊倒，脸着地震出冲击波，命中定身 0.6 秒",
      "牛来腾空！三次牛蹄盖章，落地掀起金色方块震波",
    ],
  },
  {
    id: "kimi",
    name: "Kimi",
    title: "月面小猫",
    model: "K3 · Agent Swarm",
    color: "#ccd3ff",
    accent: "#f5e7ff",
    role: "蓄力奇袭",
    description:
      "月亮背面的小猫，正在悄悄思考。等群星连成一线，答案会出现在你的身后。",
    news: "Kimi K3：多模态与 Agent Swarm 协作。",
    source: "https://www.moonshot.ai/",
    stats: [6, 6, 9, 8],
    skills: ["月薪换算力", "猫在想，别催", "月面猫猫 · 全员打工"],
    mechanics: [
      "月下思考回 22 算力，下一击增伤 50%",
      "借月影瞬移到对手背后，猫爪补上一刀",
      "Agent Swarm 六只月猫从星轨出勤，轮番空降",
    ],
  },
];
export const character = (id: FighterId) => ROSTER.find((c) => c.id === id)!;
export const RESEARCH_DATE = "2026.09.20";
