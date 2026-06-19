/** Single source of truth for admin identity on the mobile side */
export const ADMIN_PHONE_LAST10 = '6304767391';

const normalizePhone = (phone: string): string => {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits.length > 10 ? digits.slice(-10) : digits;
};

export const isAdminPhone = (phone: string): boolean =>
  normalizePhone(phone) === ADMIN_PHONE_LAST10;
