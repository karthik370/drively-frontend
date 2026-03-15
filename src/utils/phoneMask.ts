/**
 * Phone number masking utility.
 * Hides the real phone number from the other party for privacy.
 * Shows only the last 4 digits.
 */
export const maskPhoneNumber = (phone: string | null | undefined): string | null => {
    if (!phone) return null;
    const cleaned = phone.replace(/\s/g, '');
    if (cleaned.length <= 4) return cleaned;
    const visible = cleaned.slice(-4);
    const masked = '*'.repeat(cleaned.length - 4);
    return `${masked}${visible}`;
};

/**
 * Format phone for display:
 * Input:  +919876543210
 * Output: +91 ******* 3210
 */
export const formatMaskedPhone = (phone: string | null | undefined): string => {
    if (!phone) return 'Phone hidden';
    const cleaned = phone.replace(/\s/g, '');

    // Extract country code if present
    let countryCode = '';
    let number = cleaned;

    if (cleaned.startsWith('+91')) {
        countryCode = '+91 ';
        number = cleaned.slice(3);
    } else if (cleaned.startsWith('91') && cleaned.length > 10) {
        countryCode = '+91 ';
        number = cleaned.slice(2);
    }

    if (number.length <= 4) return `${countryCode}${number}`;

    const visible = number.slice(-4);
    const maskedLen = number.length - 4;
    return `${countryCode}${'*'.repeat(maskedLen)} ${visible}`;
};
