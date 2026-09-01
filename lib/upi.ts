import { Linking, Platform } from 'react-native';

export interface ParsedUpi {
  pa: string;          // Payee VPA / UPI ID (e.g. merchant@upi)
  pn: string;          // Payee Name
  am?: string;         // Amount if specified
  tr?: string;         // Transaction Reference ID
  tn?: string;         // Transaction Note
  cu?: string;         // Currency (e.g. INR)
  rawUrl: string;      // Full raw QR string
}

/**
 * Parses standard UPI QR URL strings or raw VPA handles
 * Example: upi://pay?pa=merchant@upi&pn=Merchant%20Name&am=500&cu=INR
 */
export function parseUpiQr(qrString: string): ParsedUpi {
  const cleanStr = qrString.trim();

  // Standard upi://pay?...
  if (cleanStr.startsWith('upi://pay?') || cleanStr.startsWith('UPI://PAY?')) {
    const queryString = cleanStr.split('?')[1] || '';
    const params = new URLSearchParams(queryString);

    const pa = params.get('pa') || params.get('PA') || '';
    const pn = params.get('pn') || params.get('PN') || pa.split('@')[0] || 'Merchant';
    const am = params.get('am') || params.get('AM') || undefined;
    const tr = params.get('tr') || params.get('TR') || undefined;
    const tn = params.get('tn') || params.get('TN') || undefined;
    const cu = params.get('cu') || params.get('CU') || 'INR';

    return { pa, pn, am, tr, tn, cu, rawUrl: cleanStr };
  }

  // Handle plain UPI ID handles (e.g., "9876543210@paytm" or "buildicy@okaxis")
  if (cleanStr.includes('@')) {
    const handle = cleanStr.replace(/\s+/g, '');
    const name = handle.split('@')[0];
    const upiUrl = `upi://pay?pa=${handle}&pn=${encodeURIComponent(name)}&cu=INR`;
    return {
      pa: handle,
      pn: name,
      cu: 'INR',
      rawUrl: upiUrl,
    };
  }

  // Fallback default
  return {
    pa: cleanStr,
    pn: 'Merchant',
    cu: 'INR',
    rawUrl: `upi://pay?pa=${cleanStr}&pn=Merchant&cu=INR`,
  };
}

/**
 * Builds a valid UPI URL with mandatory and optional parameters
 */
export function buildUpiUrl(data: {
  pa: string;
  pn: string;
  am: string;
  tn?: string;
  tr?: string;
}): string {
  const { pa, pn, am, tn, tr } = data;
  let url = `upi://pay?pa=${encodeURIComponent(pa)}&pn=${encodeURIComponent(pn)}&cu=INR`;
  if (am && parseFloat(am) > 0) {
    url += `&am=${encodeURIComponent(am)}`;
  }
  if (tn) {
    url += `&tn=${encodeURIComponent(tn)}`;
  }
  if (tr) {
    url += `&tr=${encodeURIComponent(tr)}`;
  }
  return url;
}

/**
 * Deep-links into specific installed UPI applications on device
 */
export async function launchUpiApp(
  app: 'gpay' | 'phonepe' | 'paytm' | 'generic',
  upiData: { pa: string; pn: string; am: string; tn?: string; tr?: string }
): Promise<boolean> {
  const genericUpiUrl = buildUpiUrl(upiData);

  let targetUrl = genericUpiUrl;

  // Custom scheme overrides if target specified
  if (app === 'gpay') {
    targetUrl = genericUpiUrl.replace('upi://pay', 'gpay://upi/pay');
  } else if (app === 'phonepe') {
    targetUrl = genericUpiUrl.replace('upi://pay', 'phonepe://pay');
  } else if (app === 'paytm') {
    targetUrl = genericUpiUrl.replace('upi://pay', 'paytmmp://pay');
  }

  console.log(`[UPI LAUNCH] Launching ${app} with URI: ${targetUrl}`);

  try {
    const canOpenTarget = await Linking.canOpenURL(targetUrl);
    if (canOpenTarget) {
      await Linking.openURL(targetUrl);
      return true;
    } else {
      console.log(`[UPI LAUNCH FALLBACK] Target app scheme ${app} not directly handled, opening generic UPI intent`);
      const canOpenGeneric = await Linking.canOpenURL(genericUpiUrl);
      if (canOpenGeneric) {
        await Linking.openURL(genericUpiUrl);
        return true;
      } else {
        // Force try opening generic URL
        await Linking.openURL(genericUpiUrl);
        return true;
      }
    }
  } catch (err: any) {
    console.error(`[UPI LAUNCH ERROR] Failed to launch ${app}:`, err.message || err);
    // Final fallback attempt using generic upi:// scheme
    try {
      await Linking.openURL(genericUpiUrl);
      return true;
    } catch (fallbackErr) {
      console.error('[UPI LAUNCH FATAL]', fallbackErr);
      return false;
    }
  }
}
