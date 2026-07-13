import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabaseClient";
import {
  Home, MapPin, Search, Plus, ShieldCheck, ChevronLeft, X,
  Building2, Warehouse, Trees, Landmark, Clock, Hash, Sun, Moon,
  FileCheck2, Upload, Check, XCircle, ClipboardList, FileText, LogOut, LogIn
} from "lucide-react";

const TYPE_ICON = { Apartment: Building2, House: Home, Land: Trees, Duplex: Warehouse, Commercial: Landmark };
const PURPOSE_LABEL = { Sale: "For Sale", Rent: "For Rent", Lease: "For Lease" };

function formatPrice(n, purpose, interval) {
  const base = n >= 1000000 ? "₦" + (n / 1000000).toFixed(n % 1000000 === 0 ? 0 : 1) + "M" : "₦" + Number(n).toLocaleString();
  if (purpose === "Rent" || purpose === "Lease") {
    const suffix = interval === "month" ? "/mo" : interval === "year" ? "/yr" : "";
    return base + suffix;
  }
  return base;
}

async function hashFile(file) {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  const bytes = Array.from(new Uint8Array(digest));
  const hex = bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
  return "0x" + hex.slice(0, 12) + "…" + hex.slice(-4);
}

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [listings, setListings] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState("browse");
  const [activeId, setActiveId] = useState(null);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [purposeFilter, setPurposeFilter] = useState("All");
  const [theme, setTheme] = useState("dark");
  const [toast, setToast] = useState("");
  const [authMode, setAuthMode] = useState("signin");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setProfile(null); return; }
    (async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
      setProfile(data);
    })();
  }, [session]);

  const fetchListings = useCallback(async () => {
    const { data, error } = await supabase.from("listings").select("*").order("featured", { ascending: false }).order("created_at", { ascending: false });
    if (!error) setListings(data || []);
    setLoaded(true);
  }, []);

  useEffect(() => { fetchListings(); }, [fetchListings]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2800);
    return () => clearTimeout(t);
  }, [toast]);

  const signUp = async (e) => {
    e.preventDefault();
    setAuthError("");
    const { data, error } = await supabase.auth.signUp({ email: authEmail, password: authPassword });
    if (error) { setAuthError(error.message); return; }
    if (data.user) {
      await supabase.from("profiles").insert({ id: data.user.id, role: "realtor", full_name: authEmail.split("@")[0] });
    }
    setToast("Account created — check your email to confirm, then sign in.");
    setAuthMode("signin");
  };

  const signIn = async (e) => {
    e.preventDefault();
    setAuthError("");
    const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
    if (error) setAuthError(error.message);
  };

  const signOut = async () => { await supabase.auth.signOut(); setView("browse"); };

  const addListing = async (form, file) => {
    if (!session) { setToast("Sign in first to post a listing"); return; }
    const { data: listing, error } = await supabase.from("listings").insert({
      realtor_id: session.user.id,
      title: form.title, location: form.location, price: Number(form.price) || 0,
      type: form.type, purpose: form.purpose, price_interval: form.purpose === "Sale" ? "total" : form.priceInterval,
      bedrooms: form.bedrooms ? Number(form.bedrooms) : null, description: form.description,
      verification_status: file ? "pending" : "unverified",
    }).select().single();

    if (error) { setToast("Error: " + error.message); return; }

    if (file) {
      const hash = await hashFile(file);
      const path = `${listing.id}/${file.name}`;
      const { error: uploadErr } = await supabase.storage.from("documents").upload(path, file);
      if (!uploadErr) {
        await supabase.from("documents").insert({ listing_id: listing.id, file_path: path, sha256_hash: hash });
        await supabase.from("listings").update({ hash }).eq("id", listing.id);
      }
    }
    setToast(file ? "Listing submitted — pending verification review" : "Listing posted");
    await fetchListings();
    setView("browse");
  };

  const approve = async (id) => {
    const { error } = await supabase.from("listings").update({ verified: true, verification_status: "verified" }).eq("id", id);
    if (error) { setToast("Not authorized: " + error.message); return; }
    setToast("Listing verified and stamped");
    await fetchListings();
  };

  const reject = async (id) => {
    const { error } = await supabase.from("listings").update({ verified: false, verification_status: "rejected" }).eq("id", id);
    if (error) { setToast("Not authorized: " + error.message); return; }
    setToast("Listing rejected");
    await fetchListings();
  };

  const filtered = listings.filter((l) => {
    const matchesQuery = query.trim() === "" || l.title.toLowerCase().includes(query.toLowerCase()) || l.location.toLowerCase().includes(query.toLowerCase());
    const matchesType = typeFilter === "All" || l.type === typeFilter;
    const matchesPurpose = purposeFilter === "All" || l.purpose === purposeFilter;
    return matchesQuery && matchesType && matchesPurpose;
  });

  const active = listings.find((l) => l.id === activeId);
  const isAdmin = profile && profile.role === "admin";

  return (
    <div className="tc-root" data-theme={theme}>
      <style>{STYLES}</style>
      <header className="header">
        <div className="logo" onClick={() => setView("browse")}>
          <div className="logo-mark">T</div>
          <span className="logo-text">TurfChain</span>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        {view !== "browse" && <button className="nav-btn" onClick={() => setView("browse")}><Home size={15} /> Browse</button>}
          {isAdmin && <button className="nav-btn" onClick={() => setView("review")}><ClipboardList size={15} /> Review queue</button>}
          {session ? (
            <>
              <button className="nav-btn primary" onClick={() => setView("post")}><Plus size={15} /> Post a listing</button>
              <button className="nav-btn" onClick={signOut}><LogOut size={15} /></button>
            </>
          ) : (
            <button className="nav-btn primary" onClick={() => setView("auth")}><LogIn size={15} /> Sign in</button>
          )}
          <button className="icon-btn" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
          </button>
        </div>
      </header>

      {view === "browse" && (
        <>
          <div className="hero">
            <h1 className="display">Find property you can <span className="hl">actually trust</span>.</h1>
            <p>Buy, rent, or lease — every verified listing on TurfChain is checked and fingerprinted against a real document.</p>
            <div className="search-bar">
              <input className="search-input" placeholder="Search by area..." value={query} onChange={(e) => setQuery(e.target.value)} />
              <select className="type-select" value={purposeFilter} onChange={(e) => setPurposeFilter(e.target.value)}>
                <option value="All">Buy or rent</option><option value="Sale">For Sale</option><option value="Rent">For Rent</option><option value="Lease">For Lease</option>
              </select>
              <select className="type-select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                <option>All</option><option>Apartment</option><option>House</option><option>Duplex</option><option>Land</option><option>Commercial</option>
              </select>
              <button className="search-go"><Search size={16} /></button>
            </div>
          </div>
          <div className="section-label"><h2 className="display">Listings</h2><span className="count">{loaded ? `${filtered.length} available` : "loading…"}</span></div>
          <div className="grid">
            {loaded && filtered.length === 0 && <div className="empty">No listings yet — be the first to post one.</div>}
            {filtered.map((l) => {
              const Icon = TYPE_ICON[l.type] || Home;
              return (
                <div className="card" key={l.id} onClick={() => { setActiveId(l.id); setView("detail"); }}>
                  <div className="card-media">
                    {l.featured && <div className="ribbon">Featured</div>}
                    <Icon size={40} color="var(--text-muted)" strokeWidth={1.4} />
                    {l.verified && <div className="seal-mini"><ShieldCheck size={26} /></div>}
                  </div>
                  <div className="card-body">
                    <div className="card-price">{formatPrice(l.price, l.purpose, l.price_interval)}</div>
                    <div className="card-title">{l.title}</div>
                    <div className="card-loc"><MapPin size={13} /> {l.location}</div>
                    <div className="badge-row">
                      <span className={`badge purpose-${l.purpose}`}>{PURPOSE_LABEL[l.purpose] || "For Sale"}</span>
                      <span className="badge">{l.type}</span>
                      {l.verification_status === "pending" && <span className="badge pending">Pending review</span>}
                      {l.verification_status === "rejected" && <span className="badge rejected">Rejected</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {view === "detail" && active && (
        <div className="detail-wrap">
          <button className="back-btn" onClick={() => setView("browse")}><ChevronLeft size={16} /> Back to listings</button>
          <div className="detail-media">
            {React.createElement(TYPE_ICON[active.type] || Home, { size: 64, color: "var(--text-muted)", strokeWidth: 1.2 })}
          </div>
          <h1 className="detail-title">{active.title}</h1>
          <div className="detail-price">{formatPrice(active.price, active.purpose, active.price_interval)}</div>
          <div className="detail-loc"><MapPin size={15} /> {active.location}</div>
          <div className="info-grid">
            <div className="info-box"><div className="info-label">Purpose</div><div className="info-val">{PURPOSE_LABEL[active.purpose] || "For Sale"}</div></div>
            <div className="info-box"><div className="info-label">Type</div><div className="info-val">{active.type}</div></div>
            {active.bedrooms != null && <div className="info-box"><div className="info-label">Bedrooms</div><div className="info-val">{active.bedrooms}</div></div>}
          </div>
          <div className="divider" />
          <p className="detail-desc">{active.description}</p>
          <div className="verify-panel">
            <div className="verify-row">
              {active.verification_status === "verified" && <><ShieldCheck size={16} /> Document verified & fingerprinted</>}
              {active.verification_status === "pending" && <><FileCheck2 size={16} /> Verification in progress</>}
              {active.verification_status === "rejected" && <><XCircle size={16} /> Verification rejected</>}
              {active.verification_status === "unverified" && <><FileCheck2 size={16} /> No document submitted</>}
            </div>
            {active.hash && <div className="verify-hash mono"><Hash size={12} style={{ display: "inline", marginRight: 4 }} />{active.hash}</div>}
          </div>
        </div>
      )}

      {view === "post" && <PostForm onSubmit={addListing} onCancel={() => setView("browse")} />}

      {view === "review" && isAdmin && (
        <ReviewQueue listings={listings.filter((l) => l.verification_status === "pending")} onApprove={approve} onReject={reject} onBack={() => setView("browse")} />
      )}

      {view === "auth" && (
        <div className="form-wrap">
          <h1 className="form-title display">{authMode === "signin" ? "Sign in" : "Create account"}</h1>
          <p className="form-sub">{authMode === "signin" ? "Realtors and admins sign in here to post and manage listings." : "Sign up to start posting listings on TurfChain."}</p>
          <form onSubmit={authMode === "signin" ? signIn : signUp}>
            <div className="field"><label>Email</label><input type="email" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} required /></div>
            <div className="field"><label>Password</label><input type="password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} required minLength={6} /></div>
            {authError && <div className="upload-hint" style={{ color: "var(--danger)", marginBottom: 12 }}>{authError}</div>}
            <button className="submit-btn" type="submit">{authMode === "signin" ? "Sign in" : "Sign up"}</button>
          </form>
          <button className="nav-btn" style={{ width: "100%", marginTop: 10, justifyContent: "center" }} onClick={() => setAuthMode(authMode === "signin" ? "signup" : "signin")}>
            {authMode === "signin" ? "Need an account? Sign up" : "Already have an account? Sign in"}
          </button>
        </div>
      )}

      {toast && <div className="toast"><Clock size={14} /> {toast}</div>}
    </div>
  );
}

function ReviewQueue({ listings, onApprove, onReject, onBack }) {
  return (
    <div className="review-wrap">
      <button className="back-btn" onClick={onBack}><ChevronLeft size={16} /> Back to listings</button>
      <h1 className="review-title display">Verification review queue</h1>
      {listings.length === 0 && <div className="empty" style={{ padding: "40px 0" }}>Nothing waiting for review.</div>}
      {listings.map((l) => (
        <div className="review-card" key={l.id}>
          <div className="review-info">
            <h3>{l.title}</h3>
            <div className="loc"><MapPin size={13} /> {l.location}</div>
            <div className="verify-hash mono">{l.hash || "no hash yet"}</div>
            <div className="review-actions">
              <button className="btn-approve" onClick={() => onApprove(l.id)}><Check size={14} /> Approve & stamp</button>
              <button className="btn-reject" onClick={() => onReject(l.id)}><XCircle size={14} /> Reject</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function PostForm({ onSubmit, onCancel }) {
  const [form, setForm] = useState({ title: "", location: "", price: "", type: "Apartment", bedrooms: "", description: "", purpose: "Sale", priceInterval: "year" });
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.location || !form.price) return;
    setSaving(true);
    await onSubmit(form, file);
    setSaving(false);
  };

  return (
    <div className="form-wrap">
      <h1 className="form-title display">Post a listing</h1>
      <form onSubmit={submit}>
        <div className="field"><label>Listing purpose</label>
          <select value={form.purpose} onChange={set("purpose")}><option value="Sale">For Sale</option><option value="Rent">For Rent</option><option value="Lease">For Lease</option></select>
        </div>
        <div className="field"><label>Property title</label><input value={form.title} onChange={set("title")} placeholder="e.g. 3-Bedroom Duplex, Gwarinpa" /></div>
        <div className="field-row">
          <div className="field"><label>Location</label><input value={form.location} onChange={set("location")} /></div>
          <div className="field"><label>Price (₦)</label><input type="number" value={form.price} onChange={set("price")} /></div>
        </div>
        {form.purpose !== "Sale" && (
          <div className="field"><label>Billing period</label>
            <select value={form.priceInterval} onChange={set("priceInterval")}><option value="year">Per year</option><option value="month">Per month</option></select>
          </div>
        )}
        <div className="field-row">
          <div className="field"><label>Type</label>
            <select value={form.type} onChange={set("type")}><option>Apartment</option><option>House</option><option>Duplex</option><option>Land</option><option>Commercial</option></select>
          </div>
          <div className="field"><label>Bedrooms</label><input type="number" value={form.bedrooms} onChange={set("bedrooms")} /></div>
        </div>
        <div className="field"><label>Description</label><textarea value={form.description} onChange={set("description")} /></div>
        <div className="field">
          <label>Property document (optional)</label>
          <label className="upload-box">
            <input type="file" accept="image/*,.pdf" onChange={(e) => setFile(e.target.files[0])} style={{ display: "none" }} />
            <Upload size={20} /><div>{file ? file.name : "Tap to upload document"}</div>
          </label>
        </div>
        <button className="submit-btn" type="submit" disabled={saving}>{saving ? "Saving…" : "Submit listing"}</button>
        <button type="button" className="nav-btn" style={{ width: "100%", marginTop: 10, justifyContent: "center" }} onClick={onCancel}>Cancel</button>
      </form>
    </div>
  );
}

const STYLES = `
* { box-sizing: border-box; }
body, .tc-root { margin:0; font-family:'Inter',sans-serif; min-height:100vh; }
.tc-root[data-theme='dark'] { background:#0F1E18; color:#F2EEE2; --bg:#0F1E18; --bg-alt:#17281F; --panel:#1C2E24; --border:#24392D; --text:#F2EEE2; --text-muted:#9FB0A4; --accent:#C9A227; --accent-strong:#E0B93B; --shadow:rgba(0,0,0,.45); --danger:#C4573A; --input:#17281F; --evergreen:#2E6B4C; }
.tc-root[data-theme='light'] { background:#F5F9F3; color:#132119; --bg:#F5F9F3; --bg-alt:#FFF; --panel:#FFF; --border:#D9E5D5; --text:#132119; --text-muted:#5E7768; --accent:#B8901E; --accent-strong:#A17D19; --shadow:rgba(30,60,40,.12); --danger:#C4573A; --input:#FFF; --evergreen:#2E6B4C; }
.display { font-family:'Fraunces',serif; } .mono { font-family:'JetBrains Mono',monospace; }
.header { display:flex; justify-content:space-between; align-items:center; padding:18px 28px; border-bottom:1px solid var(--border); position:sticky; top:0; background:var(--bg); z-index:10; }
.logo { display:flex; gap:10px; align-items:center; cursor:pointer; }
.logo-mark { width:34px; height:34px; border-radius:8px; background:linear-gradient(135deg,var(--accent),var(--evergreen)); display:flex; align-items:center; justify-content:center; font-family:'Fraunces',serif; font-weight:700; color:#0F1E18; }
.logo-text { font-family:'Fraunces',serif; font-size:20px; font-weight:600; }
.nav-btn { background:transparent; border:1px solid var(--border); color:var(--text); padding:9px 16px; border-radius:9px; font-size:14px; cursor:pointer; display:flex; align-items:center; gap:6px; }
.nav-btn.primary { background:var(--accent); border-color:var(--accent); color:#0F1E18; font-weight:600; }
.icon-btn { width:38px; height:38px; border-radius:9px; border:1px solid var(--border); background:var(--panel); display:flex; align-items:center; justify-content:center; cursor:pointer; color:var(--text); }
.hero { padding:64px 28px 40px; max-width:920px; margin:0 auto; text-align:center; }
.hero h1 { font-size:clamp(32px,5vw,52px); font-weight:600; margin:0 0 14px; }
.hero .hl { color:var(--accent); }
.hero p { color:var(--text-muted); font-size:16px; max-width:560px; margin:0 auto 30px; }
.search-bar { display:flex; gap:8px; max-width:640px; margin:0 auto; flex-wrap:wrap; background:var(--panel); border:1px solid var(--border); border-radius:14px; padding:8px; }
.search-input { flex:1; min-width:180px; background:transparent; border:none; outline:none; color:var(--text); font-size:15px; padding:10px 12px; }
.type-select { background:var(--input); border:1px solid var(--border); color:var(--text); border-radius:9px; padding:10px 12px; font-size:14px; }
.search-go { background:var(--accent); border:none; color:#0F1E18; border-radius:9px; padding:0 18px; cursor:pointer; }
.section-label { max-width:1120px; margin:0 auto; padding:0 28px; display:flex; justify-content:space-between; margin-bottom:18px; }
.count { color:var(--text-muted); font-size:13px; }
.grid { max-width:1120px; margin:0 auto 80px; padding:0 28px; display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:20px; }
.card { background:var(--panel); border:1px solid var(--border); border-radius:16px; overflow:hidden; cursor:pointer; position:relative; }
.card-media { height:150px; display:flex; align-items:center; justify-content:center; position:relative; background:var(--bg-alt); }
.seal-mini { position:absolute; top:10px; right:10px; color:var(--accent); }
.ribbon { position:absolute; top:0; left:0; background:var(--accent); color:#0F1E18; font-size:11px; font-weight:700; padding:5px 12px; border-radius:0 0 10px 0; }
.card-body { padding:16px; }
.card-price { font-family:'JetBrains Mono',monospace; color:var(--accent); font-size:18px; font-weight:600; }
.card-title { font-size:15px; font-weight:600; margin:6px 0; }
.card-loc { display:flex; gap:5px; color:var(--text-muted); font-size:13px; align-items:center; }
.badge-row { display:flex; gap:6px; margin-top:10px; flex-wrap:wrap; }
.badge { font-size:11px; padding:3px 8px; border-radius:6px; background:var(--bg-alt); color:var(--text-muted); border:1px solid var(--border); }
.badge.pending { color:#C77A2A; } .badge.rejected { color:var(--danger); }
.badge.purpose-Sale { color:var(--evergreen); } .badge.purpose-Rent { color:var(--accent); } .badge.purpose-Lease { color:#7A5FB8; }
.detail-wrap, .form-wrap, .review-wrap { max-width:700px; margin:0 auto; padding:24px 28px 80px; }
.back-btn { background:none; border:none; color:var(--text-muted); display:flex; gap:6px; cursor:pointer; margin-bottom:20px; }
.detail-media { height:260px; border-radius:18px; background:var(--bg-alt); display:flex; align-items:center; justify-content:center; margin-bottom:24px; }
.detail-title { font-family:'Fraunces',serif; font-size:28px; margin:0 0 8px; }
.detail-price { font-family:'JetBrains Mono',monospace; color:var(--accent); font-size:24px; margin-bottom:16px; }
.detail-loc { color:var(--text-muted); display:flex; gap:6px; margin-bottom:20px; align-items:center; }
.info-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:16px; margin:20px 0; }
.info-box { background:var(--panel); border:1px solid var(--border); border-radius:11px; padding:14px; }
.info-label { font-size:11px; color:var(--text-muted); text-transform:uppercase; }
.info-val { font-size:15px; font-weight:600; }
.divider { height:1px; background:var(--border); margin:24px 0; }
.detail-desc { line-height:1.7; }
.verify-panel { background:var(--bg-alt); border:1px dashed var(--accent); border-radius:14px; padding:18px; margin-top:24px; }
.verify-row { display:flex; gap:8px; color:var(--accent); font-weight:600; margin-bottom:8px; }
.verify-hash { color:var(--text-muted); font-size:13px; word-break:break-all; }
.form-title { font-family:'Fraunces',serif; font-size:26px; margin:0 0 6px; }
.form-sub { color:var(--text-muted); font-size:14px; margin-bottom:24px; }
.field { margin-bottom:18px; }
.field label { display:block; font-size:13px; color:var(--text-muted); margin-bottom:6px; }
.field input, .field select, .field textarea { width:100%; background:var(--input); border:1px solid var(--border); color:var(--text); border-radius:9px; padding:11px 12px; font-size:14px; }
.field-row { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
.upload-box { border:1.5px dashed var(--border); border-radius:12px; padding:20px; text-align:center; cursor:pointer; background:var(--bg-alt); display:block; }
.submit-btn { width:100%; background:var(--accent); color:#0F1E18; border:none; border-radius:11px; padding:14px; font-weight:700; cursor:pointer; }
.toast { position:fixed; bottom:24px; left:50%; transform:translateX(-50%); background:var(--panel); border:1px solid var(--accent); padding:12px 20px; border-radius:11px; display:flex; gap:8px; }
.empty { text-align:center; padding:60px 20px; color:var(--text-muted); grid-column:1/-1; }
.review-card { background:var(--panel); border:1px solid var(--border); border-radius:14px; padding:18px; margin-bottom:16px; }
.review-actions { display:flex; gap:8px; margin-top:12px; }
.btn-approve, .btn-reject { border:none; border-radius:8px; padding:9px 14px; font-size:13px; font-weight:600; cursor:pointer; display:flex; align-items:center; gap:5px; }
.btn-approve { background:var(--evergreen); color:#fff; }
.btn-reject { background:transparent; border:1px solid var(--danger); color:var(--danger); }
`;
