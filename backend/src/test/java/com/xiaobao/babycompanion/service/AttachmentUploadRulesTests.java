package com.xiaobao.babycompanion.service;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.xiaobao.babycompanion.config.AppStorageProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class AttachmentUploadRulesTests {

    private AttachmentUploadRules rules;

    @BeforeEach
    void setUp() {
        AppStorageProperties properties = new AppStorageProperties();
        properties.setMaxUploadBytes(10_000_000);
        properties.setMaxVideoUploadBytes(50_000_000);
        rules = new AttachmentUploadRules(properties);
    }

    @Test
    void acceptsJpegWithCorrectMagicBytes() {
        byte[] jpeg = concat(new byte[] {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0}, new byte[64]);
        assertThatCode(() -> rules.validate("image/jpeg", jpeg)).doesNotThrowAnyException();
    }

    @Test
    void acceptsPngWithCorrectMagicBytes() {
        byte[] png = concat(
                new byte[] {(byte) 0x89, (byte) 0x50, (byte) 0x4E, (byte) 0x47,
                        (byte) 0x0D, (byte) 0x0A, (byte) 0x1A, (byte) 0x0A},
                new byte[16]);
        assertThatCode(() -> rules.validate("image/png", png)).doesNotThrowAnyException();
    }

    @Test
    void acceptsMp4WithFtypBox() {
        byte[] mp4 = concat(
                new byte[] {0x00, 0x00, 0x00, 0x18, 'f', 't', 'y', 'p'},
                new byte[64]);
        assertThatCode(() -> rules.validate("video/mp4", mp4)).doesNotThrowAnyException();
    }

    @Test
    void acceptsWavWithRiffWaveHeader() {
        byte[] wav = concat(
                new byte[] {'R', 'I', 'F', 'F', 0x00, 0x00, 0x00, 0x00, 'W', 'A', 'V', 'E'},
                new byte[32]);
        assertThatCode(() -> rules.validate("audio/wav", wav)).doesNotThrowAnyException();
    }

    @Test
    void rejectsTextPayloadDeclaredAsImage() {
        byte[] bytes = "hello world this is not an image".getBytes();
        assertThatThrownBy(() -> rules.validate("image/png", bytes))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("does not match declared type");
    }

    @Test
    void rejectsExecutableHeaderDeclaredAsJpeg() {
        byte[] elf = concat(new byte[] {0x7F, 'E', 'L', 'F'}, new byte[32]);
        assertThatThrownBy(() -> rules.validate("image/jpeg", elf))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("does not match declared type");
    }

    @Test
    void rejectsHtmlContentDeclaredAsImage() {
        byte[] html = "<html><script>alert(1)</script></html>".getBytes();
        assertThatThrownBy(() -> rules.validate("image/jpeg", html))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("does not match declared type");
    }

    @Test
    void rejectsUnsupportedMimeType() {
        byte[] anything = new byte[] {1, 2, 3, 4, 5};
        assertThatThrownBy(() -> rules.validate("application/x-shockwave-flash", anything))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Unsupported attachment type");
    }

    @Test
    void rejectsEmptyPayload() {
        assertThatThrownBy(() -> rules.validate("image/jpeg", new byte[0]))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("empty");
    }

    private byte[] concat(byte[] head, byte[] tail) {
        byte[] result = new byte[head.length + tail.length];
        System.arraycopy(head, 0, result, 0, head.length);
        System.arraycopy(tail, 0, result, head.length, tail.length);
        return result;
    }
}
