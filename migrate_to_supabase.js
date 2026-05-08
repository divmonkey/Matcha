require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function migrate() {
  console.log('Starting migration...');

  // 1. Migrate Customers
  const customers = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'customers.json'), 'utf8'));
  const customerData = customers.map(c => ({
    email: c.email,
    name: c.name,
    password: c.password,
    is_temp_password: c.isTempPassword,
    created_at: c.createdAt
  }));
  
  const { error: customerError } = await supabase.from('customers').insert(customerData);
  if (customerError) console.error('Customer migration failed:', customerError);
  else console.log('Customers migrated successfully.');

  // 2. Migrate Orders
  const orders = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'orders.json'), 'utf8'));
  const orderData = orders.map(o => ({
    id: o.id,
    paypal_order_id: o.paypalOrderId,
    capture_id: o.captureId,
    customer_name: o.customerName,
    customer_email: o.customerEmail,
    address: o.address,
    payment_method: o.paymentMethod,
    total: o.total,
    status: o.status,
    shipping_tracking_url: o.shippingTrackingUrl,
    items: o.items,
    status_history: o.statusHistory,
    created_at: o.createdAt
  }));

  const { error: orderError } = await supabase.from('matcha_orders').insert(orderData);
  if (orderError) console.error('Order migration failed:', orderError);
  else console.log('Orders migrated successfully.');

  console.log('Migration finished.');
}

migrate();
