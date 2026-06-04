package com.xiaobao.babycompanion.controller;

import java.util.List;

import com.xiaobao.babycompanion.dto.privacy.DataRightsRequest;
import com.xiaobao.babycompanion.dto.privacy.DataRightsRequestDto;
import com.xiaobao.babycompanion.service.DataRightsService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/data-rights")
public class DataRightsController {

    private final DataRightsService dataRightsService;

    public DataRightsController(DataRightsService dataRightsService) {
        this.dataRightsService = dataRightsService;
    }

    @PostMapping("/request")
    public DataRightsRequestDto submitRequest(@RequestBody(required = false) DataRightsRequest request) {
        return dataRightsService.submitRequest(
                request == null ? null : request.type(),
                request == null ? null : request.reason()
        );
    }

    @GetMapping("/requests")
    public List<DataRightsRequestDto> listRequests() {
        return dataRightsService.listOwnRequests();
    }
}
