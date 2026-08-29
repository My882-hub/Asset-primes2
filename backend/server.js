import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASS = process.env.ADMIN_PASS || "buxvo123";
const MONGO_URI = process.env.MONGO_URI;

// MongoDB Database Connection
mongoose.connect(MONGO_URI)
  .then(() => console.log("MongoDB Database Connected Successfully!"))
  .catch((err) => console.log("DB Connection Error:", err));

// Database Schemas
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  balance: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

const depositSchema = new mongoose.Schema({
  id: String,
  username: String,
  amount: Number,
  proof: String,
  status: { type: String, default: "pending" },
  createdAt: { type: Date, default: Date.now }
});

const withdrawalSchema = new mongoose.Schema({
  id: String,
  username: String,
  amount: Number,
  method: String,
  account: String,
  status: { type: String, default: "pending" },
  createdAt: { type: Date, default: Date.now },
  processedAt: Date
});

const tradeSchema = new mongoose.Schema({
  id: String,
  username: String,
  side: String,
  entry: Number,
  exit: Number,
  pnl: Number,
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model("User", userSchema);
const Deposit = mongoose.model("Deposit", depositSchema);
const Withdrawal = mongoose.model("Withdrawal", withdrawalSchema);
const Trade = mongoose.model("Trade", tradeSchema);

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

app.post("/api/auth/register", async (req, res) => {
  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "");
  if (!username || !password) return res.status(400).json({ message: "Enter a username and password." });
  if (username.toLowerCase() === ADMIN_USER.toLowerCase()) return res.status(400).json({ message: "This username is reserved." });
  
  const existing = await User.findOne({ username: new RegExp(`^${username}$`, "i") });
  if (existing) return res.status(409).json({ message: "Username already exists. Please login." });

  const passwordHash = await bcrypt.hash(password, 10);
  await User.create({ username, passwordHash, balance: 0 });
  res.status(201).json({ message: "Registration complete. Now login." });
});

app.post("/api/auth/login", async (req, res) => {
  const username = String(req.body.username || "").trim();
  const password = String(req.body.password || "");

  if (username === ADMIN_USER && password === ADMIN_PASS) {
    return res.json({ token: tokenFor({ username, role: "admin" }), user: { username, role: "admin" } });
  }
  const user = await User.findOne({ username: new RegExp(`^${username}$`, "i") });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ message: "Details do not match. Please register first, then login." });
  }

  res.json({ token: tokenFor({ username: user.username, role: "user" }), user: { ...publicUser(user), role: "user" } });
});

app.get("/api/auth/me", auth, async (req, res) => {
  if (req.user.role === "admin") return res.json({ username: req.user.username, role: "admin" });
  const user = await User.findOne({ username: req.user.username });
  if (!user) return res.status(404).json({ message: "User not found." });
  res.json({ ...publicUser(user), role: "user" });
});

app.post("/api/deposits", auth, async (req, res) => {
  if (req.user.role !== "user") return res.status(403).json({ message: "Users only." });
  const amount = Number(req.body.amount);
  const proof = String(req.body.proof || "No file selected");
  if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ message: "Enter a valid amount." });

  const request = await Deposit.create({
    id: crypto.randomUUID(), username: req.user.username, amount, proof, status: "pending"
  });
  res.status(201).json(request);
});

app.get("/api/deposits/mine", auth, async (req, res) => {
  if (req.user.role !== "user") return res.json([]);
  const deposits = await Deposit.find({ username: req.user.username }).sort({ createdAt: -1 });
  res.json(deposits);
});

app.get("/api/admin/users", auth, adminOnly, async (req, res) => {
  const users = await User.find();
  res.json(users.map(publicUser));
});

app.get("/api/admin/deposits", auth, adminOnly, async (req, res) => {
  const deposits = await Deposit.find().sort({ createdAt: -1 });
  res.json(deposits);
});

app.post("/api/withdrawals", auth, async (req, res) => {
  if (req.user.role !== "user") return res.status(403).json({ message: "Users only." });
  const amount = Number(req.body.amount);
  const method = String(req.body.method || "").trim();
  const account = String(req.body.account || "").trim();
  if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ message: "Enter a valid withdrawal amount." });
  if (!method || !account) return res.status(400).json({ message: "Enter the withdrawal method and wallet/account details." });

  const user = await User.findOne({ username: req.user.username });
  if (!user) return res.status(404).json({ message: "User not found." });
  const balance = Number(user.balance || 0);
  if (amount > balance) return res.status(400).json({ message: `Insufficient demo balance. Available: $${balance.toFixed(2)}.` });

  const request = await Withdrawal.create({
    id: crypto.randomUUID(), username: user.username, amount, method, account, status: "pending"
  });
  res.status(201).json(request);
});

app.get("/api/withdrawals/mine", auth, async (req, res) => {
  if (req.user.role !== "user") return res.json([]);
  const withdrawals = await Withdrawal.find({ username: req.user.username }).sort({ createdAt: -1 });
  res.json(withdrawals);
});

app.get("/api/admin/withdrawals", auth, adminOnly, async (req, res) => {
  const withdrawals = await Withdrawal.find().sort({ createdAt: -1 });
  res.json(withdrawals);
});

app.post("/api/admin/withdrawals/:id/approve", auth, adminOnly, async (req, res) => {
  const w = await Withdrawal.findOne({ id: req.params.id });
  if (!w) return res.status(404).json({ message: "Withdrawal not found." });
  if (w.status !== "pending") return res.status(400).json({ message: "This withdrawal was already processed." });

  const user = await User.findOne({ username: w.username });
  if (!user) return res.status(404).json({ message: "User not found." });

  const balance = Number(user.balance || 0);
  const withdrawalAmount = Number(w.amount || 0);
  if (withdrawalAmount > balance) {
    return res.status(400).json({ message: `Withdrawal cannot be approved. User balance is only $${balance.toFixed(2)}.` });
  }

  user.balance = Number((balance - withdrawalAmount).toFixed(2));
  await user.save();

  w.status = "approved";
  w.processedAt = Date.now();
  await w.save();

  return res.json({ message: "Withdrawal approved successfully.", balance: user.balance, user: { username: user.username, balance: user.balance } });
});

app.post("/api/admin/withdrawals/:id/reject", auth, adminOnly, async (req, res) => {
  const w = await Withdrawal.findOne({ id: req.params.id });
  if (!w) return res.status(404).json({ message: "Withdrawal not found." });
  if (w.status !== "pending") return res.status(400).json({ message: "This withdrawal was already processed." });

  w.status = "rejected";
  w.processedAt = Date.now();
  await w.save();

  res.json({ message: "Withdrawal request rejected. No balance was deducted.", withdrawal: w });
});

app.post("/api/admin/deposits/:id/approve", auth, adminOnly, async (req, res) => {
  const d = await Deposit.findOne({ id: req.params.id });
  if (!d) return res.status(404).json({ message: "Deposit not found." });
  if (d.status !== "pending") return res.status(400).json({ message: "This deposit was already processed." });
  
  const user = await User.findOne({ username: d.username });
  if (!user) return res.status(404).json({ message: "User not found." });

  d.status = "approved";
  await d.save();

  user.balance = Number(user.balance || 0) + Number(d.amount);
  await user.save();

  res.json({ message: "Deposit approved and demo balance credited.", deposit: d, user: publicUser(user) });
});

app.post("/api/admin/deposits/:id/reject", auth, adminOnly, async (req, res) => {
  const d = await Deposit.findOne({ id: req.params.id });
  if (!d) return res.status(404).json({ message: "Deposit not found." });
  if (d.status !== "pending") return res.status(400).json({ message: "This deposit was already processed." });
  
  d.status = "rejected";
  await d.save();

  res.json({ message: "Deposit request rejected.", deposit: d });
});

app.post("/api/trades/close", auth, async (req, res) => {
  if (req.user.role !== "user") {
    return res.status(403).json({ message: "Users only." });
  }

  const { side } = req.body;
  const entry = Number(req.body.entry);
  const exit = Number(req.body.exit);

  if (!["buy", "sell"].includes(side) || !Number.isFinite(entry) || !Number.isFinite(exit)) {
    return res.status(400).json({ message: "Invalid trade data." });
  }

  const user = await User.findOne({ username: req.user.username });
  if (!user) return res.status(404).json({ message: "User not found." });

  const currentBalance = Number(user.balance || 0);
  const pnl = Number((currentBalance * 0.22).toFixed(2));

  user.balance = Number((currentBalance + pnl).toFixed(2));
  await user.save();

  await Trade.create({
    id: crypto.randomUUID(),
    username: user.username,
    side,
    entry,
    exit,
    pnl
  });

  res.json({ pnl, balance: user.balance });
});

app.get("/api/trades/mine", auth, async (req, res) => {
  const trades = await Trade.find({ username: req.user.username }).sort({ createdAt: -1 });
  res.json(trades);
});

app.listen(PORT, () => console.log(`BUXVO backend running at http://localhost:${PORT}`));