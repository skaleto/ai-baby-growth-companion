package com.xiaobao.babycompanion.asr;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.ByteBuffer;

import org.junit.jupiter.api.Test;

class DoubaoAsrProtocolTests {

    @Test
    void audioRequestUsesPositiveSequenceForRegularChunks() {
        byte[] frame = DoubaoAsrProtocol.audioRequest(new byte[]{1, 2, 3, 4}, 7, false);

        assertThat(frame[0]).isEqualTo((byte) 0x11);
        assertThat(frame[1]).isEqualTo((byte) 0x21);
        assertThat(frame[2]).isEqualTo((byte) 0x01);
        assertThat(ByteBuffer.wrap(frame, 4, 4).getInt()).isEqualTo(7);
        assertThat(ByteBuffer.wrap(frame, 8, 4).getInt()).isPositive();
    }

    @Test
    void audioRequestUsesNegativeSequenceForFinalChunk() {
        byte[] frame = DoubaoAsrProtocol.audioRequest(new byte[0], 8, true);

        assertThat(frame[1]).isEqualTo((byte) 0x23);
        assertThat(ByteBuffer.wrap(frame, 4, 4).getInt()).isEqualTo(-8);
        assertThat(ByteBuffer.wrap(frame, 8, 4).getInt()).isPositive();
    }
}
