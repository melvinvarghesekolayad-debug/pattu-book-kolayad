import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  setDoc, 
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp 
} from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json' with { type: 'json' };

// Initialize Firebase for the server
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

async function startServer() {
  const app = express();
  app.use(express.json());

  // Helper to send Telegram message
  async function sendTelegram(botToken: string, chatId: string | number, text: string) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'Markdown'
        })
      });
      return await res.json();
    } catch (err) {
      console.error('Failed to send Telegram message:', err);
      return null;
    }
  }

  // Set up Telegram webhook on server startup or setting update
  async function setupTelegramWebhook(token: string, hostUrl: string) {
    try {
      const webhookUrl = `${hostUrl}/api/telegram-webhook`;
      console.log(`Setting up Telegram webhook for URL: ${webhookUrl}`);
      const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook?url=${webhookUrl}`);
      const data = await res.json() as { ok: boolean; description?: string };
      console.log('Telegram setWebhook response:', data);
      return data.ok;
    } catch (err) {
      console.error('Failed to set Telegram webhook:', err);
      return false;
    }
  }

  // ================= API ENDPOINTS =================

  // GET Settings
  app.get('/api/settings', async (req, res) => {
    try {
      const settingsDoc = await getDoc(doc(db, 'settings', 'global'));
      if (settingsDoc.exists()) {
        res.json(settingsDoc.data());
      } else {
        res.json({ telegramBotToken: '', ownerChatId: '', businessPhone: '9400000000' });
      }
    } catch (err) {
      console.error('Error fetching settings:', err);
      res.status(500).json({ error: 'Failed to fetch settings' });
    }
  });

  // REST API for setting up Telegram bot, chat id & business phone
  app.post('/api/setup-telegram', async (req, res) => {
    try {
      const { token, chatId, businessPhone } = req.body;

      // Save to Firestore
      await setDoc(doc(db, 'settings', 'global'), {
        telegramBotToken: token ? token.trim() : '',
        ownerChatId: chatId ? String(chatId).trim() : '',
        businessPhone: businessPhone ? String(businessPhone).trim() : '9400000000',
        updatedAt: serverTimestamp()
      }, { merge: true });

      let webhookSuccess = false;
      if (token && token.trim()) {
        const hostUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
        webhookSuccess = await setupTelegramWebhook(token.trim(), hostUrl);

        if (chatId) {
          await sendTelegram(
            token.trim(), 
            chatId, 
            `🎉 *വർക്ക് മാനേജർ ബോട്ട് കണക്റ്റായി! (Bot Connected)*\n\nമുതലാളിക്ക് സ്വാഗതം! തൊഴിലാളികൾ വർക്ക് ചേർക്കുമ്പോൾ ഇവിടെ നോട്ടിഫിക്കേഷൻ ലഭിക്കും. ഏതെങ്കിലും തൊഴിലാളിയുടെ നമ്പർ (1 മുതൽ 50 വരെ) അയച്ചാൽ ആ തൊഴിലാളിയുടെ വിവരങ്ങൾ ഉടൻ ലഭിക്കുന്നതാണ്.`
          );
        }
      }

      res.json({ 
        success: true, 
        webhookRegistered: webhookSuccess, 
        message: webhookSuccess ? 'Telegram bot saved and webhook registered successfully!' : 'Settings saved, but failed to register webhook with Telegram.'
      });
    } catch (error) {
      console.error('Error in /api/setup-telegram:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // Submit Work Log API (Saves and sends instant notification to Boss)
  app.post('/api/submit-work-log', async (req, res) => {
    try {
      const {
        workerNumber,
        workerName,
        workerPhone,
        date,
        siteName,
        workDescription,
        thachCount,
        vehicleRent,
        foodExpense,
        toolsRent,
        otherExpense,
        submittedBy
      } = req.body;

      const num = Number(workerNumber);
      if (!num || num < 1 || num > 50) {
        res.status(400).json({ error: 'Worker number must be between 1 and 50' });
        return;
      }

      const payload = {
        workerNumber: num,
        workerName: String(workerName || '').trim(),
        workerPhone: String(workerPhone || '').trim(),
        date: String(date || '').trim(),
        siteName: String(siteName || '').trim(),
        workDescription: String(workDescription || '').trim(),
        thachCount: Number(thachCount) > 0 ? Number(thachCount) : 1,
        vehicleRent: Number(vehicleRent) || 0,
        foodExpense: Number(foodExpense) || 0,
        toolsRent: Number(toolsRent) || 0,
        otherExpense: Number(otherExpense) || 0,
        submittedBy: String(submittedBy || '').trim(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      // Save to Firestore
      const docRef = await addDoc(collection(db, 'work_logs'), payload);

      // Check if Telegram bot and Boss Chat ID are set
      const settingsDoc = await getDoc(doc(db, 'settings', 'global'));
      if (settingsDoc.exists()) {
        const { telegramBotToken, ownerChatId } = settingsDoc.data();
        if (telegramBotToken && ownerChatId) {
          const total = payload.vehicleRent + payload.foodExpense + payload.toolsRent + payload.otherExpense;
          const alertMsg = `🔔 *പുതിയ വർക്ക് അപ്‌ഡേറ്റ്! (New Work Entry)*\n\n` +
            `👷 *തൊഴിലാളി #${payload.workerNumber}:* ${payload.workerName}\n` +
            `⏱️ *തച്ച് (ഹാജർ):* ${payload.thachCount} തച്ച്\n` +
            `📅 *തീയതി:* ${payload.date}\n` +
            `📍 *സൈറ്റ്:* ${payload.siteName}\n` +
            `🛠️ *ജോലി വിവരങ്ങൾ:* ${payload.workDescription}\n\n` +
            `💰 *ചിലവുകൾ (Expenses):*\n` +
            `  • വണ്ടി വാടക: ₹${payload.vehicleRent}\n` +
            `  • ഫുഡ് എക്സ്പെൻസ്: ₹${payload.foodExpense}\n` +
            `  • ഉപകരണ വാടക: ₹${payload.toolsRent}\n` +
            `  • മറ്റ് ചിലവുകൾ: ₹${payload.otherExpense}\n` +
            `  👉 *ആകെ ചിലവ്: ₹${total}*\n\n` +
            `✍️ *രേഖപ്പെടുത്തിയത്:* ${payload.submittedBy || 'തൊഴിലാളി'}\n` +
            `_(കൂടുതൽ വിവരങ്ങൾക്ക് തൊഴിലാളിയുടെ നമ്പർ ആയ ${payload.workerNumber} എന്ന് അയക്കുക)_`;

          // Send notification async
          sendTelegram(telegramBotToken, ownerChatId, alertMsg).catch((e) => console.error(e));
        }
      }

      res.json({ success: true, id: docRef.id });
    } catch (err) {
      console.error('Error submitting work log:', err);
      res.status(500).json({ error: 'Failed to submit work log' });
    }
  });

  // Update Work Log API
  app.post('/api/update-work-log', async (req, res) => {
    try {
      const {
        id,
        workerNumber,
        workerName,
        date,
        siteName,
        workDescription,
        thachCount,
        vehicleRent,
        foodExpense,
        toolsRent,
        otherExpense,
        updatedBy
      } = req.body;

      if (!id) {
        res.status(400).json({ error: 'Log ID is required' });
        return;
      }

      const num = Number(workerNumber);
      const updateData = {
        workerNumber: num,
        workerName: String(workerName || '').trim(),
        date: String(date || '').trim(),
        siteName: String(siteName || '').trim(),
        workDescription: String(workDescription || '').trim(),
        thachCount: Number(thachCount) > 0 ? Number(thachCount) : 1,
        vehicleRent: Number(vehicleRent) || 0,
        foodExpense: Number(foodExpense) || 0,
        toolsRent: Number(toolsRent) || 0,
        otherExpense: Number(otherExpense) || 0,
        updatedBy: String(updatedBy || '').trim(),
        updatedAt: serverTimestamp()
      };

      const docRef = doc(db, 'work_logs', id);
      await updateDoc(docRef, updateData);

      // Notify Telegram boss
      const settingsDoc = await getDoc(doc(db, 'settings', 'global'));
      if (settingsDoc.exists()) {
        const { telegramBotToken, ownerChatId } = settingsDoc.data();
        if (telegramBotToken && ownerChatId) {
          const total = updateData.vehicleRent + updateData.foodExpense + updateData.toolsRent + updateData.otherExpense;
          const editMsg = `✏️ *വർക്ക് റിപ്പോർട്ട് എഡിറ്റ് ചെയ്തു (Report Updated)*\n\n` +
            `👷 *തൊഴിലാളി #${updateData.workerNumber}:* ${updateData.workerName}\n` +
            `⏱️ *തച്ച്:* ${updateData.thachCount} തച്ച്\n` +
            `📅 *തീയതി:* ${updateData.date}\n` +
            `📍 *സൈറ്റ്:* ${updateData.siteName}\n` +
            `🛠️ *ജോലി:* ${updateData.workDescription}\n` +
            `💰 *ആകെ ചിലവ്: ₹${total}*`;

          sendTelegram(telegramBotToken, ownerChatId, editMsg).catch((e) => console.error(e));
        }
      }

      res.json({ success: true });
    } catch (err) {
      console.error('Error updating work log:', err);
      res.status(500).json({ error: 'Failed to update work log' });
    }
  });

  // Delete Work Log API
  app.post('/api/delete-work-log', async (req, res) => {
    try {
      const { id, workerNumber, workerName } = req.body;
      if (!id) {
        res.status(400).json({ error: 'Log ID is required' });
        return;
      }

      const docRef = doc(db, 'work_logs', id);
      await deleteDoc(docRef);

      // Notify Telegram boss
      const settingsDoc = await getDoc(doc(db, 'settings', 'global'));
      if (settingsDoc.exists()) {
        const { telegramBotToken, ownerChatId } = settingsDoc.data();
        if (telegramBotToken && ownerChatId) {
          const delMsg = `🗑️ *വർക്ക് റിപ്പോർട്ട് മായ്‌ച്ചു (Report Deleted)*\n\n` +
            `👷 തൊഴിലാളി #${workerNumber || ''} (${workerName || ''}) ന്റെ ഒരു വർക്ക് എൻട്രി ആപ്പിൽ നിന്നും ഡിലീറ്റ് ചെയ്തിട്ടുണ്ട്.`;

          sendTelegram(telegramBotToken, ownerChatId, delMsg).catch((e) => console.error(e));
        }
      }

      res.json({ success: true });
    } catch (err) {
      console.error('Error deleting work log:', err);
      res.status(500).json({ error: 'Failed to delete work log' });
    }
  });

  // Service Callback / Lead Request API (Public Landing Page Leads)
  app.post('/api/submit-service-request', async (req, res) => {
    try {
      const {
        customerName,
        customerPhone,
        customerLocation,
        selectedServices,
        additionalDetails,
        preferredDate
      } = req.body;

      if (!customerName || !customerPhone) {
        res.status(400).json({ error: 'പേരും ഫോൺ നമ്പറും നിർബന്ധമാണ്' });
        return;
      }

      const servicesList = Array.isArray(selectedServices) ? selectedServices : [selectedServices || 'പെയിന്റിംഗ് & ക്ലീനിംഗ്'];

      const payload = {
        customerName: String(customerName).trim(),
        customerPhone: String(customerPhone).trim(),
        customerLocation: String(customerLocation || 'കോളയാട് / ചുറ്റളവിൽ').trim(),
        selectedServices: servicesList,
        additionalDetails: String(additionalDetails || '').trim(),
        preferredDate: String(preferredDate || '').trim(),
        status: 'new',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'service_requests'), payload);

      // Notify Telegram boss if configured
      const settingsDoc = await getDoc(doc(docRef.firestore, 'settings', 'global'));
      if (settingsDoc.exists()) {
        const { telegramBotToken, ownerChatId } = settingsDoc.data();
        if (telegramBotToken && ownerChatId) {
          const alertMsg = `📢 *പുതിയ കസ്റ്റമർ കോൾ ബാക്ക് റിക്വസ്റ്റ്! (New Service Lead)*\n\n` +
            `👤 *കസ്റ്റമർ പേര്:* ${payload.customerName}\n` +
            `📞 *ഫോൺ നമ്പർ:* ${payload.customerPhone}\n` +
            `📍 *സ്ഥലം / ഏരിയ:* ${payload.customerLocation}\n` +
            `🛠️ *ആവശ്യമുള്ള സേവനം:* ${payload.selectedServices.join(', ')}\n` +
            (payload.preferredDate ? `📅 *ഉദ്ദേശിക്കുന്ന സമയം:* ${payload.preferredDate}\n` : '') +
            (payload.additionalDetails ? `📝 *മറ്റ് വിവരങ്ങൾ:* ${payload.additionalDetails}\n` : '') +
            `\n👉 *ഉടൻ തന്നെ കസ്റ്റമറെ തിരിച്ച വിളിക്കുക!*`;

          sendTelegram(telegramBotToken, ownerChatId, alertMsg).catch((e) => console.error(e));
        }
      }

      res.json({ success: true, id: docRef.id });
    } catch (err) {
      console.error('Error submitting service request:', err);
      res.status(500).json({ error: 'Failed to submit service request' });
    }
  });

  // Update Service Request Status API
  app.post('/api/update-service-request-status', async (req, res) => {
    try {
      const { id, status } = req.body;
      if (!id || !status) {
        res.status(400).json({ error: 'ID and status required' });
        return;
      }

      const docRef = doc(db, 'service_requests', id);
      await updateDoc(docRef, {
        status,
        updatedAt: serverTimestamp()
      });

      res.json({ success: true });
    } catch (err) {
      console.error('Error updating service request status:', err);
      res.status(500).json({ error: 'Failed to update service request' });
    }
  });

  // Update Service Request Schedule & Map Location API
  app.post('/api/update-service-request-schedule', async (req, res) => {
    try {
      const { 
        id, 
        scheduledDate, 
        scheduledTime, 
        assignedWorkerName, 
        status, 
        lat, 
        lng,
        customerLocation 
      } = req.body;

      if (!id) {
        res.status(400).json({ error: 'ID required' });
        return;
      }

      const docRef = doc(db, 'service_requests', id);
      const docSnap = await getDoc(docRef);
      const currentData = docSnap.exists() ? docSnap.data() : {};

      const updateData: any = {
        updatedAt: serverTimestamp()
      };

      if (scheduledDate !== undefined) updateData.scheduledDate = String(scheduledDate || '').trim();
      if (scheduledTime !== undefined) updateData.scheduledTime = String(scheduledTime || '').trim();
      if (assignedWorkerName !== undefined) updateData.assignedWorkerName = String(assignedWorkerName || '').trim();
      if (status !== undefined) updateData.status = status;
      if (lat !== undefined && lat !== null) updateData.lat = Number(lat);
      if (lng !== undefined && lng !== null) updateData.lng = Number(lng);
      if (customerLocation !== undefined) updateData.customerLocation = String(customerLocation || '').trim();

      await updateDoc(docRef, updateData);

      // Notify Telegram boss about schedule update
      const settingsDoc = await getDoc(doc(db, 'settings', 'global'));
      if (settingsDoc.exists()) {
        const { telegramBotToken, ownerChatId } = settingsDoc.data();
        if (telegramBotToken && ownerChatId) {
          const customerName = currentData.customerName || 'കസ്റ്റമർ';
          const services = currentData.selectedServices ? currentData.selectedServices.join(', ') : 'സേവനം';
          
          const schedMsg = `🗺️ *ഗൂഗിൾ മാപ്പ് വർക്ക് ഷെഡ്യൂൾ അപ്‌ഡേറ്റ്! (Work Scheduled)*\n\n` +
            `👤 *കസ്റ്റമർ:* ${customerName}\n` +
            `📍 *സ്ഥലം:* ${updateData.customerLocation || currentData.customerLocation || 'കോളയാട്'}\n` +
            `🛠️ *സേവനം:* ${services}\n` +
            `📅 *ഷെഡ്യൂൾ തീയതി:* ${updateData.scheduledDate || 'തീരുമാനിച്ചിട്ടില്ല'}\n` +
            `⏰ *സമയം:* ${updateData.scheduledTime || 'ലഭ്യമല്ല'}\n` +
            `👷 *ചുമതലയുള്ള തൊഴിലാളി:* ${updateData.assignedWorkerName || 'നിയമിച്ചിട്ടില്ല'}\n` +
            `📌 *സ്റ്റാറ്റസ്:* ${updateData.status || currentData.status}\n\n` +
            (updateData.lat && updateData.lng ? `📍 [ഗൂഗിൾ മാപ്പിൽ ലൊക്കേഷൻ തുറക്കുക](https://www.google.com/maps/dir/?api=1&destination=${updateData.lat},${updateData.lng})` : '');

          sendTelegram(telegramBotToken, ownerChatId, schedMsg).catch((e) => console.error(e));
        }
      }

      res.json({ success: true });
    } catch (err) {
      console.error('Error updating service request schedule:', err);
      res.status(500).json({ error: 'Failed to update schedule' });
    }
  });

  // Delete Service Request API
  app.post('/api/delete-service-request', async (req, res) => {
    try {
      const { id } = req.body;
      if (!id) {
        res.status(400).json({ error: 'ID required' });
        return;
      }

      const docRef = doc(db, 'service_requests', id);
      await deleteDoc(docRef);

      res.json({ success: true });
    } catch (err) {
      console.error('Error deleting service request:', err);
      res.status(500).json({ error: 'Failed to delete service request' });
    }
  });

  // Telegram Webhook receiver
  app.post('/api/telegram-webhook', async (req, res) => {
    try {
      const update = req.body;
      console.log('Received Telegram Update:', JSON.stringify(update));

      if (!update.message || !update.message.text) {
        res.sendStatus(200);
        return;
      }

      const chatId = update.message.chat.id;
      const rawText = update.message.text.trim();
      const text = rawText.toLowerCase();

      // Fetch telegram config to verify token
      const settingsDoc = await getDoc(doc(db, 'settings', 'global'));
      const settings = settingsDoc.exists() ? settingsDoc.data() : null;
      const botToken = settings?.telegramBotToken;

      if (!botToken) {
        res.sendStatus(200);
        return;
      }

      const reply = async (msgText: string) => {
        await sendTelegram(botToken, chatId, msgText);
      };

      // 1. Handle /start or /help
      if (text === '/start' || text === '/help' || text === 'help' || text === 'സഹായം') {
        const welcomeMsg = `🛠️ *മുതലാളിക്ക് സ്വാഗതം! (Work Manager Bot)*\n\n` +
          `തൊഴിലാളികൾ ആപ്പിലൂടെ സമർപ്പിക്കുന്ന ജോലി വിവരങ്ങളും ചിലവുകളും ഇവിടെ നിമിഷങ്ങൾക്കകം അറിയാം.\n\n` +
          `📋 *എങ്ങനെ ഉപയോഗിക്കാം?*\n` +
          `• *തൊഴിലാളിയുടെ നമ്പർ (1 മുതൽ 50 വരെ)* ഇവിടെ അയച്ചാൽ ആ തൊഴിലാളിയുടെ മുഴുവൻ വർക്ക് റിപ്പോർട്ടും ചിലവുകളും ലഭിക്കും!\n` +
          `  _ഉദാഹരണത്തിന്: 5 അല്ലെങ്കിൽ /5_\n\n` +
          `• \`/today\` - ഇന്നത്തെ വർക്ക് വിവരങ്ങളും ആകെ ചിലവും\n` +
          `• \`/all\` - എല്ലാ തൊഴിലാളികളുടെയും വർക്ക് ദിവസങ്ങളും ചെലവുകളും\n` +
          `• \`/month\` - ഈ മാസത്തെ ആകെ വർക്ക് റിപ്പോർട്ട്\n\n` +
          `----------------------------------\n` +
          `💡 _മുതലാളിയുടെ Chat ID ആണ്: \`${chatId}\`_ (ഇത് ആപ്പിൽ നൽകിയാൽ പുതിയ വർക്കുകൾ വരുമ്പോൾ തത്സമയം മെസ്സേജ് വരും).`;

        await reply(welcomeMsg);
        res.sendStatus(200);
        return;
      }

      // 2. Handle /today (Today's summary)
      if (text === '/today' || text === 'today' || text === 'ഇന്ന്') {
        const todayStr = new Date().toISOString().split('T')[0];
        const qToday = query(collection(db, 'work_logs'), where('date', '==', todayStr));
        const snap = await getDocs(qToday);

        if (snap.empty) {
          await reply(`📅 *ഇന്ന് (${todayStr}) ആരും വർക്ക് വിവരങ്ങൾ സബ്മിറ്റ് ചെയ്തിട്ടില്ല!*`);
          res.sendStatus(200);
          return;
        }

        let todayReport = `📅 *ഇന്നത്തെ വർക്ക് റിപ്പോർട്ട് (${todayStr})*\n\n`;
        let totalVeh = 0, totalFd = 0, totalTl = 0, totalOth = 0, totalThachToday = 0;

        snap.forEach((d) => {
          const item = d.data();
          const v = Number(item.vehicleRent) || 0;
          const f = Number(item.foodExpense) || 0;
          const t = Number(item.toolsRent) || 0;
          const o = Number(item.otherExpense) || 0;
          const th = Number(item.thachCount) > 0 ? Number(item.thachCount) : 1;
          const subTotal = v + f + t + o;

          totalVeh += v;
          totalFd += f;
          totalTl += t;
          totalOth += o;
          totalThachToday += th;

          todayReport += `👷 *#${item.workerNumber} ${item.workerName}*\n` +
            `⏱️ ഹാജർ: ${th} തച്ച്\n` +
            `📍 സൈറ്റ്: ${item.siteName}\n` +
            `🛠️ ജോലി: ${item.workDescription}\n` +
            `💰 ചിലവ്: ₹${subTotal} (വണ്ടി: ₹${v}, ഫുഡ്: ₹${f}, ഉപകരണം: ₹${t}, മറ്റ്: ₹${o})\n` +
            `----------------------------------\n`;
        });

        const grandTotal = totalVeh + totalFd + totalTl + totalOth;
        todayReport += `\n⏱️ *ആകെ തച്ച്: ${totalThachToday} തച്ച്*\n💵 *ഇന്നത്തെ ആകെ ചിലവ്: ₹${grandTotal}*\n(ആകെ തൊഴിലാളികൾ: ${snap.size})`;

        await reply(todayReport);
        res.sendStatus(200);
        return;
      }

      // 3. Handle /all (All workers summary)
      if (text === '/all' || text === 'all' || text === '0' || text === 'എല്ലാവരും') {
        const snap = await getDocs(collection(db, 'work_logs'));
        if (snap.empty) {
          await reply(`❌ ഇതുവരെ ഒരു തൊഴിലാളിയും വർക്ക് വിവരങ്ങൾ സബ്മിറ്റ് ചെയ്തിട്ടില്ല.`);
          res.sendStatus(200);
          return;
        }

        // Group by worker number
        const workerMap: Record<number, { name: string; count: number; totalThach: number; totalExp: number }> = {};
        snap.forEach((d) => {
          const data = d.data();
          const num = Number(data.workerNumber) || 0;
          const exp = (Number(data.vehicleRent) || 0) + (Number(data.foodExpense) || 0) + (Number(data.toolsRent) || 0) + (Number(data.otherExpense) || 0);
          const th = Number(data.thachCount) > 0 ? Number(data.thachCount) : 1;

          if (!workerMap[num]) {
            workerMap[num] = { name: data.workerName || `തൊഴിലാളി ${num}`, count: 0, totalThach: 0, totalExp: 0 };
          }
          workerMap[num].count += 1;
          workerMap[num].totalThach += th;
          workerMap[num].totalExp += exp;
        });

        let allReport = `👥 *എല്ലാ തൊഴിലാളികളുടെയും വർക്ക് സംഗ്രഹം (Workers Summary)*\n\n`;
        let overallExp = 0;
        let overallDays = 0;
        let overallThach = 0;

        const sortedNums = Object.keys(workerMap).map(Number).sort((a, b) => a - b);
        sortedNums.forEach((num) => {
          const item = workerMap[num];
          overallExp += item.totalExp;
          overallDays += item.count;
          overallThach += item.totalThach;
          allReport += `👷 *നമ്പർ #${num} - ${item.name}*\n` +
            `   • ആകെ തച്ച്: ${item.totalThach} തച്ച് (${item.count} ദിവസം)\n` +
            `   • ആകെ ചിലവ്: ₹${item.totalExp}\n` +
            `   👉 വിശദ വിവരങ്ങൾക്ക്: \`/${num}\`\n\n`;
        });

        allReport += `📊 *മൊത്തം കണക്ക്:*\n` +
          `• ആകെ തൊഴിലാളികൾ: ${sortedNums.length}\n` +
          `• ആകെ തച്ച് (Total Thach): ${overallThach} തച്ച്\n` +
          `• ആകെ ജോലി ദിവസങ്ങൾ: ${overallDays}\n` +
          `• ആകെ മൊത്തം ചിലവ്: ₹${overallExp}`;

        await reply(allReport);
        res.sendStatus(200);
        return;
      }

      // 4. Handle /month (Current month summary)
      if (text === '/month' || text === 'month' || text === 'മാസം' || text === 'ഈ മാസം') {
        const currentMonthPrefix = new Date().toISOString().slice(0, 7); // YYYY-MM
        const snap = await getDocs(collection(db, 'work_logs'));

        const monthLogs: any[] = [];
        snap.forEach((d) => {
          const item = d.data();
          if (item.date && item.date.startsWith(currentMonthPrefix)) {
            monthLogs.push(item);
          }
        });

        if (monthLogs.length === 0) {
          await reply(`📅 ഈ മാസം (${currentMonthPrefix}) വർക്ക് വിവരങ്ങൾ ലഭ്യമല്ല.`);
          res.sendStatus(200);
          return;
        }

        let totalExp = 0;
        monthLogs.forEach((l) => {
          totalExp += (Number(l.vehicleRent) || 0) + (Number(l.foodExpense) || 0) + (Number(l.toolsRent) || 0) + (Number(l.otherExpense) || 0);
        });

        const uniqueWorkers = new Set(monthLogs.map((l) => l.workerNumber)).size;
        const monthReport = `📆 *ഈ മാസത്തെ റിപ്പോർട്ട് (${currentMonthPrefix})*\n\n` +
          `• ആകെ ജോലി എൻട്രികൾ: ${monthLogs.length}\n` +
          `• ജോലി ചെയ്ത തൊഴിലാളികൾ: ${uniqueWorkers}\n` +
          `• ആകെ വന്ന ചിലവ്: ₹${totalExp}\n\n` +
          `_ഏതെങ്കിലും തൊഴിലാളിയുടെ വിശദ വിവരങ്ങൾക്ക് അവരുടെ നമ്പർ (1-50) അയക്കുക._`;

        await reply(monthReport);
        res.sendStatus(200);
        return;
      }

      // 5. Check if input is a Worker Number (1 to 50)
      const cleanedNumberMatch = rawText.match(/^(?:\/|#|worker\s*|തൊഴിലാളി\s*)?([1-9]|[1-4][0-9]|50)$/i);
      let targetWorkerNumber: number | null = null;

      if (cleanedNumberMatch) {
        targetWorkerNumber = parseInt(cleanedNumberMatch[1], 10);
      } else {
        const onlyNum = parseInt(rawText.replace(/[^0-9]/g, ''), 10);
        if (!isNaN(onlyNum) && onlyNum >= 1 && onlyNum <= 50 && rawText.length <= 4) {
          targetWorkerNumber = onlyNum;
        }
      }

      if (targetWorkerNumber !== null) {
        console.log(`Searching work logs for Worker #${targetWorkerNumber}`);

        const q = query(collection(db, 'work_logs'), where('workerNumber', '==', targetWorkerNumber));
        const snap = await getDocs(q);

        if (snap.empty) {
          const notFoundMsg = `❌ *തൊഴിലാളി #${targetWorkerNumber} ന്റെ വിവരങ്ങൾ ലഭ്യമല്ല!*\n\n` +
            `നമ്പർ #${targetWorkerNumber} ഉള്ള തൊഴിലാളി ഇതുവരെ വർക്ക് വിവരങ്ങൾ ഒന്നും ആപ്പിൽ രേഖപ്പെടുത്തിയിട്ടില്ല.\n\n` +
            `👉 മറ്റേതെങ്കിലും നമ്പർ (1 മുതൽ 50 വരെ) നൽകി നോക്കൂ.`;
          await reply(notFoundMsg);
          res.sendStatus(200);
          return;
        }

        const logs: any[] = [];
        snap.forEach((d) => {
          logs.push({ id: d.id, ...d.data() });
        });

        logs.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

        const workerName = logs[0].workerName || `തൊഴിലാളി #${targetWorkerNumber}`;
        let totalVehicle = 0;
        let totalFood = 0;
        let totalTools = 0;
        let totalOther = 0;
        let totalThach = 0;

        logs.forEach((log) => {
          const th = Number(log.thachCount) > 0 ? Number(log.thachCount) : 1;
          totalThach += th;
        });

        let logReport = `📋 *തൊഴിലാളി വർക്ക് റിപ്പോർട്ട് (Worker #${targetWorkerNumber})*\n\n` +
          `👤 *പേര്:* ${workerName}\n` +
          `🔢 *തൊഴിലാളി നമ്പർ:* #${targetWorkerNumber}\n` +
          `⏱️ *ആകെ ഹാജർ (Thach):* ${totalThach} തച്ച് (${logs.length} ദിവസം)\n` +
          `==================================\n\n`;

        logs.forEach((log, index) => {
          const vehicle = Number(log.vehicleRent) || 0;
          const food = Number(log.foodExpense) || 0;
          const tools = Number(log.toolsRent) || 0;
          const other = Number(log.otherExpense) || 0;
          const th = Number(log.thachCount) > 0 ? Number(log.thachCount) : 1;
          const logTotal = vehicle + food + tools + other;

          totalVehicle += vehicle;
          totalFood += food;
          totalTools += tools;
          totalOther += other;

          logReport += `${index + 1}. 📅 *തീയതി:* ${log.date}\n` +
            `   ⏱️ *തച്ച്:* ${th} തച്ച്\n` +
            `   📍 *സൈറ്റ്:* ${log.siteName}\n` +
            `   🛠️ *ജോലി:* ${log.workDescription}\n` +
            `   💰 *ചിലവുകൾ:*\n` +
            `      • വണ്ടി വാടക: ₹${vehicle}\n` +
            `      • ഫുഡ്: ₹${food}\n` +
            `      • ഉപകരണങ്ങൾ: ₹${tools}\n` +
            `      • മറ്റ് ചിലവുകൾ: ₹${other}\n` +
            `      👉 *ദിവസത്തെ ചിലവ്: ₹${logTotal}*\n`;
          
          if (log.submittedBy) {
            logReport += `   ✍️ _രേഖപ്പെടുത്തിയത്: ${log.submittedBy}_\n`;
          }
          logReport += `----------------------------------\n\n`;
        });

        const grandTotal = totalVehicle + totalFood + totalTools + totalOther;

        logReport += `📈 *ആകെ ചിലവ് സംഗ്രഹം (Worker #${targetWorkerNumber}):*\n` +
          `🚙 വണ്ടി വാടക: ₹${totalVehicle}\n` +
          `🍲 ഫുഡ് എക്സ്പെൻസ്: ₹${totalFood}\n` +
          `🔧 ഉപകരണ വാടക: ₹${totalTools}\n` +
          `📝 മറ്റ് ചിലവുകൾ: ₹${totalOther}\n\n` +
          `💰 *ആകെ മൊത്തം ചിലവ്: ₹${grandTotal}*`;

        if (logReport.length > 4000) {
          logReport = logReport.substring(0, 3900) + '\n\n... (ബാക്കി വിവരങ്ങൾ ലിമിറ്റ് കാരണം ചുരുക്കി)';
        }

        await reply(logReport);
        res.sendStatus(200);
        return;
      }

      // 6. If not recognized, provide helpful instruction
      const helpMsg = `⚠️ *കമാൻഡ് വ്യക്തമല്ല!*\n\n` +
        `മുതലാളി, തൊഴിലാളിയുടെ റിപ്പോർട്ട് ലഭിക്കാൻ അവരുടെ നമ്പർ മാത്രം അയക്കുക.\n` +
        `ഉദാഹരണത്തിന്: *5* അല്ലെങ്കിൽ */5* (1 മുതൽ 50 വരെ).\n\n` +
        `• \`/today\` - ഇന്നത്തെ വിവരങ്ങൾ\n` +
        `• \`/all\` - എല്ലാ തൊഴിലാളികളുടെയും കണക്കുകൾ`;

      await reply(helpMsg);
      res.sendStatus(200);
    } catch (error) {
      console.error('Error in Telegram Webhook:', error);
      res.sendStatus(200);
    }
  });

  // ================= FRONTEND / VITE SERVING =================
  // Check if production build in dist/ exists
  const hasDist = fs.existsSync(path.resolve(process.cwd(), 'dist/index.html'));

  if (hasDist) {
    console.log('Serving production build from dist directory');
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (req, res) => {
      if (req.path.startsWith('/api')) {
        res.status(404).json({ error: 'API route not found' });
        return;
      }
      res.sendFile(path.resolve(distDir, 'index.html'));
    });
  } else {
    console.log('Serving development mode with Vite middleware');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);

    app.use('*', async (req, res, next) => {
      if (req.originalUrl.startsWith('/api')) {
        res.status(404).json({ error: 'API route not found' });
        return;
      }
      try {
        const indexPath = path.resolve(process.cwd(), 'index.html');
        let template = fs.readFileSync(indexPath, 'utf-8');
        template = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).send(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${port}`);
  });
}

startServer();
