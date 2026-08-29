# BUXVO Frontend

A responsive React/Vite frontend prototype for a fictional/demo trading dashboard.

## Included

- BUXVO dashboard
- Login + registration
- Admin login through the same login form
- Demo admin credentials:
  - username: `admin`
  - password: `buxvo123`
- Starting user balance is `$0.00`
- Recharge/deposit request UI
- Demo USDT address + non-scannable demo QR visual
- Payment-proof filename capture
- Admin deposit approval/rejection
- Demo balance credit after approval
- Artificial continuously moving candle chart
- BUY / SELL demo trades with simulated P/L
- Responsive mobile + desktop layout
- LocalStorage persistence

## Run

```bash
npm install
npm run dev
```

Then open the local Vite URL shown in the terminal.

## Important

This is a frontend/demo prototype only. It does not process real USDT, connect to a blockchain, verify payments, or execute real trades. Before any real-money deployment, use a secure backend, proper authentication, server-side authorization, audited payment handling, wallet verification, transaction monitoring, and legal/compliance review.
