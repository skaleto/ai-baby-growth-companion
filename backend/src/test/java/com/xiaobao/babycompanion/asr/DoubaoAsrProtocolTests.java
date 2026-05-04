package com.xiaobao.babycompanion.asr;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.ByteBuffer;

import org.junit.jupiter.api.Test;

class DoubaoAsrProtocolTests {

    @Test
    void audioRequestUsesPositiveSequenceForRegularChunks() {
        byte[] frame = DoubaoAsrProtocol.audioRequest(new byte[]{1, 2, 3, 4}, 7, false);

        assertThat(frame[0]).isEqualTo((byte) 0x11);
        assertThat(frame[1]).isEqualTo((byte) 0x20);
        assertThat(frame[2]).isEqualTo((byte) 0x01);
        assertThat(ByteBuffer.wrap(frame, 4, 4).getInt()).isPositive();
    }

    @Test
    void audioRequestUsesNegativeSequenceForFinalChunk() {
        byte[] frame = DoubaoAsrProtocol.audioRequest(new byte[0], 8, true);

        assertThat(frame[1]).isEqualTo((byte) 0x22);
        assertThat(ByteBuffer.wrap(frame, 4, 4).getInt()).isPositive();
    }

    @Test
    void parsesUncompressedProviderErrorFrames() {
        byte[] payload = "{\"error\":\"bad request\"}".getBytes();
        ByteBuffer frame = ByteBuffer.allocate(4 + 4 + 4 + payload.length);
        frame.put((byte) 0x11);
        frame.put((byte) 0xf0);
        frame.put((byte) 0x10);
        frame.put((byte) 0);
        frame.putInt(451234);
        frame.putInt(payload.length);
        frame.put(payload);

        DoubaoAsrProtocol.ParsedFrame parsed = DoubaoAsrProtocol.parse(frame.array());

        assertThat(parsed.error()).isTrue();
        assertThat(parsed.errorCode()).isEqualTo(451234);
        assertThat(parsed.payload()).contains("bad request");
    }
}
