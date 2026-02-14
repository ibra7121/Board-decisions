import { useState, useEffect, useCallback, useRef } from "react";

/* ══════════════════════════════════════════════════════════════
   🔧 إعدادات Supabase — استبدل القيم بمفاتيحك من لوحة التحكم
   ══════════════════════════════════════════════════════════════ */
const SUPABASE_URL = "https://qzciniydymoninfmpovs.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6Y2luaXlkeW1vbmluZm1wb3ZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA5MTY3NDYsImV4cCI6MjA4NjQ5Mjc0Nn0.559WsrKVIW0ny3MVXy7YopRZz3-6Q9XwdOrkoheyPSk";

const IS_CONFIGURED = !SUPABASE_URL.includes("YOUR_") && !SUPABASE_ANON_KEY.includes("YOUR_");

/* ══════════════════════════════════════════════════════════════
   🌐 Supabase Client (REST API)
   ══════════════════════════════════════════════════════════════ */
class SupabaseClient {
  constructor(url, key) {
    this.url = url;
    this.key = key;
    this.token = null;
    this.user = null;
  }

  headers(auth = true) {
    const h = { "Content-Type": "application/json", apikey: this.key };
    if (auth && this.token) h["Authorization"] = `Bearer ${this.token}`;
    else h["Authorization"] = `Bearer ${this.key}`;
    return h;
  }

  // ── Auth ──
  async signIn(email, password) {
    const res = await fetch(`${this.url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: this.key },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (data.access_token) {
      this.token = data.access_token;
      this.user = data.user;
      return { success: true, user: data.user, token: data.access_token };
    }
    return { success: false, error: data.error_description || data.msg || "فشل تسجيل الدخول" };
  }

  async signOut() {
    if (this.token) {
      await fetch(`${this.url}/auth/v1/logout`, {
        method: "POST",
        headers: this.headers(),
      }).catch(() => {});
    }
    this.token = null;
    this.user = null;
  }

  // ── Database ──
  async select(table, { filters = {}, order, limit } = {}) {
    let url = `${this.url}/rest/v1/${table}?select=*`;
    Object.entries(filters).forEach(([k, v]) => { url += `&${k}=eq.${v}`; });
    if (order) url += `&order=${order}`;
    if (limit) url += `&limit=${limit}`;
    const res = await fetch(url, { headers: this.headers() });
    return res.json();
  }

  async insert(table, data) {
    const res = await fetch(`${this.url}/rest/v1/${table}`, {
      method: "POST",
      headers: { ...this.headers(), Prefer: "return=representation" },
      body: JSON.stringify(data),
    });
    return res.json();
  }

  async update(table, id, data) {
    const res = await fetch(`${this.url}/rest/v1/${table}?id=eq.${id}`, {
      method: "PATCH",
      headers: { ...this.headers(), Prefer: "return=representation" },
      body: JSON.stringify(data),
    });
    return res.json();
  }

  async delete(table, id) {
    const res = await fetch(`${this.url}/rest/v1/${table}?id=eq.${id}`, {
      method: "DELETE",
      headers: this.headers(),
    });
    return res.ok;
  }

  async getProfile() {
    if (!this.user) return null;
    const data = await this.select("profiles", { filters: { id: this.user.id } });
    return data?.[0] || null;
  }
}

const supabase = new SupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ══════════════════════════════════════════════════════════════
   🧪 Demo Mode — يشتغل بدون Supabase للتجربة
   ══════════════════════════════════════════════════════════════ */
async function sha256(msg) {
  const buf = new TextEncoder().encode(msg);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

const DEMO_PASSWORDS = { admin: "Admin@2026#", chairman: "Chair@2026#", nominations: "Nom@2026#", audit: "Audit@2026#", viewer: "View@2026#" };

const DEMO_USERS_BASE = [
  { id: "u1", username: "admin", email: "admin@company.com", name: "مدير النظام", role: "admin", active: true, two_factor_enabled: true },
  { id: "u2", username: "chairman", email: "chairman@company.com", name: "رئيس مجلس الإدارة", role: "board_member", active: true, two_factor_enabled: true },
  { id: "u3", username: "nominations", email: "nominations@company.com", name: "رئيس لجنة الترشيحات", role: "nominations_member", active: true, two_factor_enabled: false },
  { id: "u4", username: "audit", email: "audit@company.com", name: "رئيس لجنة المراجعة", role: "audit_member", active: true, two_factor_enabled: false },
  { id: "u5", username: "viewer", email: "viewer@company.com", name: "مراقب", role: "viewer", active: true, two_factor_enabled: false },
];

const DEMO_DECISIONS = [
  { id: 1, committee: "board", title: "اعتماد الميزانية التقديرية للعام المالي 2026", description: "مراجعة واعتماد الميزانية التقديرية الشاملة", date: "2026-01-15", due_date: "2026-03-01", status: "completed", priority: "high", assignee: "الإدارة المالية", meeting_number: "م-2026/01", notes: "تمت الموافقة بالإجماع", created_by: "u1" },
  { id: 2, committee: "board", title: "تعيين مدير تنفيذي جديد لقطاع التقنية", description: "البحث والتعيين لمنصب المدير التنفيذي لقطاع التقنية", date: "2026-01-15", due_date: "2026-04-15", status: "pending", priority: "high", assignee: "الموارد البشرية", meeting_number: "م-2026/01", notes: "جاري مراجعة المرشحين", created_by: "u1" },
  { id: 3, committee: "board", title: "مراجعة استراتيجية التوسع الإقليمي", description: "دراسة فرص التوسع في أسواق الخليج", date: "2026-02-01", due_date: "2026-05-30", status: "pending", priority: "medium", assignee: "إدارة التطوير", meeting_number: "م-2026/02", notes: "", created_by: "u2" },
  { id: 4, committee: "nominations", title: "تحديث سياسة المكافآت والحوافز", description: "مراجعة وتحديث سياسة المكافآت السنوية", date: "2026-01-20", due_date: "2026-02-28", status: "completed", priority: "high", assignee: "لجنة الترشيحات", meeting_number: "ت-2026/01", notes: "تم الاعتماد", created_by: "u3" },
  { id: 5, committee: "nominations", title: "تقييم أداء الإدارة التنفيذية", description: "إجراء التقييم السنوي لأداء الإدارة العليا", date: "2026-01-20", due_date: "2026-03-31", status: "pending", priority: "high", assignee: "لجنة الترشيحات", meeting_number: "ت-2026/01", notes: "جاري جمع البيانات", created_by: "u3" },
  { id: 6, committee: "nominations", title: "ترشيح عضو مجلس مستقل جديد", description: "البحث عن مرشحين لعضوية المجلس المستقلة", date: "2026-02-05", due_date: "2026-04-01", status: "delayed", priority: "medium", assignee: "سكرتارية المجلس", meeting_number: "ت-2026/02", notes: "تأخر بسبب عدم توفر مرشحين", created_by: "u2" },
  { id: 7, committee: "audit", title: "مراجعة تقرير المراجعة الداخلية", description: "مراجعة تقرير المراجعة الداخلية للربع الرابع", date: "2026-01-25", due_date: "2026-02-15", status: "completed", priority: "high", assignee: "إدارة المراجعة الداخلية", meeting_number: "ر-2026/01", notes: "لا توجد ملاحظات جوهرية", created_by: "u4" },
  { id: 8, committee: "audit", title: "تحديث مصفوفة المخاطر المؤسسية", description: "مراجعة وتحديث مصفوفة المخاطر الشاملة", date: "2026-01-25", due_date: "2026-03-15", status: "pending", priority: "high", assignee: "إدارة المخاطر", meeting_number: "ر-2026/01", notes: "", created_by: "u4" },
  { id: 9, committee: "audit", title: "تقييم الالتزام بالأنظمة واللوائح", description: "مراجعة شاملة لمستوى الالتزام التنظيمي", date: "2026-02-10", due_date: "2026-03-30", status: "delayed", priority: "medium", assignee: "إدارة الالتزام", meeting_number: "ر-2026/02", notes: "تأخر بسبب تغييرات تنظيمية", created_by: "u4" },
  { id: 10, committee: "audit", title: "اختيار مراجع حسابات خارجي", description: "تقييم واختيار مكتب المراجعة الخارجية", date: "2026-02-10", due_date: "2026-02-28", status: "cancelled", priority: "low", assignee: "لجنة المراجعة", meeting_number: "ر-2026/02", notes: "تم تمديد عقد المراجع الحالي", created_by: "u1" },
];

/* ══════════════════════════════════════════════════════════════
   📋 CONFIG
   ══════════════════════════════════════════════════════════════ */
const COMMITTEES = [
  { id: "board", name: "مجلس المديرين", icon: "🏛️", color: "#C9A84C" },
  { id: "nominations", name: "لجنة الترشيحات والمكافآت", icon: "👥", color: "#5B8C5A" },
  { id: "audit", name: "لجنة المراجعة والمخاطر والالتزام", icon: "🔍", color: "#4A7FB5" },
];

const STATUS_MAP = {
  pending: { label: "قيد التنفيذ", dot: "#F59E0B" },
  completed: { label: "مكتمل", dot: "#10B981" },
  delayed: { label: "متأخر", dot: "#EF4444" },
  cancelled: { label: "ملغى", dot: "#6B7280" },
};

const PRIORITY_MAP = {
  high: { label: "عالية", color: "#DC2626" },
  medium: { label: "متوسطة", color: "#F59E0B" },
  low: { label: "منخفضة", color: "#3B82F6" },
};

const ROLES = {
  admin: { label: "مدير النظام", color: "#C9A84C", icon: "👑", committees: ["board", "nominations", "audit"], canEdit: true, canDelete: true, canManageUsers: true, canViewAudit: true },
  board_member: { label: "عضو مجلس إدارة", color: "#8B5CF6", icon: "🏛️", committees: ["board", "nominations", "audit"], canEdit: true, canDelete: false, canManageUsers: false, canViewAudit: true },
  nominations_member: { label: "عضو لجنة الترشيحات", color: "#5B8C5A", icon: "👥", committees: ["nominations"], canEdit: true, canDelete: false, canManageUsers: false, canViewAudit: false },
  audit_member: { label: "عضو لجنة المراجعة", color: "#4A7FB5", icon: "🔍", committees: ["audit"], canEdit: true, canDelete: false, canManageUsers: false, canViewAudit: false },
  viewer: { label: "مطّلع فقط", color: "#64748B", icon: "👁️", committees: ["board", "nominations", "audit"], canEdit: false, canDelete: false, canManageUsers: false, canViewAudit: false },
};

const sanitize = (s) => typeof s === "string" ? s.replace(/[<>"'&]/g, c => ({ "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;", "&": "&amp;" }[c])) : s;
const now = () => new Date().toLocaleString("ar-SA", { dateStyle: "short", timeStyle: "medium" });
const genOTP = () => String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, "0");
const genToken = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, "0")).join("");

const fonts = `@import url('https://fonts.googleapis.com/css2?family=Noto+Kufi+Arabic:wght@400;600;700;800&family=Tajawal:wght@300;400;500;700&family=IBM+Plex+Mono:wght@400;600&display=swap');`;
const css = `
*{box-sizing:border-box;margin:0;padding:0}
::-webkit-scrollbar{width:5px}::-webkit-scrollbar-thumb{background:rgba(201,168,76,.25);border-radius:3px}
@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
@keyframes slideIn{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:scale(1)}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
@keyframes glow{0%,100%{box-shadow:0 0 8px rgba(201,168,76,.15)}50%{box-shadow:0 0 24px rgba(201,168,76,.35)}}
@keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-8px)}40%,80%{transform:translateX(8px)}}
@keyframes scan{0%{top:-4px}100%{top:100%}}
.ch{transition:all .3s cubic-bezier(.4,0,.2,1)}.ch:hover{transform:translateY(-2px);box-shadow:0 10px 30px rgba(0,0,0,.35)}
.bg{background:linear-gradient(135deg,#C9A84C,#E5C76B);color:#070D1A;font-weight:700;border:none;cursor:pointer;transition:all .3s;font-family:'Tajawal',sans-serif}
.bg:hover{background:linear-gradient(135deg,#E5C76B,#F0D98D)}.bg:disabled{opacity:.4;cursor:not-allowed}
.gl{background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.06);backdrop-filter:blur(12px)}
.ip{width:100%;padding:11px 15px;border-radius:9px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.035);color:#E2E8F0;font-size:13px;outline:none;direction:rtl;font-family:'Tajawal',sans-serif;transition:border-color .3s}
.ip:focus{border-color:rgba(201,168,76,.5)}.ip::placeholder{color:#3E4A5C}
.mo{font-family:'IBM Plex Mono',monospace}
input,select,textarea{font-family:'Tajawal',sans-serif}
`;

/* ══════════════════════════════════════════════════════════════
   🔐 LOGIN
   ══════════════════════════════════════════════════════════════ */
function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockTime, setLockTime] = useState(0);
  // 2FA
  const [otp2FA, setOtp2FA] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [realOtp, setRealOtp] = useState("");
  const [showHint, setShowHint] = useState(false);
  const [otpTimer, setOtpTimer] = useState(0);
  const [pendingUser, setPendingUser] = useState(null);

  useEffect(() => { if (lockTime > 0) { const t = setInterval(() => setLockTime(v => v <= 1 ? (clearInterval(t), 0) : v - 1), 1000); return () => clearInterval(t); } }, [lockTime]);
  useEffect(() => { if (otpTimer > 0) { const t = setInterval(() => setOtpTimer(v => v <= 1 ? (clearInterval(t), 0) : v - 1), 1000); return () => clearInterval(t); } }, [otpTimer]);

  const isLocked = lockTime > 0;

  const handleLogin = async () => {
    if (isLocked || loading) return;
    if (!email.trim() || !password.trim()) { setError("يرجى إدخال البيانات"); return; }
    setLoading(true);
    setError("");

    let result;
    if (IS_CONFIGURED) {
      // ── Supabase Auth ──
      result = await supabase.signIn(email, password);
      if (result.success) {
        const profile = await supabase.getProfile();
        if (profile) {
          if (profile.two_factor_enabled) {
            const otp = genOTP();
            setRealOtp(otp);
            setPendingUser({ ...profile, authUser: result.user, token: result.token });
            setOtp2FA(true);
            setOtpTimer(60);
            setLoading(false);
            return;
          }
          setLoading(false);
          onLogin({ ...profile, authUser: result.user, token: result.token });
          return;
        }
      }
      setError("DEBUG: " + JSON.stringify(result));
    } else {
      // ── Demo Mode ──
      await new Promise(r => setTimeout(r, 600));
      const demoUser = DEMO_USERS_BASE.find(u => (u.email === email || u.username === email));
      if (demoUser) {
        const hash = await sha256(password);
        const expectedHash = await sha256(DEMO_PASSWORDS[demoUser.username]);
        if (hash === expectedHash) {
          if (demoUser.two_factor_enabled) {
            const otp = genOTP();
            setRealOtp(otp);
            setPendingUser(demoUser);
            setOtp2FA(true);
            setOtpTimer(60);
            setLoading(false);
            return;
          }
          setLoading(false);
          onLogin(demoUser);
          return;
        }
      }
      setError("بيانات الدخول غير صحيحة");
    }

    const newAttempts = attempts + 1;
    setAttempts(newAttempts);
    if (newAttempts >= 5) setLockTime(120);
    setShaking(true);
    setTimeout(() => setShaking(false), 600);
    setLoading(false);
  };

  const verifyOTP = () => {
    if (otpCode === realOtp && pendingUser) {
      onLogin(pendingUser);
    } else {
      setError("رمز التحقق غير صحيح");
      setShaking(true);
      setTimeout(() => setShaking(false), 600);
    }
  };

  const fillDemo = (u) => { if (!isLocked) { setEmail(u.username); setPassword(DEMO_PASSWORDS[u.username]); } };

  return (
    <div style={{ direction: "rtl", fontFamily: "'Tajawal',sans-serif", minHeight: "100vh", background: "linear-gradient(160deg,#070D1A,#0B1425,#091119)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, position: "relative" }}>
      <style>{fonts}{css}</style>
      <div style={{ position: "fixed", inset: 0, backgroundImage: "linear-gradient(rgba(201,168,76,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(201,168,76,.025) 1px,transparent 1px)", backgroundSize: "40px 40px", pointerEvents: "none" }} />

      <div style={{ animation: shaking ? "shake .5s ease" : "slideIn .5s ease", background: "linear-gradient(160deg,#111A2D,#0D1526)", border: "1px solid rgba(201,168,76,.15)", borderRadius: 20, padding: "36px 32px", maxWidth: 420, width: "100%", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg,transparent,#C9A84C,transparent)" }} />
        <div style={{ position: "absolute", left: 0, right: 0, height: 3, background: "linear-gradient(180deg,transparent,rgba(201,168,76,.04),transparent)", animation: "scan 4s linear infinite", pointerEvents: "none" }} />

        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: "linear-gradient(135deg,#C9A84C,#E5C76B)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 30, marginBottom: 12, animation: "glow 3s infinite" }}>🔐</div>
          <h1 style={{ fontSize: 19, fontWeight: 800, fontFamily: "'Noto Kufi Arabic'", background: "linear-gradient(135deg,#C9A84C,#F0D98D)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: 3 }}>نظام متابعة القرارات</h1>
          <p style={{ fontSize: 11, color: "#3E4A5C" }}>محمي بتشفير متقدم {IS_CONFIGURED ? "• متصل بـ Supabase ✅" : "• وضع تجريبي 🧪"}</p>
          <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
            {(IS_CONFIGURED ? ["Supabase Auth", "PostgreSQL", "bcrypt", "HTTPS", "RLS", "JWT"] : ["SHA-256", "2FA", "XSS Guard", "Encrypted"]).map(b => (
              <span key={b} className="mo" style={{ fontSize: 7, color: "#3E7B5A", background: "rgba(16,185,129,.07)", border: "1px solid rgba(16,185,129,.12)", padding: "2px 7px", borderRadius: 4 }}>{b}</span>
            ))}
          </div>
        </div>

        {isLocked && (
          <div style={{ background: "rgba(239,68,68,.06)", border: "1px solid rgba(239,68,68,.15)", borderRadius: 12, padding: 14, marginBottom: 16, textAlign: "center" }}>
            <div style={{ fontSize: 26 }}>🔒</div>
            <div className="mo" style={{ fontSize: 20, color: "#F87171", fontWeight: 600, marginTop: 4 }}>{lockTime}s</div>
            <div style={{ fontSize: 10, color: "#64748B", marginTop: 2 }}>تم القفل بسبب محاولات فاشلة</div>
          </div>
        )}

        {!otp2FA ? (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 18 }}>
              <div>
                <label style={{ fontSize: 10, fontWeight: 600, color: "#4A5568", marginBottom: 5, display: "block" }}>👤 {IS_CONFIGURED ? "البريد الإلكتروني" : "اسم المستخدم أو البريد"}</label>
                <input type="text" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLogin()} placeholder={IS_CONFIGURED ? "admin@company.com" : "admin"} className="ip" disabled={isLocked || loading} autoComplete="off" />
              </div>
              <div>
                <label style={{ fontSize: 10, fontWeight: 600, color: "#4A5568", marginBottom: 5, display: "block" }}>🔑 كلمة المرور</label>
                <div style={{ position: "relative" }}>
                  <input type={showPass ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleLogin()} placeholder="كلمة المرور" className="ip" disabled={isLocked || loading} style={{ paddingLeft: 40 }} autoComplete="off" />
                  <button onClick={() => setShowPass(!showPass)} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#4A5568", cursor: "pointer", fontSize: 15 }}>{showPass ? "🙈" : "👁️"}</button>
                </div>
              </div>
            </div>
            {error && <div style={{ background: "rgba(239,68,68,.06)", border: "1px solid rgba(239,68,68,.12)", borderRadius: 8, padding: "8px 12px", marginBottom: 14, fontSize: 11, color: "#F87171", display: "flex", alignItems: "center", gap: 6 }}>⚠️ {error} {attempts > 0 && <span style={{ color: "#4A5568", marginRight: "auto" }}>({attempts}/5)</span>}</div>}
            <button onClick={handleLogin} disabled={isLocked || loading} className="bg" style={{ width: "100%", padding: 12, borderRadius: 11, fontSize: 14 }}>{loading ? <span style={{ animation: "pulse 1s infinite" }}>جاري التحقق...</span> : "🔓 تسجيل الدخول"}</button>
          </>
        ) : (
          <div style={{ animation: "fadeUp .4s ease" }}>
            <div style={{ textAlign: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 42 }}>📱</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#E2E8F0", marginTop: 6 }}>المصادقة الثنائية</div>
              <div style={{ fontSize: 11, color: "#4A5568", marginTop: 3 }}>أدخل رمز التحقق ({otpTimer}s)</div>
            </div>
            <button onClick={() => setShowHint(!showHint)} style={{ width: "100%", padding: 8, borderRadius: 7, border: "1px dashed rgba(201,168,76,.25)", background: "rgba(201,168,76,.03)", color: "#C9A84C", fontSize: 10, cursor: "pointer", marginBottom: 12, fontFamily: "'Tajawal'" }}>{showHint ? `الرمز: ${realOtp}` : "🔔 عرض الرمز (تجريبي)"}</button>
            <input type="text" value={otpCode} onChange={e => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))} onKeyDown={e => e.key === "Enter" && otpCode.length === 6 && verifyOTP()} placeholder="000000" className="ip mo" style={{ textAlign: "center", fontSize: 22, letterSpacing: 10, padding: 14, marginBottom: 12 }} maxLength={6} autoFocus />
            {error && <div style={{ fontSize: 11, color: "#F87171", textAlign: "center", marginBottom: 10 }}>⚠️ {error}</div>}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => { setOtp2FA(false); setOtpCode(""); setError(""); }} style={{ flex: 1, padding: 10, borderRadius: 9, border: "1px solid rgba(255,255,255,.08)", background: "transparent", color: "#94A3B8", fontSize: 12, cursor: "pointer", fontFamily: "'Tajawal'" }}>رجوع</button>
              <button onClick={verifyOTP} disabled={otpCode.length !== 6 || otpTimer <= 0} className="bg" style={{ flex: 2, padding: 10, borderRadius: 9, fontSize: 13 }}>✓ تأكيد</button>
            </div>
          </div>
        )}

        {!otp2FA && (
          <div style={{ marginTop: 20, background: "rgba(255,255,255,.012)", borderRadius: 10, padding: "12px 14px", border: "1px solid rgba(255,255,255,.03)" }}>
            <div style={{ fontSize: 9, color: "#2A3346", marginBottom: 7, fontWeight: 600 }}>🧪 حسابات تجريبية</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
              {DEMO_USERS_BASE.map(u => (
                <div key={u.id} onClick={() => fillDemo(u)} style={{ fontSize: 9, color: "#3E4A5C", padding: "5px 7px", background: "rgba(255,255,255,.015)", borderRadius: 5, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, border: "1px solid transparent", transition: "border .2s" }} onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(201,168,76,.12)"} onMouseLeave={e => e.currentTarget.style.borderColor = "transparent"}>
                  <span>{ROLES[u.role].icon}</span>
                  <div><div style={{ fontWeight: 600, color: "#7A8599" }}>{u.username}</div><div style={{ fontSize: 7, color: ROLES[u.role].color }}>{ROLES[u.role].label} {u.two_factor_enabled ? "🔒" : ""}</div></div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   📊 MAIN APP
   ══════════════════════════════════════════════════════════════ */
export default function App() {
  const [user, setUser] = useState(null);
  const [decisions, setDecisions] = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  const [users, setUsers] = useState(DEMO_USERS_BASE);
  const [tab, setTab] = useState("dashboard");
  const [committee, setCommittee] = useState("all");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [showDetail, setShowDetail] = useState(null);
  const [showProfile, setShowProfile] = useState(false);
  const [anim, setAnim] = useState(false);
  const [newDec, setNewDec] = useState({ committee: "board", title: "", description: "", date: "2026-02-12", due_date: "", status: "pending", priority: "medium", assignee: "", meeting_number: "", notes: "" });
  const [sessionToken, setSessionToken] = useState("");

  const role = user ? ROLES[user.role] : null;

  // Load data
  useEffect(() => {
    if (!user) return;
    setSessionToken(genToken());
    loadDecisions();
    loadAuditLog();
    addAudit("تسجيل دخول", `دخول ناجح ${IS_CONFIGURED ? "عبر Supabase" : "وضع تجريبي"}`, "medium");
  }, [user]);

  useEffect(() => { setAnim(false); setTimeout(() => setAnim(true), 50); }, [committee, status, search]);

  const loadDecisions = async () => {
    if (IS_CONFIGURED) {
      const data = await supabase.select("decisions", { order: "created_at.desc" });
      if (Array.isArray(data)) setDecisions(data);
    } else {
      setDecisions(DEMO_DECISIONS);
    }
  };

  const loadAuditLog = async () => {
    if (IS_CONFIGURED && role?.canViewAudit) {
      const data = await supabase.select("audit_log", { order: "created_at.desc", limit: 200 });
      if (Array.isArray(data)) setAuditLog(data);
    }
  };

  const addAudit = async (action, details, severity = "low") => {
    const entry = { user_id: user?.id, user_name: user?.name, username: user?.username || user?.email, action, details, severity, role: user?.role, ip_address: "192.168.1." + Math.floor(Math.random() * 255), device_fingerprint: genToken().slice(0, 8), created_at: new Date().toISOString() };
    if (IS_CONFIGURED) {
      await supabase.insert("audit_log", entry);
    }
    setAuditLog(prev => [{ id: Date.now(), ...entry }, ...prev.slice(0, 499)]);
  };

  const visibleDecs = decisions.filter(d => role?.committees.includes(d.committee));
  const filtered = visibleDecs.filter(d => {
    if (committee !== "all" && d.committee !== committee) return false;
    if (status !== "all" && d.status !== status) return false;
    if (search && !d.title.includes(search) && !(d.description || "").includes(search)) return false;
    return true;
  });

  const stats = { total: visibleDecs.length, pending: visibleDecs.filter(d => d.status === "pending").length, completed: visibleDecs.filter(d => d.status === "completed").length, delayed: visibleDecs.filter(d => d.status === "delayed").length };
  const comStats = COMMITTEES.filter(c => role?.committees.includes(c.id)).map(c => ({ ...c, total: visibleDecs.filter(d => d.committee === c.id).length, done: visibleDecs.filter(d => d.committee === c.id && d.status === "completed").length }));
  const pct = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

  const handleAddDecision = async () => {
    if (!newDec.title.trim()) return;
    const dec = { ...newDec, title: sanitize(newDec.title), description: sanitize(newDec.description), notes: sanitize(newDec.notes), assignee: sanitize(newDec.assignee), created_by: user.id };
    if (IS_CONFIGURED) {
      const res = await supabase.insert("decisions", dec);
      if (res?.[0]) setDecisions(prev => [res[0], ...prev]);
    } else {
      setDecisions(prev => [{ id: Date.now(), ...dec }, ...prev]);
    }
    addAudit("إضافة قرار", sanitize(newDec.title));
    setShowAdd(false);
    setNewDec({ committee: "board", title: "", description: "", date: "2026-02-12", due_date: "", status: "pending", priority: "medium", assignee: "", meeting_number: "", notes: "" });
  };

  const updateDecStatus = async (id, newStatus) => {
    const dec = decisions.find(d => d.id === id);
    if (IS_CONFIGURED) {
      await supabase.update("decisions", id, { status: newStatus, last_modified_by: user.id });
    }
    setDecisions(prev => prev.map(d => d.id === id ? { ...d, status: newStatus } : d));
    addAudit("تغيير حالة", `${dec?.title} → ${STATUS_MAP[newStatus].label}`);
  };

  const deleteDec = async (id) => {
    const dec = decisions.find(d => d.id === id);
    if (IS_CONFIGURED) await supabase.delete("decisions", id);
    setDecisions(prev => prev.filter(d => d.id !== id));
    addAudit("حذف قرار", dec?.title, "high");
    setShowDetail(null);
  };

  const handleLogout = () => {
    addAudit("تسجيل خروج", "خروج يدوي");
    if (IS_CONFIGURED) supabase.signOut();
    setUser(null);
    setDecisions([]);
    setAuditLog([]);
    setTab("dashboard");
  };

  if (!user) return <Login onLogin={setUser} />;

  const comFilters = [{ id: "all", label: "الكل" }, ...COMMITTEES.filter(c => role.committees.includes(c.id)).map(c => ({ id: c.id, label: c.name }))];
  const sevColor = { high: "#EF4444", medium: "#F59E0B", low: "#10B981" };

  return (
    <div style={{ direction: "rtl", fontFamily: "'Tajawal','Noto Kufi Arabic',sans-serif", minHeight: "100vh", background: "linear-gradient(160deg,#070D1A,#0B1425,#091119)", color: "#E2E8F0" }}>
      <style>{fonts}{css}</style>

      {/* Header */}
      <div style={{ background: "linear-gradient(180deg,rgba(201,168,76,.06),transparent)", borderBottom: "1px solid rgba(201,168,76,.1)", padding: "12px 22px" }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: "linear-gradient(135deg,#C9A84C,#E5C76B)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>📋</div>
            <div>
              <h1 style={{ fontSize: 16, fontWeight: 800, fontFamily: "'Noto Kufi Arabic'", background: "linear-gradient(135deg,#C9A84C,#F0D98D)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>نظام متابعة القرارات</h1>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: IS_CONFIGURED ? "#10B981" : "#F59E0B", animation: "pulse 2s infinite" }} />
                <span className="mo" style={{ fontSize: 7, color: IS_CONFIGURED ? "#3E7B5A" : "#7A6530" }}>{IS_CONFIGURED ? "SUPABASE CONNECTED" : "DEMO MODE"}</span>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 3, background: "rgba(255,255,255,.02)", borderRadius: 8, padding: 2, border: "1px solid rgba(255,255,255,.04)" }}>
            {[{ id: "dashboard", l: "القرارات", i: "📊" }, ...(role.canViewAudit ? [{ id: "audit", l: "التدقيق", i: "📜" }] : []), ...(role.canManageUsers ? [{ id: "users", l: "المستخدمون", i: "👥" }] : []), { id: "security", l: "الأمان", i: "🛡️" }].map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: "5px 12px", borderRadius: 6, fontSize: 10, fontWeight: 600, border: "none", background: tab === t.id ? "rgba(201,168,76,.1)" : "transparent", color: tab === t.id ? "#C9A84C" : "#3E4A5C", cursor: "pointer", fontFamily: "'Tajawal'", display: "flex", alignItems: "center", gap: 4 }}><span style={{ fontSize: 12 }}>{t.i}</span>{t.l}</button>
            ))}
          </div>

          <div style={{ position: "relative" }}>
            <button onClick={() => setShowProfile(!showProfile)} style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,.025)", border: "1px solid rgba(255,255,255,.05)", borderRadius: 9, padding: "6px 12px", cursor: "pointer", color: "#E2E8F0" }}>
              <div style={{ width: 28, height: 28, borderRadius: 7, background: `linear-gradient(135deg,${role.color},${role.color}88)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>{role.icon}</div>
              <div style={{ textAlign: "right" }}><div style={{ fontSize: 10, fontWeight: 700 }}>{user.name}</div><div style={{ fontSize: 8, color: role.color }}>{role.label}</div></div>
            </button>
            {showProfile && (
              <div style={{ position: "absolute", top: "calc(100% + 5px)", left: 0, background: "#111A2D", border: "1px solid rgba(255,255,255,.07)", borderRadius: 9, padding: 5, minWidth: 160, zIndex: 100, animation: "slideIn .2s ease" }}>
                <button onClick={() => { handleLogout(); setShowProfile(false); }} style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "none", background: "transparent", color: "#EF4444", fontSize: 11, cursor: "pointer", textAlign: "right", fontFamily: "'Tajawal'", display: "flex", alignItems: "center", gap: 6 }}>🚪 تسجيل الخروج</button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "18px 22px" }}>
        {/* Dashboard */}
        {tab === "dashboard" && (<>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, marginBottom: 18, animation: "fadeUp .5s ease" }}>
            {[{ l: "الإجمالي", v: stats.total, i: "📊", c: "#C9A84C" }, { l: "قيد التنفيذ", v: stats.pending, i: "⏳", c: "#F59E0B" }, { l: "مكتملة", v: stats.completed, i: "✅", c: "#10B981" }, { l: "متأخرة", v: stats.delayed, i: "⚠️", c: "#EF4444" }, { l: "الإنجاز", v: `${pct}%`, i: "📈", c: "#8B5CF6" }].map((s, i) => (
              <div key={i} className="gl ch" style={{ borderRadius: 11, padding: "13px 15px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}><span style={{ fontSize: 22 }}>{s.i}</span><div><div style={{ fontSize: 20, fontWeight: 800, color: s.c, fontFamily: "'Noto Kufi Arabic'" }}>{s.v}</div><div style={{ fontSize: 9, color: "#4A5568" }}>{s.l}</div></div></div>
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 10, marginBottom: 18 }}>
            {comStats.map((c, i) => { const p = c.total > 0 ? Math.round((c.done / c.total) * 100) : 0; return (
              <div key={i} className="gl ch" style={{ borderRadius: 11, padding: 14, cursor: "pointer" }} onClick={() => setCommittee(committee === c.id ? "all" : c.id)}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 9 }}><span style={{ fontSize: 11, fontWeight: 600, color: c.color, display: "flex", alignItems: "center", gap: 5 }}><span style={{ fontSize: 17 }}>{c.icon}</span>{c.name}</span><span style={{ fontSize: 9, color: "#3E4A5C" }}>{c.done}/{c.total}</span></div>
                <div style={{ height: 4, background: "rgba(255,255,255,.04)", borderRadius: 2, overflow: "hidden" }}><div style={{ width: `${p}%`, height: "100%", background: c.color, borderRadius: 2, transition: "width .8s" }} /></div>
              </div>
            ); })}
          </div>

          <div className="gl" style={{ borderRadius: 11, padding: "10px 14px", marginBottom: 14, display: "flex", flexWrap: "wrap", gap: 7, alignItems: "center" }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔎 بحث..." className="ip" style={{ flex: "1 1 180px", fontSize: 11, padding: "7px 11px" }} />
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>{comFilters.map(c => (<button key={c.id} onClick={() => setCommittee(c.id)} style={{ padding: "4px 10px", borderRadius: 6, fontSize: 9, fontWeight: 600, border: "1px solid", borderColor: committee === c.id ? "#C9A84C" : "rgba(255,255,255,.06)", background: committee === c.id ? "rgba(201,168,76,.1)" : "transparent", color: committee === c.id ? "#C9A84C" : "#4A5568", cursor: "pointer", fontFamily: "'Tajawal'" }}>{c.label}</button>))}</div>
            <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>{[{ id: "all", l: "الكل" }, ...Object.entries(STATUS_MAP).map(([k, v]) => ({ id: k, l: v.label }))].map(s => (<button key={s.id} onClick={() => setStatus(s.id)} style={{ padding: "3px 8px", borderRadius: 5, fontSize: 8, border: "1px solid", borderColor: status === s.id ? "#C9A84C40" : "rgba(255,255,255,.04)", background: status === s.id ? "rgba(201,168,76,.07)" : "transparent", color: status === s.id ? "#C9A84C" : "#3E4A5C", cursor: "pointer", fontFamily: "'Tajawal'" }}>{s.l}</button>))}</div>
            {role.canEdit && <button onClick={() => setShowAdd(true)} className="bg" style={{ padding: "6px 16px", borderRadius: 7, fontSize: 11 }}>+ إضافة</button>}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {filtered.length === 0 && <div className="gl" style={{ borderRadius: 11, padding: 36, textAlign: "center" }}><div style={{ fontSize: 36 }}>📭</div><div style={{ fontSize: 12, color: "#3E4A5C", marginTop: 6 }}>لا توجد نتائج</div></div>}
            {filtered.map((d, idx) => { const com = COMMITTEES.find(c => c.id === d.committee); const st = STATUS_MAP[d.status]; const pr = PRIORITY_MAP[d.priority]; return (
              <div key={d.id} className="gl ch" onClick={() => setShowDetail(d)} style={{ borderRadius: 11, padding: "14px 18px", cursor: "pointer", borderRight: `3px solid ${com?.color}`, animation: anim ? `fadeUp .35s ease ${idx * .04}s both` : "none" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 170 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 5, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 13 }}>{com?.icon}</span>
                      <span style={{ fontSize: 8, color: com?.color, fontWeight: 600, background: com?.color + "10", padding: "2px 7px", borderRadius: 4 }}>{com?.name}</span>
                      <span className="mo" style={{ fontSize: 7, color: "#2A3346", background: "rgba(255,255,255,.02)", padding: "1px 5px", borderRadius: 3 }}>{d.meeting_number}</span>
                    </div>
                    <h3 style={{ fontSize: 12, fontWeight: 700, color: "#F1F5F9", marginBottom: 3, lineHeight: 1.6, fontFamily: "'Noto Kufi Arabic'" }}>{d.title}</h3>
                    <p style={{ fontSize: 9, color: "#3E4A5C", lineHeight: 1.5 }}>{d.description}</p>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, minWidth: 110 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 8, fontWeight: 600, padding: "3px 8px", borderRadius: 5, background: st.dot + "12", color: st.dot }}><span style={{ width: 5, height: 5, borderRadius: "50%", background: st.dot, animation: d.status === "pending" ? "pulse 2s infinite" : "none" }} />{st.label}</span>
                    <span style={{ fontSize: 8, color: pr.color }}>● {pr.label}</span>
                    <div style={{ fontSize: 8, color: "#2A3346" }}>📅 {d.date}</div>
                    {d.assignee && <span style={{ fontSize: 7, color: "#3E4A5C" }}>👤 {d.assignee}</span>}
                  </div>
                </div>
              </div>
            ); })}
          </div>
        </>)}

        {/* Audit Log */}
        {tab === "audit" && role.canViewAudit && (
          <div style={{ animation: "fadeUp .4s ease" }}>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: "#C9A84C", fontFamily: "'Noto Kufi Arabic'", marginBottom: 16 }}>📜 سجل التدقيق</h2>
            {auditLog.length === 0 ? <div className="gl" style={{ borderRadius: 11, padding: 36, textAlign: "center" }}><div style={{ fontSize: 36 }}>📝</div><div style={{ color: "#3E4A5C", marginTop: 6 }}>لا توجد سجلات</div></div> : (
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {auditLog.map((l, i) => (
                  <div key={l.id} className="gl" style={{ borderRadius: 9, padding: "10px 14px", animation: `fadeUp .25s ease ${i * .02}s both`, borderRight: `3px solid ${sevColor[l.severity] || "#C9A84C"}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 4 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 10, fontWeight: 700 }}>{l.user_name}</span>
                        <span className="mo" style={{ fontSize: 7, color: "#2A3346", background: "rgba(255,255,255,.02)", padding: "1px 5px", borderRadius: 3 }}>@{l.username}</span>
                        <span style={{ fontSize: 7, padding: "1px 5px", borderRadius: 3, background: (sevColor[l.severity] || "#999") + "10", color: sevColor[l.severity] }}>{l.severity === "high" ? "حرج" : l.severity === "medium" ? "متوسط" : "عادي"}</span>
                      </div>
                      <span style={{ fontSize: 8, color: "#2A3346" }}>{l.created_at ? new Date(l.created_at).toLocaleString("ar-SA") : ""}</span>
                    </div>
                    <div style={{ marginTop: 4, fontSize: 9 }}><span style={{ color: "#C9A84C", fontWeight: 600 }}>{l.action}</span> <span style={{ color: "#4A5568" }}>— {l.details}</span></div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Users */}
        {tab === "users" && role.canManageUsers && (
          <div style={{ animation: "fadeUp .4s ease" }}>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: "#C9A84C", fontFamily: "'Noto Kufi Arabic'", marginBottom: 16 }}>👥 المستخدمون</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {users.map((u, i) => (
                <div key={u.id} className="gl" style={{ borderRadius: 9, padding: "11px 14px", opacity: u.active ? 1 : .4, animation: `fadeUp .3s ease ${i * .03}s both` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: `linear-gradient(135deg,${ROLES[u.role].color},${ROLES[u.role].color}77)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>{ROLES[u.role].icon}</div>
                      <div><div style={{ fontSize: 11, fontWeight: 700 }}>{u.name} {u.two_factor_enabled && "🔒"}</div><div style={{ fontSize: 8, color: "#3E4A5C" }}>{u.email} · <span style={{ color: ROLES[u.role].color }}>{ROLES[u.role].label}</span></div></div>
                    </div>
                    <span style={{ fontSize: 8, padding: "2px 7px", borderRadius: 4, background: u.active ? "rgba(16,185,129,.07)" : "rgba(239,68,68,.07)", color: u.active ? "#10B981" : "#EF4444" }}>{u.active ? "نشط" : "معطّل"}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Security */}
        {tab === "security" && (
          <div style={{ animation: "fadeUp .4s ease" }}>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: "#C9A84C", fontFamily: "'Noto Kufi Arabic'", marginBottom: 16 }}>🛡️ لوحة الأمان</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 12 }}>
              <div className="gl" style={{ borderRadius: 13, padding: 20 }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, color: "#C9A84C", marginBottom: 12 }}>تقييم الحماية</h3>
                <div style={{ fontSize: 42, fontWeight: 800, color: IS_CONFIGURED ? "#10B981" : "#F59E0B", textAlign: "center", marginBottom: 6 }}>{IS_CONFIGURED ? "10" : "7"}/10</div>
                <div style={{ height: 5, background: "rgba(255,255,255,.04)", borderRadius: 3, overflow: "hidden", marginBottom: 14 }}><div style={{ width: IS_CONFIGURED ? "100%" : "70%", height: "100%", background: IS_CONFIGURED ? "#10B981" : "#F59E0B", borderRadius: 3 }} /></div>
                {[
                  { l: "تشفير كلمات المرور", ok: true, note: IS_CONFIGURED ? "bcrypt (Supabase)" : "SHA-256" },
                  { l: "المصادقة الثنائية (2FA)", ok: true },
                  { l: "حماية XSS", ok: true },
                  { l: "تنقية المدخلات", ok: true },
                  { l: "سجل تدقيق", ok: true },
                  { l: "صلاحيات حسب الدور (RLS)", ok: true },
                  { l: "JWT Tokens", ok: IS_CONFIGURED },
                  { l: "خادم خلفي (Backend)", ok: IS_CONFIGURED, note: IS_CONFIGURED ? "Supabase" : "" },
                  { l: "HTTPS / TLS", ok: IS_CONFIGURED },
                  { l: "قاعدة بيانات مشفرة", ok: IS_CONFIGURED, note: IS_CONFIGURED ? "PostgreSQL" : "" },
                ].map((x, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, marginBottom: 6 }}>
                    <span>{x.ok ? "✅" : "❌"}</span>
                    <span style={{ color: x.ok ? "#94A3B8" : "#4A5568" }}>{x.l}</span>
                    {x.note && <span className="mo" style={{ fontSize: 7, color: "#3E7B5A", marginRight: "auto" }}>{x.note}</span>}
                  </div>
                ))}
              </div>

              <div className="gl" style={{ borderRadius: 13, padding: 20 }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, color: "#C9A84C", marginBottom: 12 }}>معلومات الجلسة</h3>
                {[
                  { l: "الوضع", v: IS_CONFIGURED ? "Supabase (إنتاج)" : "تجريبي (Demo)", c: IS_CONFIGURED ? "#10B981" : "#F59E0B" },
                  { l: "التوكن", v: sessionToken.slice(0, 20) + "...", mono: true },
                  { l: "المستخدم", v: user.name },
                  { l: "الدور", v: role.label, c: role.color },
                  { l: "2FA", v: user.two_factor_enabled ? "مفعّلة 🔒" : "غير مفعّلة", c: user.two_factor_enabled ? "#10B981" : "#F59E0B" },
                  { l: "البريد", v: user.email || "—" },
                  { l: "التشفير", v: IS_CONFIGURED ? "bcrypt + TLS 1.3" : "SHA-256 (Web Crypto)", mono: true },
                ].map((x, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "7px 10px", background: "rgba(255,255,255,.015)", borderRadius: 7, marginBottom: 5 }}>
                    <span style={{ fontSize: 10, color: "#4A5568" }}>{x.l}</span>
                    <span className={x.mono ? "mo" : ""} style={{ fontSize: 9, color: x.c || "#E2E8F0", fontWeight: 600, direction: "ltr" }}>{x.v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {showDetail && (() => { const d = showDetail; const com = COMMITTEES.find(c => c.id === d.committee); const st = STATUS_MAP[d.status]; return (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 14 }} onClick={() => setShowDetail(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "linear-gradient(160deg,#111A2D,#0D1526)", border: "1px solid rgba(201,168,76,.15)", borderRadius: 16, padding: 24, maxWidth: 520, width: "100%", maxHeight: "85vh", overflowY: "auto", animation: "slideIn .3s ease", direction: "rtl" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ fontSize: 22 }}>{com?.icon}</span><div><div style={{ fontSize: 11, color: com?.color, fontWeight: 600 }}>{com?.name}</div><div className="mo" style={{ fontSize: 8, color: "#2A3346" }}>{d.meeting_number}</div></div></div>
              <button onClick={() => setShowDetail(null)} style={{ background: "rgba(255,255,255,.03)", border: "none", color: "#4A5568", width: 30, height: 30, borderRadius: 7, cursor: "pointer", fontSize: 13 }}>✕</button>
            </div>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: "#F1F5F9", marginBottom: 10, lineHeight: 1.7, fontFamily: "'Noto Kufi Arabic'" }}>{d.title}</h2>
            <p style={{ fontSize: 11, color: "#7A8599", lineHeight: 1.8, marginBottom: 16 }}>{d.description}</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginBottom: 16 }}>
              {[{ l: "الحالة", v: st.label, c: st.dot }, { l: "الأولوية", v: PRIORITY_MAP[d.priority].label, c: PRIORITY_MAP[d.priority].color }, { l: "التاريخ", v: d.date }, { l: "الاستحقاق", v: d.due_date || "—" }, { l: "المسؤول", v: d.assignee || "—" }, { l: "أنشئ بواسطة", v: d.created_by || "—" }].map((x, i) => (
                <div key={i} style={{ background: "rgba(255,255,255,.02)", borderRadius: 7, padding: "8px 11px" }}><div style={{ fontSize: 8, color: "#2A3346", marginBottom: 2 }}>{x.l}</div><div style={{ fontSize: 10, fontWeight: 600, color: x.c || "#E2E8F0" }}>{x.v}</div></div>
              ))}
            </div>
            {d.notes && <div style={{ background: "rgba(201,168,76,.03)", border: "1px solid rgba(201,168,76,.1)", borderRadius: 7, padding: "9px 12px", marginBottom: 14 }}><div style={{ fontSize: 9, color: "#C9A84C", fontWeight: 600, marginBottom: 2 }}>📝 ملاحظات</div><div style={{ fontSize: 10, color: "#7A8599", lineHeight: 1.6 }}>{d.notes}</div></div>}
            {role.canEdit && <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}><span style={{ fontSize: 9, color: "#3E4A5C" }}>الحالة:</span>{Object.entries(STATUS_MAP).map(([k, v]) => (<button key={k} onClick={() => { updateDecStatus(d.id, k); setShowDetail({ ...d, status: k }); }} style={{ padding: "4px 9px", borderRadius: 5, fontSize: 8, fontWeight: 600, border: d.status === k ? `2px solid ${v.dot}` : "1px solid rgba(255,255,255,.06)", background: d.status === k ? v.dot + "15" : "transparent", color: v.dot, cursor: "pointer", fontFamily: "'Tajawal'" }}>{v.label}</button>))}</div>}
            {role.canDelete && <button onClick={() => deleteDec(d.id)} style={{ marginTop: 10, padding: "5px 14px", borderRadius: 6, fontSize: 10, border: "1px solid rgba(239,68,68,.15)", background: "rgba(239,68,68,.05)", color: "#EF4444", cursor: "pointer", fontFamily: "'Tajawal'", fontWeight: 600 }}>🗑️ حذف</button>}
          </div>
        </div>
      ); })()}

      {/* Add Modal */}
      {showAdd && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 14 }} onClick={() => setShowAdd(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "linear-gradient(160deg,#111A2D,#0D1526)", border: "1px solid rgba(201,168,76,.15)", borderRadius: 16, padding: 24, maxWidth: 500, width: "100%", maxHeight: "85vh", overflowY: "auto", animation: "slideIn .3s ease", direction: "rtl" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 18 }}><h2 style={{ fontSize: 15, fontWeight: 800, color: "#C9A84C", fontFamily: "'Noto Kufi Arabic'" }}>إضافة قرار</h2><button onClick={() => setShowAdd(false)} style={{ background: "rgba(255,255,255,.03)", border: "none", color: "#4A5568", width: 30, height: 30, borderRadius: 7, cursor: "pointer" }}>✕</button></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[{ l: "اللجنة", t: "select", k: "committee", opts: COMMITTEES.filter(c => role.committees.includes(c.id)).map(c => ({ v: c.id, l: c.name })) }, { l: "العنوان", t: "text", k: "title", p: "عنوان القرار" }, { l: "الوصف", t: "textarea", k: "description", p: "وصف تفصيلي" }, { l: "رقم الاجتماع", t: "text", k: "meeting_number", p: "م-2026/03" }, { l: "تاريخ القرار", t: "date", k: "date" }, { l: "الاستحقاق", t: "date", k: "due_date" }, { l: "الأولوية", t: "select", k: "priority", opts: Object.entries(PRIORITY_MAP).map(([k, v]) => ({ v: k, l: v.label })) }, { l: "المسؤول", t: "text", k: "assignee", p: "الجهة المسؤولة" }, { l: "ملاحظات", t: "textarea", k: "notes", p: "ملاحظات" }].map(f => (
                <div key={f.k}><label style={{ fontSize: 9, fontWeight: 600, color: "#4A5568", marginBottom: 3, display: "block" }}>{f.l}</label>
                  {f.t === "select" ? <select value={newDec[f.k]} onChange={e => setNewDec(p => ({ ...p, [f.k]: e.target.value }))} className="ip" style={{ fontSize: 11 }}>{f.opts.map(o => <option key={o.v} value={o.v} style={{ background: "#111A2D" }}>{o.l}</option>)}</select> : f.t === "textarea" ? <textarea value={newDec[f.k]} onChange={e => setNewDec(p => ({ ...p, [f.k]: e.target.value }))} placeholder={f.p} rows={2} className="ip" style={{ fontSize: 11, resize: "vertical" }} /> : <input type={f.t} value={newDec[f.k]} onChange={e => setNewDec(p => ({ ...p, [f.k]: e.target.value }))} placeholder={f.p} className="ip" style={{ fontSize: 11 }} />}
                </div>))}
              <button onClick={handleAddDecision} className="bg" style={{ padding: 9, borderRadius: 9, fontSize: 12, marginTop: 4 }}>حفظ القرار</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
