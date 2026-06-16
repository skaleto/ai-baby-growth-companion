// 疫苗清单内置兜底(纯模块,无 React/资源 import)。离线/首启/OSS 拉取失败时用这份。
// 完整数据(全5省增补+全二类+各省价)由 OSS vaccine-data.json 覆盖;此处保证可用 + 结构正确。
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

const nip = (id: string, vaccine: string, doseNo: number, min: number, max: number, intro: string): VaccineDose =>
  ({ id, vaccine, doseNo, ageMonthMin: min, ageMonthMax: max, klass: "nip", region: "national", intro });

export const VACCINE_FALLBACK: VaccineData = {
  version: "2026-06-fallback",
  asOf: "2026年6月",
  doses: [
    // —— 一类(全国统一,核对官方 2025 程序;百白破为 2025 新程序 2/4/6/18月+6岁)——
    nip("bcg-1", "卡介苗", 1, 0, 1, "预防重症结核病。"),
    nip("hepb-1", "乙肝疫苗", 1, 0, 1, "预防乙型肝炎(出生 24h 内第 1 剂)。"),
    nip("hepb-2", "乙肝疫苗", 2, 1, 2, "预防乙型肝炎。"),
    nip("hepb-3", "乙肝疫苗", 3, 6, 8, "预防乙型肝炎。"),
    nip("ipv-1", "脊灰疫苗", 1, 2, 3, "预防脊髓灰质炎。"),
    nip("ipv-2", "脊灰疫苗", 2, 3, 4, "预防脊髓灰质炎。"),
    nip("opv-3", "脊灰疫苗", 3, 4, 5, "预防脊髓灰质炎。"),
    nip("opv-4", "脊灰疫苗", 4, 48, 50, "预防脊髓灰质炎(4 岁加强)。"),
    nip("dtap-1", "百白破", 1, 2, 3, "预防百日咳、白喉、破伤风。"),
    nip("dtap-2", "百白破", 2, 4, 5, "预防百日咳、白喉、破伤风。"),
    nip("dtap-3", "百白破", 3, 6, 7, "预防百日咳、白喉、破伤风。"),
    nip("dtap-4", "百白破", 4, 18, 24, "预防百日咳、白喉、破伤风。"),
    nip("dtap-5", "百白破", 5, 72, 74, "预防百日咳、白喉、破伤风(6 岁)。"),
    nip("mmr-1", "麻腮风", 1, 8, 9, "预防麻疹、流行性腮腺炎、风疹。"),
    nip("mmr-2", "麻腮风", 2, 18, 24, "预防麻疹、流行性腮腺炎、风疹。"),
    nip("je-1", "乙脑", 1, 8, 9, "预防流行性乙型脑炎。"),
    nip("je-2", "乙脑", 2, 24, 26, "预防流行性乙型脑炎。"),
    nip("mena-1", "流脑A群", 1, 6, 7, "预防 A 群流脑。"),
    nip("mena-2", "流脑A群", 2, 9, 10, "预防 A 群流脑。"),
    nip("menac-1", "流脑A+C群", 1, 36, 38, "预防 A+C 群流脑。"),
    nip("menac-2", "流脑A+C群", 2, 72, 74, "预防 A+C 群流脑(6 岁)。"),
    nip("hepa-1", "甲肝", 1, 18, 24, "预防甲型肝炎。"),
    // —— 省级增补(代表性样例;完整 5 省见内容任务)——
    { id: "varicella-bj-1", vaccine: "水痘", doseNo: 1, ageMonthMin: 12, ageMonthMax: 18, klass: "provincial", region: "BJ", intro: "预防水痘(北京对本市适龄儿童免费)。" },
    // —— 二类(自费可选;代表性样例)——
    { id: "pcv13-1", vaccine: "13价肺炎", doseNo: 1, ageMonthMin: 2, ageMonthMax: 3, klass: "optional", region: "national", intro: "预防 13 种血清型肺炎球菌感染。", recommend: "recommended" },
    { id: "rota-1", vaccine: "轮状病毒", doseNo: 1, ageMonthMin: 2, ageMonthMax: 7, klass: "optional", region: "national", intro: "口服,预防轮状病毒腹泻。", recommend: "recommended" },
    { id: "ev71-1", vaccine: "手足口(EV71)", doseNo: 1, ageMonthMin: 6, ageMonthMax: 12, klass: "optional", region: "national", intro: "预防 EV71 所致重症手足口;非高发区可降低优先级。", recommend: "optional" },
  ],
  prices: [
    { doseVaccine: "13价肺炎", region: "national", tier: "domestic", price: 600 },
    { doseVaccine: "13价肺炎", region: "national", tier: "imported", price: 900 },
    { doseVaccine: "轮状病毒", region: "national", price: 300 },
    { doseVaccine: "手足口(EV71)", region: "national", price: 200 },
  ],
};
