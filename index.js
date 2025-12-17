const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Firebase Admin with environment variables
// Initialize Firebase Admin with environment variables
const serviceAccount = {
  type: process.env.type,
  project_id: process.env.project_id,
  private_key_id: process.env.private_key_id,
  private_key: process.env.private_key ? process.env.private_key.replace(/\\n/g, '\n') : '',
  client_email: process.env.client_email,
  client_id: process.env.client_id,
  auth_uri: process.env.auth_uri,
  token_uri: process.env.token_uri,
  auth_provider_x509_cert_url: process.env.auth_provider_x609_cert_url,
  client_x509_cert_url: process.env.client_x509_cert_url,
  universe_domain: process.env.universe_domain || 'googleapis.com'
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Health check
app.get('/', (req, res) => {
  res.json({ 
    status: 'Server is running!',
    timestamp: new Date().toISOString()
  });
});

// Send notification endpoint
app.post('/sendNotification', async (req, res) => {
  try {
    const { receiverUid, title, body } = req.body;

    console.log('Received notification request:', { receiverUid, title, body });

    // Validate input
    if (!receiverUid || !title || !body) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        received: { receiverUid, title, body }
      });
    }

    // Get FCM token from Firestore
    const userDoc = await db.collection('users').doc(receiverUid).get();

    if (!userDoc.exists) {
      console.log('User not found:', receiverUid);
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = userDoc.data();
    const fcmToken = userData.fcmToken;

    if (!fcmToken) {
      console.log('No FCM token for user:', receiverUid);
      return res.status(404).json({ error: 'No FCM token found for this user' });
    }

    console.log('Sending notification to token:', fcmToken.substring(0, 20) + '...');

    // Send notification via Firebase Admin SDK
    const message = {
      notification: {
        title: title,
        body: body,
      },
      data: {
        click_action: 'FLUTTER_NOTIFICATION_CLICK',
        screen: 'chat',
      },
      token: fcmToken,
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'high_importance_channel'
        }
      }
    };

    const response = await admin.messaging().send(message);
    console.log('✅ Notification sent successfully:', response);

    return res.status(200).json({ 
      success: true, 
      messageId: response 
    });

  } catch (error) {
    console.error('❌ Error sending notification:', error);
    return res.status(500).json({ 
      error: error.message,
      code: error.code 
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
