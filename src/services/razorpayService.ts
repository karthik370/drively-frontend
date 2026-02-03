import { RAZORPAY_KEY_ID } from '../constants/config';

export type RazorpaySuccess = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

export type RazorpayCheckoutParams = {
  orderId: string;
  amountPaise: number;
  currency: string;
  name: string;
  description: string;
  prefill?: {
    contact?: string;
    email?: string;
    name?: string;
  };
};

export const openRazorpayCheckout = async (params: RazorpayCheckoutParams): Promise<RazorpaySuccess> => {
  if (!RAZORPAY_KEY_ID) {
    throw new Error('Razorpay key is not configured (EXPO_PUBLIC_RAZORPAY_KEY_ID)');
  }
  if (!params.orderId) {
    throw new Error('Razorpay orderId is required');
  }
  if (!Number.isFinite(params.amountPaise) || params.amountPaise <= 0) {
    throw new Error('Razorpay amount must be > 0');
  }

  const RazorpayCheckout = require('react-native-razorpay');

  const options = {
    key: RAZORPAY_KEY_ID,
    amount: String(params.amountPaise),
    currency: params.currency || 'INR',
    name: params.name,
    description: params.description,
    order_id: params.orderId,
    prefill: {
      contact: params.prefill?.contact,
      email: params.prefill?.email,
      name: params.prefill?.name,
    },
    theme: { color: '#2563eb' },
  };

  const data = (await RazorpayCheckout.open(options)) as any;

  return {
    razorpay_order_id: String(data?.razorpay_order_id || ''),
    razorpay_payment_id: String(data?.razorpay_payment_id || ''),
    razorpay_signature: String(data?.razorpay_signature || ''),
  };
};
