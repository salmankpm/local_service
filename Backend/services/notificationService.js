// ─────────────────────────────────────────────────────────────
//  Notification Service
//  — SMS via Twilio (OTP)
//  — Push via Firebase Cloud Messaging (booking alerts)
// ─────────────────────────────────────────────────────────────

// ── Twilio SMS ────────────────────────────────
let twilioClient = null;
try {
  const twilio = require('twilio');
  twilioClient = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );
} catch {
  console.warn('Twilio not configured — SMS disabled');
}

/**
 * Send OTP via SMS
 */
const sendOTPSms = async (phone, otp) => {
  if (!twilioClient) {
    console.log(`[DEV] OTP for ${phone}: ${otp}`);
    return;
  }
  await twilioClient.messages.create({
    body: `Your Sewa OTP is: ${otp}. Valid for 5 minutes. Do not share.`,
    from: process.env.TWILIO_PHONE,
    to:   phone,
  });
};

// ── Firebase FCM Push ─────────────────────────
/**
 * Send push notification to a device token
 * Plug in firebase-admin SDK when ready.
 */
const sendPush = async (fcmToken, title, body, data = {}) => {
  if (!fcmToken) return;
  // Example with firebase-admin:
  // await admin.messaging().send({
  //   token: fcmToken,
  //   notification: { title, body },
  //   data,
  // });
  console.log(`[PUSH] → ${fcmToken.slice(0,12)}... | ${title}: ${body}`);
};

// ── Notification helpers ──────────────────────
const notifyNewBooking = (workerFcmToken, userName, service) =>
  sendPush(workerFcmToken, 'New booking request!',
    `${userName} wants ${service}. Accept or decline.`,
    { type: 'new_booking' });

const notifyBookingAccepted = (userFcmToken, workerName) =>
  sendPush(userFcmToken, 'Booking confirmed ✅',
    `${workerName} has accepted your booking.`,
    { type: 'booking_accepted' });

const notifyBookingCompleted = (userFcmToken, service) =>
  sendPush(userFcmToken, 'Job completed!',
    `Your ${service} booking is complete. Please rate your experience.`,
    { type: 'booking_completed' });

const notifyPaymentSuccess = (userFcmToken, amount) =>
  sendPush(userFcmToken, 'Payment successful 🎉',
    `₹${amount} paid securely via Sewa.`,
    { type: 'payment_success' });

module.exports = {
  sendOTPSms,
  sendPush,
  notifyNewBooking,
  notifyBookingAccepted,
  notifyBookingCompleted,
  notifyPaymentSuccess,
};