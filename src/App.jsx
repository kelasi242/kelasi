import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, ArrowRight, ArrowUpRight, Bell, Briefcase, Calculator,
  CalendarCheck, CalendarDays, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight,
  HelpCircle, Cloud, CloudOff, Download, Eye, EyeOff, FileText, Home, Landmark,
  Laptop, LogOut, Menu, Moon, MoreHorizontal, Plus, Receipt, RefreshCw, Settings,
  ShieldCheck, Smartphone, Sparkles, Sun, Target, TrendingUp, Wallet, X, Zap, Lock,
  Mail, KeyRound, Pencil, Trash2, Upload, PiggyBank, DollarSign, BarChart3
} from 'lucide-react';
import { cloudConfigured, supabase } from './lib/supabase';
import { newId, readLocal, writeLocal } from './lib/storage';

const START_ISO = '2026-11-02';
const WEEKS_TOTAL = 104;
const START_MS = Date.parse(`${START_ISO}T00:00:00Z`);
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const NAV_ITEMS = [
  { id: 'home', label: 'Accueil', icon: Home },
  { id: 'entries', label: 'Versements', icon: Receipt },
  { id: 'forecast', label: 'Prévisions', icon: BarChart3 },
  { id: 'projects', label: 'Mes projets', icon: Target },
  { id: 'calculator', label: 'Calculatrice', icon: Calculator },
  { id: 'bank', label: 'Compte bancaire', icon: Landmark },
  { id: 'settings', label: 'Réglages', icon: Settings }
];
const CATEGORIES = [
  { id: 'perso', label: 'Épargne personnelle', color: 'mint', icon: Wallet },
  { id: 'business', label: 'Business', color: 'violet', icon: Briefcase },
  { id: 'congo', label: 'Projets au Congo', color: 'orange', icon: Target }
];
const DEFAULT_GOALS = [
  { id: 'goal-parcelle', title: 'Acheter une parcelle', target: 12000, category: 'Immobilier', color: 'orange' },
  { id: 'goal-maison', title: 'Construire une maison', target: 25000, category: 'Immobilier', color: 'mint' },
  { id: 'goal-mariage', title: 'Mariage & dot', target: 8000, category: 'Personnel', color: 'pink' },
  { id: 'goal-business', title: 'Lancer un business', target: 5000, category: 'Business', color: 'violet' },
  { id: 'goal-reserve', title: 'Réserve de sécurité', target: 3000, category: 'Sécurité', color: 'blue' },
  { id: 'congo-1', title: 'Parcelle à Brazzaville', target: 12000, category: 'Congo · Immobilier', color: 'orange', indicativeDate: '2028-11' },
  { id: 'congo-2', title: 'Parcelle à Pointe-Noire', target: 9000, category: 'Congo · Immobilier', color: 'orange', indicativeDate: '2028-02' },
  { id: 'congo-3', title: 'Construction maison familiale', target: 25000, category: 'Congo · Habitat', color: 'mint', indicativeDate: '2031-03' },
  { id: 'congo-4', title: 'Raccordement eau & électricité', target: 2500, category: 'Congo · Habitat', color: 'blue', indicativeDate: '2027-04' },
  { id: 'congo-5', title: 'Boutique / activité commerciale', target: 5000, category: 'Congo · Business', color: 'violet', indicativeDate: '2028-01' },
  { id: 'congo-6', title: 'Moto pour activité', target: 1800, category: 'Congo · Mobilité', color: 'pink', indicativeDate: '2027-04' },
  { id: 'congo-7', title: 'Forage communautaire', target: 7000, category: 'Congo · Solidarité', color: 'blue', indicativeDate: '2028-09' },
  { id: 'congo-8', title: 'Études & formation', target: 3000, category: 'Congo · Formation', color: 'violet', indicativeDate: '2027-08' },
  { id: 'congo-9', title: 'Mariage & dot', target: 8000, category: 'Congo · Famille', color: 'pink', indicativeDate: '2028-05' },
  { id: 'congo-10', title: 'Transport de matériaux', target: 4500, category: 'Congo · Logistique', color: 'orange', indicativeDate: '2027-12' }
];

function isoDate(d) {
  const dt = new Date(d);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}
function dateForWeek(index) { return isoDate(new Date(START_MS + index * WEEK_MS)); }
function weekIndexForNow() { const now = new Date(); const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()); return Math.floor((today - START_MS) / WEEK_MS); }
function niceDate(date, options = { day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!date) return '—';
  const d = new Date(`${String(date).slice(0, 10)}T12:00:00`);
  return d.toLocaleDateString('fr-FR', options);
}
function money(n, compact = false) {
  const value = Number(n || 0);
  return new Intl.NumberFormat('fr-FR', compact ? { style: 'currency', currency: 'EUR', notation: 'compact', maximumFractionDigits: 1 } : { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);
}
function sumBy(arr, fn) { return arr.reduce((sum, item) => sum + Number(fn(item) || 0), 0); }
function blankData() { return { entries: [], snapshots: [], goals: DEFAULT_GOALS.map(g => ({ ...g, id: newId(), allocated: 0 })), deletedEntryIds: [], deletedSnapshotIds: [], deletedGoalIds: [], weeklyTarget: 100, reminderDay: 6 }; }
function mergeRows(remote = [], local = []) {
  const m = new Map(remote.map(r => [r.id, r]));
  local.forEach(r => {
    const previous = m.get(r.id);
    const stamp = row => Date.parse(row?.updated_at || row?.created_at || '') || 0;
    if (!previous || stamp(r) >= stamp(previous)) m.set(r.id, { ...previous, ...r });
  });
  return [...m.values()];
}
function mergeData(remote, local) {
  const base = remote || (local ? {} : blankData());
  const loc = local || {};
  const deletedEntryIds = [...new Set([...(base.deletedEntryIds || []), ...(loc.deletedEntryIds || [])])];
  const deletedSnapshotIds = [...new Set([...(base.deletedSnapshotIds || []), ...(loc.deletedSnapshotIds || [])])];
  const deletedGoalIds = [...new Set([...(base.deletedGoalIds || []), ...(loc.deletedGoalIds || [])])];
  return {
    ...blankData(), ...base, ...loc,
    entries: mergeRows(base.entries || [], loc.entries || []).filter(r => !deletedEntryIds.includes(r.id)),
    snapshots: mergeRows(base.snapshots || [], loc.snapshots || []).filter(r => !deletedSnapshotIds.includes(r.id)),
    goals: mergeRows(base.goals || [], loc.goals || []).filter(r => !deletedGoalIds.includes(r.id)),
    deletedEntryIds, deletedSnapshotIds, deletedGoalIds,
    weeklyTarget: Number(loc.weeklyTarget || base.weeklyTarget || 100),
    reminderDay: Number(loc.reminderDay ?? base.reminderDay ?? 6)
  };
}

async function pullCloud(userId) {
  if (!supabase || !navigator.onLine) return null;
  const [e, b, g] = await Promise.all([
    supabase.from('versements').select('*').eq('user_id', userId),
    supabase.from('soldes_bancaires').select('*').eq('user_id', userId),
    supabase.from('projets').select('*').eq('user_id', userId)
  ]);
  const error = e.error || b.error || g.error;
  if (error) throw error;
  return { entries: e.data || [], snapshots: b.data || [], goals: g.data || [] };
}
async function pushCloud(userId, data) {
  if (!supabase || !navigator.onLine) return;
  const deletes = [
    data.deletedEntryIds?.length ? supabase.from('versements').delete().eq('user_id', userId).in('id', data.deletedEntryIds) : Promise.resolve({ error: null }),
    data.deletedSnapshotIds?.length ? supabase.from('soldes_bancaires').delete().eq('user_id', userId).in('id', data.deletedSnapshotIds) : Promise.resolve({ error: null }),
    data.deletedGoalIds?.length ? supabase.from('projets').delete().eq('user_id', userId).in('id', data.deletedGoalIds) : Promise.resolve({ error: null })
  ];
  const deleteResults = await Promise.all(deletes);
  const deleteError = deleteResults.find(x => x.error)?.error;
  if (deleteError) throw deleteError;
  const records = [
    ['versements', data.entries || []], ['soldes_bancaires', data.snapshots || []], ['projets', data.goals || []]
  ];
  for (const [table, rows] of records) {
    if (!rows.length) continue;
    const payload = rows.map(row => ({ ...row, user_id: userId }));
    const { error } = await supabase.from(table).upsert(payload, { onConflict: 'id' });
    if (error) throw error;
  }
  if (data.deletedEntryIds?.length || data.deletedSnapshotIds?.length || data.deletedGoalIds?.length) {
    await writeLocal(userId, { ...data, deletedEntryIds: [], deletedSnapshotIds: [], deletedGoalIds: [] });
  }
}

function App() {
  const [session, setSession] = useState(null);
  const [localMode, setLocalMode] = useState(() => localStorage.getItem('kelasi-local-mode') === 'true');
  const userId = session?.user?.id || (localMode ? 'local-device' : null);
  const userEmail = session?.user?.email || (localMode ? 'Mode local · cet appareil' : '');
  const [authView, setAuthView] = useState('signin');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authNotice, setAuthNotice] = useState('');
  const [authError, setAuthError] = useState('');
  const [page, setPage] = useState('home');
  const [data, setData] = useState(blankData);
  const [loadingData, setLoadingData] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('kelasi-theme') || 'light');
  const [online, setOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState('local');
  const [toast, setToast] = useState('');
  const [installPrompt, setInstallPrompt] = useState(null);
  const [showInstallHelp, setShowInstallHelp] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [depositModal, setDepositModal] = useState(null);
  const [goalModal, setGoalModal] = useState(null);
  const [bankModal, setBankModal] = useState(false);
  const [forecastWeekly, setForecastWeekly] = useState(100);
  const [calcGoal, setCalcGoal] = useState('10000');
  const [calcSaved, setCalcSaved] = useState('0');
  const [calcWeekly, setCalcWeekly] = useState('100');
  const [calcView, setCalcView] = useState('weeks');
  const [showAllWeeks, setShowAllWeeks] = useState(false);
  const [importError, setImportError] = useState('');
  const cloudLoadRef = useRef('');

  const notify = useCallback((message) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 3200);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('kelasi-theme', theme);
  }, [theme]);
  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => { setOnline(false); setSyncStatus('pending'); };
    const onInstall = (event) => { event.preventDefault(); setInstallPrompt(event); };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    window.addEventListener('beforeinstallprompt', onInstall);
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); window.removeEventListener('beforeinstallprompt', onInstall); };
  }, []);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data: { session: s } }) => setSession(s));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s) { setLocalMode(false); localStorage.removeItem('kelasi-local-mode'); }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    async function init() {
      setLoadingData(true);
      setSyncStatus(cloudConfigured && session ? (online ? 'syncing' : 'pending') : 'local');
      try {
        const local = await readLocal(userId);
        let remote = null;
        if (cloudConfigured && session && navigator.onLine) {
          try { remote = await pullCloud(userId); } catch (err) { setSyncStatus('pending'); console.warn('KELASI: lecture cloud impossible', err); }
        }
        if (cancelled) return;
        let merged;
        if (remote) {
          merged = mergeData(remote, local);
          // Default projects are only added when both local and cloud data are genuinely empty.
          if (!remote.goals.length && !local?.goals?.length) merged.goals = DEFAULT_GOALS.map(g => ({ ...g, id: newId(), allocated: 0 }));
          await writeLocal(userId, merged);
        } else merged = mergeData(null, local);
        setData(merged);
        if (cloudConfigured && session && navigator.onLine && remote) {
          await pushCloud(userId, merged);
          setSyncStatus('synced');
        } else if (cloudConfigured && session && !navigator.onLine) setSyncStatus('pending');
        else setSyncStatus('local');
        cloudLoadRef.current = userId;
      } catch (err) {
        console.error(err);
        if (!cancelled) { setData(mergeData(null, await readLocal(userId))); setSyncStatus('pending'); }
      } finally { if (!cancelled) setLoadingData(false); }
    }
    init();
    return () => { cancelled = true; };
  }, [userId, session?.user?.id]);

  useEffect(() => {
    if (!userId || loadingData) return;
    const t = window.setTimeout(async () => {
      await writeLocal(userId, data);
      if (cloudConfigured && session) {
        if (!navigator.onLine) { setSyncStatus('pending'); return; }
        setSyncStatus('syncing');
        try {
          await pushCloud(userId, data);
          setSyncStatus('synced');
        } catch (err) {
          console.warn('KELASI: synchronisation en attente', err);
          setSyncStatus('pending');
        }
      } else setSyncStatus('local');
    }, 450);
    return () => window.clearTimeout(t);
  }, [data, userId, session, loadingData, online]);

  useEffect(() => {
    if (!userId || !online || !cloudConfigured || !session) return;
    const retry = () => {
      if (cloudLoadRef.current === userId) {
        setSyncStatus('syncing');
        pushCloud(userId, data).then(() => setSyncStatus('synced')).catch(() => setSyncStatus('pending'));
      }
    };
    window.addEventListener('online', retry);
    return () => window.removeEventListener('online', retry);
  }, [userId, online, cloudConfigured, session, data]);

  const updateData = useCallback((fn) => setData(current => fn(current)), []);
  const entries = data.entries || [];
  const snapshots = data.snapshots || [];
  const goals = data.goals || [];
  const totalSaved = sumBy(entries, e => e.amount);
  const persoTotal = sumBy(entries.filter(e => e.category === 'perso'), e => e.amount);
  const businessTotal = sumBy(entries.filter(e => e.category === 'business'), e => e.amount);
  const congoTotal = sumBy(entries.filter(e => e.category === 'congo'), e => e.amount);
  const lastSnapshot = [...snapshots].sort((a, b) => (b.captured_at || '').localeCompare(a.captured_at || ''))[0];
  const weeklyTarget = Math.max(100, Number(data.weeklyTarget || 100));
  const planTarget = weeklyTarget * WEEKS_TOTAL;
  const progressPct = Math.min(100, (totalSaved / (planTarget || 1)) * 100);
  const currentWeekIndex = weekIndexForNow();
  const weeks = useMemo(() => Array.from({ length: WEEKS_TOTAL }, (_, i) => ({
    index: i, date: dateForWeek(i), amount: sumBy(entries.filter(e => e.week_start === dateForWeek(i)), e => e.amount)
  })), [entries]);
  const completedWeeks = weeks.filter(w => w.amount >= 100).length;
  const pastMissed = weeks.filter(w => w.index < currentWeekIndex && w.amount < 100).length;
  const upcomingWeek = weeks.find(w => w.index === Math.max(0, Math.min(WEEKS_TOTAL - 1, currentWeekIndex)));
  const goalSum = sumBy(goals, g => g.target);
  const projectedTotal = totalSaved + Math.max(0, WEEKS_TOTAL - Math.max(0, Math.min(WEEKS_TOTAL, currentWeekIndex + 1))) * weeklyTarget;
  const projected = useMemo(() => Array.from({ length: 13 }, (_, i) => {
    const paidSoFar = totalSaved;
    const weeksAhead = i * 8;
    return { label: i === 0 ? 'Maintenant' : `S+${weeksAhead}`, amount: paidSoFar + weeksAhead * forecastWeekly };
  }), [totalSaved, forecastWeekly]);
  const maxChart = Math.max(...projected.map(p => p.amount), 1);
  const weeksNeeded = Math.max(0, Math.ceil((Number(calcGoal || 0) - Number(calcSaved || 0)) / Math.max(1, Number(calcWeekly || 1))));
  const targetDate = new Date(Date.now() + weeksNeeded * WEEK_MS);
  const currencyInput = v => Number(String(v).replace(',', '.'));

  const submitAuth = async (e) => {
    e.preventDefault(); setAuthError(''); setAuthNotice('');
    if (!cloudConfigured || !supabase) { setAuthError('Configure Supabase dans le fichier .env avant de créer un compte. Le mode local est disponible pour tester cette version.'); return; }
    if (!authEmail.trim() || authPassword.length < 8) { setAuthError('Saisis ton e-mail et un mot de passe de 8 caractères minimum.'); return; }
    setAuthBusy(true);
    try {
      if (authView === 'signup') {
        const { data: result, error } = await supabase.auth.signUp({ email: authEmail.trim(), password: authPassword });
        if (error) throw error;
        if (result.session) setSession(result.session);
        else setAuthNotice('Compte créé. Vérifie ton e-mail pour confirmer ton inscription, puis connecte-toi.');
      } else {
        const { data: result, error } = await supabase.auth.signInWithPassword({ email: authEmail.trim(), password: authPassword });
        if (error) throw error;
        setSession(result.session);
      }
    } catch (err) {
      const message = err?.message || '';
      setAuthError(message.toLowerCase().includes('email not confirmed') || message.toLowerCase().includes('not confirmed')
        ? "Ton e-mail n'est pas encore confirmé. Pour un usage personnel, désactive « Confirm email » dans Supabase → Auth → Providers → Email, ou confirme le lien reçu avant de te connecter."
        : (message || 'Connexion impossible. Vérifie tes identifiants et ta connexion.'));
    }
    finally { setAuthBusy(false); }
  };
  const continueLocal = () => {
    setLocalMode(true); localStorage.setItem('kelasi-local-mode', 'true'); setAuthError(''); setAuthNotice('Mode local activé : les données resteront sur cet appareil. Configure Supabase pour les synchroniser.');
  };
  const exitLocalMode = () => {
    // Les données sont déjà persistées sous local-device : on ne les efface pas.
    localStorage.removeItem('kelasi-local-mode');
    setLocalMode(false);
    setPage('home');
    setAuthView('signin');
    setAuthNotice('Tes données locales sont conservées sur cet appareil. Connecte-toi pour utiliser Supabase.');
  };
  const logout = async () => {
    if (supabase && session) await supabase.auth.signOut();
    setSession(null); setLocalMode(false); localStorage.removeItem('kelasi-local-mode'); setPage('home'); setData(blankData());
  };
  const saveEntry = (entry) => {
    if (Number(entry.amount) < 100 || !Number.isFinite(Number(entry.amount))) { notify('Le montant minimum est de 100 €.'); return; }
    updateData(d => ({ ...d, entries: entry.id ? d.entries.map(e => e.id === entry.id ? { ...e, ...entry, updated_at: new Date().toISOString() } : e) : [...d.entries, { ...entry, id: newId(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() }] }));
    setDepositModal(null); notify(entry.id ? 'Versement modifié.' : 'Versement enregistré sur cet appareil.');
  };
  const deleteEntry = (entry) => {
    if (!window.confirm(`Supprimer le versement de ${money(entry.amount)} du ${niceDate(entry.week_start)} ?`)) return;
    updateData(d => ({ ...d, entries: d.entries.filter(e => e.id !== entry.id), deletedEntryIds: [...new Set([...(d.deletedEntryIds || []), entry.id])] }));
    notify('Versement supprimé.');
  };
  const saveBankSnapshot = (snap) => {
    updateData(d => ({ ...d, snapshots: [...d.snapshots, { ...snap, id: newId(), created_at: new Date().toISOString() }] }));
    setBankModal(false); notify('Solde bancaire enregistré.');
  };
  const deleteSnapshot = (snap) => {
    updateData(d => ({ ...d, snapshots: d.snapshots.filter(x => x.id !== snap.id), deletedSnapshotIds: [...new Set([...(d.deletedSnapshotIds || []), snap.id])] }));
    notify('Relevé de solde supprimé.');
  };
  const saveGoal = (goal) => {
    updateData(d => ({ ...d, goals: goal.id ? d.goals.map(g => g.id === goal.id ? { ...g, ...goal, updated_at: new Date().toISOString() } : g) : [...d.goals, { ...goal, id: newId(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() }] }));
    setGoalModal(null); notify(goal.id ? 'Objectif modifié.' : 'Objectif ajouté.');
  };
  const deleteGoal = (goal) => {
    if (!window.confirm(`Supprimer l'objectif « ${goal.title} » ?`)) return;
    updateData(d => ({ ...d, goals: d.goals.filter(g => g.id !== goal.id), deletedGoalIds: [...new Set([...(d.deletedGoalIds || []), goal.id])] }));
  };
  const exportData = () => {
    const content = JSON.stringify({ exportedAt: new Date().toISOString(), app: 'KELASI', ...data }, null, 2);
    const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = `kelasi-sauvegarde-${isoDate(new Date())}.json`; a.click(); URL.revokeObjectURL(url);
    notify('Sauvegarde JSON exportée.');
  };
  const exportCsv = () => {
    const rows = [['semaine','montant_eur','categorie','note'], ...entries.map(e => [e.week_start, e.amount, e.category, (e.note || '').replaceAll('"','""')])];
    const csv = '\ufeff' + rows.map(r => r.map(x => `"${String(x ?? '').replaceAll('"','""')}"`).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = `kelasi-versements-${isoDate(new Date())}.csv`; a.click(); URL.revokeObjectURL(url);
    notify('Export CSV prêt.');
  };
  const importJson = async (file) => {
    setImportError('');
    try {
      const parsed = JSON.parse(await file.text());
      if (!Array.isArray(parsed.entries)) throw new Error('Le fichier ne contient pas de liste de versements KELASI valide.');
      const safeEntries = parsed.entries.filter(e => e && typeof e.id === 'string' && Number(e.amount) >= 100 && ['perso','business','congo'].includes(e.category) && /^\d{4}-\d{2}-\d{2}$/.test(e.week_start));
      updateData(d => ({ ...d, entries: mergeRows(d.entries, safeEntries), snapshots: mergeRows(d.snapshots, Array.isArray(parsed.snapshots) ? parsed.snapshots : []), goals: mergeRows(d.goals, Array.isArray(parsed.goals) ? parsed.goals : []) }));
      notify(`${safeEntries.length} versement(s) importé(s).`);
    } catch (err) { setImportError(err.message || 'Import impossible.'); }
  };
  const triggerInstall = async () => {
    if (!installPrompt) { setShowInstallHelp(v => !v); return; }
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };
  const requestNotification = async () => {
    if (!('Notification' in window)) { notify('Les notifications ne sont pas prises en charge par ce navigateur.'); return; }
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      notify('Rappel activé pour les ouvertures de KELASI le jour choisi.');
      if (currentWeekIndex >= 0 && currentWeekIndex < WEEKS_TOTAL && !entries.some(e => e.week_start === dateForWeek(currentWeekIndex))) {
        new Notification('KELASI — Ton épargne', { body: 'Pense à enregistrer ton versement hebdomadaire.' });
      }
    } else notify('Autorisation de notification refusée dans le navigateur.');
  };

  useEffect(() => {
    if (!userId || !('Notification' in window) || Notification.permission !== 'granted') return;
    if (currentWeekIndex < 0 || currentWeekIndex >= WEEKS_TOTAL) return;
    const day = new Date().getDay();
    const reminderDayJs = Number(data.reminderDay ?? 6);
    if (day === reminderDayJs && !entries.some(e => e.week_start === dateForWeek(currentWeekIndex))) {
      const key = `kelasi-reminder-${userId}-${dateForWeek(currentWeekIndex)}`;
      if (!localStorage.getItem(key)) {
        new Notification('KELASI — Ton épargne', { body: 'Ta case de la semaine est encore vide. Ajoute ton versement de 100 € minimum.' });
        localStorage.setItem(key, 'shown');
      }
    }
  }, [userId, data.reminderDay, entries.length, currentWeekIndex]);

  if (!userId) {
    return <AuthScreen
      authView={authView} setAuthView={setAuthView} authEmail={authEmail} setAuthEmail={setAuthEmail}
      authPassword={authPassword} setAuthPassword={setAuthPassword} showPassword={showPassword}
      setShowPassword={setShowPassword} submitAuth={submitAuth} authBusy={authBusy} authNotice={authNotice}
      authError={authError} continueLocal={continueLocal} cloudConfigured={cloudConfigured}
    />;
  }

  return (
    <div className={`app-shell ${menuOpen ? 'menu-open' : ''}`}>
      <aside className="sidebar">
        <div className="brand"><div className="brand-icon"><img src="/icons/kelasi-512.png" alt="" /></div><div><span className="brand-name">KELASI</span><span className="brand-sub">MON ÉPARGNE, MES PROJETS</span></div><button className="mobile-close icon-button" aria-label="Fermer le menu" onClick={() => setMenuOpen(false)}><X size={18}/></button></div>
        <div className="workspace-label">ESPACE PERSONNEL</div>
        <nav className="nav-list" aria-label="Navigation principale">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            return <button key={item.id} className={`nav-item ${page === item.id ? 'active' : ''}`} onClick={() => { setPage(item.id); setMenuOpen(false); }}><Icon size={19}/><span>{item.label}</span>{item.id === 'entries' && entries.length > 0 && <span className="nav-count">{entries.length}</span>}</button>;
          })}
        </nav>
        <div className="sidebar-spacer" />
        <div className="sidebar-goal-card">
          <div className="goal-card-top"><span className="mini-spark"><Sparkles size={15}/></span><span>CAP SUR 2 ANS</span></div>
          <div className="goal-card-value">{money(planTarget)}</div>
          <p>Ton prochain chapitre commence avec une semaine à la fois.</p>
          <div className="progress-track"><span style={{ width: `${progressPct}%` }} /></div>
          <div className="goal-card-foot"><span>{progressPct.toFixed(0)} % atteint</span><span>Nov. 2028</span></div>
        </div>
        <button className="profile-row" onClick={() => setPage('settings')}><div className="avatar">{userEmail.charAt(0).toUpperCase() || 'K'}</div><div className="profile-info"><strong>{session?.user?.email?.split('@')[0] || 'Mon espace'}</strong><span>{localMode ? 'Stockage local' : 'Compte synchronisé'}</span></div><MoreHorizontal size={18}/></button>
      </aside>
      {menuOpen && <button className="menu-scrim" aria-label="Fermer le menu" onClick={() => setMenuOpen(false)} />}
      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left"><button className="icon-button mobile-menu" aria-label="Ouvrir le menu" onClick={() => setMenuOpen(true)}><Menu size={21}/></button><div className="breadcrumb"><span>Mon espace</span><ChevronRight size={14}/><strong>{NAV_ITEMS.find(n => n.id === page)?.label || 'Accueil'}</strong></div></div>
          <div className="topbar-actions">{localMode && <button className="btn-local-exit" onClick={exitLocalMode}><LogOut size={15}/> Quitter le mode local / Se connecter</button>}<div className={`connection-pill ${online ? 'is-online' : 'is-offline'}`}><span className="status-dot"/>{online ? 'En ligne' : 'Hors ligne'}</div><button className="theme-toggle icon-button" title={theme === 'light' ? 'Activer le mode sombre' : 'Activer le mode clair'} onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>{theme === 'light' ? <Moon size={18}/> : <Sun size={18}/>}</button><button className="top-avatar" title="Réglages" onClick={() => setPage('settings')}>{userEmail.charAt(0).toUpperCase() || 'K'}</button></div>
        </header>
        {localMode && <div className="local-warning"><Laptop size={16}/><span><strong>Mode local actif.</strong> Les données restent sur cet appareil. Configure Supabase pour les synchroniser entre ton téléphone et ta tablette.</span><button onClick={exitLocalMode}>Quitter le mode local / Se connecter</button></div>}
        {cloudConfigured && session && <div className={`sync-banner sync-${syncStatus}`}><span className="sync-symbol">{syncStatus === 'synced' ? <CheckCircle2 size={15}/> : syncStatus === 'syncing' ? <RefreshCw size={15} className="spin"/> : <CloudOff size={15}/>}</span><span>{syncStatus === 'synced' ? 'Données synchronisées' : syncStatus === 'syncing' ? 'Synchronisation…' : 'Modifications conservées localement, synchronisation en attente'}</span></div>}
        <div className="page-content">
          {loadingData ? <div className="loading-state"><div className="loader"/><span>Ouverture de ton espace…</span></div> : <>
            {page === 'home' && <Dashboard data={data} entries={entries} weeks={weeks} completedWeeks={completedWeeks} missedWeeks={pastMissed} currentWeekIndex={currentWeekIndex} totalSaved={totalSaved} persoTotal={persoTotal} businessTotal={businessTotal} congoTotal={congoTotal} planTarget={planTarget} progressPct={progressPct} projectedTotal={projectedTotal} weeklyTarget={weeklyTarget} lastSnapshot={lastSnapshot} onAdd={() => setDepositModal({ week_start: upcomingWeek?.date || START_ISO })} onPage={setPage} onInstall={triggerInstall} showInstallHelp={showInstallHelp} />}
            {page === 'entries' && <EntriesPage entries={entries} weeks={weeks} onAdd={() => setDepositModal({ week_start: dateForWeek(Math.max(0, Math.min(103, currentWeekIndex))) })} onEdit={e => setDepositModal(e)} onDelete={deleteEntry} exportCsv={exportCsv} />}
            {page === 'forecast' && <ForecastPage totalSaved={totalSaved} weeklyTarget={weeklyTarget} forecastWeekly={forecastWeekly} setForecastWeekly={setForecastWeekly} planTarget={planTarget} progressPct={progressPct} weeks={weeks} entries={entries} projected={projected} maxChart={maxChart} />}
            {page === 'projects' && <ProjectsPage goals={goals} totalSaved={totalSaved} congoTotal={congoTotal} businessTotal={businessTotal} onAdd={() => setGoalModal({})} onEdit={g => setGoalModal(g)} onDelete={deleteGoal} />}
            {page === 'calculator' && <CalculatorPage calcGoal={calcGoal} setCalcGoal={setCalcGoal} calcSaved={calcSaved} setCalcSaved={setCalcSaved} calcWeekly={calcWeekly} setCalcWeekly={setCalcWeekly} calcView={calcView} setCalcView={setCalcView} weeksNeeded={weeksNeeded} targetDate={targetDate} totalSaved={totalSaved} weeklyTarget={weeklyTarget} />}
            {page === 'bank' && <BankPage lastSnapshot={lastSnapshot} snapshots={snapshots} totalSaved={totalSaved} persoTotal={persoTotal} businessTotal={businessTotal} congoTotal={congoTotal} onAdd={() => setBankModal(true)} onDelete={deleteSnapshot} onImport={importJson} importError={importError} />}
            {page === 'settings' && <SettingsPage theme={theme} setTheme={setTheme} data={data} updateData={updateData} userEmail={userEmail} localMode={localMode} online={online} syncStatus={syncStatus} exportData={exportData} exportCsv={exportCsv} onImport={importJson} importError={importError} onNotify={requestNotification} onLogout={logout} onExitLocal={exitLocalMode} onInstall={triggerInstall} showInstallHelp={showInstallHelp} installPrompt={installPrompt} onReset={() => { if (window.confirm('Effacer toutes les données locales KELASI ?')) { setData(blankData()); notify('Données locales réinitialisées.'); } }} />}
          </>}
        </div>
        <footer className="app-footer"><span>© 2026 KELASI</span><span><ShieldCheck size={13}/> Tes projets, à ton rythme.</span><button onClick={() => setPage('settings')}>Confidentialité & données</button></footer>
      </main>
      <nav className="mobile-bottom-nav" aria-label="Navigation mobile">
        {[NAV_ITEMS[0], NAV_ITEMS[1], NAV_ITEMS[3], NAV_ITEMS[5], NAV_ITEMS[6]].map(item => { const Icon = item.icon; return <button key={item.id} className={page === item.id ? 'selected' : ''} onClick={() => setPage(item.id)}><Icon size={19}/><span>{item.id === 'projects' ? 'Projets' : item.id === 'bank' ? 'Banque' : item.label}</span></button>; })}
      </nav>
      {depositModal && <DepositModal entry={depositModal} onClose={() => setDepositModal(null)} onSave={saveEntry} />}
      {goalModal && <GoalModal goal={goalModal} onClose={() => setGoalModal(null)} onSave={saveGoal} />}
      {bankModal && <BankModal onClose={() => setBankModal(false)} onSave={saveBankSnapshot} />}
      {toast && <div className="toast"><CheckCircle2 size={17}/>{toast}</div>}
    </div>
  );
}

function AuthScreen(props) {
  const { authView, setAuthView, authEmail, setAuthEmail, authPassword, setAuthPassword, showPassword, setShowPassword, submitAuth, authBusy, authNotice, authError, continueLocal, cloudConfigured } = props;
  return <div className="auth-screen">
    <div className="auth-art"><div className="auth-art-orb orb-one"/><div className="auth-art-orb orb-two"/><div className="auth-art-content"><div className="brand auth-brand"><div className="brand-icon"><img src="/icons/kelasi-512.png" alt=""/></div><div><span className="brand-name">KELASI</span><span className="brand-sub">MON ÉPARGNE, MES PROJETS</span></div></div><div className="auth-hero-copy"><div className="eyebrow light-eyebrow"><Sparkles size={14}/> TON FUTUR SE CONSTRUIT MAINTENANT</div><h1>Les grands projets commencent par de <em>petits pas.</em></h1><p>Un versement après l'autre, transforme ta discipline en liberté et tes idées en projets concrets.</p><div className="auth-illustration"><div className="illus-circle"><TrendingUp size={58}/></div><div className="illus-card illus-one"><span className="illus-label">CAPITAL CIBLE</span><strong>10 400 €</strong><small>sur 2 ans minimum</small></div><div className="illus-card illus-two"><span className="illus-check"><Check size={14}/></span><div><strong>Cette semaine</strong><small>100 € · objectif de base</small></div></div><div className="illus-dots">✦ &nbsp; · &nbsp; ✦</div></div></div><div className="auth-quote">« La constance fait grandir ce que l'ambition commence. »</div></div></div>
    <div className="auth-panel"><div className="auth-panel-inner"><div className="auth-mobile-brand"><img src="/icons/kelasi-512.png" alt=""/> KELASI</div><div className="auth-heading"><span className="auth-overline">BIENVENUE DANS TON ESPACE</span><h2>{authView === 'signup' ? 'Crée ton espace' : 'Content de te revoir'}</h2><p>{authView === 'signup' ? 'Commence à organiser ton avenir financier.' : 'Connecte-toi pour retrouver tes objectifs.'}</p></div><div className="auth-tabs"><button className={authView === 'signin' ? 'active' : ''} onClick={() => setAuthView('signin')}>Connexion</button><button className={authView === 'signup' ? 'active' : ''} onClick={() => setAuthView('signup')}>Créer un compte</button></div><form className="auth-form" onSubmit={submitAuth}><label>Adresse e-mail<div className="field-with-icon"><Mail size={17}/><input type="email" autoComplete="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} placeholder="toi@exemple.com" required/></div></label><label>Mot de passe<div className="field-with-icon"><KeyRound size={17}/><input type={showPassword ? 'text' : 'password'} autoComplete={authView === 'signup' ? 'new-password' : 'current-password'} value={authPassword} onChange={e => setAuthPassword(e.target.value)} placeholder="8 caractères minimum" minLength={8} required/><button type="button" className="field-end-button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Masquer' : 'Afficher'}>{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></div></label>{authError && <div className="auth-error">{authError}</div>}{authNotice && <div className="auth-notice">{authNotice}</div>}<button className="btn-primary auth-submit" disabled={authBusy}>{authBusy ? <RefreshCw size={17} className="spin"/> : <Lock size={17}/>} {authView === 'signup' ? 'Créer mon compte' : 'Me connecter'}<ArrowRight size={17}/></button></form><div className="auth-security"><ShieldCheck size={17}/><span>Tes versements sont privés. Le mot de passe bancaire n'est jamais demandé.</span></div><div className="local-access"><div className="local-access-line"><span></span>OU POUR DÉCOUVRIR L'APPLICATION<span></span></div><button onClick={continueLocal} className="btn-secondary"><Smartphone size={17}/> Continuer en mode local</button><p>Pour tester sans configurer de compte. Les données ne seront pas partagées entre appareils.</p></div><div className="auth-foot">KELASI · Planifie aujourd'hui, construis demain.</div></div></div>
  </div>;
}

function PageHeader({ eyebrow, title, description, action, actionLabel, actionIcon: ActionIcon = Plus }) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action && <button className="btn-primary" onClick={action}><ActionIcon size={17}/>{actionLabel}</button>}</div>;
}
function StatCard({ label, value, note, icon: Icon, tone = 'mint', change }) {
  return <div className="stat-card"><div className={`stat-icon ${tone}`}><Icon size={20}/></div><div className="stat-label">{label}</div><div className="stat-value">{value}</div><div className="stat-note">{change && <span className="stat-change"><ArrowUpRight size={13}/>{change}</span>}{note}</div></div>;
}
function Dashboard({ data, entries, weeks, completedWeeks, missedWeeks, currentWeekIndex, totalSaved, persoTotal, businessTotal, congoTotal, planTarget, progressPct, projectedTotal, weeklyTarget, lastSnapshot, onAdd, onPage, onInstall, showInstallHelp }) {
  const thisIdx = currentWeekIndex < 0 ? 0 : Math.min(WEEKS_TOTAL - 1, currentWeekIndex);
  const thisWeek = weeks[thisIdx];
  const alreadyThisWeek = thisWeek?.amount >= 100;
  const nextUp = weeks.slice(Math.max(0, thisIdx - 2), Math.min(WEEKS_TOTAL, thisIdx + 6));
  const firstName = 'à toi';
  const categorySummary = [{ label: 'Personnel', value: persoTotal, color: 'mint', icon: Wallet }, { label: 'Business', value: businessTotal, color: 'violet', icon: Briefcase }, { label: 'Projets Congo', value: congoTotal, color: 'orange', icon: Target }];
  return <>
    <div className="welcome-row"><div><div className="eyebrow"><span className="live-dot"/> TON TABLEAU DE BORD</div><h1>Chaque semaine te rapproche <span>de tes rêves.</span></h1><p>Bonjour {firstName} 👋 Voici comment avance ton avenir financier.</p></div><div className="welcome-date"><CalendarDays size={16}/><span>{new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span></div></div>
    <section className="hero-grid">
      <div className="balance-hero"><div className="hero-topline"><div><span className="hero-overline">CAPITAL ÉPARGNÉ AU TOTAL</span><div className="hero-amount">{money(totalSaved)}</div></div><div className="hero-symbol"><PiggyBank size={25}/></div></div><div className="hero-subline"><span><span className="hero-status-dot"/> {entries.length} versement{entries.length > 1 ? 's' : ''} enregistré{entries.length > 1 ? 's' : ''}</span><span>{money(weeklyTarget)} / semaine visés</span></div><div className="hero-progress-title"><span>Progression vers ton objectif</span><strong>{progressPct.toFixed(1)} %</strong></div><div className="hero-progress"><span style={{ width: `${progressPct}%` }}/></div><div className="hero-progress-bottom"><span>{money(totalSaved)} épargnés</span><span>Objectif : {money(planTarget)}</span></div><button className="hero-add-btn" onClick={onAdd}><Plus size={18}/> Enregistrer mon versement <ArrowRight size={17}/></button><div className="hero-decoration decor-a"/><div className="hero-decoration decor-b"/></div>
      <div className="weekly-card"><div className="weekly-card-header"><div><div className="eyebrow">MON RYTHME</div><h3>La semaine en cours</h3></div><div className={`weekly-badge ${alreadyThisWeek ? 'done' : 'todo'}`}>{alreadyThisWeek ? <Check size={13}/> : <Zap size={13}/>} {alreadyThisWeek ? 'Validée' : currentWeekIndex < 0 ? 'Bientôt' : 'À faire'}</div></div><div className="weekly-amount">{money(thisWeek?.amount || 0)}<small> / {money(weeklyTarget)}</small></div><div className="weekly-meter"><span style={{ width: `${Math.min(100, ((thisWeek?.amount || 0) / weeklyTarget) * 100)}%` }}/></div><div className="weekly-dates"><CalendarCheck size={15}/><span>{niceDate(thisWeek?.date)} · {currentWeekIndex < 0 ? 'Début du plan' : 'Semaine de suivi'}</span></div><button className="btn-secondary full-width" onClick={onAdd}>{alreadyThisWeek ? 'Ajouter un versement' : 'Pointer ma semaine'}<ArrowRight size={16}/></button><div className="weekly-divider"/><div className="weekly-mini-stats"><div><strong>{completedWeeks}<span>/104</span></strong><small>Semaines validées</small></div><div><strong>{missedWeeks}</strong><small>Semaines manquées</small></div><div><strong>{completedWeeks ? Math.round(completedWeeks / WEEKS_TOTAL * 100) : 0}%</strong><small>Régularité</small></div></div></div>
    </section>
    <section className="stats-grid"><StatCard label="Épargne personnelle" value={money(persoTotal)} note="Pour toi & ta famille" icon={Wallet} tone="mint"/><StatCard label="Capital business" value={money(businessTotal)} note="Investissements & activités" icon={Briefcase} tone="violet"/><StatCard label="Projets au Congo" value={money(congoTotal)} note="Parcelle, maison, mariage…" icon={Target} tone="orange"/><StatCard label="Solde bancaire déclaré" value={lastSnapshot ? money(lastSnapshot.balance) : '—'} note={lastSnapshot ? `Mis à jour le ${niceDate(lastSnapshot.captured_at)}` : 'À renseigner manuellement'} icon={Landmark} tone="blue"/></section>
    <section className="dashboard-lower"><div className="panel checkin-panel"><div className="panel-heading"><div><div className="eyebrow">TA RÉGULARITÉ</div><h2>Carte de pointage</h2><p>104 semaines pour construire ton capital.</p></div><button className="text-link" onClick={() => onPage('entries')}>Voir le détail <ArrowRight size={14}/></button></div><div className="checkin-legend"><span><i className="legend-dot completed"/> Validée</span><span><i className="legend-dot missed"/> À rattraper</span><span><i className="legend-dot future"/> À venir</span></div><div className="checkin-grid">{weeks.map(w => <button key={w.index} className={`checkin-cell ${w.amount >= 100 ? 'complete' : w.index < currentWeekIndex ? 'missed' : w.index === currentWeekIndex ? 'current' : 'future'}`} title={`Semaine ${w.index + 1} · ${niceDate(w.date)} · ${money(w.amount)}`} onClick={() => onPage('entries')}>{w.amount >= 100 ? <Check size={12}/> : String(w.index + 1).padStart(2, '0')}</button>)}</div><div className="checkin-footer"><span><strong>{completedWeeks}</strong> / 104 semaines validées</span><span>Du 2 nov. 2026 au 30 oct. 2028</span></div></div>
      <div className="panel breakdown-panel"><div className="panel-heading"><div><div className="eyebrow">OÙ VA TON ÉPARGNE ?</div><h2>Répartition du capital</h2><p>Par catégorie de versement.</p></div><div className="breakdown-ring" style={{ '--p': `${totalSaved ? (persoTotal / totalSaved) * 100 : 0}%` }}><div><strong>{money(totalSaved, true)}</strong><small>total</small></div></div></div><div className="breakdown-list">{categorySummary.map(item => { const Icon = item.icon; const pct = totalSaved ? item.value / totalSaved * 100 : 0; return <div className="breakdown-item" key={item.label}><div className={`breakdown-item-icon ${item.color}`}><Icon size={16}/></div><div className="breakdown-item-main"><div><strong>{item.label}</strong><span>{pct.toFixed(0)}%</span></div><div className="thin-progress"><span className={item.color} style={{ width: `${pct}%` }}/></div></div><strong className="breakdown-amount">{money(item.value)}</strong></div>; })}</div><button className="panel-foot-link" onClick={() => onPage('forecast')}>Explorer mes prévisions <ArrowRight size={15}/></button></div></section>
    <section className="bottom-promo-row"><div className="next-milestone"><div className="milestone-icon"><Target size={22}/></div><div className="milestone-text"><strong>Ton prochain grand cap</strong><span>{totalSaved >= 5000 ? 'Tu as franchi les 5 000 € : bravo !' : `Encore ${money(Math.max(0, 5000 - totalSaved))} pour atteindre les 5 000 €.`}</span></div><button className="icon-button" onClick={() => onPage('calculator')} aria-label="Calculer un objectif"><ArrowRight size={18}/></button></div><div className="install-promo"><div className="install-promo-icon"><Smartphone size={21}/></div><div><strong>Emporte KELASI partout</strong><span>Installe l'application sur ton téléphone ou ta tablette.</span></div><button className="btn-outline" onClick={onInstall}>Installer <Download size={15}/></button></div></section>
    {showInstallHelp && <div className="install-help"><strong>Installer KELASI</strong><span>Android : menu ⋮ du navigateur → Installer l'application. iPhone/iPad : bouton Partager → Sur l'écran d'accueil.</span></div>}
  </>;
}

function EntriesPage({ entries, weeks, onAdd, onEdit, onDelete, exportCsv }) {
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('new');
  const filtered = [...entries].filter(e => filter === 'all' || e.category === filter).sort((a,b) => sort === 'new' ? (b.week_start || '').localeCompare(a.week_start || '') : (a.week_start || '').localeCompare(b.week_start || ''));
  return <><PageHeader eyebrow="SUIVI HEBDOMADAIRE" title="Mes versements" description="Chaque versement compte. Garde une trace claire de chaque étape." action={onAdd} actionLabel="Ajouter un versement"/><div className="entries-summary"><div><span className="summary-overline">VERSEMENTS ENREGISTRÉS</span><strong>{entries.length}</strong><span className="summary-caption">opérations au total</span></div><div><span className="summary-overline">CAPITAL CUMULÉ</span><strong>{money(sumBy(entries,e=>e.amount))}</strong><span className="summary-caption">tous projets confondus</span></div><div><span className="summary-overline">MEILLEUR VERSEMENT</span><strong>{money(Math.max(0,...entries.map(e=>Number(e.amount))))}</strong><span className="summary-caption">montant le plus élevé</span></div><button className="btn-secondary export-btn" onClick={exportCsv}><FileText size={17}/> Exporter CSV</button></div><div className="panel entries-panel"><div className="list-toolbar"><div className="segmented-tabs"><button className={filter==='all'?'selected':''} onClick={()=>setFilter('all')}>Tout ({entries.length})</button>{CATEGORIES.map(c=><button key={c.id} className={filter===c.id?'selected':''} onClick={()=>setFilter(c.id)}>{c.label.replace('Épargne ','').replace('Projets au ','')} ({entries.filter(e=>e.category===c.id).length})</button>)}</div><label className="sort-select">Trier <select value={sort} onChange={e=>setSort(e.target.value)}><option value="new">Plus récent</option><option value="old">Plus ancien</option></select><ChevronDown size={14}/></label></div>{filtered.length ? <div className="entry-list">{filtered.map(entry=>{const category=CATEGORIES.find(c=>c.id===entry.category)||CATEGORIES[0];const Icon=category.icon;return <div className="entry-row" key={entry.id}><div className={`entry-icon ${category.color}`}><Icon size={18}/></div><div className="entry-main"><strong>{category.label}</strong><span>Semaine du {niceDate(entry.week_start)}{entry.note ? ` · ${entry.note}` : ''}</span></div><div className="entry-right"><strong>{money(entry.amount)}</strong><span className="entry-confirmed"><CheckCircle2 size={13}/> Enregistré</span></div><div className="entry-actions"><button className="icon-button" aria-label="Modifier" onClick={()=>onEdit(entry)}><Pencil size={15}/></button><button className="icon-button danger" aria-label="Supprimer" onClick={()=>onDelete(entry)}><Trash2 size={15}/></button></div></div>})}</div> : <EmptyState icon={Receipt} title="Pas encore de versement" text="Ajoute ton premier versement de 100 € minimum pour lancer la série." action={onAdd} actionLabel="Ajouter un versement"/>}</div><div className="tip-banner"><div className="tip-icon"><HelpCircle size={18}/></div><div><strong>Petit rappel</strong><p>La carte de pointage considère une semaine validée lorsqu'au moins 100 € y sont enregistrés. Les données saisies hors ligne seront synchronisées au retour d'Internet si Supabase est configuré.</p></div></div></>;
}

function ForecastPage({ totalSaved, weeklyTarget, forecastWeekly, setForecastWeekly, planTarget, progressPct, weeks, entries, projected, maxChart }) {
  const options = [100,150,200,250,300];
  const nowIndex = Math.max(0, weekIndexForNow());
  const remainingSlots = weeks.filter(w => w.index >= nowIndex && w.amount < 100).length;
  const projectedAtEnd = totalSaved + remainingSlots * forecastWeekly;
  const breakpoints = [0,13,26,39,52,65,78,91,103].map(i => ({ i, date: dateForWeek(i), amount: totalSaved + i * forecastWeekly }));
  const chartMax = Math.max(projectedAtEnd, ...breakpoints.map(p => p.amount), 1);
  return <><PageHeader eyebrow="VISION À LONG TERME" title="Prévisions sur 2 ans" description="Simule plusieurs rythmes d'épargne et mesure l'effet de la régularité."/><div className="forecast-hero-grid"><div className="forecast-main-card"><div className="forecast-card-top"><div><span className="hero-overline">CAPITAL PROJETÉ AU 1ER NOVEMBRE 2028</span><strong>{money(projectedAtEnd)}</strong><span className="forecast-muted">Avec un versement de {money(forecastWeekly)} chaque semaine à venir.</span></div><div className="forecast-top-icon"><TrendingUp size={25}/></div></div><div className="forecast-comparison"><div><span>Déjà épargné</span><strong>{money(totalSaved)}</strong></div><div><span>À venir estimé</span><strong>{money(Math.max(0, projectedAtEnd-totalSaved))}</strong></div><div><span>Objectif initial</span><strong>{money(planTarget)}</strong></div></div></div><div className="panel forecast-control"><div className="eyebrow">SIMULATEUR HEBDOMADAIRE</div><h3>Combien veux-tu mettre de côté ?</h3><p>Choisis un scénario, le montant minimum est de 100 € par semaine.</p><div className="scenario-options">{options.map(v=><button key={v} className={forecastWeekly===v?'chosen':''} onClick={()=>setForecastWeekly(v)}>{money(v)}<small>/ sem.</small></button>)}</div><label className="range-label"><span>Montant personnalisé</span><strong>{money(forecastWeekly)} / semaine</strong></label><input className="range-input" type="range" min="100" max="500" step="25" value={forecastWeekly} onChange={e=>setForecastWeekly(Number(e.target.value))}/><div className="range-limits"><span>100 €</span><span>500 €</span></div><div className="scenario-result"><Sparkles size={16}/><span>À ce rythme, tu pourrais atteindre <strong>{money(forecastWeekly*104)}</strong> en 104 versements.</span></div></div></div>
    <div className="panel chart-panel"><div className="panel-heading"><div><div className="eyebrow">COURBE DE PROGRESSION</div><h2>Capital estimé dans le temps</h2><p>Simulation indicative, hors intérêts et frais.</p></div><div className="chart-legend"><i/> Capital projeté</div></div><div className="chart-area"><div className="chart-y-labels"><span>{money(chartMax)}</span><span>{money(chartMax*.75)}</span><span>{money(chartMax*.5)}</span><span>{money(chartMax*.25)}</span><span>0 €</span></div><div className="chart-content"><div className="chart-grid-lines"><i/><i/><i/><i/><i/></div><svg viewBox="0 0 760 250" preserveAspectRatio="none" role="img" aria-label="Courbe de capital projeté"><defs><linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity=".28"/><stop offset="100%" stopColor="#10b981" stopOpacity=".015"/></linearGradient></defs><path d={`M ${breakpoints.map((p,i)=>`${(i/(breakpoints.length-1))*760},${245-(p.amount/chartMax)*225}`).join(' L ')} L 760,250 L 0,250 Z`} fill="url(#chartFill)"/><polyline points={breakpoints.map((p,i)=>`${(i/(breakpoints.length-1))*760},${245-(p.amount/chartMax)*225}`).join(' ')} fill="none" stroke="#0e9f74" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>{breakpoints.map((p,i)=><circle key={i} cx={(i/(breakpoints.length-1))*760} cy={245-(p.amount/chartMax)*225} r="4" fill="#fff" stroke="#0e9f74" strokeWidth="3"/>)}</svg><div className="chart-x-labels"><span>Nov. 2026</span><span>Mai 2027</span><span>Nov. 2027</span><span>Mai 2028</span><span>Nov. 2028</span></div></div></div></div>
    <div className="forecast-bottom-grid"><div className="panel milestone-list-panel"><div className="panel-heading"><div><div className="eyebrow">ÉTAPES CLÉS</div><h2>Les caps à franchir</h2></div></div>{[1000,2500,5000,10000,20000].map(target=>{const done=totalSaved>=target;const left=Math.max(0,target-totalSaved);const weeksLeft=Math.ceil(left/Math.max(100,forecastWeekly));return <div className="milestone-row" key={target}><div className={`milestone-status ${done?'done':''}`}>{done?<Check size={14}/>:<Target size={14}/>}</div><div className="milestone-info"><strong>{money(target)}</strong><span>{done?'Objectif atteint':`Environ ${weeksLeft} semaine${weeksLeft>1?'s':''} au rythme choisi`}</span></div><div className="milestone-date">{done?'✓':niceDate(isoDate(new Date(Date.now()+weeksLeft*WEEK_MS)),{month:'short',year:'numeric'})}</div></div>})}</div><div className="panel scenario-table-panel"><div className="panel-heading"><div><div className="eyebrow">COMPARAISON</div><h2>Que peux-tu construire ?</h2></div></div><div className="scenario-table">{[100,150,200,250].map(amount=><div className={`scenario-line ${amount===forecastWeekly?'current':''}`} key={amount}><span>{money(amount)} / semaine</span><strong>{money(amount*104)}</strong><small>{amount===forecastWeekly?'Scénario sélectionné':`${amount*104<10000?'Moins de 10 000 €':'Capital potentiel'}`}</small></div>)}</div><p className="fine-print">Les résultats sont des projections mathématiques, non une garantie. Ils supposent 104 versements réguliers, sans intérêts, retraits, frais ou variation de change.</p></div></div>
  </>;
}

function ProjectsPage({ goals, totalSaved, congoTotal, businessTotal, onAdd, onEdit, onDelete }) {
  const [filter, setFilter] = useState('Tous');
  const categories = ['Tous', ...new Set(goals.map(g=>g.category))];
  const visible = goals.filter(g=>filter==='Tous'||g.category===filter);
  const colorClasses = ['mint','orange','violet','blue','pink'];
  const goalIcons = { 'Immobilier': Home, 'Personnel': Sparkles, 'Business': Briefcase, 'Sécurité': ShieldCheck, 'Formation': Laptop, 'Voyage': ArrowUpRight };
  return <><PageHeader eyebrow="DONNER UN SENS À TON CAPITAL" title="Mes projets" description="Définis tes grandes étapes, fixe un budget et suis leur progression." action={onAdd} actionLabel="Nouveau projet"/><div className="project-intro"><div className="project-intro-icon"><Target size={23}/></div><div><strong>Tu épargnes pour vivre tes projets, pas seulement pour voir un chiffre grandir.</strong><span>Les budgets affichés sont des exemples de départ : ajuste-les à tes devis, ta ville et tes priorités.</span></div><div className="project-intro-total"><span>Objectifs cumulés</span><strong>{money(sumBy(goals,g=>g.target))}</strong></div></div><div className="project-top-stats"><div className="project-stat"><span>Capital total KELASI</span><strong>{money(totalSaved)}</strong></div><div className="project-stat"><span>Réservé aux projets Congo</span><strong>{money(congoTotal)}</strong></div><div className="project-stat"><span>Nombre d'objectifs</span><strong>{goals.length}</strong></div></div><div className="project-filter-row"><div className="eyebrow">MES OBJECTIFS</div><div className="filter-pills">{categories.map(c=><button key={c} className={filter===c?'active':''} onClick={()=>setFilter(c)}>{c}</button>)}</div></div>{visible.length ? <div className="projects-grid">{visible.map((goal,i)=>{const Icon=goalIcons[goal.category]||Target;const allocated=Number(goal.allocated||0);const percent=Math.min(100,allocated/Math.max(1,goal.target)*100);const color=goal.color||colorClasses[i%colorClasses.length];return <article className="project-card" key={goal.id}><div className="project-card-top"><div className={`project-icon ${color}`}><Icon size={21}/></div><div className="project-card-menu"><button className="icon-button" aria-label="Modifier projet" onClick={()=>onEdit(goal)}><Pencil size={15}/></button><button className="icon-button danger" aria-label="Supprimer projet" onClick={()=>onDelete(goal)}><Trash2 size={15}/></button></div></div><span className="project-category">{goal.category}</span><h3>{goal.title}</h3><div className="project-target-row"><span>Budget cible</span><strong>{money(goal.target)}</strong></div><div className="project-progress"><span className={color} style={{width:`${percent}%`}}/></div><div className="project-progress-info"><span>{percent.toFixed(0)} %</span><span>{goal.indicativeDate ? `Atteinte indicative : ${goal.indicativeDate}` : `${money(Math.max(0,goal.target-allocated))} restants`}</span></div><div className="project-card-foot"><span className="project-foot-icon"><Activity size={14}/></span><span>Montant réservé spécifiquement à ce projet</span></div></article>})}<button className="project-add-card" onClick={onAdd}><span><Plus size={22}/></span><strong>Ajouter un projet</strong><small>Un nouvel objectif à construire.</small></button></div> : <EmptyState icon={Target} title="Aucun objectif dans cette catégorie" text="Ajoute un projet pour organiser tes prochaines étapes." action={onAdd} actionLabel="Créer un projet"/>}<div className="project-ideas"><div className="panel-heading"><div><div className="eyebrow">IDÉES À 32 ANS</div><h2>Des priorités qui bâtissent l'avenir</h2><p>Des pistes à ajuster à ta situation personnelle.</p></div></div><div className="ideas-grid"><div><span className="idea-number">01</span><strong>Actifs immobiliers</strong><p>Vérifier les titres fonciers avec un professionnel avant de payer une parcelle ou de commencer la construction.</p></div><div><span className="idea-number">02</span><strong>Revenus durables</strong><p>Réserver un capital pour tester un petit business, mesurer les coûts et éviter de tout investir dès le départ.</p></div><div><span className="idea-number">03</span><strong>Sécurité & famille</strong><p>Prévoir une réserve d'urgence séparée des budgets mariage, construction et projets professionnels.</p></div></div></div></>;
}

function CalculatorPage({ calcGoal, setCalcGoal, calcSaved, setCalcSaved, calcWeekly, setCalcWeekly, calcView, setCalcView, weeksNeeded, targetDate, totalSaved, weeklyTarget }) {
  const [projectCost, setProjectCost] = useState('15000');
  const [projectAlready, setProjectAlready] = useState('0');
  const [requiredWeeks, setRequiredWeeks] = useState('104');
  const [calcMode, setCalcMode] = useState('duration');
  const [usdRate, setUsdRate] = useState('1.09');
  const needPerWeek = Math.max(100, Math.ceil((Number(projectCost)-Number(projectAlready))/Math.max(1,Number(requiredWeeks))));
  const remaining = Math.max(0,Number(calcGoal)-Number(calcSaved));
  return <><PageHeader eyebrow="TES CHIFFRES, EN UN INSTANT" title="Calculatrice d'épargne" description="Calcule ton délai, ton versement hebdomadaire ou le budget d'un projet."/><div className="calculator-layout"><div className="panel calculator-panel"><div className="calculator-header"><div className="calculator-icon"><Calculator size={22}/></div><div><h2>Calculer un objectif</h2><p>Combien de temps pour atteindre ton capital ?</p></div></div><div className="calc-tabs"><button className={calcView==='weeks'?'selected':''} onClick={()=>setCalcView('weeks')}>Temps nécessaire</button><button className={calcView==='weekly'?'selected':''} onClick={()=>setCalcView('weekly')}>Montant requis</button></div>{calcView==='weeks'?<><label className="form-label">Objectif à atteindre (€)<input type="number" min="0" value={calcGoal} onChange={e=>setCalcGoal(e.target.value)} /></label><label className="form-label">Déjà épargné (€)<input type="number" min="0" value={calcSaved} onChange={e=>setCalcSaved(e.target.value)} /></label><label className="form-label">Versement hebdomadaire (€)<input type="number" min="100" step="25" value={calcWeekly} onChange={e=>setCalcWeekly(e.target.value)} onBlur={()=>setCalcWeekly(String(Math.max(100,Number(calcWeekly)||100)))}/><span className="field-hint">Le minimum KELASI est de 100 € / semaine.</span></label><div className="calc-result-card"><span className="calc-result-overline">RÉSULTAT ESTIMÉ</span><strong>{weeksNeeded} <small>semaine{weeksNeeded>1?'s':''}</small></strong><div className="calc-result-bottom"><span>Solde restant : {money(remaining)}</span><span>Date indicative : {niceDate(isoDate(targetDate),{day:'numeric',month:'short',year:'numeric'})}</span></div></div></>:<><label className="form-label">Capital visé (€)<input type="number" min="0" value={calcGoal} onChange={e=>setCalcGoal(e.target.value)}/></label><label className="form-label">Capital déjà disponible (€)<input type="number" min="0" value={calcSaved} onChange={e=>setCalcSaved(e.target.value)}/></label><label className="form-label">Horizon souhaité (semaines)<input type="number" min="1" value={requiredWeeks} onChange={e=>setRequiredWeeks(e.target.value)}/></label><div className="calc-result-card"><span className="calc-result-overline">VERSEMENT HEBDOMADAIRE REQUIS</span><strong>{money(Math.max(100,Math.ceil(remaining/Math.max(1,Number(requiredWeeks)))))}</strong><div className="calc-result-bottom"><span>Minimum : 100 € / semaine</span><span>Sur {requiredWeeks} semaine(s)</span></div></div></>}</div>
    <div className="panel calculator-panel project-calculator"><div className="calculator-header"><div className="calculator-icon orange"><DollarSign size={22}/></div><div><h2>Calculer un projet</h2><p>Parcelle, construction, mariage ou lancement d'activité.</p></div></div><div className="project-calc-modes">{[{id:'duration',label:'Combien de temps ?'},{id:'weekly',label:'Quel versement ?'}].map(m=><button key={m.id} className={calcMode===m.id?'active':''} onClick={()=>setCalcMode(m.id)}>{m.label}</button>)}</div><label className="form-label">Budget estimé du projet (€)<input type="number" min="0" value={projectCost} onChange={e=>setProjectCost(e.target.value)}/></label><label className="form-label">Épargne déjà dédiée (€)<input type="number" min="0" value={projectAlready} onChange={e=>setProjectAlready(e.target.value)}/></label>{calcMode==='duration'?<div className="form-label">Versement hebdomadaire<select value={calcWeekly} onChange={e=>setCalcWeekly(e.target.value)}><option value="100">100 € / semaine</option><option value="150">150 € / semaine</option><option value="200">200 € / semaine</option><option value="250">250 € / semaine</option><option value="300">300 € / semaine</option></select><span className="field-hint">Choisis un rythme que tu peux maintenir.</span></div>:<label className="form-label">Délai souhaité (semaines)<input type="number" min="1" value={requiredWeeks} onChange={e=>setRequiredWeeks(e.target.value)}/></label>}<div className="mini-result"><div className="mini-result-icon"><Target size={18}/></div><div><span>{calcMode==='duration'?'Tu atteindrais cet objectif en':'Pour respecter ce délai, vise au moins'}</span><strong>{calcMode==='duration'?`${Math.ceil(Math.max(0,Number(projectCost)-Number(projectAlready))/Math.max(100,Number(calcWeekly)||100))} semaines`:`${money(needPerWeek)} / semaine`}</strong><small>{calcMode==='duration'?`environ ${Math.ceil(Math.max(0,Number(projectCost)-Number(projectAlready))/Math.max(100,Number(calcWeekly)||100)/52*12)} mois`:'sans compter intérêts ni frais'}</small></div></div></div></div>
    <div className="panel currency-panel"><div className="calculator-header"><div className="calculator-icon"><DollarSign size={22}/></div><div><h2>Convertisseur</h2><p>Repères indicatifs, à ajuster avec le taux du jour.</p></div></div><label className="form-label">Montant en euros (€)<input type="number" min="0" defaultValue="100" onChange={e=>{const wrap=e.currentTarget.closest('.currency-panel'); const amount=Number(e.target.value||0); wrap.querySelector('.conversion-result').textContent = `${amount.toLocaleString('fr-FR')} € = ${(amount*655.957).toLocaleString('fr-FR',{maximumFractionDigits:0})} FCFA · ${(amount*Number(usdRate||0)).toFixed(2)} USD`;}} /></label><label className="form-label">Taux EUR → USD<input type="number" min="0" step="0.01" value={usdRate} onChange={e=>setUsdRate(e.target.value)} /></label><div className="conversion-result">100 € = 65 596 FCFA · 109,00 USD</div><p className="fine-print">Taux FCFA fixe affiché : 1 € = 655,957 FCFA. Le taux USD est modifiable selon le cours choisi.</p></div>
    <div className="calculator-tip"><Zap size={18}/><div><strong>Astuce KELASI</strong><span>Commence par un objectif prioritaire, garde une réserve d'urgence et revois les budgets lorsque tu obtiens des devis locaux fiables.</span></div></div></>;
}

function BankPage({ lastSnapshot, snapshots, totalSaved, persoTotal, businessTotal, congoTotal, onAdd, onDelete, onImport, importError }) {
  const gap = lastSnapshot ? Number(lastSnapshot.balance)-totalSaved : null;
  return <><PageHeader eyebrow="VUE FINANCIÈRE GLOBALE" title="Compte bancaire" description="Compare le solde déclaré de La Banque Postale avec ton suivi d'épargne personnel et business." action={onAdd} actionLabel="Actualiser le solde" actionIcon={RefreshCw}/><div className="bank-notice"><div className="bank-notice-icon"><ShieldCheck size={20}/></div><div><strong>Connexion bancaire non automatique</strong><p>KELASI ne se connecte pas directement à La Banque Postale. Saisis le solde que tu lis dans l'application officielle ; n'entre jamais tes identifiants bancaires ici.</p></div><a href="https://www.labanquepostale.fr/" target="_blank" rel="noreferrer" className="btn-secondary">Ouvrir La Banque Postale <ArrowUpRight size={15}/></a></div><div className="bank-top-grid"><div className="bank-balance-card"><div className="bank-card-top"><div className="bank-brand-line"><div className="bank-card-logo"><Landmark size={18}/></div><span>LA BANQUE POSTALE</span></div><span className="manual-badge"><span/> Saisie manuelle</span></div><div className="bank-balance-label">Dernier solde renseigné</div><div className="bank-balance-value">{lastSnapshot?money(lastSnapshot.balance):'À renseigner'}</div><div className="bank-card-bottom"><span>{lastSnapshot?`Mis à jour le ${niceDate(lastSnapshot.captured_at)}`:'Ajoute ton premier solde'}</span><button onClick={onAdd}><Plus size={15}/> Actualiser</button></div><div className="bank-card-watermark"><Landmark size={94}/></div></div><div className="bank-gap-card"><div className="bank-gap-icon"><Activity size={20}/></div><span className="summary-overline">ÉCART AVEC LE SUIVI KELASI</span><strong>{gap===null?'—':`${gap>0?'+':''}${money(gap)}`}</strong><p>{gap===null?'Renseigne un solde bancaire pour comparer.':gap>=0?'Le solde bancaire déclaré est supérieur au total suivi dans KELASI.':'Le total des versements KELASI dépasse le solde déclaré : vérifie les retraits et dépenses.'}</p><span className="gap-caveat">Cet écart n'est pas une anomalie automatique : KELASI n'enregistre pas tes autres revenus, retraits ni dépenses.</span></div></div><div className="bank-category-grid"><div className="bank-category-card"><div className="bank-category-top"><Wallet size={18}/><span>Personnel</span></div><strong>{money(persoTotal)}</strong><small>Versements classés personnels</small></div><div className="bank-category-card"><div className="bank-category-top violet-text"><Briefcase size={18}/><span>Business</span></div><strong>{money(businessTotal)}</strong><small>Capital classé business</small></div><div className="bank-category-card"><div className="bank-category-top orange-text"><Target size={18}/><span>Projets Congo</span></div><strong>{money(congoTotal)}</strong><small>Capital affecté aux projets</small></div><div className="bank-category-card"><div className="bank-category-top blue-text"><PiggyBank size={18}/><span>Suivi total</span></div><strong>{money(totalSaved)}</strong><small>Tous les versements enregistrés</small></div></div><div className="panel bank-history"><div className="panel-heading"><div><div className="eyebrow">HISTORIQUE DES SOLDES</div><h2>Mes relevés de référence</h2><p>Garde une trace datée des soldes consultés dans l'application bancaire.</p></div></div>{snapshots.length?<div className="snapshot-list">{[...snapshots].sort((a,b)=>(b.captured_at||'').localeCompare(a.captured_at||'')).map(s=><div className="snapshot-row" key={s.id}><div className="snapshot-icon"><Landmark size={18}/></div><div className="snapshot-main"><strong>{niceDate(s.captured_at)}</strong><span>{s.note||'Solde déclaré'}</span></div><strong>{money(s.balance)}</strong><button className="icon-button danger" onClick={()=>onDelete(s)} aria-label="Supprimer ce solde"><Trash2 size={15}/></button></div>)}</div>:<EmptyState icon={Landmark} title="Aucun solde enregistré" text="Renseigne le montant affiché dans La Banque Postale pour commencer l'historique." action={onAdd} actionLabel="Saisir un solde"/>}</div><div className="bank-import-panel"><div className="bank-import-icon"><Upload size={18}/></div><div><strong>Sauvegarder ou restaurer tes données</strong><p>Pour une sauvegarde KELASI, utilise Réglages. L'import ici accepte un fichier de sauvegarde JSON KELASI, pas directement les relevés bancaires bruts.</p>{importError&&<span className="inline-error">{importError}</span>}</div><label className="btn-outline file-button">Importer JSON<input type="file" accept="application/json,.json" hidden onChange={e=>e.target.files?.[0]&&onImport(e.target.files[0])}/></label></div></>;
}

function SettingsPage({ theme, setTheme, data, updateData, userEmail, localMode, online, syncStatus, exportData, exportCsv, onImport, importError, onNotify, onLogout, onExitLocal, onInstall, showInstallHelp, installPrompt, onReset }) {
  const [showLogoutConfirm,setShowLogoutConfirm] = useState(false);
  const [weeklyDraft,setWeeklyDraft] = useState(String(data.weeklyTarget || 100));
  useEffect(() => setWeeklyDraft(String(data.weeklyTarget || 100)), [data.weeklyTarget]);
  const reminderDays = [{value:1,label:'Lundi'},{value:2,label:'Mardi'},{value:3,label:'Mercredi'},{value:4,label:'Jeudi'},{value:5,label:'Vendredi'},{value:6,label:'Samedi'},{value:0,label:'Dimanche'}];
  return <><PageHeader eyebrow="TON ESPACE, TES RÈGLES" title="Réglages" description="Personnalise ton expérience et contrôle tes données."/><div className="settings-layout"><div className="settings-main"><section className="panel settings-section"><div className="settings-section-header"><div className="settings-section-icon"><Wallet size={19}/></div><div><h2>Mon plan d'épargne</h2><p>Définis ton rythme, avec un minimum de 100 € par semaine.</p></div></div><label className="settings-field"><span>Objectif de versement hebdomadaire</span><div className="settings-input-wrap"><input type="number" min="100" step="25" value={weeklyDraft} onChange={e=>setWeeklyDraft(e.target.value)} onBlur={()=>{const value=Math.max(100,Number(weeklyDraft)||100);setWeeklyDraft(String(value));updateData(d=>({...d,weeklyTarget:value}));}}/><span>€ / semaine</span></div></label><div className="settings-info"><CalendarDays size={16}/><span>Plan de suivi : <strong>2 novembre 2026 – 30 octobre 2028</strong>, sur 104 semaines de versement.</span></div></section><section className="panel settings-section"><div className="settings-section-header"><div className="settings-section-icon purple"><Sun size={19}/></div><div><h2>Apparence</h2><p>Choisis l'affichage le plus confortable pour toi.</p></div></div><div className="theme-options"><button className={theme==='light'?'chosen':''} onClick={()=>setTheme('light')}><span className="theme-preview light-preview"><Sun size={22}/></span><span><strong>Mode clair</strong><small>Net et lumineux</small></span>{theme==='light'&&<CheckCircle2 size={18}/>}</button><button className={theme==='dark'?'chosen':''} onClick={()=>setTheme('dark')}><span className="theme-preview dark-preview"><Moon size={22}/></span><span><strong>Mode sombre</strong><small>Confort visuel le soir</small></span>{theme==='dark'&&<CheckCircle2 size={18}/>}</button></div></section><section className="panel settings-section"><div className="settings-section-header"><div className="settings-section-icon orange"><Bell size={19}/></div><div><h2>Rappels de versement</h2><p>Reçois un rappel au prochain lancement de KELASI le jour choisi.</p></div></div><label className="settings-field"><span>Jour préféré</span><select value={data.reminderDay??6} onChange={e=>updateData(d=>({...d,reminderDay:Number(e.target.value)}))}>{reminderDays.map(d=><option key={d.value} value={d.value}>{d.label}</option>)}</select></label><div className="settings-inline-actions"><span>Autorise les notifications du navigateur. Le rappel se déclenche lorsque l'application est ouverte ce jour-là.</span><button className="btn-secondary" onClick={onNotify}><Bell size={16}/> Activer</button></div></section><section className="panel settings-section"><div className="settings-section-header"><div className="settings-section-icon blue"><Cloud size={19}/></div><div><h2>Compte & synchronisation</h2><p>État du compte qui stocke tes données.</p></div></div><div className="account-info-row"><div className="account-avatar">{userEmail.charAt(0).toUpperCase()||'K'}</div><div><strong>{userEmail}</strong><span>{localMode?'Local : cet appareil uniquement':online?(syncStatus==='synced'?'Connexion cloud active':'Compte Supabase'):'Hors ligne : synchronisation en attente'}</span></div><span className={`account-status ${localMode?'local':syncStatus==='synced'?'good':'waiting'}`}>{localMode?'LOCAL':syncStatus==='synced'?'ACTIF':'EN ATTENTE'}</span></div>{localMode&&<><div className="settings-info warning-info"><HelpCircle size={16}/><span>Pour utiliser la même épargne sur le téléphone et la tablette, configure Supabase et crée un compte sécurisé. Le mode local ne synchronise pas les appareils.</span></div><button className="btn-primary local-exit-settings" onClick={onExitLocal}><LogOut size={16}/> Quitter le mode local / Se connecter</button></>}{!localMode&&<button className="btn-danger-outline" onClick={()=>setShowLogoutConfirm(true)}><LogOut size={16}/> Se déconnecter</button>}{showLogoutConfirm&&<div className="confirm-inline"><span>Te déconnecter de cet appareil ? Les données synchronisées resteront dans ton compte.</span><button className="btn-secondary" onClick={()=>setShowLogoutConfirm(false)}>Annuler</button><button className="btn-danger" onClick={onLogout}>Déconnexion</button></div>}</section><section className="panel settings-section"><div className="settings-section-header"><div className="settings-section-icon mint"><FileText size={19}/></div><div><h2>Sauvegarde & export</h2><p>Garde une copie de tes données ou analyse tes versements.</p></div></div><div className="export-actions"><button className="export-option" onClick={exportData}><span className="export-icon"><Download size={18}/></span><span><strong>Sauvegarde complète JSON</strong><small>Versements, soldes et objectifs</small></span><ArrowRight size={16}/></button><button className="export-option" onClick={exportCsv}><span className="export-icon csv"><FileText size={18}/></span><span><strong>Exporter les versements CSV</strong><small>Ouvrable dans Excel ou LibreOffice</small></span><ArrowRight size={16}/></button><label className="export-option import-option"><span className="export-icon import"><Upload size={18}/></span><span><strong>Restaurer une sauvegarde JSON</strong><small>Fusionne les données du fichier avec celles présentes</small></span><ArrowRight size={16}/><input type="file" accept="application/json,.json" hidden onChange={e=>e.target.files?.[0]&&onImport(e.target.files[0])}/></label>{importError&&<span className="inline-error">{importError}</span>}</div></section><section className="panel settings-section danger-settings"><div className="settings-section-header"><div className="settings-section-icon orange"><RefreshCw size={19}/></div><div><h2>Zone sensible</h2><p>Supprime les données conservées sur cet appareil.</p></div></div><button className="btn-danger-outline" onClick={onReset}><RefreshCw size={16}/> Réinitialiser les données locales</button></section></div><aside className="settings-aside"><div className="settings-brand-card"><div className="settings-logo"><img src="/icons/kelasi-512.png" alt="Logo KELASI"/></div><h3>KELASI</h3><p>Ton épargne, ton avenir, semaine après semaine.</p><span className="version-pill">VERSION 1.0 · PWA</span><button className="btn-primary full-width" onClick={onInstall}><Download size={16}/>{installPrompt?'Installer maintenant':'Installer sur mon appareil'}</button>{showInstallHelp&&<p className="install-mini-help">Android : menu ⋮ → Installer. iPhone/iPad : Partager → Sur l'écran d'accueil.</p>}</div><div className="privacy-card"><ShieldCheck size={19}/><strong>Ta sécurité avant tout</strong><p>Ne saisis jamais ton mot de passe La Banque Postale dans KELASI. Ne partage pas tes codes d'accès. L'authentification de l'application est distincte de ta banque.</p></div><div className="support-card"><HelpCircle size={18}/><div><strong>À propos du hors ligne</strong><p>Les données sont conservées localement. Avec Supabase configuré, elles se synchronisent au retour d'Internet. Pour une première connexion, un accès Internet est nécessaire.</p></div></div></aside></div></>;
}

function EmptyState({ icon: Icon, title, text, action, actionLabel }) {
  return <div className="empty-state"><div className="empty-icon"><Icon size={24}/></div><h3>{title}</h3><p>{text}</p>{action&&<button className="btn-secondary" onClick={action}><Plus size={16}/>{actionLabel||'Ajouter'}</button>}</div>;
}

function DepositModal({ entry, onClose, onSave }) {
  const [weekStart,setWeekStart] = useState(entry.week_start || START_ISO);
  const [amount,setAmount] = useState(String(entry.amount ?? '100'));
  const [category,setCategory] = useState(entry.category || 'perso');
  const [note,setNote] = useState(entry.note || '');
  const [error,setError] = useState('');
  const amountNum = Number(String(amount).replace(',','.'));
  const submit = e => { e.preventDefault(); if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) return setError('Choisis une semaine valide.'); if (amountNum < 100 || !Number.isFinite(amountNum)) return setError('Le montant minimum est de 100 €.'); if (weekStart < START_ISO || weekStart > dateForWeek(103)) return setError('Choisis une date comprise dans le plan de 104 semaines.'); onSave({ ...(entry.id?{id:entry.id}:{}), week_start:weekStart, amount:amountNum, category, note:note.trim() }); };
  return <ModalFrame title={entry.id?'Modifier le versement':'Nouveau versement'} subtitle="Chaque versement construit ton capital." onClose={onClose}><form className="modal-form" onSubmit={submit}><div className="amount-entry-label">MONTANT DU VERSEMENT</div><div className="amount-input-wrap"><span>€</span><input type="number" min="100" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} autoFocus required/><small>EUR</small></div><div className="min-rule"><CheckCircle2 size={14}/> Minimum autorisé : 100 €</div><label className="form-label">Semaine de versement<select value={weekStart} onChange={e=>setWeekStart(e.target.value)}>{Array.from({length:WEEKS_TOTAL},(_,i)=><option key={i} value={dateForWeek(i)}>Semaine {String(i+1).padStart(2,'0')} · {niceDate(dateForWeek(i))}</option>)}</select></label><div className="form-label">Catégorie de versement</div><div className="category-choice-grid">{CATEGORIES.map(c=>{const Icon=c.icon;return <button type="button" key={c.id} className={`category-choice ${category===c.id?'selected':''}`} onClick={()=>setCategory(c.id)}><span className={`category-choice-icon ${c.color}`}><Icon size={18}/></span><span>{c.label}</span>{category===c.id&&<CheckCircle2 size={15}/>}</button>})}</div><label className="form-label">Note (facultative)<input value={note} onChange={e=>setNote(e.target.value)} placeholder="Ex. : virement épargne de novembre" maxLength={140}/></label>{error&&<div className="inline-error">{error}</div>}<div className="modal-foot"><button type="button" className="btn-ghost" onClick={onClose}>Annuler</button><button className="btn-primary"><Check size={17}/>{entry.id?'Enregistrer les modifications':'Valider le versement'}</button></div></form></ModalFrame>;
}
function GoalModal({ goal, onClose, onSave }) {
  const [title,setTitle] = useState(goal.title||'');const [target,setTarget]=useState(String(goal.target||'1000'));const [allocated,setAllocated]=useState(String(goal.allocated||'0'));const [category,setCategory]=useState(goal.category||'Personnel');const [color,setColor]=useState(goal.color||'mint');const [error,setError]=useState('');
  const submit=e=>{e.preventDefault();if(!title.trim())return setError('Donne un nom à ton projet.');if(Number(target)<=0)return setError('Le budget doit être supérieur à zéro.');onSave({...(goal.id?{id:goal.id}:{}),title:title.trim(),target:Number(target),allocated:Math.max(0,Number(allocated)||0),category,color});};
  return <ModalFrame title={goal.id?'Modifier le projet':'Nouvel objectif'} subtitle="Définis une prochaine étape réaliste." onClose={onClose}><form className="modal-form" onSubmit={submit}><label className="form-label">Nom du projet<input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Ex. : Acheter une parcelle" maxLength={70} required/></label><label className="form-label">Budget cible (€)<input type="number" min="1" step="100" value={target} onChange={e=>setTarget(e.target.value)} required/></label><label className="form-label">Montant déjà affecté à ce projet (€)<input type="number" min="0" step="50" value={allocated} onChange={e=>setAllocated(e.target.value)}/><span className="field-hint">Renseigne ici la somme réservée spécifiquement à ce projet.</span></label><label className="form-label">Catégorie<select value={category} onChange={e=>setCategory(e.target.value)}>{['Immobilier','Personnel','Business','Sécurité','Formation','Voyage','Famille','Autre'].map(c=><option key={c}>{c}</option>)}</select></label><div className="form-label">Couleur</div><div className="color-choices">{['mint','orange','violet','blue','pink'].map(c=><button type="button" key={c} aria-label={c} className={`color-choice ${c} ${color===c?'selected':''}`} onClick={()=>setColor(c)}>{color===c&&<Check size={15}/>}</button>)}</div>{error&&<div className="inline-error">{error}</div>}<div className="modal-foot"><button type="button" className="btn-ghost" onClick={onClose}>Annuler</button><button className="btn-primary"><Check size={16}/>{goal.id?'Modifier le projet':'Créer le projet'}</button></div></form></ModalFrame>;
}
function BankModal({ onClose, onSave }) {
  const [balance,setBalance]=useState('');const [date,setDate]=useState(isoDate(new Date()));const [note,setNote]=useState('');const [error,setError]=useState('');
  const submit=e=>{e.preventDefault();const n=Number(String(balance).replace(',','.'));if(!Number.isFinite(n)||n<0)return setError('Saisis un solde de 0 € ou plus.');onSave({balance:n,captured_at:date,note:note.trim()});};
  return <ModalFrame title="Actualiser le solde bancaire" subtitle="Reporte le montant affiché dans l'application officielle de ta banque." onClose={onClose}><form className="modal-form" onSubmit={submit}><div className="bank-modal-caution"><ShieldCheck size={17}/><span>Ne saisis ni identifiant, ni mot de passe bancaire. Seul le montant du solde est demandé.</span></div><label className="form-label">Solde du compte (€)<input type="number" min="0" step="0.01" value={balance} onChange={e=>setBalance(e.target.value)} placeholder="Ex. : 4 250,00" required/></label><label className="form-label">Date de consultation<input type="date" value={date} onChange={e=>setDate(e.target.value)} required/></label><label className="form-label">Note (facultative)<input value={note} onChange={e=>setNote(e.target.value)} placeholder="Ex. : après le virement hebdomadaire" maxLength={120}/></label>{error&&<div className="inline-error">{error}</div>}<div className="modal-foot"><button type="button" className="btn-ghost" onClick={onClose}>Annuler</button><button className="btn-primary"><Check size={17}/>Enregistrer le solde</button></div></form></ModalFrame>;
}
function ModalFrame({ title, subtitle, onClose, children }) {
  useEffect(()=>{const key=e=>e.key==='Escape'&&onClose();window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[onClose]);
  return <div className="modal-overlay" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><div className="modal-card"><div className="modal-header"><div><div className="eyebrow">KELASI · TON ESPACE</div><h2>{title}</h2><p>{subtitle}</p></div><button className="icon-button" onClick={onClose} aria-label="Fermer"><X size={19}/></button></div>{children}</div></div>;
}

export default App;
