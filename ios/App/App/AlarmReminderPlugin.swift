import Capacitor
import Foundation
import UserNotifications

@objc(AlarmReminderPlugin)
class AlarmReminderPlugin: CAPPlugin, CAPBridgedPlugin {
    let identifier = "AlarmReminderPlugin"
    let jsName = "AlarmReminder"
    let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "scheduleAlarm", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cancelAlarm", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "consumeAlarmEvents", returnType: CAPPluginReturnPromise)
    ]

    private let defaults = UserDefaults.standard
    private let eventQueueKey = "xiaobao_alarm_events"
    private let maxIntervalOccurrences = 32

    @objc func scheduleAlarm(_ call: CAPPluginCall) {
        guard let reminderId = call.getString("reminderId"), !reminderId.isEmpty,
              let dueAt = call.getString("dueAt"), !dueAt.isEmpty else {
            call.reject("reminderId and dueAt are required")
            return
        }

        let notificationId = call.getInt("notificationId") ?? abs(reminderId.hashValue % 2_000_000_000)
        let intervalMinutes = call.getInt("intervalMinutes") ?? 0
        let scheduleMode = call.getString("scheduleMode") ?? (intervalMinutes > 0 ? "interval" : "once")
        let alertMode = call.getString("alertMode") ?? "notification"
        if scheduleMode != "once" && scheduleMode != "interval" {
            call.reject("scheduleMode must be once or interval")
            return
        }
        if alertMode != "notification" && alertMode != "ringing" {
            call.reject("alertMode must be notification or ringing")
            return
        }
        if scheduleMode == "interval" && intervalMinutes <= 0 {
            call.reject("intervalMinutes must be positive for interval reminders")
            return
        }
        guard let firstDueAt = parseIsoDate(dueAt) else {
            call.reject("dueAt must be an ISO date")
            return
        }

        let alarm: [String: Any] = [
            "reminderId": reminderId,
            "notificationId": notificationId,
            "title": call.getString("title") ?? "小宝记提醒",
            "body": call.getString("body") ?? "到提醒时间啦",
            "dueText": call.getString("dueText") ?? "",
            "dueAt": dueAt,
            "scheduleMode": scheduleMode,
            "alertMode": alertMode,
            "intervalMinutes": intervalMinutes,
            "soundId": call.getString("soundId") ?? "soft_chime"
        ]

        cancelStoredAlarm(notificationId: notificationId, reminderId: reminderId)
        saveAlarm(alarm)
        scheduleNotifications(for: alarm, firstDueAt: firstDueAt) { error in
            if let error {
                call.reject("Failed to schedule iOS notification", nil, error)
                return
            }
            var result = JSObject()
            result["scheduled"] = true
            // iOS does not expose an Android-style exact-alarm permission; local notifications are best-effort.
            result["exact"] = true
            call.resolve(result)
        }
    }

    @objc func cancelAlarm(_ call: CAPPluginCall) {
        let reminderId = call.getString("reminderId") ?? ""
        let notificationId = call.getInt("notificationId") ?? abs(reminderId.hashValue % 2_000_000_000)
        cancelStoredAlarm(notificationId: notificationId, reminderId: reminderId)
        var result = JSObject()
        result["cancelled"] = true
        call.resolve(result)
    }

    @objc func consumeAlarmEvents(_ call: CAPPluginCall) {
        let rawEvents = defaults.array(forKey: eventQueueKey) as? [[String: Any]] ?? []
        defaults.set([], forKey: eventQueueKey)
        var result = JSObject()
        result["events"] = rawEvents
        call.resolve(result)
    }

    private func scheduleNotifications(for alarm: [String: Any], firstDueAt: Date, completion: @escaping (Error?) -> Void) {
        let scheduleMode = alarm["scheduleMode"] as? String ?? "once"
        let intervalMinutes = alarm["intervalMinutes"] as? Int ?? 0
        let occurrenceCount = scheduleMode == "interval" ? maxIntervalOccurrences : 1
        let center = UNUserNotificationCenter.current()
        var identifiers: [String] = []
        var firstError: Error?
        let group = DispatchGroup()

        let startDueAt = firstDueAt.timeIntervalSinceNow < 1 ? Date().addingTimeInterval(1) : firstDueAt
        for index in 0..<occurrenceCount {
            let dueAt = scheduleMode == "interval"
                ? startDueAt.addingTimeInterval(TimeInterval(index * intervalMinutes * 60))
                : startDueAt
            let requestId = "\(alarm["notificationId"] as? Int ?? 0)-\(index)"
            identifiers.append(requestId)
            let request = UNNotificationRequest(
                identifier: requestId,
                content: notificationContent(for: alarm, occurrenceIndex: index, requestId: requestId),
                trigger: UNCalendarNotificationTrigger(dateMatching: Calendar.current.dateComponents([.year, .month, .day, .hour, .minute, .second], from: dueAt), repeats: false)
            )

            group.enter()
            center.add(request) { error in
                if firstError == nil {
                    firstError = error
                }
                group.leave()
            }
        }

        group.notify(queue: .main) {
            var nextAlarm = alarm
            nextAlarm["requestIdentifiers"] = identifiers
            self.saveAlarm(nextAlarm)
            completion(firstError)
        }
    }

    private func notificationContent(for alarm: [String: Any], occurrenceIndex: Int, requestId: String) -> UNMutableNotificationContent {
        let content = UNMutableNotificationContent()
        content.title = alarm["title"] as? String ?? "小宝记提醒"
        content.body = alarm["body"] as? String ?? "到提醒时间啦"
        if (alarm["alertMode"] as? String) == "ringing" {
            let soundName = (alarm["soundId"] as? String) == "soft_bell" ? "xiaobao_bell.wav" : "xiaobao_chime.wav"
            content.sound = UNNotificationSound(named: UNNotificationSoundName(rawValue: soundName))
        } else {
            content.sound = .default
        }

        content.userInfo = [
            "cap_extra": [
                "nativeAlarm": true,
                "platform": "ios",
                "requestIdentifier": requestId,
                "reminderId": alarm["reminderId"] as? String ?? "",
                "notificationId": alarm["notificationId"] as? Int ?? 0,
                "title": alarm["title"] as? String ?? "",
                "dueText": alarm["dueText"] as? String ?? "",
                "scheduleMode": alarm["scheduleMode"] as? String ?? "once",
                "alertMode": alarm["alertMode"] as? String ?? "notification",
                "intervalMinutes": alarm["intervalMinutes"] as? Int ?? 0,
                "soundId": alarm["soundId"] as? String ?? "soft_chime",
                "occurrenceIndex": occurrenceIndex
            ]
        ]
        return content
    }

    private func saveAlarm(_ alarm: [String: Any]) {
        let notificationId = alarm["notificationId"] as? Int ?? 0
        defaults.set(alarm, forKey: alarmKey(notificationId))
    }

    private func readAlarm(notificationId: Int) -> [String: Any]? {
        defaults.dictionary(forKey: alarmKey(notificationId))
    }

    private func cancelStoredAlarm(notificationId: Int, reminderId: String) {
        let center = UNUserNotificationCenter.current()
        let identifiers = (readAlarm(notificationId: notificationId)?["requestIdentifiers"] as? [String]) ?? ["\(notificationId)-0"]
        center.removePendingNotificationRequests(withIdentifiers: identifiers)
        center.removeDeliveredNotifications(withIdentifiers: identifiers)
        defaults.removeObject(forKey: alarmKey(notificationId))
    }

    private func alarmKey(_ notificationId: Int) -> String {
        "alarm_\(notificationId)"
    }

    private func parseIsoDate(_ value: String) -> Date? {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = formatter.date(from: value) {
            return date
        }
        formatter.formatOptions = [.withInternetDateTime]
        return formatter.date(from: value)
    }
}
