# BUXVO Demo + Simple Backend

This version includes a simple Express backend and JSON file database.

## Features
- Register / Login
- Demo balance
- Demo deposits with admin approval/rejection
- Demo withdrawals with admin approval/rejection
- Withdrawal amount cannot exceed the current demo balance
- Approved withdrawal deducts the amount from the user's balance
- Demo trading P/L

## Run backend
```bash
cd backend
npm install
npm start
```

Backend runs on `http://localhost:4000`.

## Run frontend
Open another terminal:
```bash
cd frontend
npm install
npm run dev
```

If needed, create `frontend/.env`:
```env
VITE_API_URL=http://localhost:4000/api
```

## Admin
Username: `admin`
Password: `buxvo123`

## Withdrawal flow
1. User opens **Withdraw**.
2. User enters amount, method and wallet/account details.
3. Backend creates a **pending** withdrawal request.
4. Admin opens **Admin Panel** and approves or rejects it.
5. On approval, the demo balance is deducted on the server.
6. On rejection, no balance is deducted.

This is a demo system. It does not send real money or connect to a real wallet/payment provider.
