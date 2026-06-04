package com.xiaobao.babycompanion.util;

/**
 * Masks phone numbers for safe logging and display.
 *
 * <p>Full phone numbers must never appear in info/warn/error logs. This helper turns a Chinese
 * mainland 11-digit mobile number such as {@code 13800008888} into {@code 138****8888}, keeping the
 * first three and last four digits while hiding the middle four.
 *
 * <p>The method never throws: blank input becomes {@code "***"}, and any value that is not a plain
 * 11-digit number (already masked, malformed, or a placeholder like {@code "-"}) is returned
 * unchanged so callers can log it as-is without leaking a full number.
 */
public final class PhoneMasking {

    private static final String EMPTY_MASK = "***";

    private PhoneMasking() {
    }

    /**
     * Returns a masked representation of the given phone number.
     *
     * @param phone the raw phone value (may be {@code null})
     * @return {@code "***"} for blank input; the masked form for an 11-digit number; otherwise the
     *     original value unchanged
     */
    public static String mask(String phone) {
        if (phone == null) {
            return EMPTY_MASK;
        }
        String trimmed = phone.trim();
        if (trimmed.isEmpty()) {
            return EMPTY_MASK;
        }
        if (!isElevenDigit(trimmed)) {
            return phone;
        }
        return trimmed.substring(0, 3) + "****" + trimmed.substring(7);
    }

    private static boolean isElevenDigit(String value) {
        if (value.length() != 11) {
            return false;
        }
        for (int i = 0; i < value.length(); i++) {
            if (!Character.isDigit(value.charAt(i))) {
                return false;
            }
        }
        return true;
    }
}
