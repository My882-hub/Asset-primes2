import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || "buxvo-demo-secret-change-me";
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASS = process.env.ADMIN_PASS || "buxvo123";
const DB_FILE = path.join(__dirname, "data.json");

function loadDB() {
  if (!fs.existsSync(DB_FILE)) return { users: [], deposits: [], withdrawals: [], trades: [] };
  try { return JSON.parse(fs.readFileSync(DB_FILE, "utf8")); }
  catch { return { users: [], deposits: [], withdrawals: [], trades: [] }; }
}
function saveDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}
let db = loadDB();
if (!Array.isArray(db.withdrawals)) db.withdrawals = [];

const app = express();
app.use(cors());
app.use(express.json());

function publicUser(u) {
  return { username: u.username, balance: Number(u.balance || 0), createdAt: u.createdAt };
}
function tokenFor(payload) { return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" }); }

function auth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: "Please login first." });
  }
}
function adminOnly(req, res, next) {
  if (req.user?.role !== "admin") return res.status(403).json({ message: "Admin access required." });
  next();
}

app.get("/api/health", (req,res) => res.json({ ok:true, app:"BUXVO backend" }));

app.post("/api/auth/register", async (req,res) => {
  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "");
  if (!username || !password) return res.status(400).json({ message:"Enter a username and password." });
  if (username.toLowerCase() === ADMIN_USER.toLowerCase()) return res.status(400).json({ message:"This username is reserved." });
  if (db.users.some(u => u.username.toLowerCase() === username.toLowerCase()))
    return res.status(409).json({ message:"Username already exists. Please login." });

  const passwordHash = await bcrypt.hash(password, 10);
  db.users.push({ username, passwordHash, balance:0, createdAt:Date.now() });
  saveDB(db);
  res.status(201).json({ message:"Registration complete. Now login." });
});

app.post("/api/auth/login", async (req,res) => {
  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "");

  if (username === ADMIN_USER && password === ADMIN_PASS) {
    return res.json({ token: tokenFor({ username, role:"admin" }), user:{ username, role:"admin" } });
  }
  const user = db.users.find(u => u.username.toLowerCase() === username.toLowerCase());
  if (!user || !(await bcrypt.compare(password, user.passwordHash)))
    return res.status(401).json({ message:"Details do not match. Please register first, then login." });

  res.json({ token: tokenFor({ username:user.username, role:"user" }), user:{ ...publicUser(user), role:"user" } });
});

app.get("/api/auth/me", auth, (req,res) => {
  if (req.user.role === "admin") return res.json({ username: req.user.username, role:"admin" });
  const user = db.users.find(u => u.username === req.user.username);
  if (!user) return res.status(404).json({ message:"User not found." });
  res.json({ ...publicUser(user), role:"user" });
});

app.post("/api/deposits", auth, (req,res) => {
  if (req.user.role !== "user") return res.status(403).json({message:"Users only."});
  const amount = Number(req.body.amount);
  const proof = String(req.body.proof || "No file selected");
  if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({message:"Enter a valid amount."});

  const request = {
    id: crypto.randomUUID(), username:req.user.username, amount, proof,
    status:"pending", createdAt:Date.now()
  };
  db.deposits.unshift(request); saveDB(db);
  res.status(201).json(request);
});

app.get("/api/deposits/mine", auth, (req,res) => {
  if (req.user.role !== "user") return res.json([]);
  res.json(db.deposits.filter(d => d.username === req.user.username));
});

app.get("/api/admin/users", auth, adminOnly, (req,res) => res.json(db.users.map(publicUser)));
app.get("/api/admin/deposits", auth, adminOnly, (req,res) => res.json(db.deposits));

app.post("/api/withdrawals", auth, (req,res) => {
  if (req.user.role !== "user") return res.status(403).json({message:"Users only."});
  const amount = Number(req.body.amount);
  const method = String(req.body.method || "").trim();
  const account = String(req.body.account || "").trim();
  if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({message:"Enter a valid withdrawal amount."});
  if (!method || !account) return res.status(400).json({message:"Enter the withdrawal method and wallet/account details."});

  const user = db.users.find(u => u.username === req.user.username);
  if (!user) return res.status(404).json({message:"User not found."});
  const balance = Number(user.balance || 0);
  if (amount > balance) return res.status(400).json({message:`Insufficient demo balance. Available: $${balance.toFixed(2)}.`});

  const request = {
    id: crypto.randomUUID(), username:user.username, amount, method, account,
    status:"pending", createdAt:Date.now()
  };
  db.withdrawals.unshift(request); saveDB(db);
  res.status(201).json(request);
});

app.get("/api/withdrawals/mine", auth, (req,res) => {
  if (req.user.role !== "user") return res.json([]);
  res.json(db.withdrawals.filter(w => w.username === req.user.username));
});

app.get("/api/admin/withdrawals", auth, adminOnly, (req,res) => res.json(db.withdrawals));

app.post("/api/admin/withdrawals/:id/approve", auth, adminOnly, (req, res) => {
  const w = db.withdrawals.find(x => x.id === req.params.id);

  if (!w) {
    return res.status(404).json({
      message: "Withdrawal not found."
    });
  }

  if (w.status !== "pending") {
    return res.status(400).json({
      message: "This withdrawal was already processed."
    });
  }

  const user = db.users.find(
    u => u.username === w.username
  );

  if (!user) {
    return res.status(404).json({
      message: "User not found."
    });
  }

  const balance = Number(user.balance || 0);

  // Withdrawal amount define here
  const withdrawalAmount = Number(w.amount || 0);

  if (
    !Number.isFinite(withdrawalAmount) ||
    withdrawalAmount <= 0
  ) {
    return res.status(400).json({
      message: "Invalid withdrawal amount."
    });
  }

  if (withdrawalAmount > balance) {
    return res.status(400).json({
      message: `Withdrawal cannot be approved. User balance is only $${balance.toFixed(2)}.`
    });
  }

  // Deduct withdrawal from balance
  user.balance = Number(
    (balance - withdrawalAmount).toFixed(2)
  );

  // Approve withdrawal
  w.status = "approved";
  w.processedAt = Date.now();

  saveDB(db);

  return res.json({
    message: "Withdrawal approved successfully.",
    balance: user.balance,
    user: {
      username: user.username,
      balance: user.balance
    }
  });
});

app.post("/api/admin/withdrawals/:id/reject", auth, adminOnly, (req,res) => {
  const w = db.withdrawals.find(x => x.id === req.params.id);
  if (!w) return res.status(404).json({message:"Withdrawal not found."});
  if (w.status !== "pending") return res.status(400).json({message:"This withdrawal was already processed."});
  w.status = "rejected";
  w.processedAt = Date.now();
  saveDB(db);
  res.json({ message:"Withdrawal request rejected. No balance was deducted.", withdrawal:w });
});

app.post("/api/admin/deposits/:id/approve", auth, adminOnly, (req,res) => {
  const d = db.deposits.find(x => x.id === req.params.id);
  if (!d) return res.status(404).json({message:"Deposit not found."});
  if (d.status !== "pending") return res.status(400).json({message:"This deposit was already processed."});
  const user = db.users.find(u => u.username === d.username);
  if (!user) return res.status(404).json({message:"User not found."});

  d.status = "approved";
  user.balance = Number(user.balance || 0) + Number(d.amount);
  saveDB(db);
  res.json({ message:"Deposit approved and demo balance credited.", deposit:d, user:publicUser(user) });
});

app.post("/api/admin/deposits/:id/reject", auth, adminOnly, (req,res) => {
  const d = db.deposits.find(x => x.id === req.params.id);
  if (!d) return res.status(404).json({message:"Deposit not found."});
  if (d.status !== "pending") return res.status(400).json({message:"This deposit was already processed."});
  d.status = "rejected"; saveDB(db);
  res.json({ message:"Deposit request rejected.", deposit:d });
});

app.post("/api/trades/close", auth, (req,res) => {
  if (req.user.role !== "user") {
    return res.status(403).json({
      message: "Users only."
    });
  }

  const { side } = req.body;
  const entry = Number(req.body.entry);
  const exit = Number(req.body.exit);

  if (
    !["buy", "sell"].includes(side) ||
    !Number.isFinite(entry) ||
    !Number.isFinite(exit)
  ) {
    return res.status(400).json({
      message: "Invalid trade data."
    });
  }

  const user = db.users.find(
    u => u.username === req.user.username
  );

  if (!user) {
    return res.status(404).json({
      message: "User not found."
    });
  }

  // Current account balance
  const currentBalance = Number(user.balance || 0);

  // Fixed 22% profit according to account balance
  const pnl = Number(
    (currentBalance * 0.22).toFixed(2)
  );

  // Add exact 22% profit to balance
  user.balance = Number(
    (currentBalance + pnl).toFixed(2)
  );

  db.trades.unshift({
    id: crypto.randomUUID(),
    username: user.username,
    side,
    entry,
    exit,
    pnl,
    createdAt: Date.now()
  });

  saveDB(db);

  res.json({
    pnl,
    balance: user.balance
  });
});

app.get("/api/trades/mine", auth, (req,res) => {
  res.json(db.trades.filter(t => t.username === req.user.username));
});

app.listen(PORT, () => console.log(`BUXVO backend running at http://localhost:${PORT}`));
