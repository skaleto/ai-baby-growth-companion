package com.xiaobao.babycompanion.agent;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

public enum SkillMode {
    EXECUTE("execute"),
    DISCLOSE("disclose"),
    GUARD("guard");

    private final String wireValue;

    SkillMode(String wireValue) {
        this.wireValue = wireValue;
    }

    @JsonValue
    public String wireValue() {
        return wireValue;
    }

    @JsonCreator
    public static SkillMode fromWireValue(String value) {
        if (value == null) return null;
        for (SkillMode mode : values()) {
            if (mode.name().equalsIgnoreCase(value) || mode.wireValue.equalsIgnoreCase(value)) {
                return mode;
            }
        }
        return null;
    }
}
