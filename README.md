# WhatsApp Tendering System

A comprehensive WhatsApp-based tendering system for suppliers in Oman, built with Node.js, PostgreSQL, Twilio WhatsApp API, and OpenAI for voice transcription and translation.

## 🚀 Features

- **📱 WhatsApp Integration**: Send tender alerts and receive bids via WhatsApp
- **🎤 Voice Support**: Accept voice messages with automatic transcription and translation
- **🌐 Multi-language**: Support for English, Arabic, Hindi, and Urdu
- **📊 Real-time Dashboard**: Monitor tenders, bids, and system status
- **👥 Supplier Management**: Add, manage, and test supplier connections
- **🔔 Notifications**: Automatic notifications to coordinators when bids are received
- **📝 Logging**: Comprehensive system logs and audit trail

## 🏗️ Architecture

- **Backend**: Node.js with Express
- **Database**: PostgreSQL (with mock fallback for development)
- **WhatsApp**: Twilio WhatsApp Business API
- **AI**: OpenAI Whisper (voice transcription) + GPT-4 (translation)
- **Frontend**: HTML/CSS/JavaScript dashboard
- **Deployment**: Render (with PostgreSQL add-on)

## 📋 Prerequisites

Before deploying, you'll need:

1. **Twilio Account** (for WhatsApp Business API)
2. **OpenAI API Key** (for voice transcription and translation)
3. **PostgreSQL Database** (provided by Render)
4. **WhatsApp Business Phone Number** (from Twilio)

## 🚀 Deployment on Render

### Step 1: Prepare Your Repository

1. Push your code to GitHub
2. Ensure your repository is public or connected to Render

### Step 2: Create Render App

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Configure the service:
   - **Name**: `whatsapp-tendering-system`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free (or paid for better performance)

### Step 3: Add PostgreSQL Database

1. In your Render dashboard, click "New +" → "PostgreSQL"
2. Configure the database:
   - **Name**: `tendering-db`
   - **Database**: `tendering_system`
   - **User**: Auto-generated
   - **Plan**: Free (or paid for better performance)
3. Copy the **Internal Database URL** for the next step

### Step 4: Configure Environment Variables

In your Render app settings, add these environment variables:

```bash
# Required for production
NODE_ENV=production
DATABASE_URL=postgres://username:password@host:port/database_name
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=whatsapp:+14155238886
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
ADMIN_PHONE=whatsapp:+968XXXXXXXX

# Optional
JWT_SECRET=your_jwt_secret_key_here
LOG_LEVEL=info
```

### Step 5: Deploy

1. Click "Create Web Service"
2. Wait for the build to complete
3. Your app will be available at `https://your-app-name.onrender.com`

## 🔧 Configuration

### Twilio Setup

1. **Create Twilio Account**:
   - Go to [Twilio Console](https://console.twilio.com/)
   - Sign up for a free account

2. **Get WhatsApp Business Number**:
   - Go to "Messaging" → "Try it out" → "Send a WhatsApp message"
   - Follow the instructions to get your WhatsApp number
   - Note: You'll need to verify your business for production use

3. **Get Credentials**:
   - Copy your Account SID and Auth Token from the console
   - Add them to your environment variables

### OpenAI Setup

1. **Create OpenAI Account**:
   - Go to [OpenAI Platform](https://platform.openai.com/)
   - Sign up and add billing information

2. **Get API Key**:
   - Go to "API Keys" section
   - Create a new API key
   - Add it to your environment variables

### Webhook Configuration

1. **Set Webhook URL in Twilio**:
   - Go to Twilio Console → "Messaging" → "Settings" → "WhatsApp Sandbox Settings"
   - Set the webhook URL to: `https://your-app-name.onrender.com/api/whatsapp/webhook`
   - Set HTTP method to: `POST`

## 📱 Usage

### Dashboard Access

Once deployed, access your dashboard at:
```
https://your-app-name.onrender.com/dashboard
```

### Adding Suppliers

1. Go to the "Suppliers" tab in the dashboard
2. Click "Add New Supplier"
3. Enter the supplier's WhatsApp number (with country code)
4. Add their name, email, and preferred language
5. Click "Add Supplier"

### Posting Tenders

1. Go to the "Tenders" tab
2. Fill out the tender form:
   - **Title**: Description of items needed
   - **Category**: Type of goods/services
   - **Quantity**: Number of items
   - **Unit**: Unit of measurement
   - **Closing Date**: When bids are due
   - **Description**: Additional details
3. Click "Post Tender"
4. The system will automatically send WhatsApp alerts to all active suppliers

### Receiving Bids

When suppliers respond via WhatsApp:
1. **Text Messages**: Automatically processed and stored
2. **Voice Messages**: Transcribed and translated automatically
3. **Notifications**: Coordinators receive WhatsApp notifications
4. **Dashboard**: All bids appear in the "Bids" tab

### Managing Bids

1. View all bids in the dashboard
2. Use admin commands via WhatsApp:
   - `/listbids` - View recent bids
   - `/winner [tender_id] [bid_id]` - Select winning bid
3. Winners receive automatic notifications

## 🔍 Testing

### Local Testing

1. Clone the repository
2. Install dependencies: `npm install`
3. Create `.env` file from `env.example`
4. Run: `npm start`
5. Access dashboard at: `http://localhost:3000/dashboard`

### Production Testing

1. **Test Webhook**: Send a message to your Twilio WhatsApp number
2. **Test Tender Creation**: Post a tender via dashboard
3. **Test Supplier Alerts**: Verify suppliers receive WhatsApp messages
4. **Test Bid Processing**: Have suppliers respond with bids
5. **Test Notifications**: Verify coordinators receive bid notifications

## 📊 System Status

The dashboard shows real-time system status:

- **Database**: Connection status
- **Twilio**: WhatsApp API configuration
- **OpenAI**: Voice processing configuration
- **Admin Phone**: Coordinator notification setup
- **Counts**: Tenders, bids, and suppliers

## 🔒 Security

- **Webhook Verification**: Twilio signature verification in production
- **Rate Limiting**: API rate limiting to prevent abuse
- **Input Validation**: All inputs validated and sanitized
- **Error Handling**: Comprehensive error handling and logging

## 📝 Logs

System logs are available in the dashboard:
- WhatsApp message logs
- Tender creation logs
- Bid processing logs
- Error logs
- Notification logs

## 🛠️ Development

### Project Structure

```
├── config/
│   ├── database.js      # Database configuration
│   └── mockDatabase.js  # Mock data for development
├── routes/
│   ├── admin.js         # Admin management routes
│   ├── bids.js          # Bid management routes
│   ├── dashboard.js     # Dashboard API routes
│   ├── tenders.js       # Tender management routes
│   └── whatsapp.js      # WhatsApp webhook routes
├── services/
│   ├── openaiService.js # OpenAI integration
│   └── twilioService.js # Twilio WhatsApp integration
├── public/
│   └── dashboard.html   # Main dashboard UI
├── server.js            # Main application file
└── package.json         # Dependencies and scripts
```

### Adding Features

1. **New Routes**: Add to `routes/` directory
2. **New Services**: Add to `services/` directory
3. **Database Changes**: Update `config/database.js`
4. **UI Changes**: Modify `public/dashboard.html`

## 🐛 Troubleshooting

### Common Issues

1. **Webhook Not Receiving Messages**:
   - Check webhook URL in Twilio console
   - Verify app is deployed and running
   - Check Render logs for errors

2. **Database Connection Issues**:
   - Verify `DATABASE_URL` environment variable
   - Check PostgreSQL service is running
   - Verify database credentials

3. **WhatsApp Messages Not Sending**:
   - Check Twilio credentials
   - Verify phone number format (whatsapp:+968XXXXXXXX)
   - Check Twilio account balance

4. **Voice Transcription Not Working**:
   - Verify OpenAI API key
   - Check OpenAI account balance
   - Verify audio file format

### Debug Mode

Enable debug logging by setting:
```bash
LOG_LEVEL=debug
```

### Render Logs

View application logs in Render dashboard:
1. Go to your app in Render
2. Click "Logs" tab
3. Monitor real-time logs for errors

## 📞 Support

For issues or questions:
1. Check the logs in the dashboard
2. Review Render application logs
3. Verify all environment variables are set
4. Test with the simulation feature in the dashboard

## 📄 License

This project is licensed under the MIT License. 

### **Test Script: Send WhatsApp Message via Twilio**

1. **Create a file called `twilio-test.js` in your project directory.**
2. **Paste this code:**

```js
require('dotenv').config();
const twilio = require('twilio');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const from = process.env.TWILIO_PHONE_NUMBER; // e.g. whatsapp:+14155238886
const to = 'whatsapp:+96891163374'; // The number you want to test

const client = twilio(accountSid, authToken);

client.messages
  .create({
    from,
    to,
    body: 'Test message from Twilio via Node.js'
  })
  .then(msg => console.log('Message SID:', msg.sid))
  .catch(console.error);
```

3. **Run it in your terminal:**
```sh
node twilio-test.js
```

---

**What to expect:**
- If successful, you'll see a `Message SID` in the console and the WhatsApp message will be delivered.
- If there's an error, the error message will tell you what's wrong (credentials, number format, permissions, etc.).

---

**If you get an error, copy and paste it here and I'll help you fix it!**  
If you get a success, your Twilio setup is correct and the issue is in your app logic or environment. 