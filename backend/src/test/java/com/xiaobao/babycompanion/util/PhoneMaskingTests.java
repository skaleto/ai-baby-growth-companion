package com.xiaobao.babycompanion.util;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class PhoneMaskingTests {

    @Test
    void masksMiddleFourDigitsOfElevenDigitNumber() {
        assertThat(PhoneMasking.mask("13800008888")).isEqualTo("138****8888");
        assertThat(PhoneMasking.mask("13800000002")).isEqualTo("138****0002");
    }

    @Test
    void returnsPlaceholderForNull() {
        assertThat(PhoneMasking.mask(null)).isEqualTo("***");
    }

    @Test
    void returnsPlaceholderForEmptyOrBlank() {
        assertThat(PhoneMasking.mask("")).isEqualTo("***");
        assertThat(PhoneMasking.mask("   ")).isEqualTo("***");
    }

    @Test
    void returnsOriginalForNonElevenDigitValues() {
        assertThat(PhoneMasking.mask("-")).isEqualTo("-");
        assertThat(PhoneMasking.mask("123")).isEqualTo("123");
        assertThat(PhoneMasking.mask("138000088888")).isEqualTo("138000088888");
        assertThat(PhoneMasking.mask("1380000888a")).isEqualTo("1380000888a");
        assertThat(PhoneMasking.mask("+8613800008888")).isEqualTo("+8613800008888");
    }

    @Test
    void trimsSurroundingWhitespaceBeforeMasking() {
        assertThat(PhoneMasking.mask("  13800008888  ")).isEqualTo("138****8888");
    }

    @Test
    void isIdempotentForAlreadyMaskedInput() {
        String masked = PhoneMasking.mask("13800008888");
        assertThat(PhoneMasking.mask(masked)).isEqualTo(masked);
    }
}
