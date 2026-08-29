import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowDownToLine, ArrowUpToLine, BarChart3, Check, ChevronRight,
CircleDollarSign, Clock3, Copy, CreditCard, History, List,
LogIn, LogOut, Menu, ShieldCheck, TrendingDown, TrendingUp,
Upload, UserRound, Wallet, X, Zap
} from "lucide-react";
import "./styles.css";

const DEPOSIT_ADDRESS = "TMzfFr9MKSiXDd37YnGEogAN97qVxsbSC9";
const ADMIN_USER = "admin";
const ADMIN_PASS = "buxvo123";

const API = import.meta.env.VITE_API_URL || "https://asset-primes2.onrender.com/api";
const CHART_STORAGE_KEY = "ASSET PRIMES_chart_candles_v3";
const CANDLE_DURATION_MS = 60000;

async function api(path, options = {}) {
  const token = localStorage.getItem("ASSET PRIMES_token");
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Something went wrong.");
  return data;
}

function createInitialCandles() {
  const candles = [];
  let price = 100;

  for (let i = 0; i < 200; i++) {
    const open = price;

    const movement =
      (Math.random() - 0.5) * 3;

    const close = open + movement;

    const high =
      Math.max(open, close) +
      Math.random() * 1.5;

    const low =
      Math.min(open, close) -
      Math.random() * 1.5;

    candles.push({
      open,
      close,
      high,
      low,
      time: Date.now() - (200 - i) * 10000
    });

    price = close;
  }

  return candles;
}

function loadSavedCandles() {
  try {
    const saved = JSON.parse(localStorage.getItem(CHART_STORAGE_KEY) || "[]");

    if (
      Array.isArray(saved) &&
      saved.length > 0 &&
      saved.every(c =>
        Number.isFinite(Number(c.open)) &&
        Number.isFinite(Number(c.close)) &&
        Number.isFinite(Number(c.high)) &&
        Number.isFinite(Number(c.low)) &&
        Number.isFinite(Number(c.time))
      )
    ) {
      return saved.slice(-500).map(c => ({
        open: Number(c.open),
        close: Number(c.close),
        high: Number(c.high),
        low: Number(c.low),
        time: Number(c.time)
      }));
    }
  } catch (e) {}

  return createInitialCandles();
}

async function loadBitcoinCandles() {
  const response = await fetch(
    "https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=500"
  );

  const data = await response.json();

  return data.map(c => ({
    time: Number(c[0]),
    open: Number(c[1]),
    high: Number(c[2]),
    low: Number(c[3]),
    close: Number(c[4])
  }));
}

const CRYPTO_LIST = [
  {
    id: "BTC",
    name: "Bitcoin",
    symbol: "BTCUSDT",
    icon: "₿",
    color: "#f7931a"
  },
  {
    id: "ETH",
    name: "Ethereum",
    symbol: "ETHUSDT",
    icon: "♦",
    color: "#627eea"
  },
  {
    id: "BNB",
    name: "BNB",
    symbol: "BNBUSDT",
    icon: "◆",
    color: "#f3ba2f"
  },
  {
    id: "SOL",
    name: "Solana",
    symbol: "SOLUSDT",
    icon: "≋",
    color: "#9945ff"
  },
  {
    id: "XRP",
    name: "XRP",
    symbol: "XRPUSDT",
    icon: "✕",
    color: "#ffffff"
  }
];

function App() {
  const [view, setView] = useState("dashboard");
  const [auth, setAuth] = useState(() => JSON.parse(localStorage.getItem("ASSET PRIMES_auth") || "null"));
  const [users, setUsers] = useState([]);
  const [deposits, setDeposits] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [myDeposits, setMyDeposits] = useState([]);
  const [myWithdrawals, setMyWithdrawals] = useState([]);
  const [myTrades, setMyTrades] = useState([]);
  const [balance, setBalance] = useState(() => Number(localStorage.getItem("ASSET PRIMES_balance") || 0));
  const [profile, setProfile] = useState({ username: "", phone: "",address: "", email: ""});
  const [openTrade, setOpenTrade] = useState(null);
  const [notice, setNotice] = useState("");
  const [authMode, setAuthMode] = useState("login");
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => localStorage.setItem("ASSET PRIMES_auth", JSON.stringify(auth)), [auth]);
  useEffect(() => localStorage.setItem("ASSET PRIMES_balance", String(balance)), [balance]);

  useEffect(() => {
    if (!localStorage.getItem("ASSET PRIMES_token")) return;
    api("/auth/me").then(user => {
      setAuth(user);
      setBalance(Number(user.balance || 0));
      if (user.role === "admin") {
        Promise.all([api("/admin/users"), api("/admin/deposits"), api("/admin/withdrawals")]).then(([u,d,w]) => { setUsers(u); setDeposits(d); setWithdrawals(w); });
      }
    }).catch(() => { localStorage.removeItem("ASSET PRIMES_token"); localStorage.removeItem("ASSET PRIMES_auth"); setAuth(null); });
  }, []);

const currentUser = auth?.role === "user" ? auth.username : null;

const refreshMyBalance = async () => {
  if (!auth || auth.role !== "user") return;

  try {
    const user = await api("/auth/me");

    setAuth(user);
    setBalance(Number(user.balance || 0));

    localStorage.setItem(
      "ASSET PRIMES_balance",
      String(Number(user.balance || 0))
    );
  } catch (e) {
    console.log("Balance refresh error:", e.message);
  }
};

const loadMyHistory = async () => {
  try {
    const [d, w, t] = await Promise.all([
      api("/deposits/mine"),
      api("/withdrawals/mine"),
      api("/trades/mine")
    ]);

    setMyDeposits(Array.isArray(d) ? d : []);
    setMyWithdrawals(Array.isArray(w) ? w : []);
    setMyTrades(Array.isArray(t) ? t : []);
  } catch (e) {
    console.error("History loading error:", e);
    setNotice(`History error: ${e.message}`);
  }
};

useEffect(() => {
  if (!auth || auth.role !== "user") return;

  refreshMyBalance();
  loadMyHistory();

  const interval = setInterval(() => {
    refreshMyBalance();
    loadMyHistory();
  }, 3000);

  return () => clearInterval(interval);
}, [auth]);


  const login = async (username, password) => {
    try {
      const data = await api("/auth/login", { method:"POST", body:JSON.stringify({ username, password }) });
      localStorage.setItem("ASSET PRIMES_token", data.token);
    setAuth(data.user);
      setBalance(Number(data.user.balance || 0));
      setView(data.user.role === "admin" ? "admin" : "dashboard");
      if (data.user.role === "user") {
          loadMyHistory(data.user.username);}
      setView(data.user.role === "admin" ? "admin" : "dashboard");
      if (data.user.role === "admin") {
        const [u,d,w] = await Promise.all([api("/admin/users"), api("/admin/deposits"), api("/admin/withdrawals")]);
        setUsers(u); setDeposits(d); setWithdrawals(w);
      }
      setNotice(data.user.role === "admin" ? "Admin panel unlocked." : "Welcome back.");
      return true;
    } catch (e) { setNotice(e.message); return false; }
  };

  const register = async (username, password) => {
    try {
      await api("/auth/register", { method:"POST", body:JSON.stringify({ username, password }) });
      setNotice("Registration complete. Now login.");
      setAuthMode("login");
    } catch (e) { setNotice(e.message); }
  };

  const logout = () => {
    localStorage.removeItem("ASSET PRIMES_token");
    localStorage.removeItem("ASSET PRIMES_auth");
    setAuth(null);
    setView("dashboard");
    setOpenTrade(null);
    setMobileOpen(false);
    setNotice("Logged out.");
  };

  const requireLogin = (nextView) => {
    if (!auth) {
      setAuthMode("login");
      setView("auth");
      setNotice("Please login or register to access this function.");
      return;
    }
    setView(nextView);
    setMobileOpen(false);
  };

  const submitDeposit = async (amount, fileName) => {
    if (!auth || auth.role !== "user") return;
    try {
      await api("/deposits", { method:"POST", body:JSON.stringify({ amount:Number(amount), proof:fileName || "No file selected" }) });
      await loadMyHistory();
      setNotice("Deposit request submitted. It will remain pending until admin approval.");
      setView("dashboard");
    } catch (e) { setNotice(e.message); }
  };

  const refreshAdmin = async () => {
    const [u,d,w] = await Promise.all([api("/admin/users"), api("/admin/deposits"), api("/admin/withdrawals")]);
    setUsers(u); setDeposits(d); setWithdrawals(w);
  };

  const approveDeposit = async (id) => {
    try {
      const data = await api(`/admin/deposits/${id}/approve`, { method:"POST" });
      await refreshAdmin();
      if (currentUser === data.user.username) setBalance(data.user.balance);
      setNotice(data.message);
    } catch (e) { setNotice(e.message); }
  };

  const rejectDeposit = async (id) => {
    try {
      const data = await api(`/admin/deposits/${id}/reject`, { method:"POST" });
      await refreshAdmin();
      setNotice(data.message);
    } catch (e) { setNotice(e.message); }
  };


  const submitWithdrawal = async (amount, method, account) => {
    if (!auth || auth.role !== "user") return;
    try {
      await api("/withdrawals", { method:"POST", body:JSON.stringify({ amount:Number(amount), method, account }) });
      await loadMyHistory();
      setNotice("Withdrawal request submitted. It will remain pending until admin approval.");
      setView("dashboard");
    } catch (e) { setNotice(e.message); }
  };

  const approveWithdrawal = async (id) => {
    try {
      const data = await api(`/admin/withdrawals/${id}/approve`, { method:"POST" });
      await refreshAdmin();
      setNotice(data.message);
      if (currentUser === data.user.username) setBalance(Number(data.user.balance));
    } catch (e) { setNotice(e.message); }
  };

  const rejectWithdrawal = async (id) => {
    try {
      const data = await api(`/admin/withdrawals/${id}/reject`, { method:"POST" });
      await refreshAdmin();
      setNotice(data.message);
    } catch (e) { setNotice(e.message); }
  };


  const startTrade = (side) => {
  if (!auth || auth.role !== "user") return requireLogin("trading");

  if (openTrade) {
    return setNotice("Close the current trade before opening another.");
  }

  if (balance <= 0) {
    return setNotice("Balance is 0. Add a deposit first.");
  }

  const entry = livePrice;

  setOpenTrade({
    side,
    entry,
    started: Date.now(),
    amount: balance
  });

  setNotice(`${side.toUpperCase()} Trade opened at ${entry.toFixed(2)}.`);
};

const closeTrade = async (finalPnl = null) => {
  if (!openTrade) return;

  try {
    const data = await api("/trades/close", {
      method: "POST",
      body: JSON.stringify({
        side: openTrade.side,
        entry: openTrade.entry,
        exit: livePrice,
        demoPnl: finalPnl
      })
    });

    setBalance(Number(data.balance));
    setOpenTrade(null);

    setNotice(
      `Trade closed. +$${Number(data.pnl).toFixed(2)} profit added to your balance.`
    );
  } catch (e) {
    setNotice(e.message);
  }
};

const [selectedCrypto, setSelectedCrypto] = useState(CRYPTO_LIST[0]);

const [candles, setCandles] = useState([]);

const [livePrice, setLivePrice] = useState(0);

const [priceStats, setPriceStats] = useState({
  high: 0,
  low: 0,
  volume: 0,
  change: 0
});

const [tick, setTick] = useState(0);

useEffect(() => {
  const fetchMarketData = async () => {
    try {
      const symbol = selectedCrypto.symbol;

      const candleResponse = await fetch(
        `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1m&limit=200`
      );

      const candleData = await candleResponse.json();

      if (Array.isArray(candleData)) {
        const formattedCandles = candleData.map(c => ({
          time: Number(c[0]),
          open: Number(c[1]),
          high: Number(c[2]),
          low: Number(c[3]),
          close: Number(c[4]),
          volume: Number(c[5])
        }));

        setCandles(formattedCandles);

        const last =
          formattedCandles[formattedCandles.length - 1];

        if (last) {
          setLivePrice(last.close);
        }
      }

      const tickerResponse = await fetch(
        `https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`
      );

      const ticker = await tickerResponse.json();

      setLivePrice(Number(ticker.lastPrice));

      setPriceStats({
        high: Number(ticker.highPrice),
        low: Number(ticker.lowPrice),
        volume: Number(ticker.volume),
        change: Number(ticker.priceChangePercent)
      });

      setTick(t => t + 1);

    } catch (error) {
      console.log("Market data error:", error);
    }
  };

  fetchMarketData();

  const interval = setInterval(fetchMarketData, 5000);

  return () => clearInterval(interval);

}, [selectedCrypto]);


 const currentCandleTime =
  candles[candles.length - 1]?.time || Date.now();

const secondsLeft = Math.max(
  0,
  Math.ceil(
    (60000 - (Date.now() - currentCandleTime)) / 1000
  )
);

const tradePnl = useMemo(() => {
  if (!openTrade) return 0;

  const elapsed = Date.now() - openTrade.started;
  const progress = Math.min(elapsed / 60000, 1);

  // 22% of the account balance at the time trade was opened
  const targetProfit = Number(
    (openTrade.amount * 0.22).toFixed(2)
  );

  // Smooth movement towards target profit
  const fluctuation =
    Math.sin(elapsed / 1800) * (targetProfit * 0.08) +
    Math.sin(elapsed / 4200) * (targetProfit * 0.05);

  const trend = progress * targetProfit;

  if (elapsed < 1000) {
    return 0;
  }

  if (progress >= 1) {
    return targetProfit;
  }

  return Number(
    (trend + fluctuation).toFixed(2)
  );
}, [openTrade, tick]);

const closingTrade = useRef(false);

useEffect(() => {
  if (!openTrade || closingTrade.current) return;

  const elapsed = Date.now() - openTrade.started;

const targetProfit = Number(
  (openTrade.amount * 0.22).toFixed(2)
);

if (
  tradePnl >= targetProfit ||
  elapsed >= 60000
) {
  closingTrade.current = true;

  closeTrade(targetProfit).finally(() => {
    closingTrade.current = false;
  });
}

}, [tick, openTrade, tradePnl]);

  return (
    <div className="app-shell" onMouseMove={(e) => { document.documentElement.style.setProperty("--mx", `${e.clientX}px`); document.documentElement.style.setProperty("--my", `${e.clientY}px`); }}>
      <header className="topbar">
        <div className="brand" onClick={() => setView("dashboard")}>
          <div className="brand-mark"><Zap size={18} /></div>
          <span>ASSET PRIMES</span>
        </div>
        <div className="top-actions">
          <div className="balance-chip"><Wallet size={16} /> ${auth?.role === "user" ? balance.toFixed(2) : "0.00"}</div>
          {auth ? (
            <button className="ghost-btn" onClick={logout}><LogOut size={17} /> Logout</button>
          ) : (
            <button className="primary-btn compact" onClick={() => { setAuthMode("login"); setView("auth"); }}><UserRound size={17} /> Login</button>
          )}
          <button className="mobile-menu" onClick={() => setMobileOpen(v => !v)}><Menu /></button>
        </div>
      </header>

      <div className={`layout ${mobileOpen ? "mobile-open" : ""}`}>
        <aside className="sidebar">
          <div className="nav-label">Workspace</div>
          <NavButton icon={<Wallet />} text="Dashboard" active={view === "dashboard"} onClick={() => { setView("dashboard"); setMobileOpen(false); }} />
          <NavButton icon={<ArrowDownToLine />} text="Deposit" onClick={() => requireLogin("deposit")} />
          <NavButton icon={<ArrowUpToLine />} text="Withdraw" onClick={() => { requireLogin("withdraw"); }} />
          <NavButton icon={<BarChart3 />} text="Trading" onClick={() => requireLogin("trading")} />
          <NavButton icon={<History />} text="Deposit History" active={view === "deposit-history"} onClick={() => { loadMyHistory(); requireLogin("deposit-history")}}/>
          <NavButton icon={<History />} text="Withdraw History" active={view === "withdraw-history"} onClick={() => { loadMyHistory(); requireLogin("withdraw-history")}}/>
          <NavButton icon={<List />} text="Trade History" active={view === "trade-history"} onClick={() => { loadMyHistory(); requireLogin("trade-history")}} />
          {auth?.role === "admin" && <>
            <div className="nav-label admin-label">Restricted</div>
            <NavButton icon={<ShieldCheck />} text="Admin Panel" active={view === "admin"} onClick={() => setView("admin")} />
          </>}
          
        </aside>

        <main className="main">
          {notice && <div className="notice"><Check size={17} />{notice}<button onClick={() => setNotice("")}><X size={16} /></button></div>}
          {view === "dashboard" && <Dashboard auth={auth} balance={balance} onDeposit={() => requireLogin("deposit")} onWithdraw={() => requireLogin("withdraw")} onTrading={() => requireLogin("trading")} />}
          {view === "auth" && <AuthPanel mode={authMode} setMode={setAuthMode} onLogin={login} onRegister={register} />}
          {view === "deposit" && <DepositPanel onSubmit={submitDeposit} />}
          {view === "withdraw" && <WithdrawPanel balance={balance} onSubmit={submitWithdrawal} />}
          {view === "deposit-history" && (<DepositHistory deposits={myDeposits} />)}
          {view === "withdraw-history" && (<WithdrawHistory withdrawals={myWithdrawals} />)}
          {view === "trade-history" && (<TradeHistory trades={myTrades} />)}
          {view === "trading" && (<TradingPanel candles={candles} livePrice={livePrice} secondsLeft={secondsLeft} openTrade={openTrade} tradePnl={tradePnl} onBuy={() => startTrade("buy")} onSell={() => startTrade("sell")} onClose={closeTrade} selectedCrypto={selectedCrypto} setSelectedCrypto={setSelectedCrypto} priceStats={priceStats} />)}
          {view === "admin" && auth?.role === "admin" && <AdminPanel users={users} deposits={deposits} withdrawals={withdrawals} onApprove={approveDeposit} onReject={rejectDeposit} onApproveWithdrawal={approveWithdrawal} onRejectWithdrawal={rejectWithdrawal} />}
        </main>
      </div>
    </div>
  );
}

function NavButton({ icon, text, active, onClick }) {
  return <button className={`nav-btn ${active ? "active" : ""}`} onClick={onClick}>{icon}<span>{text}</span><ChevronRight className="nav-arrow" size={15} /></button>;
}

function Dashboard({ auth, balance, onDeposit, onWithdraw, onTrading }) {
  return (
    <section>
      <div className="hero">
        <div>
          <div className="eyebrow">ASSET PRIMES / USER DASHBOARD</div>
          <h1>Trade the move.<br /><span>Own the moment.</span></h1>
          <p>Market simulation with a live-moving candle chart. Login to unlock trading and account actions.</p>
        </div>
        <div className="hero-orb"><BarChart3 size={74} strokeWidth={1.2} /></div>
      </div>

      <div className="stats-grid">
        <Stat title="Available Balance" value={`$${auth?.role === "user" ? balance.toFixed(2) : "0.00"}`} icon={<Wallet />} />
        <Stat title="Account Status" value={auth ? "Active" : "Guest"} icon={<ShieldCheck />} />
        <Stat title="Market" value="Live" icon={<TrendingUp />} />
      </div>

      <div className="action-grid">
        <ActionCard icon={<ArrowDownToLine />} title="Deposit" desc="Submit a deposit." onClick={onDeposit} />
        <ActionCard icon={<ArrowUpToLine />} title="Withdraw" desc="Submit a withdrawal request." onClick={onWithdraw} />
        <ActionCard icon={<BarChart3 />} title="Open Trading" desc="Watch the candles move and place trades." onClick={onTrading} />
      </div>

      <div className="security-strip"><ShieldCheck size={19} /><div><strong>Trading Tip</strong><span>Analyze the overall market trend before entering the trade.</span></div></div>
    </section>
  );
}

function Stat({ title, value, icon }) {
  return <div className="stat-card"><div className="stat-icon">{icon}</div><div><span>{title}</span><strong>{value}</strong></div></div>;
}

function ActionCard({ icon, title, desc, onClick }) {
  return <button className="action-card" onClick={onClick}><div className="action-icon">{icon}</div><div><strong>{title}</strong><p>{desc}</p></div><ChevronRight className="card-arrow" /></button>;
}

function AuthPanel({ mode, setMode, onLogin, onRegister }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const submit = e => {
    e.preventDefault();
    mode === "login" ? onLogin(username.trim(), password) : onRegister(username.trim(), password);
  };
  return <section className="center-page"><div className="auth-card">
    <div className="auth-head"><div className="brand-mark large"><Zap size={22} /></div><h2>{mode === "login" ? "Welcome back" : "Create account"}</h2><p>{mode === "login" ? "Login to access your ASSET PRIMES account." : "Start with low balance."}</p></div>
    <form onSubmit={submit}>
      <label>Username<input value={username} onChange={e => setUsername(e.target.value)} placeholder="Enter username" /></label>
      <label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter password" /></label>
      <button className="primary-btn full">{mode === "login" ? <><LogIn size={17}/> Login</> : "Register"}</button>
    </form>
    <button className="switch-btn" onClick={() => setMode(mode === "login" ? "register" : "login")}>{mode === "login" ? "Don't have an account? Register" : "Already registered? Login"}</button>
    <small className="admin-hint"></small>
  </div></section>;
}

function DepositPanel({ onSubmit }) {
  const [amount, setAmount] = useState("");
  const [file, setFile] = useState("");
  return <section>
    <div className="section-head"><div><div className="eyebrow">ACCOUNT / Deposit</div><h2>Fund your balance</h2><p>Add funds securely to your trading account and get ready to explore the market.</p></div></div>
    <div className="deposit-layout">
      <div className="deposit-card">
        <img src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${DEPOSIT_ADDRESS}`} alt="USDT TRC20 QR Code" className="w-full max-w-[200px] mx-auto rounded-lg"/>
        <div className="chain-badge">USDT · TRC20</div>
        <div className="address-box"><span>Deposit address</span><strong>{DEPOSIT_ADDRESS}</strong><button onClick={() => navigator.clipboard?.writeText(DEPOSIT_ADDRESS)}><Copy size={15}/></button></div>
      </div>
      <form className="deposit-form" onSubmit={e => { e.preventDefault(); onSubmit(amount, file); }}>
        <label>Amount (USDT)<input type="number" min="1" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" required /></label>
        <label>Payment proof<input type="file" accept="image/*" onChange={e => setFile(e.target.files?.[0]?.name || "")} required /></label>
        <div className="upload-box"><Upload size={21}/><strong>{file || "Upload payment screenshot"}</strong><span>PNG, JPG or WEBP</span></div>
        <button className="primary-btn full" type="submit"><CreditCard size={17}/> Confirm Deposit</button>
        <small></small>
      </form>
    </div>
  </section>;
}

function WithdrawPanel({ balance, onSubmit }) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("USDT TRC20");
  const [account, setAccount] = useState("");
  const max = Number(balance || 0);
  return <section className="center-page"><div className="simple-card withdraw-card">
    <div className="action-icon"><ArrowUpToLine /></div><h2>Withdraw</h2><p>Available balance: <strong>${max.toFixed(2)}</strong></p>
    <form className="withdraw-form" onSubmit={e => { e.preventDefault(); onSubmit(amount, method, account); }}>
      <label>Amount (USDT)<input type="number" min="1" max={max} step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" required /></label>
      <label>Withdrawal method<select value={method} onChange={e => setMethod(e.target.value)}><option>USDT TRC20</option><option>USDT ERC20</option><option>Bank Transfer</option></select></label>
      <label>Wallet / Account details<input value={account} onChange={e => setAccount(e.target.value)} placeholder="Enter wallet address or account number" required /></label>
      <button className="primary-btn full" type="submit" disabled={max <= 0}><ArrowUpToLine size={17}/> Submit Withdrawal</button>
      <small></small>
    </form>
  </div></section>;
}

function TradingPanel({
  candles,
  livePrice,
  secondsLeft,
  openTrade,
  tradePnl,
  onBuy,
  onSell,
  onClose,
  selectedCrypto,
  setSelectedCrypto,
  priceStats
}) {

  const timerText =
    `00:${String(secondsLeft).padStart(2, "0")}`;

  return (
    <section className="crypto-trading-page">

      {/* TOP MARKET INFORMATION */}

      <div className="crypto-market-header">

        <div className="crypto-selected-name">

          <div
            className="crypto-main-icon"
            style={{
              background: selectedCrypto.color
            }}
          >
            {selectedCrypto.icon}
          </div>

          <div>
            <strong>{selectedCrypto.name}</strong>

            <span>
              {selectedCrypto.id} / USDT
            </span>
          </div>

        </div>


        <div className="market-stat">

          <span>
            {selectedCrypto.id} / USDT
          </span>

          <strong>
            ${Number(livePrice).toFixed(2)}
          </strong>

          <small
            className={
              priceStats.change >= 0
                ? "profit"
                : "loss"
            }
          >
            {priceStats.change >= 0 ? "+" : ""}
            {priceStats.change.toFixed(2)}%
          </small>

        </div>


        <div className="market-stat">

          <span>24h High</span>

          <strong>
            ${Number(priceStats.high).toFixed(2)}
          </strong>

        </div>


        <div className="market-stat">

          <span>24h Low</span>

          <strong>
            ${Number(priceStats.low).toFixed(2)}
          </strong>

        </div>


        <div className="market-stat">

          <span>24h Volume</span>

          <strong>
            {Number(priceStats.volume).toFixed(2)}
          </strong>

        </div>


        <div className="live-badge">

          ● LIVE

        </div>

      </div>



      {/* MAIN CHART AREA */}

      <div className="crypto-chart-layout">


        {/* LEFT CRYPTO MENU */}

        <div className="crypto-selector">

          {CRYPTO_LIST.map(crypto => (

            <button
              key={crypto.id}

              className={`crypto-item ${
                selectedCrypto.id === crypto.id
                  ? "selected"
                  : ""
              }`}

              onClick={() =>
                setSelectedCrypto(crypto)
              }
            >

              <div
                className="crypto-small-icon"
                style={{
                  background: crypto.color
                }}
              >
                {crypto.icon}
              </div>


              <div className="crypto-item-text">

                <strong>
                  {crypto.name}
                </strong>

                <span>
                  {crypto.id} / USDT
                </span>

              </div>

            </button>

          ))}

        </div>



        {/* CHART */}

        <div className="crypto-chart-container">

          <div className="chart-top-info">

            <span className="timeframe">
              1m
            </span>


            <span className="countdown">

              Next candle: {timerText}

            </span>


            <span className="drag-text">

              Drag chart to view history

            </span>

          </div>


          <CandleChart
            candles={candles}
            livePrice={livePrice}
          />

        </div>

      </div>



      {/* TRADE PANEL */}

      <div className="trade-panel">

        <div>

          <span className="trade-label">

            POSITION

          </span>


          {openTrade ? (

            <div className="open-position">

              <b
                className={openTrade.side}
              >

                {openTrade.side.toUpperCase()}

              </b>


              <span>

                Entry $
                {openTrade.entry.toFixed(2)}

              </span>


              <strong
                className={
                  tradePnl >= 0
                    ? "profit"
                    : "loss"
                }
              >

                {tradePnl >= 0 ? "+" : ""}

                ${tradePnl.toFixed(2)}

              </strong>

            </div>

          ) : (

            <div className="no-position">

              No open trade

            </div>

          )}

        </div>



        <div className="trade-actions">

          <button
            className="buy-btn"
            onClick={onBuy}
            disabled={!!openTrade}
          >

            <TrendingUp size={18} />

            BUY

          </button>


          <button
            className="sell-btn"
            onClick={onSell}
            disabled={!!openTrade}
          >

            <TrendingDown size={18} />

            SELL

          </button>


          {openTrade && (

            <button
              className="close-btn"
              onClick={onClose}
            >

              Close Trade

            </button>

          )}

        </div>

      </div>

    </section>
  );
}

function WithdrawHistory({ withdrawals }) {
  return (
    <section>
      <div className="section-head">
        <div>
          <div className="eyebrow">ACCOUNT / HISTORY</div>
          <h2>Withdraw History</h2>
          <p>Your previous withdrawal requests.</p>
        </div>
      </div>

      <div className="admin-card">
        {withdrawals.length === 0 ? (
          <div className="empty">No withdrawal history yet.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Wallet / Account</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {withdrawals.map(w => (
                  <tr key={w.id}>
                    <td>
                      {new Date(w.createdAt).toLocaleString()}
                    </td>

                    <td>
                      ${Number(w.amount).toFixed(2)}
                    </td>

                    <td>{w.method}</td>

                    <td>{w.account}</td>

                    <td>
                      <span className={`status ${w.status}`}>
                        {w.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

function TradeHistory({ trades }) {
  return (
    <section>
      <div className="section-head">
        <div>
          <div className="eyebrow">MARKET / HISTORY</div>
          <h2>Trade History</h2>
          <p>Your completed trades.</p>
        </div>
      </div>

      <div className="admin-card">
        {trades.length === 0 ? (
          <div className="empty">No completed trades yet.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Side</th>
                  <th>Entry</th>
                  <th>Exit</th>
                  <th>P/L</th>
                </tr>
              </thead>

              <tbody>
                {trades.map(t => (
                  <tr key={t.id}>
                    <td>
                      {new Date(t.createdAt).toLocaleString()}
                    </td>

                    <td>
                      {t.side.toUpperCase()}
                    </td>

                    <td>
                      ${Number(t.entry).toFixed(2)}
                    </td>

                    <td>
                      ${Number(t.exit).toFixed(2)}
                    </td>

                    <td className={Number(t.pnl) >= 0 ? "profit" : "loss"}>
                      {Number(t.pnl) >= 0 ? "+" : ""}
                      ${Number(t.pnl).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

function CandleChart({
  candles,
  livePrice
}) {

  const scrollRef = useRef(null);

  const [zoom, setZoom] = useState(8);
const [verticalZoom, setVerticalZoom] = useState(1);

  const [followingLive, setFollowingLive] =
    useState(true);

  const dragRef = useRef({
    active: false,
    startX: 0,
    startScrollLeft: 0
  });


  const height = 430;

  const candleWidth = zoom;

  const candleGap =
    Math.max(3, zoom * 0.5);

  const padX = 45;

  const padY = 30;


  const chartCandles =
    candles.slice(-500);


  if (!chartCandles.length) {

    return (
      <div className="chart-loading">

        Loading live chart...

      </div>
    );

  }


  const totalWidth =
    chartCandles.length *
    (candleWidth + candleGap) +
    100;


  const allPrices =
    chartCandles.flatMap(c => [
      c.high,
      c.low
    ]);


  const rawMin =
    Math.min(...allPrices);

  const rawMax =
    Math.max(...allPrices);


  const extraSpace =
    Math.max(
      (rawMax - rawMin) * 0.12,
      1
    );


  const min =
    rawMin - extraSpace;

  const max =
    rawMax + extraSpace;


  
const scaleY = value => {
  const normalY =
    height -
    padY -
    (
      (value - min) /
      (max - min || 1)
    ) *
    (height - padY * 2);

  const chartCenter = height / 2;

  return (
    chartCenter +
    (normalY - chartCenter) * verticalZoom
  );
};


  const priceY =
    scaleY(livePrice);



  useEffect(() => {

    const el =
      scrollRef.current;

    if (
      !el ||
      !followingLive
    ) return;


    el.scrollLeft =
      el.scrollWidth -
      el.clientWidth;

  }, [
    chartCandles.length,
    livePrice,
    followingLive,
    zoom
  ]);



  const handleScroll = () => {

    const el =
      scrollRef.current;

    if (!el) return;


    const distanceFromRight =
      el.scrollWidth -
      el.clientWidth -
      el.scrollLeft;


    setFollowingLive(
      distanceFromRight < 40
    );

  };



  const handlePointerDown = e => {

    const el =
      scrollRef.current;

    if (!el) return;


    dragRef.current = {

      active: true,

      startX:
        e.clientX,

      startScrollLeft:
        el.scrollLeft

    };


    el.setPointerCapture?.(
      e.pointerId
    );

  };



  const handlePointerMove = e => {

    const el =
      scrollRef.current;

    const drag =
      dragRef.current;


    if (
      !el ||
      !drag.active
    ) return;


    const distance =
      e.clientX -
      drag.startX;


    el.scrollLeft =
      drag.startScrollLeft -
      distance;

  };



  const stopDrag = () => {

    dragRef.current.active =
      false;

  };



  const goLive = () => {

    const el =
      scrollRef.current;

    if (!el) return;


    setFollowingLive(true);


    el.scrollTo({

      left:
        el.scrollWidth -
        el.clientWidth,

      behavior:
        "smooth"

    });

  };



  return (

    <div className="chart-stage">


      {!followingLive && (

        <button
          className="go-live-btn"
          onClick={goLive}
        >

          ● LIVE

        </button>

      )}


      <div
        ref={scrollRef}
        className="chart-scroll"
        onScroll={handleScroll}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopDrag}
        onPointerCancel={stopDrag}
      >


        <svg
          width={totalWidth}
          height={height}
          viewBox={`0 0 ${totalWidth} ${height}`}
        >


          {[0,1,2,3,4,5].map(i => {

            const y =
              padY +
              i *
              (height - padY * 2) /
              5;


            return (

              <line
                key={`h-${i}`}
                x1="0"
                x2={totalWidth}
                y1={y}
                y2={y}
                className="gridline"
              />

            );

          })}



          {Array.from(
            {
              length:
                Math.ceil(
                  totalWidth / 170
                )
            },
            (_, i) => i
          ).map(i => {

            const x =
              i * 170;


            return (

              <line
                key={`v-${i}`}
                x1={x}
                x2={x}
                y1="0"
                y2={height}
                className="gridline"
              />

            );

          })}



          <line
            x1="0"
            x2={totalWidth}
            y1={priceY}
            y2={priceY}
            className="live-price-line"
          />



          {chartCandles.map((c, i) => {

            const x =
              padX +
              i *
              (
                candleWidth +
                candleGap
              );


            const openY =
              scaleY(c.open);

            const closeY =
              scaleY(c.close);

            const highY =
              scaleY(c.high);

            const lowY =
              scaleY(c.low);


            const isUp =
              c.close >= c.open;


            const bodyY =
              Math.min(
                openY,
                closeY
              );


            const bodyHeight =
              Math.max(
                2,
                Math.abs(
                  closeY -
                  openY
                )
              );


            return (

              <g
                key={`${c.time}-${i}`}
                className={
                  isUp
                    ? "candle-up"
                    : "candle-down"
                }
              >


                <line
                  x1={
                    x +
                    candleWidth / 2
                  }

                  x2={
                    x +
                    candleWidth / 2
                  }

                  y1={highY}
                  y2={lowY}

                  strokeWidth="1.4"
                />


                <rect
                  x={x}
                  y={bodyY}
                  width={candleWidth}
                  height={bodyHeight}
                  rx="1"
                />

              </g>

            );

          })}



          <g
            transform={`translate(
              ${totalWidth - 100},
              ${priceY - 12}
            )`}
          >

            <rect
              width="94"
              height="24"
              rx="5"
              className="live-price-tag"
            />


            <text
              x="47"
              y="16"
              textAnchor="middle"
              className="live-price-text"
            >

              {Number(
                livePrice
              ).toFixed(2)}

            </text>

          </g>

        </svg>

      </div>



      {/* ZOOM CONTROL */}

<div className="chart-zoom-control">

  <span>+</span>

  <input
    type="range"
    min="0.5"
    max="3"
    step="0.1"
    value={verticalZoom}
    onChange={e =>
      setVerticalZoom(
        Number(e.target.value)
      )
    }
    className="vertical-zoom-slider"
  />

  <span>−</span>

</div>

      <div className="zoom-labels">

        
      </div>


    </div>

  );
}

function DepositHistory({ deposits }) {
  return (
    <section>
      <div className="section-head">
        <div>
          <div className="eyebrow">ACCOUNT / HISTORY</div>
          <h2>Deposit History</h2>
          <p>Your previous Deposit requests.</p>
        </div>
      </div>

      <div className="admin-card">
        {deposits.length === 0 ? (
          <div className="empty">No deposit history yet.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Proof</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {deposits.map(d => (
                  <tr key={d.id}>
                    <td>
                      {new Date(d.createdAt).toLocaleString()}
                    </td>

                    <td>
                      ${Number(d.amount).toFixed(2)}
                    </td>

                    <td>{d.proof}</td>

                    <td>
                      <span className={`status ${d.status}`}>
                        {d.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

function AdminPanel({ users, deposits, withdrawals, onApprove, onReject, onApproveWithdrawal, onRejectWithdrawal }) {
  const pending = deposits.filter(d => d.status === "pending");
  const pendingWithdrawals = withdrawals.filter(w => w.status === "pending");
  return <section>
    <div className="section-head"><div><div className="eyebrow">RESTRICTED / ADMIN</div><h2>Operations Panel</h2><p>Only visible after signing in with the admin credentials.</p></div><div className="admin-pill"><ShieldCheck size={16}/> ADMIN</div></div>
    <div className="stats-grid admin-stats"><Stat title="Registered Users" value={users.length} icon={<UserRound/>}/><Stat title="Pending Deposits" value={pending.length} icon={<Clock3/>}/><Stat title="Pending Withdrawals" value={pendingWithdrawals.length} icon={<ArrowUpToLine/>}/><Stat title="Approved Volume" value={`$${deposits.filter(d=>d.status==="approved").reduce((a,d)=>a+Number(d.amount||0),0).toFixed(2)}`} icon={<CircleDollarSign/>}/></div>
    <div className="admin-card"><div className="table-head"><h3>Deposit Requests</h3><span>{pending.length} pending</span></div>
      {deposits.length === 0 ? <div className="empty">No deposit requests yet.</div> : <div className="table-wrap"><table><thead><tr><th>User</th><th>Amount</th><th>Proof</th><th>Status</th><th>Action</th></tr></thead><tbody>{deposits.map(d=><tr key={d.id}><td>{d.username}</td><td>${Number(d.amount).toFixed(2)}</td><td>{d.proof}</td><td><span className={`status ${d.status}`}>{d.status}</span></td><td>{d.status==="pending" ? <div className="row-actions"><button className="approve" onClick={()=>onApprove(d.id)}><Check size={15}/>Approve</button><button className="reject" onClick={()=>onReject(d.id)}><X size={15}/>Reject</button></div> : "—"}</td></tr>)}</tbody></table></div>}
    </div>
    <div className="admin-card"><div className="table-head"><h3>Withdrawal Requests</h3><span>{pendingWithdrawals.length} pending</span></div>
      {withdrawals.length === 0 ? <div className="empty">No withdrawal requests yet.</div> : <div className="table-wrap"><table><thead><tr><th>User</th><th>Amount</th><th>Method</th><th>Account / Wallet</th><th>Status</th><th>Action</th></tr></thead><tbody>{withdrawals.map(w=><tr key={w.id}><td>{w.username}</td><td>${Number(w.amount).toFixed(2)}</td><td>{w.method}</td><td>{w.account}</td><td><span className={`status ${w.status}`}>{w.status}</span></td><td>{w.status==="pending" ? <div className="row-actions"><button className="approve" onClick={()=>onApproveWithdrawal(w.id)}><Check size={15}/>Approve</button><button className="reject" onClick={()=>onRejectWithdrawal(w.id)}><X size={15}/>Reject</button></div> : "—"}</td></tr>)}</tbody></table></div>}
    </div>
    <div className="admin-card"><div className="table-head"><h3>User Accounts</h3></div><div className="table-wrap"><table><thead><tr><th>Username</th><th>Balance</th><th>Created</th></tr></thead><tbody>{users.map(u=><tr key={u.username}><td>{u.username}</td><td>${Number(u.balance||0).toFixed(2)}</td><td>{new Date(u.createdAt).toLocaleDateString()}</td></tr>)}</tbody></table></div></div>
  </section>;
}

createRoot(document.getElementById("root")).render(<App />);
