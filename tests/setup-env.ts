process.env.DATABASE_URL = process.env.DATABASE_URL_TEST || "postgresql://benne:benne@localhost:5432/bennedirect_test";
process.env.APP_SECRET = "test-secret-test-secret-test-secret-0123456789";
process.env.DEV_LOG_OTP = "true";
process.env.STORAGE_DIR = "/tmp/benne-test-storage";
for (const k of ["SMTP_HOST", "SMTP_FROM", "TWILIO_ACCOUNT_SID", "VAPID_PRIVATE_KEY", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"]) delete process.env[k];
process.env.SMS_PROVIDER = "none";
