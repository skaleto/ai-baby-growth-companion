package com.xiaobao.babycompanion.agent;

public enum SkillMode {
    EXECUTE("execute"),
    DISCLOSE("disclose"),
    GUARD("guard");

    private final String wireValue;

    SkillMode(String wireValue) {
        this.wireValue = wireValue;
    }

    public String wireValue() {
        return wireValue;
    }
}
