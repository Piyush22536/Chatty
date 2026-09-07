import admin from "firebase-admin";

// ---------------------------------------------------------------------------
// Firebase Admin SDK — initialised once, imported where needed.
//
// Required env vars (from your Firebase project's Service Account JSON):
//   FIREBASE_PROJECT_ID
//   FIREBASE_CLIENT_EMAIL
//   FIREBASE_PRIVATE_KEY   (copy the full "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n" value)
// ---------------------------------------------------------------------------

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // The private key stored in .env has escaped newlines — restore them
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

export default admin;
