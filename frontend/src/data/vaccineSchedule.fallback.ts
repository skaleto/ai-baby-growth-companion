// 疫苗清单内置兜底(纯模块,无 React/资源 import)。离线/首启/OSS 拉取失败时用这份。
// 数据经 Claude 深度研究 + Codex 交叉核对(2025–2026 现行),来源与把握度见
// docs/architecture/vaccine-data-research.md。完整/更新数据由 OSS vaccine-data.json 覆盖。
// 注:面向中文家长,苗名与说明一律中文为主;价格不写各省精确数(无可靠统一价表),统一「咨询接种点」,
// 参考区间放在说明里并标「以接种点为准」。
export type VaccineDoseClass = "nip" | "provincial" | "optional"; // 一类 / 省级增补 / 二类自费
export type RegionCode = "national" | "BJ" | "SH" | "GD" | "ZJ" | "JS";
export type DoseStatus = "done" | "overdue" | "closing" | "due" | "upcoming";

export type VaccineDose = {
  id: string;
  vaccine: string;
  doseNo: number;
  ageMonthMin: number;
  ageMonthMax: number;
  klass: VaccineDoseClass;
  region: RegionCode;
  intro: string;
  recommend?: "recommended" | "optional";
};
export type VaccinePrice = { doseVaccine: string; region: RegionCode; tier?: "domestic" | "imported"; price: number };
export type VaccineData = { version: string; asOf: string; doses: VaccineDose[]; prices: VaccinePrice[] };

// 一类(全国统一免费,national)
const nip = (id: string, vaccine: string, doseNo: number, min: number, max: number, intro: string): VaccineDose =>
  ({ id, vaccine, doseNo, ageMonthMin: min, ageMonthMax: max, klass: "nip", region: "national", intro });
// 省级增补(本省免费,provincial)
const prov = (id: string, vaccine: string, doseNo: number, min: number, max: number, region: RegionCode, intro: string): VaccineDose =>
  ({ id, vaccine, doseNo, ageMonthMin: min, ageMonthMax: max, klass: "provincial", region, intro });
// 二类(自费可选,national)
const opt = (id: string, vaccine: string, doseNo: number, min: number, max: number, intro: string, recommend: "recommended" | "optional"): VaccineDose =>
  ({ id, vaccine, doseNo, ageMonthMin: min, ageMonthMax: max, klass: "optional", region: "national", intro, recommend });

export const VACCINE_FALLBACK: VaccineData = {
  version: "2026-06-r2",
  asOf: "2026年6月",
  doses: [
    // ========== 一类(全国免费,核对至 2025–2026 现行)==========
    nip("bcg-1", "卡介苗", 1, 0, 1, "预防重症结核病,出生时接种。"),
    nip("hepb-1", "乙肝疫苗", 1, 0, 1, "预防乙型肝炎,出生 24 小时内打第 1 剂。"),
    nip("hepb-2", "乙肝疫苗", 2, 1, 2, "预防乙型肝炎,第 2 剂。"),
    nip("hepb-3", "乙肝疫苗", 3, 6, 8, "预防乙型肝炎,第 3 剂。"),
    nip("ipv-1", "脊灰疫苗", 1, 2, 3, "预防小儿麻痹症,注射剂(灭活),第 1 剂。"),
    nip("ipv-2", "脊灰疫苗", 2, 3, 4, "预防小儿麻痹症,注射剂(灭活),第 2 剂。"),
    nip("opv-3", "脊灰疫苗", 3, 4, 5, "预防小儿麻痹症,口服剂(减毒),第 3 剂。"),
    nip("opv-4", "脊灰疫苗", 4, 48, 50, "预防小儿麻痹症,口服剂,4 岁加强。"),
    nip("dtap-1", "百白破", 1, 2, 3, "预防百日咳、白喉、破伤风,第 1 剂。"),
    nip("dtap-2", "百白破", 2, 4, 5, "预防百日咳、白喉、破伤风,第 2 剂。"),
    nip("dtap-3", "百白破", 3, 6, 7, "预防百日咳、白喉、破伤风,第 3 剂。"),
    nip("dtap-4", "百白破", 4, 18, 24, "预防百日咳、白喉、破伤风,18 月龄加强。"),
    nip("dtap-5", "百白破", 5, 72, 74, "预防百日咳、白喉、破伤风,6 岁加强(2025 年起 6 岁也打百白破)。"),
    nip("mmr-1", "麻腮风", 1, 8, 9, "预防麻疹、流行性腮腺炎、风疹,第 1 剂。"),
    nip("mmr-2", "麻腮风", 2, 18, 24, "预防麻疹、流行性腮腺炎、风疹,第 2 剂。"),
    nip("je-1", "乙脑疫苗", 1, 8, 9, "预防流行性乙型脑炎,减毒活疫苗,第 1 剂。"),
    nip("je-2", "乙脑疫苗", 2, 24, 26, "预防流行性乙型脑炎,2 岁加强。"),
    nip("mena-1", "流脑A群", 1, 6, 7, "预防 A 群流行性脑膜炎,第 1 剂。"),
    nip("mena-2", "流脑A群", 2, 9, 10, "预防 A 群流行性脑膜炎,第 2 剂。"),
    nip("menac-1", "流脑A+C群", 1, 36, 38, "预防 A 群和 C 群流行性脑膜炎,3 岁接种。"),
    nip("menac-2", "流脑A+C群", 2, 72, 74, "预防 A 群和 C 群流行性脑膜炎,6 岁加强。"),
    nip("hepa-1", "甲肝疫苗", 1, 18, 24, "预防甲型肝炎,减毒活疫苗 1 剂(部分地区用灭活疫苗打 2 剂)。"),

    // ========== 省级增补(本省对适龄儿童免费)==========
    // 上海:免费水痘(2018 年起纳入,12 月龄 + 4 岁两剂)
    prov("varicella-sh-1", "水痘疫苗", 1, 12, 18, "SH", "上海对本市适龄儿童免费接种,预防水痘,第 1 剂(约 1 岁)。"),
    prov("varicella-sh-2", "水痘疫苗", 2, 48, 54, "SH", "上海免费,水痘第 2 剂,4 岁接种。"),
    // 江苏:免费水痘(2023 年起 0–6 岁纳入,12–18 月龄 + 4 岁两剂)
    prov("varicella-js-1", "水痘疫苗", 1, 12, 18, "JS", "江苏对全省适龄儿童免费接种,预防水痘,第 1 剂。"),
    prov("varicella-js-2", "水痘疫苗", 2, 48, 54, "JS", "江苏免费,水痘第 2 剂,4 岁接种。"),
    // 北京/广东/浙江:无可靠确认的「全省」0–6 岁常规免费增补苗,故省级不列(Claude×Codex 交叉核对):
    //   · 北京:水痘仅疫情应急接种,非常规;
    //   · 广东:全省自费(2025 非免疫规划方案),深圳等市级单独免费(省码装不下);
    //   · 浙江:经 11 市逐市官方核查 + 政府采购量佐证,确认无全省免费——2025 省采购水痘 3.55 万支中仅湖州市 3.35 万 + 杭州余杭区 0.2 万,
    //          即只有湖州市(全市)+杭州余杭/萧山(区级)局部免费,其余 9 市自费;网传"全省免费"实为江苏政策串台。故省级不列。
    // 这三省的市级/存疑免费情况已在下方「水痘疫苗(自费)」说明里点明「以本市为准」。

    // ========== 二类(自费可选,核心婴幼包)==========
    // 五联疫苗:2/3/4 月龄 + 18 月龄共 4 剂,替代相应免费针,少扎针
    opt("penta-1", "五联疫苗", 1, 2, 3, "自费联合针,一针预防百日咳白喉破伤风、小儿麻痹、b型流感嗜血杆菌引起的感染五种病;2/3/4 月龄加 18 月龄共 4 剂。打了五联可不再单打对应的免费针。费用咨询接种点。", "recommended"),
    opt("penta-2", "五联疫苗", 2, 3, 4, "五联第 2 剂。", "recommended"),
    opt("penta-3", "五联疫苗", 3, 4, 5, "五联第 3 剂。", "recommended"),
    opt("penta-4", "五联疫苗", 4, 18, 24, "五联第 4 剂(加强)。", "recommended"),
    // 13价肺炎:婴儿 2/4/6 月龄 + 12–15 月龄共 4 剂(剂次随起种月龄变)
    opt("pcv13-1", "13价肺炎", 1, 2, 3, "预防 13 种肺炎球菌引起的肺炎、脑膜炎、中耳炎等。婴儿一般 2/4/6 月龄加 12–15 月龄共 4 剂,起种越晚剂次越少,以说明书为准。参考价约 500–710 元/剂(集采挂网参考,实际含服务费、各地不同,以接种点为准)。", "recommended"),
    opt("pcv13-2", "13价肺炎", 2, 4, 5, "13价肺炎第 2 剂。", "recommended"),
    opt("pcv13-3", "13价肺炎", 3, 6, 7, "13价肺炎第 3 剂。", "recommended"),
    opt("pcv13-4", "13价肺炎", 4, 12, 15, "13价肺炎第 4 剂(加强)。", "recommended"),
    // Hib:2/4/6 月龄 + 18 月龄(打了五联可不必单打)
    opt("hib-1", "Hib疫苗", 1, 2, 3, "预防 b 型流感嗜血杆菌引起的脑膜炎、肺炎等。常 2/4/6 月龄加 18 月龄,剂次随起种月龄变;若已打五联疫苗可不必单打。费用咨询接种点。", "optional"),
    opt("hib-2", "Hib疫苗", 2, 4, 5, "Hib 第 2 剂。", "optional"),
    opt("hib-3", "Hib疫苗", 3, 6, 7, "Hib 第 3 剂。", "optional"),
    opt("hib-4", "Hib疫苗", 4, 18, 24, "Hib 第 4 剂(加强)。", "optional"),
    // 五价轮状病毒(进口口服):6–32 周龄,3 剂
    opt("rota5-1", "五价轮状病毒", 1, 2, 3, "口服,预防轮状病毒引起的腹泻。首剂需 6–12 周龄起、整个 3 剂在 32 周龄(约 8 月龄)前完成。费用咨询接种点。", "recommended"),
    opt("rota5-2", "五价轮状病毒", 2, 3, 4, "五价轮状第 2 剂(口服)。", "recommended"),
    opt("rota5-3", "五价轮状病毒", 3, 4, 8, "五价轮状第 3 剂(口服),32 周龄前完成。", "recommended"),
    // 单价轮状病毒(国产口服):2 月龄–3 岁每年 1 次
    opt("rota1-1", "单价轮状病毒", 1, 2, 36, "国产口服,2 月龄到 3 岁每年口服 1 次,预防轮状病毒腹泻。费用咨询接种点。", "optional"),
    // 手足口疫苗(EV71):6 月龄–5 岁,2 剂
    opt("ev71-1", "手足口疫苗", 1, 6, 8, "预防肠道病毒 71 型(EV71)引起的重症手足口病。6 月龄起、建议 12 月龄前打完 2 剂;只防 EV71 这一型。费用咨询接种点。", "recommended"),
    opt("ev71-2", "手足口疫苗", 2, 7, 12, "手足口第 2 剂,与第 1 剂间隔 1 个月以上。", "recommended"),
    // 流感疫苗:6 月龄起每年 1 次
    opt("flu-1", "流感疫苗", 1, 6, 60, "6 月龄起每年接种 1 次预防流感;首次接种打 2 剂(间隔 4 周以上),之后每年 1 剂。目前以四价为主,参考价约 78–138 元/剂(以接种点为准)。", "recommended"),
    // 水痘疫苗(自费省):12–24 月龄 + 4 岁两剂
    opt("varicella-1", "水痘疫苗", 1, 12, 24, "预防水痘,共 2 剂:12–24 月龄第 1 剂、4 岁第 2 剂。上海、江苏对本省适龄儿童免费(选所在省查看);广东深圳、浙江湖州等部分城市也免费;其他地区自费,具体以本市接种点为准。", "recommended"),
    opt("varicella-2", "水痘疫苗", 2, 48, 54, "水痘第 2 剂,4 岁接种。", "recommended"),
  ],
  // 二类各省精确自费价无可靠统一来源(走省级谈判/阳光采购、不公示统一价表);
  // 故不在此写各省价,清单统一显示「咨询接种点」,流感/13价的参考区间已写进各自说明。
  prices: [],
};
