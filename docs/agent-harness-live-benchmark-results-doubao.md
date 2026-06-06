# Agent Harness Live Benchmark Results

Generated at: 2026-06-06T04:34:18.406Z

## Guardrails

- Provider: doubao
- Model: doubao-seed-2-0-pro-260215
- Max calls: 24
- Max output tokens per call: 450
- Budget: 20.00 CNY
- Preflight worst-case estimate: 5.1848 CNY
- Actual usage estimate from API response: 2.5824 CNY
- Judge calls: disabled
- Thinking: disabled

## Summary

- Scenarios selected: 24
- Pass: 24
- Fail: 0

| Scenario | Result | Usage | Cost CNY | Notes |
| --- | --- | ---: | ---: | --- |
| recent-milk-confirmation | PASS | 5544/498 | 0.1028 | all checks passed |
| midnight-twelve | PASS | 5373/658 | 0.1073 | all checks passed |
| read-only-reminders | PASS | 5414/363 | 0.0949 | all checks passed |
| feeding-interval-reminder | PASS | 5322/951 | 0.1194 | all checks passed |
| growth-ambiguous-weight | PASS | 5382/497 | 0.1003 | all checks passed |
| expense-reference-price | PASS | 5317/460 | 0.0978 | all checks passed |
| ordinary-qa-no-memory | PASS | 5324/442 | 0.0971 | all checks passed |
| private-reminder-share | PASS | 5373/288 | 0.0911 | all checks passed |
| mixed-feeding-missing-type | PASS | 5366/508 | 0.1006 | all checks passed |
| embedded-question-vomit-record | PASS | 5379/1579 | 0.1477 | all checks passed |
| feeding-start-no-amount | PASS | 5321/698 | 0.1083 | all checks passed |
| sleep-start-no-duration | PASS | 5322/400 | 0.0952 | all checks passed |
| vague-health-reminder | PASS | 5321/484 | 0.0989 | all checks passed |
| medicine-reminder-pending | PASS | 5323/749 | 0.1105 | all checks passed |
| growth-measurement-complete | PASS | 5335/1171 | 0.1292 | all checks passed |
| growth-out-of-range | PASS | 5320/840 | 0.1145 | all checks passed |
| growth-duplicate-boundary | PASS | 5385/426 | 0.0973 | all checks passed |
| growth-update-boundary | PASS | 5388/411 | 0.0967 | all checks passed |
| memory-explicit-health | PASS | 5322/855 | 0.1152 | all checks passed |
| expense-actual-amount | PASS | 5323/705 | 0.1086 | all checks passed |
| photo-album-save | PASS | 5372/571 | 0.1034 | all checks passed |
| screenshot-ignore | PASS | 5371/297 | 0.0914 | all checks passed |
| read-only-daily-summary | PASS | 5502/421 | 0.0988 | all checks passed |
| caregiver-fatigue-support | PASS | 5319/1782 | 0.1557 | all checks passed |

## Scenario Details

### recent-milk-confirmation

- Expected: Short milk-type confirmation merges with previous ask and produces one complete milk event.
- Checks: 1:PASS, 2:PASS, 3:PASS, 4:PASS, 5:PASS
- Output: `{"classification":{"intent":"record","mutation":"auto"},"effects":[{"type":"careLog","mode":"auto","date":"2026-06-06","time":"00:58","amountMl":20,"feedingType":"breast"}],"reply":"刚才这次20ml母乳我已经记好啦。"}`

### midnight-twelve

- Expected: Near midnight, plain twelve means 00:00, not noon.
- Checks: 1:PASS, 2:PASS, 3:PASS, 4:PASS, 5:PASS
- Output: `{"classification":{"intent":"record","mutation":"auto"},"effects":[{"type":"careLog","mode":"auto","date":"2026-06-06","time":"00:00","amountMl":100,"feedingType":"formula","note":"凌晨时段用户提及的十二点默认识别为00:00，用户明确说明为奶粉无需确认"}],"reply":"好的，已帮你记好小宝今天00:00喝了100毫升奶粉的记录哦。"}`

### read-only-reminders

- Expected: Read-only reminder query must not create or ask for a new reminder.
- Checks: 1:PASS, 2:PASS, 3:PASS
- Output: `{"classification":{"intent":"question","mutation":"none"},"effects":[],"reply":"今天有两个待办提醒哦：1. 今天12:00的喂奶提醒；2. 今天20:00的维生素D提醒。"}`

### feeding-interval-reminder

- Expected: Interval feeding reminder, not a feeding record and not a memory.
- Checks: 1:PASS, 2:PASS, 3:PASS, 4:PASS, 5:PASS
- Output: `{"classification":{"intent":"reminder","mutation":"ask"},"effects":[{"type":"reminder","mode":"ask","date":"2026-06-06","title":"喂奶提醒","scheduleMode":"interval","intervalMinutes":30,"missingFields":["confirmation"],"note":"用户明确要求不将该内容记为宝宝习惯"}],"reply":"好的，我不会把这句话记成宝宝的习惯哦。请问你需要我设置每30分钟一次的喂奶提醒吗？"}`

### growth-ambiguous-weight

- Expected: Ambiguous Chinese weight unit asks for unit before saving.
- Checks: 1:PASS, 2:PASS, 3:PASS, 4:PASS
- Output: `{"classification":{"intent":"growth","mutation":"ask"},"effects":[{"type":"growthMeasurement","mode":"ask","date":"2026-06-06","missingFields":["weightUnit"]}],"reply":"请问你说的体重14的单位是公斤还是斤呀？我确认后帮你记录哦。"}`

### expense-reference-price

- Expected: Reference price lookup is not an actual expense record.
- Checks: 1:PASS, 2:PASS
- Output: `{"classification":{"intent":"question","mutation":"none"},"effects":[],"reply":"好的，我不会帮你记录这笔账~目前我没办法直接识别条形码查询价格哦，你可以告诉我商品的具体名称，我可以帮你参考相关的市场价格~"}`

### ordinary-qa-no-memory

- Expected: Ordinary parenting Q&A should not save memory or care records.
- Checks: 1:PASS, 2:PASS, 3:PASS
- Output: `{"classification":{"intent":"question","mutation":"none"},"effects":[],"reply":"7个月的宝宝不爱吃辅食是比较常见的情况哦，你可以试试调整辅食的性状、更换不同口味或食材种类，每次少量给宝宝尝试，不要强迫进食哦。如果宝宝长期食欲不佳，也可以咨询儿保医生排查是否有消化方面的问题~"}`

### private-reminder-share

- Expected: Private caregiver reminder sharing is a boundary, not sync or create.
- Checks: 1:PASS, 2:PASS, 3:PASS
- Output: `{"classification":{"intent":"boundary","mutation":"none"},"effects":[],"reply":"这个提醒目前不能直接同步给奶奶；你可以在提醒设置里查看是否支持共享权限。"}`

### mixed-feeding-missing-type

- Expected: Mixed feeding generic milk amount asks milk type, not auto-save.
- Checks: 1:PASS, 2:PASS, 3:PASS, 4:PASS
- Output: `{"classification":{"intent":"record","mutation":"ask"},"effects":[{"type":"careLog","mode":"ask","date":"2026-06-06","time":"17:20","amountMl":120,"feedingType":"unknown","missingFields":["feedingType"],"note":"混合喂养场景下需确认奶类类型"}],"reply":"请问宝宝这次喝的是母乳还是配方奶呢？"}`

### embedded-question-vomit-record

- Expected: Concrete milk record embedded in a question still writes one milk event, with calm health copy.
- Checks: 1:PASS, 2:PASS, 3:PASS, 4:PASS, 5:PASS
- Output: `{"classification":{"intent":"record","mutation":"auto"},"effects":[{"type":"careLog","mode":"auto","date":"2026-06-06","time":"21:00","amountMl":100,"feedingType":"formula","note":"喝完吐了一点"}],"reply":"今天目前的照护记录不多哦，之前已经喝了120ml奶，刚刚九点多喝的100ml奶粉和轻微吐奶的情况我已经帮你记好了，现在今天总奶量是220ml~"}`

### feeding-start-no-amount

- Expected: Feeding start without amount must not save zero or fake amount.
- Checks: 1:PASS, 2:PASS
- Output: `{"classification":{"intent":"record","mutation":"none"},"effects":[],"reply":"好的，等宝宝喝完你告诉我具体喝了多少以及是母乳还是配方奶哦，我到时帮你记录~"}`

### sleep-start-no-duration

- Expected: Sleep start without duration must not invent a complete sleep record.
- Checks: 1:PASS, 2:PASS
- Output: `{"classification":{"intent":"record","mutation":"none"},"effects":[],"reply":"好的，我等你后续补充睡眠时长后再记录哦。"}`

### vague-health-reminder

- Expected: Vague health reminder asks concrete time and does not invent due time.
- Checks: 1:PASS, 2:PASS, 3:PASS, 4:PASS
- Output: `{"classification":{"intent":"reminder","mutation":"ask"},"effects":[{"type":"reminder","mode":"ask","title":"查看宝宝湿疹","missingFields":["提醒时间"]}],"reply":"好的，麻烦你告诉我具体的提醒时间哦，我到时候会准时提醒你查看宝宝湿疹情况的。"}`

### medicine-reminder-pending

- Expected: Medicine reminder stays pending or asks confirmation, not auto-create.
- Checks: 1:PASS, 2:PASS, 3:PASS
- Output: `{"classification":{"intent":"reminder","mutation":"pending"},"effects":[{"type":"reminder","mode":"pending","date":"2026-06-07","time":"09:00","scheduleMode":"once","title":"给宝宝吃医生开的维生素D"}],"reply":"我已经帮你整理好明天上午9点给宝宝吃维生素D的提醒啦，确认后就会正式生效哦。"}`

### growth-measurement-complete

- Expected: Complete growth measurements become pending drafts.
- Checks: 1:PASS, 2:PASS
- Output: `{"classification":{"intent":"growth","mutation":"pending"},"effects":[{"type":"growthMeasurement","mode":"pending","date":"2026-06-06","title":"身高","note":"68.2cm"},{"type":"growthMeasurement","mode":"pending","date":"2026-06-06","title":"体重","note":"7.4kg"},{"type":"growthMeasurement","mode":"pending","date":"2026-06-06","title":"头围","note":"42cm"}],"reply":"我已经整理好小宝今天的成长数据：身高68.2cm、体重7.4kg、头围42cm，你确认后就可以保存到成长档案啦~"}`

### growth-out-of-range

- Expected: Out-of-range growth measurement asks confirmation, not save.
- Checks: 1:PASS, 2:PASS, 3:PASS
- Output: `{"classification":{"intent":"growth","mutation":"ask"},"effects":[{"type":"growthMeasurement","mode":"ask","date":"2026-06-06","title":"身高记录","missingFields":["correct height value"],"note":"提交的999cm身高数值异常，需用户确认正确值"}],"reply":"你输入的身高999cm数值明显不符合正常范围哦，请确认一下正确的身高数值后我再帮你记录~"}`

### growth-duplicate-boundary

- Expected: Duplicate same-day same-value growth measurement asks instead of adding another draft.
- Checks: 1:PASS, 2:PASS, 3:PASS
- Output: `{"classification":{"intent":"growth","mutation":"none"},"effects":[],"reply":"今天已经记录过小宝体重7.4kg啦，不需要重复维护哦。"}`

### growth-update-boundary

- Expected: Historical growth edit is a chat boundary, not a new pending measurement.
- Checks: 1:PASS, 2:PASS
- Output: `{"classification":{"intent":"boundary","mutation":"none"},"effects":[],"reply":"抱歉呀，当前聊天界面暂时不能直接修改历史成长数据，你可以前往成长记录页面找到对应的身高记录进行编辑哦。"}`

### memory-explicit-health

- Expected: Explicit memory request becomes a pending memory, not ordinary Q&A.
- Checks: 1:PASS, 2:PASS
- Output: `{"classification":{"intent":"memory","mutation":"pending"},"effects":[{"type":"memory","mode":"pending","date":"2026-06-06","title":"小宝对鸡蛋起疹子，辅食需规避鸡蛋","note":"用户要求记住该饮食禁忌，后续辅食相关提醒需提及"}],"reply":"好的，我已经把小宝吃鸡蛋会起疹子的注意事项整理好了，你确认后我就会记住，之后涉及辅食相关的内容我会特意提醒你留意哦~"}`

### expense-actual-amount

- Expected: Actual baby expense with paid amount becomes an expense draft.
- Checks: 1:PASS, 2:PASS, 3:PASS
- Output: `{"classification":{"intent":"expense","mutation":"auto"},"effects":[{"type":"expenseItem","mode":"auto","date":"2026-06-06","amount":268,"title":"购买小宝奶粉","category":"喂养消费"}],"reply":"好的，已经帮你把今天买小宝奶粉花费的268元记到账本里啦。"}`

### photo-album-save

- Expected: Explicit baby photo save creates an album effect only.
- Checks: 1:PASS, 2:PASS, 3:PASS
- Output: `{"classification":{"intent":"record","mutation":"auto"},"effects":[{"type":"album","mode":"auto","date":"2026-06-06","time":"13:00","title":"小宝微笑照片"}],"reply":"好的，这张照片已经帮你保存到小宝的成长相册啦。"}`

### screenshot-ignore

- Expected: Screenshot with explicit do-not-save creates no album or records.
- Checks: 1:PASS, 2:PASS
- Output: `{"classification":{"intent":"boundary","mutation":"none"},"effects":[],"reply":"好的，我不会保存这张App截图哦。"}`

### read-only-daily-summary

- Expected: Read-only daily summary uses seeded context and creates no effects.
- Checks: 1:PASS, 2:PASS, 3:PASS, 4:PASS
- Output: `{"classification":{"intent":"question","mutation":"none"},"effects":[],"reply":"今天已有记录里，小宝的总奶量是240ml，共喂了3次，睡眠总时长是3小时哦。"}`

### caregiver-fatigue-support

- Expected: Caregiver fatigue gets low-anxiety support without mutating app state.
- Checks: 1:PASS, 2:PASS, 3:PASS, 4:PASS
- Output: `{"classification":{"intent":"boundary","mutation":"none"},"effects":[],"reply":"带娃真的太辛苦了，你可别硬扛着，快找机会好好歇一歇，照顾好自己呀。"}`
