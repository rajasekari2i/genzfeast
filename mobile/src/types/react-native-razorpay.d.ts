// react-native-razorpay ships no usable root-level TypeScript types (only a
// sample-app-local declaration file) — this is the minimal shape this
// codebase actually calls. See CartScreen.tsx.
declare module 'react-native-razorpay' {
  export interface RazorpayCheckoutOptions {
    key: string;
    amount: number;
    currency?: string;
    order_id: string;
    name?: string;
    description?: string;
    prefill?: { email?: string; contact?: string; name?: string };
    theme?: { color?: string };
    // BRD/PRD V1 scope: UPI-only. config_id (Dashboard's Payment Methods
    // Configuration) is included for completeness but is NOT confirmed
    // supported by the React Native Standard SDK this package wraps — only
    // Checkout.js/web and Payment Links document it. `method` below is
    // documented for this SDK and is the one actually enforcing the
    // restriction (CartScreen.tsx).
    config_id?: string;
    method?: {
      upi?: '0' | '1';
      card?: '0' | '1';
      netbanking?: '0' | '1';
      wallet?: '0' | '1';
      paylater?: '0' | '1';
    };
  }

  export interface RazorpaySuccessResult {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature?: string;
  }

  const RazorpayCheckout: {
    open(options: RazorpayCheckoutOptions): Promise<RazorpaySuccessResult>;
  };

  export default RazorpayCheckout;
}
