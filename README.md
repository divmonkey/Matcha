# Matcha Book 🍵

A premium landing page and e-commerce platform for "The Green Tea Matcha Recipe Book." This project features a modern, responsive design with a custom cart system, PayPal integration, and secure dashboards for both customers and administrators.

## 🚀 Features

- **Responsive Landing Page:** Beautifully designed with smooth scroll reveals and interactive elements.
- **Shopping Cart:** Custom-built vanilla JS cart with persistent sessions.
- **PayPal Integration:** Secure payment processing using the PayPal JavaScript SDK.
- **Customer Dashboard:** Allows customers to view their order history and status.
- **Admin Panel:** Comprehensive dashboard for managing orders and site configuration.
- **Email Notifications:** Automatic confirmation emails via Nodemailer (integrated with Mailpit for testing).
- **Supabase Backend:** Scalable database for managing customers and order data.

## 🛠️ Tech Stack

- **Backend:** Node.js, Express.js
- **Database:** Supabase (PostgreSQL)
- **Frontend:** HTML5, CSS3 (Vanilla), JavaScript (Vanilla)
- **Auth:** Cookie-based session management
- **Testing:** Playwright for End-to-End testing
- **Tools:** Mailpit for local email debugging

## 🏁 Getting Started

### Prerequisites

- Node.js (v18+)
- A Supabase account and project
- A PayPal Developer account (for sandbox testing)

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd matcha
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   Copy `.env.example` to `.env` and fill in your credentials:
   ```bash
   cp .env.example .env
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```
   The application will be available at `http://localhost:3000`.

### Local Email Testing

To test email notifications locally, run [Mailpit](https://github.com/axllent/mailpit):
```bash
./mailpit.exe
```
Access the Mailpit UI at `http://localhost:8025`.

## 📂 Project Structure

- `/public`: Static frontend files (HTML, CSS, JS, Images).
- `/data`: Local JSON storage for configuration and fallback data.
- `/supabase`: Database schema and migration scripts.
- `/task`: Project guidelines and task tracking.
- `/test`: Playwright test suites.
- `index.js`: Main Express server and API routes.

## 🧪 Testing

Run the Playwright test suite:
```bash
npx playwright test
```

## 📜 License

This project is licensed under the ISC License.
