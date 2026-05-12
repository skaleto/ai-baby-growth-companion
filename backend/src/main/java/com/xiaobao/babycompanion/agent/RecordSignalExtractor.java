package com.xiaobao.babycompanion.agent;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.Clock;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

@Component
public class RecordSignalExtractor {

    private static final Pattern ISO_DATE = Pattern.compile("(20\\d{2})[-/.年](\\d{1,2})[-/.月](\\d{1,2})日?");
    private static final Pattern MONTH_DAY = Pattern.compile("(\\d{1,2})月(\\d{1,2})[日号]?");
    private static final Pattern TIME = Pattern.compile("(凌晨|早上|上午|中午|下午|晚上)?\\s*(\\d{1,2}|[一二两三四五六七八九十]{1,3})\\s*(?:点\\s*(半|\\d{1,2}|[一二两三四五六七八九十]{1,3})?|[:：]\\s*(\\d{1,2}))");
    private static final Pattern ML = Pattern.compile("(?:每次)?\\s*(\\d{2,4})\\s*(?:ml|mL|毫升)");
    private static final Pattern TIMES = Pattern.compile("(?:喝奶|吃奶|喂奶|奶)?\\s*(\\d{1,2})\\s*次");
    private static final Pattern SLEEP = Pattern.compile("(?:睡了|睡眠|睡觉)\\s*(\\d+(?:\\.\\d+)?)\\s*(?:个)?(?:小时|h)");
    private static final Pattern WAKES = Pattern.compile("(?:夜醒|醒了|醒来)\\s*(\\d{1,2})\\s*次");
    private static final Pattern TEMPERATURE = Pattern.compile("(3[5-9](?:\\.\\d)?)\\s*(?:度|℃)");
    private static final Pattern INTERVAL_REMINDER = Pattern.compile("(?:每隔|每)\\s*(半|\\d+(?:\\.\\d+)?|[一二两三四五六七八九十]+)\\s*(?:个)?\\s*(分钟|分|小时)");
    private static final Pattern MONEY = Pattern.compile("(?:¥|￥)?\\s*(\\d+(?:\\.\\d{1,2})?)\\s*(?:元|块|rmb|RMB)?");
    private static final Pattern PART_SEPARATOR = Pattern.compile("[。；;\\n，,]");

    private final ObjectMapper objectMapper;
    private final Clock clock;

    @Autowired
    public RecordSignalExtractor(ObjectMapper objectMapper) {
        this(objectMapper, Clock.systemDefaultZone());
    }

    RecordSignalExtractor(ObjectMapper objectMapper, Clock clock) {
        this.objectMapper = objectMapper;
        this.clock = clock;
    }

    public RecordSignals extract(String message) {
        String text = message == null ? "" : message.trim();
        LocalDate today = LocalDate.now(clock);
        List<String> dates = targetDates(text, today);
        String date = dates.isEmpty() ? today.toString() : dates.get(0);
        Set<String> topics = new LinkedHashSet<>();
        Set<String> risks = new LinkedHashSet<>();
        ObjectNode care = objectMapper.createObjectNode();
        care.put("id", "care-" + UUID.randomUUID());
        care.put("date", date);
        ArrayNode notes = objectMapper.createArrayNode();
        ArrayNode events = objectMapper.createArrayNode();
        List<CareRecordClarification> clarifications = new ArrayList<>();
        boolean concreteCare = false;
        ReminderSignal reminderSignal = reminderSignal(text);
        ExpenseSignal expenseSignal = expenseSignal(text, date);

        if (matches(text, feedingPattern())) topics.add("feeding");
        if (matches(text, "睡|夜醒|哄睡")) topics.add("sleep");
        if (matches(text, "便便|大便|拉了|臭臭")) topics.add("poop");
        if (matches(text, "体温|发烧|发热|度|退烧")) topics.add("temperature");
        if (matches(text, "疫苗|接种")) topics.add("vaccine");
        if (matches(text, "提醒|闹钟|记得|定时|每隔\\s*(\\d+|[一二两三四五六七八九十半]+)\\s*(分钟|分|小时)")) topics.add("reminder");
        if (expenseSignal != null || matches(text, "记账|花了|花费|支出|买了|购买|付款|多少钱|价格")) topics.add("expense");

        if (matches(text, "发烧|发热|退烧|体温")) risks.add("fever");
        if (matches(text, "药|用药|吃药|剂量")) risks.add("medicine");
        if (matches(text, "疫苗|接种")) risks.add("vaccine");
        if (matches(text, "过敏|皮疹|疹子")) risks.add("allergy");
        if (matches(text, "呼吸|喘|憋气")) risks.add("breathing");
        if (matches(text, "摔|撞|磕|出血|外伤")) risks.add("injury");

        Integer milkTimes = firstInt(TIMES, text);
        Integer milkMl = firstInt(ML, text);
        if (milkTimes != null) {
            care.put("milkTimes", milkTimes);
        }
        if (milkMl != null) {
            int totalMl = milkTimes != null && text.matches(".*(每次|每顿).*") ? milkMl * milkTimes : milkMl;
            care.put("milkMl", totalMl);
            concreteCare = true;
        } else if (topics.contains("feeding") && (milkTimes != null || incompleteFeeding(text))) {
            clarifications.add(new CareRecordClarification(
                    "feeding",
                    List.of("milkMl"),
                    milkTimes != null
                            ? "今天喝奶次数我看到了，还需要总奶量或每次大概多少 ml，才能帮你记完整。"
                            : "这次喝完后告诉我喝了多少 ml，我再帮你记到时间线里。"
            ));
        }

        Double sleepHours = firstDouble(SLEEP, text);
        if (sleepHours != null) {
            care.put("sleepHours", sleepHours);
            concreteCare = true;
        }
        Integer wakes = firstInt(WAKES, text);
        if (wakes != null) {
            care.put("wakes", wakes);
            concreteCare = true;
        }
        Double temperature = firstDouble(TEMPERATURE, text);
        if (temperature != null) {
            care.put("temperature", temperature);
            concreteCare = true;
        }
        if (matches(text, "便便|大便|拉了|臭臭")) {
            care.put("poop", compact(text));
            concreteCare = true;
        }

        List<ObjectNode> extractedEvents = extractCareEvents(text, date, today);
        int milkEventTotal = 0;
        int milkEventCount = 0;
        double sleepEventTotal = 0;
        for (ObjectNode event : extractedEvents) {
            events.add(event);
            if ("milk".equals(event.path("type").asText()) && event.path("amountMl").isNumber()) {
                milkEventTotal += event.path("amountMl").asInt();
                milkEventCount += 1;
            }
            if ("sleep".equals(event.path("type").asText()) && event.path("durationHours").isNumber()) {
                sleepEventTotal += event.path("durationHours").asDouble();
            }
        }
        if (!extractedEvents.isEmpty()) {
            if (milkEventTotal > 0 && (milkMl == null || milkEventCount > 1 || !text.matches(".*(每次|每顿).*"))) {
                care.put("milkMl", milkEventTotal);
            }
            if (milkTimes == null && milkEventCount > 1) {
                care.put("milkTimes", milkEventCount);
            }
            if (sleepHours == null && sleepEventTotal > 0) {
                care.put("sleepHours", roundOneDecimal(sleepEventTotal));
            }
            concreteCare = true;
        }

        if (topics.contains("sleep") && sleepHours == null && incompleteSleep(text)) {
            clarifications.add(new CareRecordClarification(
                    "sleep",
                    List.of("durationHours"),
                    "等宝宝醒来后告诉我这次大概睡了多久，我再帮你记到睡眠记录里。"
            ));
        }

        if (concreteCare) {
            notes.add(compact(text));
            care.set("notes", notes);
            care.set("events", events);
        }

        boolean explicitReminderTime = topics.contains("reminder") && (
                firstTime(text, date, today) != null
                        || matches(text, "明天|后天|大后天|上午|下午|晚上|\\d+月\\d+[日号]?|20\\d{2}")
                        || matches(text, "(\\d+|[一二两三四五六七八九十]+)\\s*(分钟|分|小时|天)\\s*后|半\\s*(个)?小时\\s*后|一刻钟后")
                        || matches(text, "每隔\\s*(\\d+|[一二两三四五六七八九十半]+)\\s*(分钟|分|小时)|每\\s*(\\d+|[一二两三四五六七八九十半]+)\\s*(分钟|分|小时)")
                        || reminderSignal != null
        );
        return new RecordSignals(
                dates.isEmpty() ? List.of(today.toString()) : dates,
                topics.stream().toList(),
                risks.stream().toList(),
                concreteCare ? care : null,
                concreteCare,
                explicitReminderTime,
                clarifications,
                AgentCapabilityContract.unsupportedMutationRequest(text),
                reminderSignal,
                expenseSignal
        );
    }

    private ExpenseSignal expenseSignal(String text, String date) {
        if (!StringUtils.hasText(text)) return null;
        boolean intent = matches(text, "记账|花了|花费|支出|买了|购买|付款|给.*买|为.*买");
        if (!intent) return null;
        Double amount = expenseAmount(text);
        String title = expenseTitle(text);
        if (amount == null && !StringUtils.hasText(title)) return null;
        return new ExpenseSignal(title, amount, date, expenseCategory(title + " " + text), compact(text));
    }

    private Double expenseAmount(String text) {
        Matcher matcher = MONEY.matcher(text);
        Double best = null;
        while (matcher.find()) {
            Double value = doubleValue(matcher.group(1));
            if (value == null || value <= 0) continue;
            String around = text.substring(Math.max(0, matcher.start() - 8), Math.min(text.length(), matcher.end() + 4));
            if (around.matches(".*(点|:|：|分钟|小时|ml|毫升|次).*")) continue;
            best = value;
        }
        return best;
    }

    private String expenseTitle(String text) {
        String title = text
                .replaceAll("(今天|昨天|前天|明天|刚刚|刚才|给小宝|给宝宝|为小宝|为宝宝)", " ")
                .replaceAll("(帮我)?记账|记录(一下)?|花了|花费|支出|付款|支付|买了|购买|给.*?买|为.*?买|买", " ")
                .replaceAll("(?:¥|￥)?\\s*\\d+(?:\\.\\d{1,2})?\\s*(?:元|块|rmb|RMB)?", " ")
                .replaceAll("[，。,.；;！!？?]", " ")
                .trim();
        if (!StringUtils.hasText(title)) return "";
        return title.length() > 30 ? title.substring(0, 30) : title;
    }

    private String expenseCategory(String raw) {
        String text = raw == null ? "" : raw;
        if (matches(text, "奶粉|配方奶|水奶|液态奶")) return "formula";
        if (matches(text, "尿裤|纸尿裤|拉拉裤|尿不湿")) return "diaper";
        if (matches(text, "辅食|米粉|果泥|肉泥|零食")) return "food";
        if (matches(text, "衣服|裤子|帽子|袜|鞋|围兜|睡袋")) return "clothing";
        if (matches(text, "玩具|绘本|摇铃|积木")) return "toy";
        if (matches(text, "体检|疫苗|挂号|医院|药|护理|退烧|体温计")) return "health";
        if (matches(text, "湿巾|棉柔巾|洗护|沐浴|润肤|日用")) return "daily";
        if (matches(text, "早教|课程|摄影|游泳|娱乐")) return "education";
        return "other";
    }

    private ReminderSignal reminderSignal(String text) {
        boolean hasReminderIntent = matches(text, "提醒|闹钟|记得|定时|响铃|铃声");
        if (!hasReminderIntent) return null;
        Integer intervalMinutes = intervalMinutes(text);
        boolean intervalIntent = intervalMinutes != null || matches(text, "循环提醒|定时提醒|每隔|喂奶闹钟|定时喂奶|喂奶定时");
        if (!intervalIntent) return null;
        String topic = matches(text, feedingPattern()) ? "feeding" : "general";
        boolean ringingRequested = "feeding".equals(topic) || matches(text, "闹钟|响铃|铃声");
        return new ReminderSignal("interval", intervalMinutes, compact(text), topic, ringingRequested);
    }

    private Integer intervalMinutes(String text) {
        Matcher matcher = INTERVAL_REMINDER.matcher(text);
        if (!matcher.find()) return null;
        Double amount = looseIntervalNumber(matcher.group(1));
        if (amount == null) return null;
        int minutes = "小时".equals(matcher.group(2)) ? (int) Math.round(amount * 60) : (int) Math.round(amount);
        return minutes > 0 ? minutes : null;
    }

    private Double looseIntervalNumber(String value) {
        if (!StringUtils.hasText(value)) return null;
        if ("半".equals(value)) return 0.5;
        try {
            return Double.parseDouble(value);
        } catch (NumberFormatException ignored) {
            // Fall through to common Chinese numerals.
        }
        Integer parsed = looseNumber(value);
        return parsed == null ? null : parsed.doubleValue();
    }

    private List<ObjectNode> extractCareEvents(String text, String date, LocalDate today) {
        List<ObjectNode> events = new ArrayList<>();
        for (String part : eventParts(text)) {
            events.addAll(eventsFromPart(part, date, today));
            if (events.size() >= 24) break;
        }
        return events.stream().limit(24).toList();
    }

    private List<String> eventParts(String text) {
        List<String> parts = new ArrayList<>();
        for (String sentence : PART_SEPARATOR.split(text)) {
            String trimmed = sentence.trim();
            if (!StringUtils.hasText(trimmed)) continue;
            parts.addAll(splitByRepeatedTimes(trimmed));
        }
        return parts;
    }

    private List<String> splitByRepeatedTimes(String text) {
        List<String> parts = new ArrayList<>();
        Matcher matcher = TIME.matcher(text);
        List<Integer> starts = new ArrayList<>();
        while (matcher.find()) {
            starts.add(matcher.start());
        }
        if (starts.size() <= 1) {
            parts.add(text);
            return parts;
        }
        for (int index = 0; index < starts.size(); index++) {
            int start = starts.get(index);
            int end = index + 1 < starts.size() ? starts.get(index + 1) : text.length();
            String part = text.substring(start, end).trim();
            if (StringUtils.hasText(part)) parts.add(part);
        }
        return parts;
    }

    private List<ObjectNode> eventsFromPart(String part, String date, LocalDate today) {
        List<ObjectNode> events = new ArrayList<>();
        String time = firstTime(part, date, today);
        Integer amountMl = firstInt(ML, part);
        Double durationHours = firstDouble(SLEEP, part);
        Double temperature = firstDouble(TEMPERATURE, part);

        if (matches(part, feedingPattern())) {
            boolean summaryOnly = time == null && firstInt(TIMES, part) != null;
            if (!summaryOnly && time != null && amountMl != null) {
                ObjectNode event = baseEvent(date, time, "milk", "喝奶", part);
                event.put("amountMl", amountMl);
                events.add(event);
            }
        }

        if (matches(part, "睡了|小睡|入睡|睡着|睡觉|睡眠")) {
            boolean summaryOnly = time == null && !matches(part, "睡了|小睡|入睡");
            if (!summaryOnly && time != null && durationHours != null) {
                ObjectNode event = baseEvent(date, time, "sleep", "睡觉", part);
                event.put("durationHours", durationHours);
                events.add(event);
            }
        }

        if (matches(part, "夜醒|醒了|醒来")) {
            if (time != null) {
                events.add(baseEvent(date, time, "wake", "醒来", part));
            }
        }

        if (matches(part, "便便|大便|拉了|臭臭")) {
            events.add(baseEvent(date, time, "poop", "便便", part));
        }

        if (matches(part, "辅食|米粉|蛋黄|菜泥|果泥|肉泥|粥")) {
            events.add(baseEvent(date, time, "solid", "辅食", part));
        }

        if (matches(part, "体温|发烧|发热|度|℃")) {
            if (time != null || temperature != null) {
                ObjectNode event = baseEvent(date, time, "temperature", "体温", part);
                if (temperature != null) event.put("temperature", temperature);
                events.add(event);
            }
        }

        return events;
    }

    private ObjectNode baseEvent(String date, String time, String type, String title, String note) {
        ObjectNode event = objectMapper.createObjectNode();
        event.put("id", "care-event-" + UUID.randomUUID());
        event.put("type", type);
        event.put("date", date);
        if (StringUtils.hasText(time)) {
            event.put("time", time);
        } else {
            event.putNull("time");
        }
        event.put("title", title);
        event.put("note", compact(note));
        ArrayNode tags = objectMapper.createArrayNode();
        tags.add(title);
        event.set("tags", tags);
        return event;
    }

    private List<String> targetDates(String text, LocalDate today) {
        Set<String> dates = new LinkedHashSet<>();
        if (text.contains("前天")) dates.add(today.minusDays(2).toString());
        if (text.contains("昨天")) dates.add(today.minusDays(1).toString());
        if (text.contains("今天")) dates.add(today.toString());
        if (text.contains("明天")) dates.add(today.plusDays(1).toString());
        if (text.contains("后天")) dates.add(today.plusDays(2).toString());

        Matcher iso = ISO_DATE.matcher(text);
        while (iso.find()) {
            dates.add(LocalDate.of(Integer.parseInt(iso.group(1)), Integer.parseInt(iso.group(2)), Integer.parseInt(iso.group(3))).toString());
        }
        Matcher monthDay = MONTH_DAY.matcher(text);
        while (monthDay.find()) {
            LocalDate date = LocalDate.of(today.getYear(), Integer.parseInt(monthDay.group(1)), Integer.parseInt(monthDay.group(2)));
            dates.add(date.toString());
        }
        return dates.stream().toList();
    }

    private boolean incompleteFeeding(String text) {
        return matches(text, "(开始|准备|要|想|又要|正在|现在).{0,8}(喝奶|吃奶|喂奶)|" +
                "(喝奶|吃奶|喂奶).{0,8}(开始|准备|要|想|正在)");
    }

    private String feedingPattern() {
        return "喝奶|吃奶|喂奶|奶量|母乳|亲喂|配方奶|奶粉|喝了\\s*\\d{2,4}\\s*(?:ml|mL|毫升)";
    }

    private boolean incompleteSleep(String text) {
        return matches(text, "(开始|准备|要|想|正在|现在).{0,8}(睡觉|睡着|入睡|小睡|午睡|晚睡)|" +
                "(睡觉|睡着|入睡|小睡|午睡|晚睡).{0,8}(开始|准备|要|想|正在)?");
    }

    private String firstTime(String text, String targetDate, LocalDate today) {
        Matcher matcher = TIME.matcher(text);
        if (!matcher.find()) return null;
        String period = matcher.group(1) == null ? "" : matcher.group(1);
        Integer parsedHour = looseNumber(matcher.group(2));
        if (parsedHour == null) return null;
        int hour = parsedHour;
        String minuteText = matcher.group(3) != null ? matcher.group(3) : matcher.group(4);
        Integer parsedMinute = minuteText == null ? 0 : "半".equals(minuteText) ? 30 : looseNumber(minuteText);
        if (parsedMinute == null) return null;
        int minute = parsedMinute;
        if (("下午".equals(period) || "晚上".equals(period)) && hour < 12) hour += 12;
        if ("中午".equals(period) && hour < 11) hour += 12;
        if ("凌晨".equals(period) && hour == 12) hour = 0;
        if (!StringUtils.hasText(period) && hour >= 1 && hour <= 11 && today.toString().equals(targetDate)) {
            hour = inferAmbiguousHourForToday(hour, minute);
        }
        if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
        return "%02d:%02d".formatted(hour, minute);
    }

    private Integer looseNumber(String value) {
        if (!StringUtils.hasText(value)) return null;
        String trimmed = value.trim();
        if (trimmed.matches("\\d+")) return Integer.parseInt(trimmed);
        if ("十".equals(trimmed)) return 10;
        int tenIndex = trimmed.indexOf("十");
        if (tenIndex >= 0) {
            Integer tens = tenIndex == 0 ? 1 : chineseDigit(trimmed.substring(0, tenIndex));
            String right = trimmed.substring(tenIndex + 1);
            Integer ones = StringUtils.hasText(right) ? chineseDigit(right) : 0;
            return tens == null || ones == null ? null : tens * 10 + ones;
        }
        return chineseDigit(trimmed);
    }

    private Integer chineseDigit(String value) {
        return switch (value) {
            case "零" -> 0;
            case "一" -> 1;
            case "二", "两" -> 2;
            case "三" -> 3;
            case "四" -> 4;
            case "五" -> 5;
            case "六" -> 6;
            case "七" -> 7;
            case "八" -> 8;
            case "九" -> 9;
            default -> null;
        };
    }

    private int inferAmbiguousHourForToday(int hour, int minute) {
        LocalTime now = LocalDateTime.now(clock).toLocalTime();
        LocalTime morning = LocalTime.of(hour, minute);
        LocalTime afternoon = LocalTime.of(hour + 12, minute);
        if (!afternoon.isAfter(now)) return hour + 12;
        if (!morning.isAfter(now)) return hour;
        return hour;
    }

    private Integer firstInt(Pattern pattern, String text) {
        Matcher matcher = pattern.matcher(text);
        return matcher.find() ? Integer.parseInt(matcher.group(1)) : null;
    }

    private Double firstDouble(Pattern pattern, String text) {
        Matcher matcher = pattern.matcher(text);
        return matcher.find() ? Double.parseDouble(matcher.group(1)) : null;
    }

    private Double doubleValue(String value) {
        try {
            return Double.parseDouble(value);
        } catch (NumberFormatException exception) {
            return null;
        }
    }

    private double roundOneDecimal(double value) {
        return Math.round(value * 10.0) / 10.0;
    }

    private boolean matches(String text, String regex) {
        return StringUtils.hasText(text) && text.matches(".*(" + regex + ").*");
    }

    private String compact(String text) {
        return text.length() > 160 ? text.substring(0, 160) : text;
    }
}
