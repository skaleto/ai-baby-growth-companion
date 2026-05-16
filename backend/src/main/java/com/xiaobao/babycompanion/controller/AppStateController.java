package com.xiaobao.babycompanion.controller;

import java.util.Set;

import com.xiaobao.babycompanion.auth.CurrentUser;
import com.xiaobao.babycompanion.dto.app.AppStateDto;
import com.xiaobao.babycompanion.dto.app.AppStateResponse;
import com.xiaobao.babycompanion.service.AppStateService;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/app/state")
public class AppStateController {

    private static final Set<String> ALLOWED_COLLECTIONS = Set.of(
            "profile",
            "messages",
            "growthEvents",
            "careLogs",
            "reminders",
            "memories",
            "pendingEffects",
            "albumItems",
            "expenses",
            "conversationSummary"
    );

    private static final Set<String> ALLOWED_UPSERT_MODES = Set.of("merge", "replace");

    private static final int MAX_PATH_ID_LENGTH = 128;

    private final AppStateService appStateService;
    private final CurrentUser currentUser;

    public AppStateController(AppStateService appStateService, CurrentUser currentUser) {
        this.appStateService = appStateService;
        this.currentUser = currentUser;
    }

    @GetMapping
    public AppStateResponse read() {
        currentUser.requirePrincipal();
        return appStateService.read();
    }

    @PutMapping
    public AppStateResponse replace(@RequestBody AppStateDto state) {
        currentUser.requireCaregiver();
        return appStateService.replace(state);
    }

    @PostMapping("/import")
    public AppStateResponse importState(@RequestBody AppStateDto state) {
        currentUser.requireCaregiver();
        return appStateService.importState(state);
    }

    @PutMapping("/{collection}/{id}")
    public AppStateResponse upsertRecord(
            @PathVariable String collection,
            @PathVariable String id,
            @RequestParam(defaultValue = "merge") String mode,
            @RequestBody JsonNode item
    ) {
        currentUser.requireCaregiver();
        validateCollection(collection);
        validateId(id);
        validateMode(mode);
        return appStateService.upsertRecord(collection, id, item, mode);
    }

    @DeleteMapping("/{collection}/{id}")
    public AppStateResponse deleteRecord(@PathVariable String collection, @PathVariable String id) {
        currentUser.requireCaregiver();
        validateCollection(collection);
        validateId(id);
        return appStateService.deleteRecord(collection, id);
    }

    @DeleteMapping("/attachments/{id}")
    public AppStateResponse deleteAttachment(@PathVariable String id) {
        currentUser.requireCaregiver();
        validateId(id);
        return appStateService.deleteAttachment(id);
    }

    @PostMapping("/pending-effects/{id}/confirm")
    public AppStateResponse confirmPendingEffect(@PathVariable String id) {
        currentUser.requireCaregiver();
        validateId(id);
        return appStateService.confirmPendingEffect(id);
    }

    @PostMapping("/pending-effects/{id}/discard")
    public AppStateResponse discardPendingEffect(@PathVariable String id) {
        currentUser.requireCaregiver();
        validateId(id);
        return appStateService.discardPendingEffect(id);
    }

    private void validateCollection(String collection) {
        if (collection == null || !ALLOWED_COLLECTIONS.contains(collection)) {
            throw new IllegalArgumentException("Unsupported state collection.");
        }
    }

    private void validateMode(String mode) {
        if (mode == null || !ALLOWED_UPSERT_MODES.contains(mode)) {
            throw new IllegalArgumentException("Unsupported upsert mode.");
        }
    }

    private void validateId(String id) {
        if (id == null || id.isEmpty() || id.length() > MAX_PATH_ID_LENGTH) {
            throw new IllegalArgumentException("Invalid record id.");
        }
    }
}
