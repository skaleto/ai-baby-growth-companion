package com.xiaobao.babycompanion.asr;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.util.zip.GZIPInputStream;
import java.util.zip.GZIPOutputStream;

final class DoubaoAsrProtocol {

    private static final int VERSION = 0x1;
    private static final int HEADER_SIZE = 0x1;
    private static final int FULL_CLIENT_REQUEST = 0x1;
    private static final int AUDIO_ONLY_REQUEST = 0x2;
    private static final int FULL_SERVER_RESPONSE = 0x9;
    private static final int SERVER_ACK = 0xB;
    private static final int SERVER_ERROR_RESPONSE = 0xF;
    private static final int POS_SEQUENCE = 0x1;
    private static final int NEG_SEQUENCE = 0x2;
    private static final int NEG_WITH_SEQUENCE = 0x3;
    private static final int JSON = 0x1;
    private static final int NO_SERIALIZATION = 0x0;
    private static final int GZIP = 0x1;

    private DoubaoAsrProtocol() {
    }

    static byte[] fullClientRequest(String json) {
        byte[] payload = gzip(json.getBytes(StandardCharsets.UTF_8));
        return frame(FULL_CLIENT_REQUEST, 0, JSON, GZIP, null, payload);
    }

    static byte[] audioRequest(byte[] pcmChunk, int sequence, boolean last) {
        byte[] payload = gzip(pcmChunk);
        return frame(AUDIO_ONLY_REQUEST, last ? NEG_SEQUENCE : 0, NO_SERIALIZATION, GZIP, null, payload);
    }

    static ParsedFrame parse(byte[] bytes) {
        if (bytes.length < 8) {
            throw new IllegalArgumentException("ASR frame is too short");
        }

        int headerSize = (bytes[0] & 0x0F) * 4;
        int messageType = (bytes[1] >> 4) & 0x0F;
        int flags = bytes[1] & 0x0F;
        int serialization = (bytes[2] >> 4) & 0x0F;
        int compression = bytes[2] & 0x0F;
        int offset = headerSize;
        Integer sequence = null;
        Integer errorCode = null;
        if (messageType == SERVER_ERROR_RESPONSE) {
            requireLength(bytes, offset + 4);
            errorCode = ByteBuffer.wrap(bytes, offset, 4).getInt();
            offset += 4;
        } else if (flags == POS_SEQUENCE || flags == NEG_WITH_SEQUENCE) {
            requireLength(bytes, offset + 4);
            sequence = ByteBuffer.wrap(bytes, offset, 4).getInt();
            offset += 4;
        }

        requireLength(bytes, offset + 4);
        int payloadSize = ByteBuffer.wrap(bytes, offset, 4).getInt();
        offset += 4;
        requireLength(bytes, offset + Math.max(payloadSize, 0));

        byte[] payload = new byte[Math.max(payloadSize, 0)];
        System.arraycopy(bytes, offset, payload, 0, payload.length);
        if (compression == GZIP) {
            payload = gunzip(payload);
        }

        String textPayload = serialization == JSON || messageType == FULL_SERVER_RESPONSE || messageType == SERVER_ERROR_RESPONSE
                ? new String(payload, StandardCharsets.UTF_8)
                : "";
        return new ParsedFrame(messageType, sequence, errorCode, textPayload, messageType == SERVER_ERROR_RESPONSE);
    }

    private static byte[] frame(
            int messageType,
            int flags,
            int serialization,
            int compression,
            Integer sequence,
            byte[] payload
    ) {
        int size = 4 + (sequence == null ? 0 : 4) + 4 + payload.length;
        ByteBuffer buffer = ByteBuffer.allocate(size);
        buffer.put((byte) ((VERSION << 4) | HEADER_SIZE));
        buffer.put((byte) ((messageType << 4) | flags));
        buffer.put((byte) ((serialization << 4) | compression));
        buffer.put((byte) 0);
        if (sequence != null) {
            buffer.putInt(sequence);
        }
        buffer.putInt(payload.length);
        buffer.put(payload);
        return buffer.array();
    }

    private static void requireLength(byte[] bytes, int length) {
        if (bytes.length < length) {
            throw new IllegalArgumentException("ASR frame payload is incomplete");
        }
    }

    private static byte[] gzip(byte[] bytes) {
        try {
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            try (GZIPOutputStream gzip = new GZIPOutputStream(output)) {
                gzip.write(bytes);
            }
            return output.toByteArray();
        } catch (IOException exception) {
            throw new IllegalStateException("Failed to gzip ASR payload", exception);
        }
    }

    private static byte[] gunzip(byte[] bytes) {
        try (GZIPInputStream gzip = new GZIPInputStream(new ByteArrayInputStream(bytes))) {
            return gzip.readAllBytes();
        } catch (IOException exception) {
            throw new IllegalArgumentException("Failed to gunzip ASR payload", exception);
        }
    }

    record ParsedFrame(int messageType, Integer sequence, Integer errorCode, String payload, boolean error) {
        boolean isTextResponse() {
            return messageType == FULL_SERVER_RESPONSE || messageType == SERVER_ACK || messageType == SERVER_ERROR_RESPONSE;
        }
    }
}
