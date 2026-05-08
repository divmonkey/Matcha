require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
const cookieParser = require('cookie-parser');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cookieParser()); // Use cookie-parser for auth

// Initialize Supabase client
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const PORT = process.env.PORT || 3000;

/* ─── ADMIN CONFIG ──────────────────────────────────────── */
const ADMIN_FILE = path.join(__dirname, 'data', 'admin.json');
const CUSTOMERS_FILE = path.join(__dirname, 'data', 'customers.json');
const FORGOT_PW_FILE = path.join(__dirname, 'data', 'forgot_passwords.json');

let adminConfig = {
  password: 'matcha2025',
  email: process.env.ADMIN_EMAIL || 'admin@matcha.test'
};

if (!fs.existsSync(ADMIN_FILE)) {
  fs.writeFileSync(ADMIN_FILE, JSON.stringify(adminConfig, null, 2));
} else {
  adminConfig = JSON.parse(fs.readFileSync(ADMIN_FILE, 'utf8'));
}

function saveAdminConfig() {
  fs.writeFileSync(ADMIN_FILE, JSON.stringify(adminConfig, null, 2));
}

const SESSION_TOKEN = 'matcha-session-' + Math.random().toString(36).substring(2, 15);

function isAdmin(req, res, next) {
  if (req.cookies.admin_session === SESSION_TOKEN) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
}

/* ─── CUSTOMER STORE ────────────────────────────────────── */
function loadCustomers() {
  try { return JSON.parse(fs.readFileSync(CUSTOMERS_FILE, 'utf8')); } catch { return []; }
}
function saveCustomers(customers) {
  fs.writeFileSync(CUSTOMERS_FILE, JSON.stringify(customers, null, 2));
}

function getCustomer(email) {
  return loadCustomers().find(c => c.email.toLowerCase() === email.toLowerCase());
}

function createOrUpdateCustomer(email, name) {
  const customers = loadCustomers();
  let customer = customers.find(c => c.email.toLowerCase() === email.toLowerCase());
  let isNew = false;
  let tempPass = '';

  if (!customer) {
    isNew = true;
    tempPass = Math.random().toString(36).substring(2, 10);
    customer = {
      email: email.toLowerCase(),
      name: name || 'Customer',
      password: tempPass,
      isTempPassword: true,
      createdAt: new Date().toISOString()
    };
    customers.push(customer);
    saveCustomers(customers);
  }
  return { customer, isNew, tempPass };
}

function isCustomer(req, res, next) {
  const email = req.cookies.customer_email;
  const pass = req.cookies.customer_pass;
  if (!email || !pass) return res.status(401).json({ error: 'Unauthorized' });
  
  const customer = getCustomer(email);
  if (customer && customer.password === pass) {
    req.customer = customer;
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized' });
  }
}

/* ─── FORGOT PASSWORD ───────────────────────────────────── */
function loadForgotTokens() {
  try { return JSON.parse(fs.readFileSync(FORGOT_PW_FILE, 'utf8')); } catch { return {}; }
}
function saveForgotTokens(tokens) {
  fs.writeFileSync(FORGOT_PW_FILE, JSON.stringify(tokens, null, 2));
}

async function sendResetEmail(email, token, type) {
  if (!transporter) return false;
  const link = `http://localhost:${PORT}/${type}/reset-password/?token=${token}&email=${email}`;
  const mailOptions = {
    from: `"Matcha Book" <${SMTP_USER}>`,
    to: email,
    subject: `Password Reset Request`,
    text: `You requested a password reset. Click the link below to set a new password:\n\n${link}\n\nIf you didn't request this, ignore this email.`,
    html: `<p>You requested a password reset. Click the button below to set a new password:</p>
           <a href="${link}" style="background:#3D6B4F;color:#fff;padding:12px 24px;border-radius:40px;text-decoration:none;display:inline-block;">Reset Password</a>
           <p>If you didn't request this, ignore this email.</p>`
  };
  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (err) {
    console.error('Reset email failed:', err);
    return false;
  }
}

/* ─── PAYPAL CONFIG ─────────────────────────────────────── */
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || '';
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || '';
const PAYPAL_API_BASE = 'https://api-m.sandbox.paypal.com';

/* ─── EMAIL CONFIG ──────────────────────────────────────── */
// Defaulting to MailPit for development
const SMTP_HOST = process.env.SMTP_HOST || 'localhost';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '1025', 10);
const SMTP_USER = process.env.SMTP_USER || 'admin@matcha.test';
const SMTP_PASS = process.env.SMTP_PASS || '!test_dev';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@matcha.test';

const emailEnabled = !!(SMTP_HOST && SMTP_USER && SMTP_PASS);

let transporter = null;
if (emailEnabled) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

/* ─── ORDER STORE ───────────────────────────────────────── */
const DATA_DIR = path.join(__dirname, 'data');
// Supabase table for orders
const ORDERS_TABLE = 'matcha_orders';

/* --- ORDERS STORE (Supabase) ------------------------------------- */
async function loadOrders() {
  const { data, error } = await supabase.from(ORDERS_TABLE).select('*').order('created_at', { ascending: false });
  if (error) {
    console.error('Error loading orders from Supabase:', error);
    return [];
  }
  return data;
}

async function saveOrder(order) {
  const { data, error } = await supabase.from(ORDERS_TABLE).upsert(order, { onConflict: 'id' }).select();
  if (error) {
    console.error('Error saving order to Supabase:', error);
    return null;
  }
  return data[0];
}

async function createOrder(orderData) {
  const timestamp = new Date().toISOString();
  const order = {
    id: 'ORD-' + Date.now().toString(36).toUpperCase(),
    ...orderData,
    address: orderData.address || '',
    paymentMethod: orderData.paymentMethod || 'paypal',
    shippingTrackingUrl: '',
    status: 'pending', // Default to pending
    statusHistory: [
      { status: 'pending', timestamp }
    ],
    createdAt: timestamp,
  };
  const { data, error } = await supabase.from(ORDERS_TABLE).insert(order).select();
  if (error) {
    console.error('Error creating order in Supabase:', error);
    return null;
  }
  return data[0];
}

async function getOrder(id) {
  const { data, error } = await supabase.from(ORDERS_TABLE).select('*').eq('id', id).single();
  if (error && error.code !== 'PGRST116') { // PGRST116 means no rows found
    console.error('Error fetching order from Supabase:', error);
    return null;
  }
  return data;
}

async function getOrdersByEmail(email) {
  const { data, error } = await supabase.from(ORDERS_TABLE).select('*').ilike('customer_email', email).order('created_at', { ascending: false });
  if (error) {
    console.error('Error fetching orders by email from Supabase:', error);
    return [];
  }
  return data;
}

/* ─── EMAIL SENDERS ─────────────────────────────────────── */
async function sendCustomerConfirmation(order, tempPass) {
  if (!transporter || !order.customerEmail) return false;
  const itemsList = order.items.map(i => `• ${i.name} x${i.qty} — $${(i.price * i.qty).toFixed(2)}`).join('\n');
  
  let loginNote = '';
  if (tempPass) {
    loginNote = `
--- ACCOUNT CREATED ---
We've created a temporary account for you to track your order.
Login: ${order.customerEmail}
Temporary Password: ${tempPass}

Login here: http://localhost:${PORT}/client/login/
-----------------------
`;
  }

  const mailOptions = {
    from: `"Matcha Book" <${SMTP_USER}>`,
    to: order.customerEmail,
    subject: `Order Confirmation — ${order.id}`,
    text: `Hi ${order.customerName || 'there'},

Thank you for your purchase! Here are your order details:

Order ID: ${order.id}
Date: ${new Date(order.createdAt).toLocaleString()}

Items:
${itemsList}

Total: $${order.total.toFixed(2)}
${loginNote}
Track this specific order directly at:
http://localhost:${PORT}/customer/order-status/?orderId=${order.id}&email=${order.customerEmail}

If you have any questions, reply to this email.

— Matcha Book Team`,
    html: `<div style="font-family:Georgia,serif;max-width:480px;margin:0 auto;color:#1E2A22;">
      <h2 style="color:#3D6B4F;font-weight:300;">Thank you for your order!</h2>
      <p>Hi ${order.customerName || 'there'},</p>
      <p>Your order has been confirmed. Here are the details:</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr><td style="border-bottom:1px solid #D6CEC0;padding:8px 0;"><strong>Order ID</strong></td><td style="border-bottom:1px solid #D6CEC0;padding:8px 0;text-align:right;">${order.id}</td></tr>
        <tr><td style="border-bottom:1px solid #D6CEC0;padding:8px 0;"><strong>Date</strong></td><td style="border-bottom:1px solid #D6CEC0;padding:8px 0;text-align:right;">${new Date(order.createdAt).toLocaleString()}</td></tr>
        <tr><td style="border-bottom:1px solid #D6CEC0;padding:8px 0;"><strong>Total</strong></td><td style="border-bottom:1px solid #D6CEC0;padding:8px 0;text-align:right;">$${order.total.toFixed(2)}</td></tr>
      </table>
      ${tempPass ? `
      <div style="background:#F9F6F0; padding:16px; border-radius:8px; margin:16px 0; border:1px solid #D6CEC0;">
        <h4 style="margin:0 0 8px 0; color:#3D6B4F;">Account Created</h4>
        <p style="margin:0; font-size:14px;">A temporary account has been created for you.</p>
        <p style="margin:8px 0 0 0; font-size:14px;"><strong>Password:</strong> ${tempPass}</p>
        <p style="margin:12px 0 0 0;"><a href="http://localhost:${PORT}/client/login/" style="color:#3D6B4F; font-weight:600;">Login to Client Dashboard</a></p>
      </div>` : ''}
      <p style="margin-top:24px;">
        <a href="http://localhost:${PORT}/customer/order-status/?orderId=${order.id}&email=${order.customerEmail}" style="background:#3D6B4F;color:#fff;padding:12px 24px;border-radius:40px;text-decoration:none;display:inline-block;">Track My Order</a>
      </p>
      <p style="font-size:12px;color:#8A9E8C;margin-top:24px;">— Matcha Book Team</p>
    </div>`,
  };
  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (err) {
    console.error('Customer email failed:', err.message);
    return false;
  }
}

async function sendAdminNotification(order) {
  const targetEmail = adminConfig.email || ADMIN_EMAIL;
  if (!transporter || !targetEmail) return false;
  const itemsList = order.items.map(i => `• ${i.name} x${i.qty} — $${(i.price * i.qty).toFixed(2)}`).join('\n');
  const mailOptions = {
    from: `"Matcha Book" <${SMTP_USER}>`,
    to: targetEmail,
    subject: `New Order — ${order.id}`,
    text: `A new order has been placed.

Order ID: ${order.id}
Customer: ${order.customerName || 'N/A'} (${order.customerEmail || 'N/A'})
Date: ${new Date(order.createdAt).toLocaleString()}

Items:
${itemsList}

Total: $${order.total.toFixed(2)}

View admin dashboard:
http://localhost:${PORT}/admin/dashboard/
`,
    html: `<div style="font-family:Georgia,serif;max-width:480px;margin:0 auto;color:#1E2A22;">
      <h2 style="color:#3D6B4F;font-weight:300;">New Order Received</h2>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr><td style="border-bottom:1px solid #D6CEC0;padding:8px 0;"><strong>Order ID</strong></td><td style="border-bottom:1px solid #D6CEC0;padding:8px 0;text-align:right;">${order.id}</td></tr>
        <tr><td style="border-bottom:1px solid #D6CEC0;padding:8px 0;"><strong>Customer</strong></td><td style="border-bottom:1px solid #D6CEC0;padding:8px 0;text-align:right;">${order.customerName || 'N/A'} &lt;${order.customerEmail || 'N/A'}&gt;</td></tr>
        <tr><td style="border-bottom:1px solid #D6CEC0;padding:8px 0;"><strong>Total</strong></td><td style="border-bottom:1px solid #D6CEC0;padding:8px 0;text-align:right;">$${order.total.toFixed(2)}</td></tr>
      </table>
      <p style="margin-top:24px;"><a href="http://localhost:${PORT}/admin/dashboard/" style="background:#3D6B4F;color:#fff;padding:12px 24px;border-radius:40px;text-decoration:none;display:inline-block;">Admin Dashboard</a></p>
    </div>`,
  };
  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (err) {
    console.error('Admin email failed:', err.message);
    return false;
  }
}

async function sendStatusUpdateEmail(order) {
  if (!transporter || !order.customerEmail) return false;
  
  let statusText = `Your order status has been updated to: ${order.status.toUpperCase()}.`;
  if (order.status === 'shipped' && order.shippingTrackingUrl) {
    statusText += `\n\nYou can track your shipment here: ${order.shippingTrackingUrl}`;
  }

  const mailOptions = {
    from: `"Matcha Book" <${SMTP_USER}>`,
    to: order.customerEmail,
    subject: `Order Update — ${order.id} — ${order.status.toUpperCase()}`,
    text: `Hi ${order.customerName || 'there'},

${statusText}

Order ID: ${order.id}

You can view your order details at:
http://localhost:${PORT}/customer/dashboard/?orderId=${order.id}&email=${order.customerEmail}

— Matcha Book Team`,
    html: `<div style="font-family:Georgia,serif;max-width:480px;margin:0 auto;color:#1E2A22;">
      <h2 style="color:#3D6B4F;font-weight:300;">Order Status Update</h2>
      <p>Hi ${order.customerName || 'there'},</p>
      <p><strong>Order ID: ${order.id}</strong></p>
      <p>${statusText.replace(/\n/g, '<br>')}</p>
      <p style="margin-top:24px;"><a href="http://localhost:${PORT}/customer/dashboard/?orderId=${order.id}&email=${order.customerEmail}" style="background:#3D6B4F;color:#fff;padding:12px 24px;border-radius:40px;text-decoration:none;display:inline-block;">View Order Details</a></p>
      <p style="font-size:12px;color:#8A9E8C;margin-top:24px;">— Matcha Book Team</p>
    </div>`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Status update email sent to ${order.customerEmail} for order ${order.id}`);
    return true;
  } catch (err) {
    console.error('Status update email failed:', err.message);
    return false;
  }
}

/* ─── CLEAN URLS MIDDLEWARE ──────────────────────────────── */
app.get(/(.*)\/$/, (req, res, next) => {
  const p = req.params[0];
  const htmlPath = path.join(__dirname, 'public', p + '.html');
  if (fs.existsSync(htmlPath)) {
    return res.sendFile(htmlPath);
  }
  next();
});

/* ─── MIDDLEWARE ────────────────────────────────────────── */
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

/* ─── PAYPAL HELPERS ────────────────────────────────────── */
async function getPayPalAccessToken() {
  if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
    throw new Error('PayPal credentials not configured.');
  }
  const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');
  const res = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || 'Failed to get PayPal access token');
  return data.access_token;
}

/* ─── ROUTES ────────────────────────────────────────────── */

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get(['/login', '/login/'], (req, res) => {
  if (req.cookies.admin_session === SESSION_TOKEN) {
    return res.redirect('/admin/dashboard/');
  }
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === adminConfig.password) {
    res.cookie('admin_session', SESSION_TOKEN, { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 });
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Incorrect password' });
  }
});

app.post('/api/admin/logout', (req, res) => {
  res.clearCookie('admin_session');
  res.json({ success: true });
});

app.get('/api/admin/config', isAdmin, (req, res) => {
  res.json({ email: adminConfig.email });
});

app.put('/api/admin/config', isAdmin, (req, res) => {
  const { email, password } = req.body;
  if (email) adminConfig.email = email;
  if (password) adminConfig.password = password;
  saveAdminConfig();
  res.json({ success: true, email: adminConfig.email });
});

app.get('/api/config', (req, res) => {
  res.json({
    paypalClientId: PAYPAL_CLIENT_ID || null,
    paypalConfigured: !!(PAYPAL_CLIENT_ID && PAYPAL_CLIENT_SECRET),
    emailConfigured: emailEnabled,
  });
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, paypalConfigured: !!(PAYPAL_CLIENT_ID && PAYPAL_CLIENT_SECRET), emailConfigured: emailEnabled });
});

app.post('/api/create-paypal-order', async (req, res) => {
  try {
    const { items, total } = req.body;
    const accessToken = await getPayPalAccessToken();
    const orderItems = (items || []).map(item => ({
      name: item.name.substring(0, 127),
      unit_amount: { currency_code: 'USD', value: item.price.toFixed(2) },
      quantity: item.qty.toString(),
    }));
    const payload = {
      intent: 'CAPTURE',
      purchase_units: [{
        amount: {
          currency_code: 'USD',
          value: total.toFixed(2),
          breakdown: { item_total: { currency_code: 'USD', value: total.toFixed(2) } },
        },
        items: orderItems,
      }],
    };
    const response = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
      body: JSON.stringify(payload),
    });
    const order = await response.json();
    if (!response.ok) {
      console.error('PayPal create order error:', order);
      return res.status(500).json({ error: order.message || 'Failed to create PayPal order' });
    }
    res.json({ orderID: order.id });
  } catch (err) {
    console.error('Create order error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/capture-paypal-order', async (req, res) => {
  try {
    const { orderID } = req.body;
    if (!orderID) return res.status(400).json({ error: 'orderID is required' });

    const accessToken = await getPayPalAccessToken();
    const response = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders/${orderID}/capture`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
    });
    const data = await response.json();
    if (!response.ok) {
      console.error('PayPal capture error:', data);
      return res.status(500).json({ error: data.message || 'Failed to capture PayPal order' });
    }

    // Extract customer info from PayPal response
    const purchaseUnit = data.purchase_units?.[0];
    const payer = data.payer || {};
    const shipping = purchaseUnit?.shipping || {};
    const addressObj = shipping.address || {};
    const addressStr = [
      addressObj.address_line_1,
      addressObj.address_line_2,
      addressObj.admin_area_2,
      addressObj.admin_area_1,
      addressObj.postal_code,
      addressObj.country_code
    ].filter(Boolean).join(', ');

    const customerName = shipping.name?.full_name || payer.name?.given_name + ' ' + payer.name?.surname || 'Customer';
    const customerEmail = payer.email_address || '';
    const captureID = purchaseUnit?.payments?.captures?.[0]?.id || '';
    const total = parseFloat(purchaseUnit?.payments?.captures?.[0]?.amount?.value || 0);

    // Build items from capture data or fallback
    let items = [];
    if (purchaseUnit?.items) {
      items = purchaseUnit.items.map(i => ({
        name: i.name,
        price: parseFloat(i.unit_amount.value),
        qty: parseInt(i.quantity, 10),
      }));
    }

    // Save order
    const order = createOrder({
      paypalOrderId: orderID,
      captureId: captureID,
      customerName: customerName.trim(),
      customerEmail: customerEmail,
      address: addressStr,
      paymentMethod: 'paypal',
      total,
      items,
    });

    // Create/Update customer account
    const { tempPass } = createOrUpdateCustomer(customerEmail, customerName);

    // Send emails
    const customerSent = await sendCustomerConfirmation(order, tempPass);
    const adminSent = await sendAdminNotification(order);

    res.json({ success: true, order, tempPass, emails: { customer: customerSent, admin: adminSent } });
  } catch (err) {
    console.error('Capture order error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ─── CLIENT AUTH ROUTES ────────────────────────────────── */
app.post('/api/client/login', (req, res) => {
  const { email, password } = req.body;
  const customer = getCustomer(email);
  if (customer && customer.password === password) {
    res.cookie('customer_email', customer.email, { httpOnly: true, maxAge: 30 * 24 * 60 * 60 * 1000 });
    res.cookie('customer_pass', customer.password, { httpOnly: true, maxAge: 30 * 24 * 60 * 60 * 1000 });
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Invalid email or password' });
  }
});

app.post('/api/client/logout', (req, res) => {
  res.clearCookie('customer_email');
  res.clearCookie('customer_pass');
  res.json({ success: true });
});

app.get('/api/client/me', isCustomer, (req, res) => {
  const { password, ...safeCustomer } = req.customer;
  res.json(safeCustomer);
});

app.put('/api/client/me', isCustomer, (req, res) => {
  const { name, password } = req.body;
  const customers = loadCustomers();
  const index = customers.findIndex(c => c.email === req.customer.email);
  if (index !== -1) {
    if (name) customers[index].name = name;
    if (password) {
      customers[index].password = password;
      customers[index].isTempPassword = false;
      // Update cookie to reflect new password
      res.cookie('customer_pass', password, { httpOnly: true, maxAge: 30 * 24 * 60 * 60 * 1000 });
    }
    saveCustomers(customers);
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Customer not found' });
  }
});

app.get('/api/client/orders', isCustomer, (req, res) => {
  const orders = getOrdersByEmail(req.customer.email);
  res.json(orders);
});

app.delete('/api/client/orders', isCustomer, (req, res) => {
  const orders = loadOrders();
  const filtered = orders.filter(o => o.customerEmail.toLowerCase() !== req.customer.email.toLowerCase());
  saveOrders(filtered);
  res.json({ success: true });
});

/* ─── FORGOT PASSWORD ROUTES ────────────────────────────── */
app.post('/api/forgot-password', async (req, res) => {
  const { email, type } = req.body; // type: 'admin' or 'client'
  let user = null;
  if (type === 'admin') {
    if (email.toLowerCase() === adminConfig.email.toLowerCase()) user = adminConfig;
  } else {
    user = getCustomer(email);
  }

  if (!user) return res.json({ success: true, message: 'If that email exists, a reset link has been sent.' });

  const token = Math.random().toString(36).substring(2, 15);
  const tokens = loadForgotTokens();
  tokens[token] = { email: email.toLowerCase(), type, expires: Date.now() + 3600000 };
  saveForgotTokens(tokens);

  await sendResetEmail(email.toLowerCase(), token, type);
  res.json({ success: true, message: 'If that email exists, a reset link has been sent.' });
});

app.post('/api/reset-password', (req, res) => {
  const { token, password } = req.body;
  const tokens = loadForgotTokens();
  const session = tokens[token];

  if (!session || session.expires < Date.now()) {
    return res.status(400).json({ error: 'Invalid or expired token' });
  }

  if (session.type === 'admin') {
    adminConfig.password = password;
    saveAdminConfig();
  } else {
    const customers = loadCustomers();
    const index = customers.findIndex(c => c.email.toLowerCase() === session.email.toLowerCase());
    if (index !== -1) {
      customers[index].password = password;
      customers[index].isTempPassword = false;
      saveCustomers(customers);
    }
  }

  delete tokens[token];
  saveForgotTokens(tokens);
  res.json({ success: true });
});

app.post('/api/orders/:id/refund', isAdmin, async (req, res) => {
  const { id } = req.params;
  const order = getOrderById(id);
  if (!order || !order.captureId) return res.status(404).json({ error: 'Order or Capture ID not found' });

  try {
    const accessToken = await getPayPalAccessToken();
    const response = await fetch(`${PAYPAL_API_BASE}/v2/payments/captures/${order.captureId}/refund`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'PayPal-Request-Id': `REFUND-${order.id}-${Date.now()}` // Make ID unique per request
      },
    });
    
    const data = await response.json(); // Try to parse JSON response
    if (!response.ok) {
      console.error('PayPal refund API error:', { status: response.status, statusText: response.statusText, data }); // Log detailed error
      throw new Error(data.message || `Refund failed. PayPal status: ${response.status}`); // Throw error with details
    }

    // Update internal status
    const orders = loadOrders();
    const index = orders.findIndex(o => o.id === id);
    orders[index].status = 'refunded';
    orders[index].statusHistory.push({ status: 'refunded', timestamp: new Date().toISOString() });
    saveOrders(orders);

    res.json({ success: true, refundDetails: data });
  } catch (err) {
    console.error('Refund process error:', err.message); // Log caught errors
    res.status(500).json({ error: err.message });
  }
});

/* ─── ORDER API ─────────────────────────────────────────── */
app.get('/api/orders', isAdmin, (req, res) => {
  const orders = loadOrders();
  res.json(orders);
});

app.delete('/api/orders', isAdmin, (req, res) => {
  saveOrders([]);
  res.json({ success: true });
});

app.get('/api/orders/:id', isAdmin, (req, res) => {
  const order = getOrderById(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json(order);
});

app.put('/api/orders/:id/status', isAdmin, (req, res) => {
  const { id } = req.params;
  const { status, shippingTrackingUrl } = req.body;
  const orders = loadOrders();
  const index = orders.findIndex(o => o.id === id);

  if (index === -1) return res.status(404).json({ error: 'Order not found' });

  const order = orders[index];
  const oldStatus = order.status;

  order.status = status || order.status;
  order.shippingTrackingUrl = shippingTrackingUrl !== undefined ? shippingTrackingUrl : order.shippingTrackingUrl;

  if (status && status !== oldStatus) {
    order.statusHistory.push({
      status: order.status,
      timestamp: new Date().toISOString()
    });
    // Send status update email
    sendStatusUpdateEmail(order);
  }

  saveOrders(orders);
  res.json({ success: true, order });
});

app.post('/api/orders/:id/resend-confirmation', isAdmin, async (req, res) => {
  const { id } = req.params;  const order = getOrderById(id);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const sent = await sendCustomerConfirmation(order);
  if (sent) {
    res.json({ success: true, message: 'Confirmation email resent.' });
  } else {
    res.status(500).json({ error: 'Failed to send email.' });
  }
});

app.get('/api/orders/customer/:email', (req, res) => {
  const orders = getOrdersByEmail(req.params.email);
  res.json(orders);
});

app.get('/api/orders/lookup', (req, res) => {
  const { orderId, email } = req.query;
  if (!orderId || !email) return res.status(400).json({ error: 'orderId and email are required' });

  const order = loadOrders().find(o => 
    o.id.toLowerCase() === orderId.toLowerCase() && 
    o.customerEmail.toLowerCase() === email.toLowerCase()
  );

  if (!order) return res.status(404).json({ error: 'Order not found or email mismatch.' });
  res.json(order);
});

app.listen(PORT, () => {
  console.log(`Matcha Book server running at http://localhost:${PORT}`);
  if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
    console.log('\n⚠️  PayPal credentials not set.');
    console.log('   Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET to enable checkout.\n');
  }
  if (!emailEnabled) {
    console.log('\n📧 Email not configured.');
    console.log('   Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, ADMIN_EMAIL to enable email notifications.\n');
    console.log('   Gmail Setup Example:');
    console.log('   SMTP_HOST=smtp.gmail.com');
    console.log('   SMTP_PORT=587');
    console.log('   SMTP_USER=your_email@gmail.com');
    console.log('   SMTP_PASS=your_app_password');
    console.log('   ADMIN_EMAIL=admin@example.com\n');
  }
});
