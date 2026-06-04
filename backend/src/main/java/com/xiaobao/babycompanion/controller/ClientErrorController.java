package com.xiaobao.babycompanion.controller;

import com.xiaobao.babycompanion.dto.clienterror.ClientErrorAck;
import com.xiaobao.babycompanion.dto.clienterror.ClientErrorReport;
import com.xiaobao.babycompanion.service.ClientErrorService;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * REQ-OBS-001 (R0.5): receives minimal crash / white-screen / OTA-failure reports from the frontend
 * error boundary. Reachable without authentication (a crash may happen before login), and accepts
 * only the bounded technical fields in {@link ClientErrorReport} — never chat content or media.
 */
@RestController
@RequestMapping("/api/client-errors")
public class ClientErrorController {

    private final ClientErrorService clientErrorService;

    public ClientErrorController(ClientErrorService clientErrorService) {
        this.clientErrorService = clientErrorService;
    }

    @PostMapping
    public ClientErrorAck report(@RequestBody(required = false) ClientErrorReport report) {
        clientErrorService.record(report);
        return new ClientErrorAck(true);
    }
}
