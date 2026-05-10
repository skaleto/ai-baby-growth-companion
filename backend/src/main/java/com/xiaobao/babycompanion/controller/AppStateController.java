package com.xiaobao.babycompanion.controller;

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

    private final AppStateService appStateService;

    public AppStateController(AppStateService appStateService) {
        this.appStateService = appStateService;
    }

    @GetMapping
    public AppStateResponse read() {
        return appStateService.read();
    }

    @PutMapping
    public AppStateResponse replace(@RequestBody AppStateDto state) {
        return appStateService.replace(state);
    }

    @PostMapping("/import")
    public AppStateResponse importState(@RequestBody AppStateDto state) {
        return appStateService.importState(state);
    }

    @PutMapping("/{collection}/{id}")
    public AppStateResponse upsertRecord(
            @PathVariable String collection,
            @PathVariable String id,
            @RequestParam(defaultValue = "merge") String mode,
            @RequestBody JsonNode item
    ) {
        return appStateService.upsertRecord(collection, id, item, mode);
    }

    @DeleteMapping("/{collection}/{id}")
    public AppStateResponse deleteRecord(@PathVariable String collection, @PathVariable String id) {
        return appStateService.deleteRecord(collection, id);
    }

    @DeleteMapping("/attachments/{id}")
    public AppStateResponse deleteAttachment(@PathVariable String id) {
        return appStateService.deleteAttachment(id);
    }

    @PostMapping("/pending-effects/{id}/confirm")
    public AppStateResponse confirmPendingEffect(@PathVariable String id) {
        return appStateService.confirmPendingEffect(id);
    }

    @PostMapping("/pending-effects/{id}/discard")
    public AppStateResponse discardPendingEffect(@PathVariable String id) {
        return appStateService.discardPendingEffect(id);
    }
}
