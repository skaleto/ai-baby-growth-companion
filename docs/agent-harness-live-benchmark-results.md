# Agent Harness Live Benchmark Results

Generated at: 2026-06-06T04:28:08.149Z

## Guardrails

- Provider: deepseek
- Model: deepseek-v4-pro
- Max calls: 24
- Max output tokens per call: 450
- Budget: 20.00 CNY
- Preflight worst-case estimate: 4.3736 CNY
- Actual usage estimate from API response: 0.3152 CNY
- Judge calls: disabled
- Thinking: disabled

## Summary

- Scenarios selected: 24
- Pass: 24
- Fail: 0

| Scenario | Result | Usage | Cost CNY | Notes |
| --- | --- | ---: | ---: | --- |
| recent-milk-confirmation | PASS | 5168/128 | 0.0689 | all checks passed |
| midnight-twelve | PASS | 5028/129 | 0.0671 | all checks passed |
| read-only-reminders | PASS | 5067/54 | 0.0077 | all checks passed |
| feeding-interval-reminder | PASS | 4992/151 | 0.0092 | all checks passed |
| growth-ambiguous-weight | PASS | 5036/110 | 0.0087 | all checks passed |
| expense-reference-price | PASS | 4986/60 | 0.0068 | all checks passed |
| ordinary-qa-no-memory | PASS | 4991/95 | 0.0078 | all checks passed |
| private-reminder-share | PASS | 5033/57 | 0.0073 | all checks passed |
| mixed-feeding-missing-type | PASS | 5020/138 | 0.0092 | all checks passed |
| embedded-question-vomit-record | PASS | 5033/147 | 0.0096 | all checks passed |
| feeding-start-no-amount | PASS | 4989/50 | 0.0066 | all checks passed |
| sleep-start-no-duration | PASS | 4989/56 | 0.0067 | all checks passed |
| vague-health-reminder | PASS | 4990/112 | 0.0082 | all checks passed |
| medicine-reminder-pending | PASS | 4989/135 | 0.0088 | all checks passed |
| growth-measurement-complete | PASS | 5000/212 | 0.0109 | all checks passed |
| growth-out-of-range | PASS | 4985/127 | 0.0085 | all checks passed |
| growth-duplicate-boundary | PASS | 5040/55 | 0.0074 | all checks passed |
| growth-update-boundary | PASS | 5041/73 | 0.0078 | all checks passed |
| memory-explicit-health | PASS | 4991/108 | 0.0081 | all checks passed |
| expense-actual-amount | PASS | 4989/108 | 0.0081 | all checks passed |
| photo-album-save | PASS | 5032/103 | 0.0085 | all checks passed |
| screenshot-ignore | PASS | 5030/53 | 0.0072 | all checks passed |
| read-only-daily-summary | PASS | 5135/85 | 0.0093 | all checks passed |
| caregiver-fatigue-support | PASS | 4985/59 | 0.0068 | all checks passed |

## Scenario Details

### recent-milk-confirmation

- Expected: Short milk-type confirmation merges with previous ask and produces one complete milk event.
- Checks: 1:PASS, 2:PASS, 3:PASS, 4:PASS, 5:PASS
- Output: `{"classification":{"intent":"record","mutation":"auto"},"effects":[{"type":"careLog","mode":"auto","date":"2026-06-06","time":"00:58","amountMl":20,"feedingType":"breast","note":"合并上一轮草稿，确认母乳，更新奶量总计和时间线事件"}],"reply":"刚才这次母乳20ml，我记好了。"}`

### midnight-twelve

- Expected: Near midnight, plain twelve means 00:00, not noon.
- Checks: 1:PASS, 2:PASS, 3:PASS, 4:PASS, 5:PASS
- Output: `{"classification":{"intent":"record","mutation":"auto"},"effects":[{"type":"careLog","mode":"auto","date":"2026-06-06","time":"00:00","amountMl":100,"feedingType":"formula","note":"凌晨十二点奶粉100ml，已更新奶量总计和时间线事件"}],"reply":"凌晨十二点喝了100毫升奶粉，我记好了。"}`

### read-only-reminders

- Expected: Read-only reminder query must not create or ask for a new reminder.
- Checks: 1:PASS, 2:PASS, 3:PASS
- Output: `{"classification":{"intent":"question","mutation":"none"},"effects":[],"reply":"今天还有两个提醒：中午12点喂奶，晚上8点吃维生素D。"}`

### feeding-interval-reminder

- Expected: Interval feeding reminder, not a feeding record and not a memory.
- Checks: 1:PASS, 2:PASS, 3:PASS, 4:PASS, 5:PASS
- Output: `{"classification":{"intent":"reminder","mutation":"ask"},"effects":[{"type":"reminder","mode":"ask","scheduleMode":"interval","intervalMinutes":30,"title":"喂奶提醒","missingFields":["具体开始时间或首次提醒时间"],"note":"用户要求每半小时提醒喂奶，但未提供首次提醒时间，需追问。"}],"reply":"好的，我可以帮你设置每半小时的喂奶提醒。你想从什么时候开始提醒呢？比如现在开始，还是从某个具体时间？"}`

### growth-ambiguous-weight

- Expected: Ambiguous Chinese weight unit asks for unit before saving.
- Checks: 1:PASS, 2:PASS, 3:PASS, 4:PASS
- Output: `{"classification":{"intent":"growth","mutation":"ask"},"effects":[{"type":"growthMeasurement","mode":"ask","date":"2026-06-06","missingFields":["unit"],"note":"体重14缺单位，需确认是斤还是公斤"}],"reply":"体重14是斤还是公斤呢？确认后我帮你整理好记录。"}`

### expense-reference-price

- Expected: Reference price lookup is not an actual expense record.
- Checks: 1:PASS, 2:PASS
- Output: `{"classification":{"intent":"question","mutation":"none"},"effects":[],"reply":"这个条形码的价格我暂时查不到，需要你提供商品名称或扫码后我才能帮你看看参考价。"}`

### ordinary-qa-no-memory

- Expected: Ordinary parenting Q&A should not save memory or care records.
- Checks: 1:PASS, 2:PASS, 3:PASS
- Output: `{"classification":{"intent":"question","mutation":"none"},"effects":[],"reply":"宝宝不爱吃辅食，可能是口味、口感或进食时机的问题。可以试试换不同种类的辅食，比如从单一米糊换成蔬菜泥或水果泥，或者在宝宝心情好、不太饿也不太饱的时候喂。如果持续不爱吃，也可以咨询儿科医生看看是否有其他原因。"}`

### private-reminder-share

- Expected: Private caregiver reminder sharing is a boundary, not sync or create.
- Checks: 1:PASS, 2:PASS, 3:PASS
- Output: `{"classification":{"intent":"boundary","mutation":"none"},"effects":[],"reply":"这个提醒目前不能直接同步给奶奶；你可以在提醒设置里查看是否支持共享权限。"}`

### mixed-feeding-missing-type

- Expected: Mixed feeding generic milk amount asks milk type, not auto-save.
- Checks: 1:PASS, 2:PASS, 3:PASS, 4:PASS
- Output: `{"classification":{"intent":"record","mutation":"ask"},"effects":[{"type":"careLog","mode":"ask","date":"2026-06-06","time":"17:20","amountMl":120,"feedingType":"unknown","missingFields":["feedingType"],"note":"混合喂养下未明确奶类，需确认是母乳还是配方奶"}],"reply":"刚才这次120毫升奶，是母乳还是配方奶呢？"}`

### embedded-question-vomit-record

- Expected: Concrete milk record embedded in a question still writes one milk event, with calm health copy.
- Checks: 1:PASS, 2:PASS, 3:PASS, 4:PASS, 5:PASS
- Output: `{"classification":{"intent":"record","mutation":"auto"},"effects":[{"type":"careLog","mode":"auto","date":"2026-06-06","time":"21:00","amountMl":100,"feedingType":"formula","note":"刚才九点多喝了100毫升奶粉，喝完吐了一点"}],"reply":"刚才九点多芊宝喝了100毫升奶粉，我记好了。喝完吐了一点，注意观察一下，如果吐得频繁或宝宝不舒服，及时看看医生。"}`

### feeding-start-no-amount

- Expected: Feeding start without amount must not save zero or fake amount.
- Checks: 1:PASS, 2:PASS
- Output: `{"classification":{"intent":"record","mutation":"ignore"},"effects":[],"reply":"好的，等小宝喝完你告诉我奶量，我再帮你记。"}`

### sleep-start-no-duration

- Expected: Sleep start without duration must not invent a complete sleep record.
- Checks: 1:PASS, 2:PASS
- Output: `{"classification":{"intent":"record","mutation":"ignore"},"effects":[],"reply":"好的，先不记时长，等小宝醒了你告诉我睡了多久，我再帮你补上。"}`

### vague-health-reminder

- Expected: Vague health reminder asks concrete time and does not invent due time.
- Checks: 1:PASS, 2:PASS, 3:PASS, 4:PASS
- Output: `{"classification":{"intent":"reminder","mutation":"ask"},"effects":[{"type":"reminder","mode":"ask","missingFields":["dueTime"],"note":"用户要求晚点提醒查看湿疹，但未提供具体时间，需要追问。"}],"reply":"好的，你想什么时候提醒你查看湿疹呢？比如晚上几点，或者明天上午？"}`

### medicine-reminder-pending

- Expected: Medicine reminder stays pending or asks confirmation, not auto-create.
- Checks: 1:PASS, 2:PASS, 3:PASS
- Output: `{"classification":{"intent":"reminder","mutation":"pending"},"effects":[{"type":"reminder","mode":"pending","date":"2026-06-07","time":"09:00","title":"给宝宝吃医生开的维生素D","scheduleMode":"once","note":"药品提醒需确认，不能自动创建"}],"reply":"好的，明天上午9点提醒给宝宝吃维生素D，我整理好了，需要你确认一下。"}`

### growth-measurement-complete

- Expected: Complete growth measurements become pending drafts.
- Checks: 1:PASS, 2:PASS
- Output: `{"classification":{"intent":"growth","mutation":"pending"},"effects":[{"type":"growthMeasurement","mode":"pending","date":"2026-06-06","title":"身高","note":"68.2cm"},{"type":"growthMeasurement","mode":"pending","date":"2026-06-06","title":"体重","note":"7.4kg"},{"type":"growthMeasurement","mode":"pending","date":"2026-06-06","title":"头围","note":"42cm"}],"reply":"好的，今天的身高68.2cm、体重7.4kg、头围42cm已经整理好了，需要你确认一下再保存。"}`

### growth-out-of-range

- Expected: Out-of-range growth measurement asks confirmation, not save.
- Checks: 1:PASS, 2:PASS, 3:PASS
- Output: `{"classification":{"intent":"growth","mutation":"ask"},"effects":[{"type":"growthMeasurement","mode":"ask","date":"2026-06-06","missingFields":["unit"],"note":"身高999cm数值异常，需确认单位是否为厘米，或是否为输入错误"}],"reply":"小宝今天身高999cm，这个数值看起来有点异常，是厘米吗？还是输入有误？我先帮你确认一下再记录。"}`

### growth-duplicate-boundary

- Expected: Duplicate same-day same-value growth measurement asks instead of adding another draft.
- Checks: 1:PASS, 2:PASS, 3:PASS
- Output: `{"classification":{"intent":"growth","mutation":"none"},"effects":[],"reply":"今天已经有一条 7.4kg 的体重记录了，不需要再重复记录哦。"}`

### growth-update-boundary

- Expected: Historical growth edit is a chat boundary, not a new pending measurement.
- Checks: 1:PASS, 2:PASS
- Output: `{"classification":{"intent":"boundary","mutation":"none"},"effects":[],"reply":"成长记录的修改需要在成长页操作哦，聊天里暂时不能直接改。你可以去宝宝资料里的成长记录，找到上周那条身高，手动改成68.5厘米。"}`

### memory-explicit-health

- Expected: Explicit memory request becomes a pending memory, not ordinary Q&A.
- Checks: 1:PASS, 2:PASS
- Output: `{"classification":{"intent":"memory","mutation":"pending"},"effects":[{"type":"memory","mode":"pending","title":"小宝对鸡蛋起疹子","note":"辅食过敏记忆，待确认"}],"reply":"好的，我记下了：小宝对鸡蛋起疹子，以后辅食提醒会注意。需要我帮你确认保存这条记忆吗？"}`

### expense-actual-amount

- Expected: Actual baby expense with paid amount becomes an expense draft.
- Checks: 1:PASS, 2:PASS, 3:PASS
- Output: `{"classification":{"intent":"expense","mutation":"auto"},"effects":[{"type":"expenseItem","mode":"auto","date":"2026-06-06","amount":268,"title":"奶粉","category":"喂养"}],"reply":"好的，今天买奶粉花了268元，已经记到账本了。"}`

### photo-album-save

- Expected: Explicit baby photo save creates an album effect only.
- Checks: 1:PASS, 2:PASS, 3:PASS
- Output: `{"classification":{"intent":"record","mutation":"auto"},"effects":[{"type":"album","mode":"auto","date":"2026-06-06","title":"baby-smile.jpg","note":"保存宝宝照片到成长相册"}],"reply":"这张照片已经保存到小宝的成长相册了。"}`

### screenshot-ignore

- Expected: Screenshot with explicit do-not-save creates no album or records.
- Checks: 1:PASS, 2:PASS
- Output: `{"classification":{"intent":"boundary","mutation":"none"},"effects":[],"reply":"好的，这是App截图，我不会保存。有什么需要我帮忙看的吗？"}`

### read-only-daily-summary

- Expected: Read-only daily summary uses seeded context and creates no effects.
- Checks: 1:PASS, 2:PASS, 3:PASS, 4:PASS
- Output: `{"classification":{"intent":"question","mutation":"none"},"effects":[],"reply":"今天已有记录里，奶量是 240ml，共 3 次，分别在 08:00 和 12:00 各 120ml；睡眠 3 小时，从 13:00 开始。"}`

### caregiver-fatigue-support

- Expected: Caregiver fatigue gets low-anxiety support without mutating app state.
- Checks: 1:PASS, 2:PASS, 3:PASS, 4:PASS
- Output: `{"classification":{"intent":"boundary","mutation":"none"},"effects":[],"reply":"带娃确实很辛苦，你已经做得很好了。累了就歇一歇，别太勉强自己。"}`
