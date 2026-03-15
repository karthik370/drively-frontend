/**
 * Cashfree Payment Gateway — Mobile Service
 * ───────────────────────────────────────────
 * Wraps the react-native-cashfree-pg-sdk (v2) to open
 * the Cashfree checkout overlay.
 *
 * NOTE: react-native-cashfree-pg-sdk has native modules —
 * you'll need a dev client build (not Expo Go).
 */
import { CASHFREE_ENV } from '../constants/config';

export type CashfreeCheckoutParams = {
  orderId: string;
  paymentSessionId: string;
};

export type CashfreeSuccess = {
  orderId: string;
};

/**
 * Opens the Cashfree checkout UI (Drop Checkout).
 * Returns { orderId } on success, which you then send to backend /verify.
 */
export const openCashfreeCheckout = (params: CashfreeCheckoutParams): Promise<CashfreeSuccess> => {
  return new Promise(async (resolve, reject) => {
    if (!params.paymentSessionId) {
      return reject(new Error('Cashfree paymentSessionId is required'));
    }
    if (!params.orderId) {
      return reject(new Error('Cashfree orderId is required'));
    }

    try {
      // ── v2 named exports ──
      const { CFPaymentGatewayService } = require('react-native-cashfree-pg-sdk');
      const {
        CFSession,
        CFEnvironment,
        CFDropCheckoutPayment,
      } = require('cashfree-pg-api-contract');

      // 1. Register callbacks BEFORE starting the payment
      CFPaymentGatewayService.setCallback({
        onVerify: (orderIdResult: string) => {
          console.log('[Cashfree] Payment verified, orderId:', orderIdResult);
          resolve({ orderId: orderIdResult || params.orderId });
        },
        onError: (error: any, orderIdResult: string) => {
          console.log('[Cashfree] Payment error:', JSON.stringify(error), 'orderId:', orderIdResult);
          const msg =
            error?.getMessage?.() ||
            error?.message ||
            error?.reason ||
            'Payment was cancelled or failed.';
          reject(new Error(msg));
        },
      });

      // 2. Build session & checkout payment objects
      const env = CASHFREE_ENV === 'PRODUCTION' ? CFEnvironment.PRODUCTION : CFEnvironment.SANDBOX;

      console.log('[Cashfree] Opening checkout:', {
        orderId: params.orderId,
        env: CASHFREE_ENV,
        paymentSessionId: params.paymentSessionId,
        sessionIdLength: params.paymentSessionId?.length,
      });

      const session = new CFSession(params.paymentSessionId, params.orderId, env);
      const checkoutPayment = new CFDropCheckoutPayment(session, null, null);

      // 3. Start payment
      CFPaymentGatewayService.doPayment(checkoutPayment);
    } catch (error: any) {
      console.error('[Cashfree] SDK error:', error);
      reject(new Error(error?.message || 'Failed to open Cashfree checkout'));
    }
  });
};
