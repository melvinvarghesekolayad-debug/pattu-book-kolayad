import React, { useState, useEffect } from 'react';
import { usePWAInstall } from './usePWAInstall';
import { 
  collection, 
  getDocs, 
  query, 
  orderBy, 
  limit 
} from 'firebase/firestore';
import { db } from './firebase';
import { APIProvider, Map, AdvancedMarker, Pin, InfoWindow } from '@vis.gl/react-google-maps';
import { 
  Briefcase, 
  Calendar, 
  User as UserIcon, 
  MapPin, 
  Wrench, 
  Truck, 
  Utensils, 
  DollarSign, 
  CheckCircle, 
  Settings, 
  History, 
  PlusCircle, 
  AlertCircle, 
  Send, 
  Bot, 
  Users, 
  FileSpreadsheet,
  X,
  ChevronRight,
  Info,
  Download,
  Pencil,
  Trash2,
  Edit3,
  Lock,
  Unlock,
  KeyRound,
  LogOut,
  Phone,
  PhoneCall,
  MessageSquare,
  Search,
  ShieldCheck,
  Droplets,
  Paintbrush,
  Home as HomeIcon,
  Check,
  Clock,
  Sparkles,
  Share2,
  ExternalLink,
  Globe,
  Building2,
  Route as RouteIcon,
  Navigation,
  MapPin as MapPinIcon,
  Calendar as CalendarIcon,
  Clock as ClockIcon,
  Filter,
  Layers,
  Compass
} from 'lucide-react';

// Custom Vector Logo Icon Component
const LogoIcon = ({ className = "w-10 h-10" }: { className?: string }) => (
  <div className={`relative flex items-center justify-center shrink-0 rounded-2xl bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-900 border border-emerald-300/40 shadow-lg shadow-emerald-950/40 overflow-hidden group ${className}`}>
    {/* Inner glossy reflection */}
    <div className="absolute inset-0 bg-gradient-to-tr from-amber-400/20 via-transparent to-white/30 opacity-90" />
    <svg 
      viewBox="0 0 64 64" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg" 
      className="w-[72%] h-[72%] relative z-10 drop-shadow-md transition-transform duration-300 group-hover:scale-105"
    >
      {/* Golden Hammer & Ruler emblem */}
      <path d="M12 20L28 36M28 36L44 20M28 36V52" stroke="#FBBF24" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      {/* Helmet / Shield top */}
      <path d="M16 24C16 16 22 10 32 10C42 10 48 16 48 24V28H16V24Z" fill="#F59E0B" stroke="#FEF3C7" strokeWidth="2" />
      {/* Hardhat brim */}
      <path d="M12 28H52C54 28 55 29.5 54 31C52 34 44 36 32 36C20 36 12 34 10 31C9 29.5 10 28 12 28Z" fill="#D97706" />
      {/* Badge Checkmark */}
      <circle cx="46" cy="46" r="10" fill="#10B981" stroke="#FFFFFF" strokeWidth="2" />
      <path d="M42 46L45 49L50 43" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </div>
);

interface WorkLog {
  id?: string;
  workerNumber: number;
  workerName: string;
  workerPhone?: string;
  date: string;
  siteName: string;
  workDescription: string;
  thachCount?: number;
  vehicleRent: number;
  foodExpense: number;
  toolsRent: number;
  otherExpense: number;
  submittedBy?: string;
  createdAt?: any;
}

interface ServiceRequest {
  id?: string;
  customerName: string;
  customerPhone: string;
  customerLocation: string;
  selectedServices: string[];
  additionalDetails?: string;
  preferredDate?: string;
  status: 'new' | 'contacted' | 'accepted' | 'completed';
  createdAt?: any;
  lat?: number;
  lng?: number;
  scheduledDate?: string;
  scheduledTime?: string;
  assignedWorkerName?: string;
}

export default function App() {
  const { isInstallable, isInstalled, install, isIOS } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // Current logged in worker profile
  const [activeWorkerNumber, setActiveWorkerNumber] = useState<number>(() => {
    const saved = localStorage.getItem('worklog_active_number');
    return saved ? parseInt(saved, 10) : 1;
  });

  // Directory of assigned names for Worker #1 to #50
  const [workerNamesMap, setWorkerNamesMap] = useState<Record<number, string>>(() => {
    try {
      const saved = localStorage.getItem('worklog_names_map');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  const [activeWorkerName, setActiveWorkerName] = useState<string>(() => {
    const savedName = localStorage.getItem('worklog_active_name');
    if (savedName && !savedName.startsWith('തൊഴിലാളി')) return savedName;
    const num = localStorage.getItem('worklog_active_number');
    const n = num ? parseInt(num, 10) : 1;
    const mapSaved = localStorage.getItem('worklog_names_map');
    if (mapSaved) {
      const parsed = JSON.parse(mapSaved);
      if (parsed[n]) return parsed[n];
    }
    return '';
  });
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // Tab: 'add' (Add Work), 'history' (View History) - 2 Main Pages
  const [activeTab, setActiveTab] = useState<'add' | 'history'>('add');
  const [showPublicPageOnLock, setShowPublicPageOnLock] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

  // Google Maps Quota Exhausted State
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  useEffect(() => {
    const handleQuotaExceeded = () => setQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handleQuotaExceeded);
    return () => window.removeEventListener('gmp-quota-exceeded', handleQuotaExceeded);
  }, []);

  // Customer Callback Leads State
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>([]);
  const [loadingServiceRequests, setLoadingServiceRequests] = useState(false);

  // Google Maps Schedule Modal & Map State
  const [selectedRequestForSchedule, setSelectedRequestForSchedule] = useState<ServiceRequest | null>(null);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [schedDate, setSchedDate] = useState('');
  const [schedTime, setSchedTime] = useState('രാവിലെ 08:30 AM');
  const [schedWorker, setSchedWorker] = useState('');
  const [schedLat, setSchedLat] = useState<number>(11.8797);
  const [schedLng, setSchedLng] = useState<number>(75.7142);
  const [schedStatus, setSchedStatus] = useState<'new' | 'contacted' | 'accepted' | 'completed'>('contacted');
  const [schedLocationName, setSchedLocationName] = useState('');
  const [schedSaving, setSchedSaving] = useState(false);
  const [activeMarkerId, setActiveMarkerId] = useState<string | null>(null);
  const [mapFilterStatus, setMapFilterStatus] = useState<'all' | 'new' | 'contacted' | 'accepted' | 'completed'>('all');

  // Public Service Request Callback Form State
  const [leadName, setLeadName] = useState('');
  const [leadPhone, setLeadPhone] = useState('');
  const [leadLocation, setLeadLocation] = useState('കോളയാട്');
  const [leadServices, setLeadServices] = useState<string[]>(['പെയിന്റിംഗ് വർക്കുകൾ']);
  const [leadNotes, setLeadNotes] = useState('');
  const [leadDate, setLeadDate] = useState('');
  const [leadSubmitting, setLeadSubmitting] = useState(false);
  const [leadSuccess, setLeadSuccess] = useState(false);
  const [leadError, setLeadError] = useState('');

  // Multi-lingual Services Search & Filter State
  const [serviceSearchQuery, setServiceSearchQuery] = useState('');
  const [selectedServiceCategory, setSelectedServiceCategory] = useState<string>('all');

  // Interactive Instant Cost Estimator State
  const [calcService, setCalcService] = useState<'painting' | 'terrace' | 'wall_moss' | 'well' | 'tank'>('painting');
  const [calcUnits, setCalcUnits] = useState<number>(1200);
  const [calcQuality, setCalcQuality] = useState<'standard' | 'premium' | 'ultra'>('premium');

  // Form: Whose work details are we submitting?
  // 'self' means for the logged in worker, 'other' means for another worker
  const [entryFor, setEntryFor] = useState<'self' | 'other'>('self');
  const [targetWorkerNumber, setTargetWorkerNumber] = useState<number>(activeWorkerNumber);
  const [targetWorkerName, setTargetWorkerName] = useState<string>(activeWorkerName);
  
  // Work Details Form Fields
  const [dateType, setDateType] = useState<'today' | 'yesterday' | 'custom'>('today');
  const [customDate, setCustomDate] = useState(new Date().toISOString().split('T')[0]);
  const [thachCount, setThachCount] = useState<number>(1);
  const [isCustomThach, setIsCustomThach] = useState(false);
  const [customThachInput, setCustomThachInput] = useState('1');
  const [siteName, setSiteName] = useState('');
  const [workDescription, setWorkDescription] = useState('');
  const [vehicleRent, setVehicleRent] = useState('');
  const [foodExpense, setFoodExpense] = useState('');
  const [toolsRent, setToolsRent] = useState('');
  const [otherExpense, setOtherExpense] = useState('');

  // Submission Status
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [formError, setFormError] = useState('');
  const [lastSubmittedWorker, setLastSubmittedWorker] = useState<number | null>(null);

  // Recent Logs & Filter
  const [logs, setLogs] = useState<WorkLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [filterWorkerNumber, setFilterWorkerNumber] = useState<number | 'all'>('all');

  // Telegram Settings & Business Contact Phone State
  const [botToken, setBotToken] = useState('');
  const [bossChatId, setBossChatId] = useState('');
  const [businessPhone, setBusinessPhone] = useState<string>(() => {
    return localStorage.getItem('worklog_business_phone') || '9400000000';
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<{ text: string; isError: boolean } | null>(null);

  // Edit Report Modal State
  const [editingLog, setEditingLog] = useState<WorkLog | null>(null);
  const [editForm, setEditForm] = useState<{
    workerNumber: number;
    workerName: string;
    date: string;
    siteName: string;
    workDescription: string;
    thachCount: number;
    vehicleRent: string;
    foodExpense: string;
    toolsRent: string;
    otherExpense: string;
  }>({
    workerNumber: 1,
    workerName: '',
    date: '',
    siteName: '',
    workDescription: '',
    thachCount: 1,
    vehicleRent: '',
    foodExpense: '',
    toolsRent: '',
    otherExpense: ''
  });
  const [updatingLog, setUpdatingLog] = useState(false);

  // Delete Confirmation Modal State
  const [deletingLog, setDeletingLog] = useState<WorkLog | null>(null);
  const [deletingInProgress, setDeletingInProgress] = useState(false);

  // App Lock / Security State (Password: 4646)
  const [isAppUnlocked, setIsAppUnlocked] = useState<boolean>(() => {
    return localStorage.getItem('worklog_app_unlocked') === 'true';
  });
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');

  const handleLoginSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (passwordInput === '4646') {
      setIsAppUnlocked(true);
      localStorage.setItem('worklog_app_unlocked', 'true');
      setLoginError('');
    } else {
      setLoginError('തെറ്റായ പാസ്‌വേഡ്! വീണ്ടും ശ്രമിക്കുക.');
    }
  };

  const handleKeypadPress = (digit: string) => {
    if (passwordInput.length < 10) {
      const nextPin = passwordInput + digit;
      setPasswordInput(nextPin);
      setLoginError('');
      if (nextPin === '4646') {
        setIsAppUnlocked(true);
        localStorage.setItem('worklog_app_unlocked', 'true');
        setLoginError('');
      }
    }
  };

  const handleKeypadDelete = () => {
    setPasswordInput(prev => prev.slice(0, -1));
    setLoginError('');
  };

  const handleKeypadClear = () => {
    setPasswordInput('');
    setLoginError('');
  };

  const handleLockApp = () => {
    setIsAppUnlocked(false);
    localStorage.removeItem('worklog_app_unlocked');
    setPasswordInput('');
    setLoginError('');
  };

  const handleOpenEdit = (log: WorkLog) => {
    setEditingLog(log);
    setEditForm({
      workerNumber: log.workerNumber,
      workerName: log.workerName || '',
      date: log.date || '',
      siteName: log.siteName || '',
      workDescription: log.workDescription || '',
      thachCount: log.thachCount || 1,
      vehicleRent: String(log.vehicleRent || ''),
      foodExpense: String(log.foodExpense || ''),
      toolsRent: String(log.toolsRent || ''),
      otherExpense: String(log.otherExpense || '')
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLog || !editingLog.id) return;
    setUpdatingLog(true);
    try {
      const payload = {
        id: editingLog.id,
        workerNumber: editForm.workerNumber,
        workerName: editForm.workerName.trim() || workerNamesMap[editForm.workerNumber] || `തൊഴിലാളി #${editForm.workerNumber}`,
        date: editForm.date,
        siteName: editForm.siteName.trim(),
        workDescription: editForm.workDescription.trim(),
        thachCount: editForm.thachCount,
        vehicleRent: Number(editForm.vehicleRent) || 0,
        foodExpense: Number(editForm.foodExpense) || 0,
        toolsRent: Number(editForm.toolsRent) || 0,
        otherExpense: Number(editForm.otherExpense) || 0,
        updatedBy: `തൊഴിലാളി #${activeWorkerNumber} (${activeWorkerName})`
      };

      const res = await fetch('/api/update-work-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Update failed');
      setEditingLog(null);
      loadLogs();
    } catch (err) {
      console.error(err);
      alert('റിപ്പോർട്ട് മാറ്റാൻ കഴിഞ്ഞില്ല. ദയവായി വീണ്ടും ശ്രമിക്കുക.');
    } finally {
      setUpdatingLog(false);
    }
  };

  const handleDeleteLog = async () => {
    if (!deletingLog || !deletingLog.id) return;
    setDeletingInProgress(true);
    try {
      const res = await fetch('/api/delete-work-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: deletingLog.id,
          workerNumber: deletingLog.workerNumber,
          workerName: deletingLog.workerName
        })
      });

      if (!res.ok) throw new Error('Delete failed');
      setDeletingLog(null);
      loadLogs();
    } catch (err) {
      console.error(err);
      alert('ഡിലീറ്റ് ചെയ്യാൻ കഴിഞ്ഞില്ല. ദയവായി വീണ്ടും ശ്രമിക്കുക.');
    } finally {
      setDeletingInProgress(false);
    }
  };

  // Load Bot Settings & Logs on startup
  useEffect(() => {
    loadSettings();
    loadLogs();
    loadServiceRequests();
  }, []);

  const loadServiceRequests = async () => {
    setLoadingServiceRequests(true);
    try {
      const q = query(collection(db, 'service_requests'), orderBy('createdAt', 'desc'), limit(100));
      const snap = await getDocs(q);
      const list: ServiceRequest[] = [];
      snap.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as ServiceRequest);
      });
      setServiceRequests(list);
    } catch (err) {
      console.error('Failed to load service requests', err);
    } finally {
      setLoadingServiceRequests(false);
    }
  };

  // Google Maps Coordinates & Distance Helpers
  const LOCAL_TOWNS: Record<string, { lat: number; lng: number }> = {
    'കോളയാട്': { lat: 11.8797, lng: 75.7142 },
    'പേരാവൂർ': { lat: 11.8986, lng: 75.7335 },
    'ഇരിട്ടി': { lat: 11.9802, lng: 75.6669 },
    'മട്ടന്നൂർ': { lat: 11.9288, lng: 75.5724 },
    'ചിറ്റാരിപ്പറമ്പ്': { lat: 11.8523, lng: 75.6418 },
    'നെടുംപൊയിൽ': { lat: 11.8492, lng: 75.7981 },
    'കൂത്തുപറമ്പ്': { lat: 11.8286, lng: 75.5671 },
    'ശിവപുരം': { lat: 11.9056, lng: 75.6148 },
    'കേളകം': { lat: 11.8924, lng: 75.8115 },
    'കണിച്ചാർ': { lat: 11.8845, lng: 75.7721 },
  };

  const getRequestCoords = (req: ServiceRequest, index = 0): { lat: number; lng: number } => {
    if (req.lat && req.lng) return { lat: req.lat, lng: req.lng };
    const loc = req.customerLocation || '';
    for (const [town, coords] of Object.entries(LOCAL_TOWNS)) {
      if (loc.includes(town)) {
        return coords;
      }
    }
    const angle = (index * 137.5 * Math.PI) / 180;
    const radius = 0.012 + (index % 5) * 0.007;
    return {
      lat: 11.8797 + radius * Math.cos(angle),
      lng: 75.7142 + radius * Math.sin(angle)
    };
  };

  const calculateDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return (R * c).toFixed(1);
  };

  const openScheduleModal = (req: ServiceRequest, index = 0) => {
    setSelectedRequestForSchedule(req);
    const coords = getRequestCoords(req, index);
    setSchedLat(coords.lat);
    setSchedLng(coords.lng);
    setSchedDate(req.scheduledDate || req.preferredDate || new Date().toISOString().split('T')[0]);
    setSchedTime(req.scheduledTime || 'രാവിലെ 08:30 AM');
    setSchedWorker(req.assignedWorkerName || activeWorkerName || 'തൊഴിലാളി #1');
    setSchedStatus(req.status || 'contacted');
    setSchedLocationName(req.customerLocation || 'കോളയാട്');
    setIsScheduleModalOpen(true);
  };

  const handleSaveSchedule = async () => {
    if (!selectedRequestForSchedule?.id) return;
    setSchedSaving(true);
    try {
      const res = await fetch('/api/update-service-request-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedRequestForSchedule.id,
          scheduledDate: schedDate,
          scheduledTime: schedTime,
          assignedWorkerName: schedWorker,
          status: schedStatus,
          lat: schedLat,
          lng: schedLng,
          customerLocation: schedLocationName
        })
      });

      if (res.ok) {
        setIsScheduleModalOpen(false);
        setSelectedRequestForSchedule(null);
        loadServiceRequests();
      } else {
        alert('ഷെഡ്യൂൾ സേവ് ചെയ്യുന്നതിൽ പരാജയപ്പെട്ടു.');
      }
    } catch (err) {
      console.error(err);
      alert('കണക്ഷൻ തകരാർ സംഭവിച്ചു.');
    } finally {
      setSchedSaving(false);
    }
  };

  // Render Google Maps Work Schedule & Route Planner Tab
  const renderScheduleTab = () => {
    const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "AIzaSyCRIwKL8DvOezAYNVNzBMV8r2lVAOyJLFU";

    const filteredRequests = serviceRequests.filter(req => {
      if (mapFilterStatus === 'all') return true;
      return req.status === mapFilterStatus;
    });

    const getStatusBadge = (status: string) => {
      switch (status) {
        case 'new':
          return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1">🔴 പുതിയത്</span>;
        case 'contacted':
          return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">🟡 ഷെഡ്യൂൾ ചെയ്തു</span>;
        case 'accepted':
          return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300 flex items-center gap-1">🔵 ഇൻ പ്രോഗ്രസ്</span>;
        case 'completed':
          return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">🟢 പൂർത്തിയായി</span>;
        default:
          return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300">ലഭ്യമല്ല</span>;
      }
    };

    const getPinBg = (status: string) => {
      switch (status) {
        case 'new': return '#EF4444';
        case 'contacted': return '#F59E0B';
        case 'accepted': return '#3B82F6';
        case 'completed': return '#10B981';
        default: return '#6B7280';
      }
    };

    return (
      <div className="space-y-4 animate-fade-in">
        {/* Quota Exceeded Sticky Warning Banner */}
        {quotaExceeded && (
          <div className="bg-amber-50 border border-amber-200 text-amber-900 px-4 py-2.5 rounded-2xl text-xs text-center shadow-sm">
            <span>
              Google Maps Platform quota reached. If you are the app owner, visit{' '}
              <a
                href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-semibold text-amber-950 hover:text-amber-800"
              >
                maps developer site
              </a>{' '}
              for instructions to update your account.
            </span>
          </div>
        )}

        {/* Schedule Header Card */}
        <div className="bg-gradient-to-br from-slate-900 via-emerald-950 to-teal-950 text-white rounded-3xl p-5 shadow-xl border border-emerald-500/30 space-y-3 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300">
                <Navigation className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-1.5">
                  <span>ഗൂഗിൾ മാപ്പ് & വർക്ക് ഷെഡ്യൂൾ</span>
                  <span className="text-[10px] bg-emerald-500/30 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-400/30 font-semibold">20 KM റൂട്ടുകൾ</span>
                </h2>
                <p className="text-xs text-emerald-200/80">കോളയാട് ഓഫീസ് തറയിൽ നിന്നും സൈറ്റുകളിലേക്കുള്ള ഷെഡ്യൂൾ</p>
              </div>
            </div>
          </div>

          {/* Map Counter Chips */}
          <div className="grid grid-cols-4 gap-1.5 pt-1">
            <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-2 text-center">
              <span className="text-[10px] text-slate-400 block font-medium">ആകെ</span>
              <span className="text-sm font-extrabold text-white">{serviceRequests.length}</span>
            </div>
            <div className="bg-amber-950/40 border border-amber-500/30 rounded-xl p-2 text-center">
              <span className="text-[10px] text-amber-300 block font-medium">ഷെഡ്യൂൾ</span>
              <span className="text-sm font-extrabold text-amber-400">
                {serviceRequests.filter(r => r.status === 'contacted').length}
              </span>
            </div>
            <div className="bg-blue-950/40 border border-blue-500/30 rounded-xl p-2 text-center">
              <span className="text-[10px] text-blue-300 block font-medium">വർക്ക് നടക്കുന്നു</span>
              <span className="text-sm font-extrabold text-blue-400">
                {serviceRequests.filter(r => r.status === 'accepted').length}
              </span>
            </div>
            <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-2 text-center">
              <span className="text-[10px] text-emerald-300 block font-medium">പൂർത്തിയായി</span>
              <span className="text-sm font-extrabold text-emerald-400">
                {serviceRequests.filter(r => r.status === 'completed').length}
              </span>
            </div>
          </div>
        </div>

        {/* Map Filter Controls */}
        <div className="bg-white p-2.5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between gap-2 overflow-x-auto">
          <div className="flex items-center gap-1 shrink-0 text-xs font-bold text-slate-600">
            <Filter className="w-3.5 h-3.5 text-emerald-600" />
            <span>ഫിൽട്ടർ:</span>
          </div>
          <div className="flex items-center gap-1 shrink-0 overflow-x-auto">
            <button
              onClick={() => setMapFilterStatus('all')}
              className={`px-2.5 py-1 rounded-xl text-xs font-bold transition ${
                mapFilterStatus === 'all'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              എല്ലാ സൈറ്റുകളും ({serviceRequests.length})
            </button>
            <button
              onClick={() => setMapFilterStatus('new')}
              className={`px-2.5 py-1 rounded-xl text-xs font-bold transition ${
                mapFilterStatus === 'new'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
              }`}
            >
              🔴 പുതിയത് ({serviceRequests.filter(r => r.status === 'new').length})
            </button>
            <button
              onClick={() => setMapFilterStatus('contacted')}
              className={`px-2.5 py-1 rounded-xl text-xs font-bold transition ${
                mapFilterStatus === 'contacted'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
              }`}
            >
              🟡 ഷെഡ്യൂൾ ({serviceRequests.filter(r => r.status === 'contacted').length})
            </button>
            <button
              onClick={() => setMapFilterStatus('accepted')}
              className={`px-2.5 py-1 rounded-xl text-xs font-bold transition ${
                mapFilterStatus === 'accepted'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
              }`}
            >
              🔵 ഇൻ പ്രോഗ്രസ് ({serviceRequests.filter(r => r.status === 'accepted').length})
            </button>
            <button
              onClick={() => setMapFilterStatus('completed')}
              className={`px-2.5 py-1 rounded-xl text-xs font-bold transition ${
                mapFilterStatus === 'completed'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
              }`}
            >
              🟢 പൂർത്തിയായി ({serviceRequests.filter(r => r.status === 'completed').length})
            </button>
          </div>
        </div>

        {/* Interactive Google Map Box */}
        <div className="bg-white rounded-3xl p-2 border border-slate-200/90 shadow-md overflow-hidden relative">
          <APIProvider apiKey={GOOGLE_MAPS_KEY}>
            <div style={{ width: '100%', height: '420px', borderRadius: '1.25rem', overflow: 'hidden' }} className="relative shadow-inner">
              <Map
                defaultCenter={{ lat: 11.8797, lng: 75.7142 }}
                defaultZoom={11}
                mapId="DEMO_MAP_ID"
                internalUsageAttributionIds={["gmp_mcp_codeassist_v1_aistudio"]}
                gestureHandling="greedy"
                disableDefaultUI={false}
              >
                {/* Kolayad Office HQ Pin */}
                <AdvancedMarker
                  position={{ lat: 11.8797, lng: 75.7142 }}
                  title="കോളയാട് ഓഫീസ് തറ (HQ)"
                >
                  <Pin background="#065F46" glyphColor="#FFFFFF" borderColor="#34D399">
                    <HomeIcon className="w-4 h-4 text-white" />
                  </Pin>
                </AdvancedMarker>

                {/* Markers for each lead */}
                {filteredRequests.map((req, idx) => {
                  const coords = getRequestCoords(req, idx);
                  const isSelected = activeMarkerId === req.id;
                  const dist = calculateDistanceKm(11.8797, 75.7142, coords.lat, coords.lng);

                  return (
                    <React.Fragment key={req.id || idx}>
                      <AdvancedMarker
                        position={coords}
                        title={req.customerName}
                        onClick={() => setActiveMarkerId(req.id || null)}
                      >
                        <Pin
                          background={getPinBg(req.status)}
                          borderColor="#FFFFFF"
                          glyphColor="#FFFFFF"
                        />
                      </AdvancedMarker>

                      {isSelected && (
                        <InfoWindow
                          position={coords}
                          onCloseClick={() => setActiveMarkerId(null)}
                        >
                          <div className="p-1 space-y-2 max-w-xs font-sans text-slate-800">
                            <div className="flex items-start justify-between gap-2 border-b border-slate-200 pb-1.5">
                              <div>
                                <h3 className="font-bold text-sm text-slate-900">{req.customerName}</h3>
                                <p className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                                  <MapPin className="w-3 h-3" />
                                  {req.customerLocation} ({dist} KM)
                                </p>
                              </div>
                              <div>{getStatusBadge(req.status)}</div>
                            </div>

                            <div className="space-y-1 text-xs">
                              <p className="font-medium text-slate-700">
                                <span className="font-bold text-slate-900">സേവനം:</span> {req.selectedServices.join(', ')}
                              </p>
                              {req.scheduledDate && (
                                <p className="text-amber-800 bg-amber-50 px-2 py-0.5 rounded font-semibold flex items-center gap-1">
                                  <CalendarIcon className="w-3 h-3 text-amber-600" />
                                  {req.scheduledDate} ({req.scheduledTime || '08:30 AM'})
                                </p>
                              )}
                              {req.assignedWorkerName && (
                                <p className="text-teal-800 bg-teal-50 px-2 py-0.5 rounded font-semibold flex items-center gap-1">
                                  <UserIcon className="w-3 h-3 text-teal-600" />
                                  {req.assignedWorkerName}
                                </p>
                              )}
                            </div>

                            {/* Actions */}
                            <div className="pt-1.5 flex items-center gap-1.5 flex-wrap border-t border-slate-100">
                              <a
                                href={`tel:${req.customerPhone}`}
                                className="px-2 py-1 bg-emerald-600 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm hover:bg-emerald-700"
                              >
                                <Phone className="w-3 h-3" />
                                <span>വിളിക്കുക</span>
                              </a>
                              <a
                                href={`https://wa.me/91${req.customerPhone.replace(/\D/g, '')}`}
                                target="_blank"
                                rel="noreferrer"
                                className="px-2 py-1 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-emerald-200"
                              >
                                <MessageSquare className="w-3 h-3" />
                                <span>വാട്സാപ്പ്</span>
                              </a>
                              <button
                                onClick={() => openScheduleModal(req, idx)}
                                className="px-2 py-1 bg-amber-500 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm hover:bg-amber-600"
                              >
                                <ClockIcon className="w-3 h-3" />
                                <span>ഷെഡ്യൂൾ ചെയ്യുക</span>
                              </button>
                              <a
                                href={`https://www.google.com/maps/dir/?api=1&origin=11.8797,75.7142&destination=${coords.lat},${coords.lng}`}
                                target="_blank"
                                rel="noreferrer"
                                className="px-2 py-1 bg-slate-800 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm hover:bg-slate-900"
                              >
                                <Navigation className="w-3 h-3" />
                                <span>റൂട്ട്</span>
                              </a>
                            </div>
                          </div>
                        </InfoWindow>
                      )}
                    </React.Fragment>
                  );
                })}
              </Map>

              {/* Quick Legend Overlay */}
              <div className="absolute bottom-2 left-2 right-2 bg-slate-900/90 backdrop-blur text-white px-3 py-1.5 rounded-xl border border-slate-700 text-[10px] flex items-center justify-between gap-1 shadow-lg z-10 overflow-x-auto">
                <span className="font-bold text-slate-300 shrink-0">മാപ്പ് സൂചിക:</span>
                <span className="flex items-center gap-1 text-rose-300 font-semibold shrink-0">
                  <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" /> പുതിയത്
                </span>
                <span className="flex items-center gap-1 text-amber-300 font-semibold shrink-0">
                  <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> ഷെഡ്യൂൾ ചെയ്തു
                </span>
                <span className="flex items-center gap-1 text-blue-300 font-semibold shrink-0">
                  <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> ഇൻ പ്രോഗ്രസ്
                </span>
                <span className="flex items-center gap-1 text-emerald-300 font-semibold shrink-0">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> പൂർത്തിയായി
                </span>
              </div>
            </div>
          </APIProvider>
        </div>

        {/* Schedule List & Timeline Section */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-md space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-emerald-600" />
                <span>ഷെഡ്യൂൾ ചെയ്ത ജോലികളും ലീഡുകളും</span>
              </h3>
              <p className="text-xs text-slate-500">മാപ്പിലെ അല്ലെങ്കിൽ താഴെയുള്ള ഏതെങ്കിലും ജോലിയുടെ ഷെഡ്യൂൾ മാറ്റാം</p>
            </div>
          </div>

          {filteredRequests.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-300 text-slate-500 text-xs">
              ഈ ഫിൽട്ടറിൽ വർക്ക് ഷെഡ്യൂളുകൾ ഒന്നും ലഭ്യമല്ല.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRequests.map((req, idx) => {
                const coords = getRequestCoords(req, idx);
                const dist = calculateDistanceKm(11.8797, 75.7142, coords.lat, coords.lng);

                return (
                  <div
                    key={req.id || idx}
                    className="p-4 bg-slate-50/80 hover:bg-slate-100/90 rounded-2xl border border-slate-200/90 transition shadow-sm space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                          <span>{req.customerName}</span>
                          <a
                            href={`tel:${req.customerPhone}`}
                            className="text-emerald-700 text-xs hover:underline flex items-center gap-0.5"
                          >
                            <Phone className="w-3 h-3 inline" /> {req.customerPhone}
                          </a>
                        </h4>
                        <p className="text-xs text-slate-600 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                          <span className="font-semibold">{req.customerLocation}</span>
                          <span className="text-slate-400">({dist} KM അകലെ)</span>
                        </p>
                      </div>
                      <div>{getStatusBadge(req.status)}</div>
                    </div>

                    {/* Service & Details */}
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200/60 text-xs space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-slate-700">ആവശ്യമുള്ള ജോലി:</span>
                        {req.selectedServices.map((s, i) => (
                          <span key={i} className="bg-emerald-50 text-emerald-800 font-bold px-2 py-0.5 rounded-md border border-emerald-200">
                            {s}
                          </span>
                        ))}
                      </div>

                      {/* Scheduled info if available */}
                      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100 text-slate-700">
                        <div className="flex items-center gap-1 text-[11px]">
                          <CalendarIcon className="w-3.5 h-3.5 text-amber-600" />
                          <span>
                            തീയതി: <strong className="text-slate-900">{req.scheduledDate || req.preferredDate || 'തീരുമാനിച്ചിട്ടില്ല'}</strong>
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-[11px]">
                          <ClockIcon className="w-3.5 h-3.5 text-teal-600" />
                          <span>
                            സമയം: <strong className="text-slate-900">{req.scheduledTime || '08:30 AM'}</strong>
                          </span>
                        </div>
                      </div>

                      {req.assignedWorkerName && (
                        <div className="flex items-center gap-1 text-[11px] text-teal-800 bg-teal-50 px-2 py-1 rounded-lg border border-teal-200 mt-1">
                          <UserIcon className="w-3.5 h-3.5 text-teal-600" />
                          <span>തൊഴിലാളി: <strong>{req.assignedWorkerName}</strong></span>
                        </div>
                      )}
                    </div>

                    {/* Action Bar */}
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <button
                        onClick={() => openScheduleModal(req, idx)}
                        className="flex-1 py-2 px-3 bg-emerald-800 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
                      >
                        <ClockIcon className="w-3.5 h-3.5" />
                        <span>{req.scheduledDate ? 'ഷെഡ്യൂൾ മാറ്റുക' : 'ഷെഡ്യൂൾ ചെയ്യുക'}</span>
                      </button>

                      <a
                        href={`https://www.google.com/maps/dir/?api=1&origin=11.8797,75.7142&destination=${coords.lat},${coords.lng}`}
                        target="_blank"
                        rel="noreferrer"
                        className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0"
                      >
                        <Navigation className="w-3.5 h-3.5 text-blue-600" />
                        <span>ഗൂഗിൾ മാപ്പ് റൂട്ട്</span>
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Schedule & Location Editing Modal */}
        {isScheduleModalOpen && selectedRequestForSchedule && (
          <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-3xl max-w-md w-full p-5 space-y-4 border border-slate-200 shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                    <CalendarIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">വർക്ക് ഷെഡ്യൂളർ</h3>
                    <p className="text-xs text-slate-500">{selectedRequestForSchedule.customerName} - {schedLocationName}</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsScheduleModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Body Form */}
              <div className="space-y-3 text-xs">
                {/* Location Name & Preset Chips */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">സ്ഥലനാമം / ലൊക്കേഷൻ</label>
                  <input
                    type="text"
                    value={schedLocationName}
                    onChange={(e) => setSchedLocationName(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none"
                    placeholder="കോളയാട്, പേരാവൂർ..."
                  />
                  {/* Quick Town Chips */}
                  <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                    {Object.keys(LOCAL_TOWNS).map((town) => (
                      <button
                        key={town}
                        type="button"
                        onClick={() => {
                          setSchedLocationName(town);
                          setSchedLat(LOCAL_TOWNS[town].lat);
                          setSchedLng(LOCAL_TOWNS[town].lng);
                        }}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition ${
                          schedLocationName.includes(town)
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                        }`}
                      >
                        {town}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Schedule Date & Time */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">ഷെഡ്യൂൾ തീയതി</label>
                    <input
                      type="date"
                      value={schedDate}
                      onChange={(e) => setSchedDate(e.target.value)}
                      className="w-full p-2.5 border border-slate-300 rounded-xl font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">സമയം (Time Slot)</label>
                    <select
                      value={schedTime}
                      onChange={(e) => setSchedTime(e.target.value)}
                      className="w-full p-2.5 border border-slate-300 rounded-xl font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none"
                    >
                      <option value="രാവിലെ 08:00 AM">രാവിലെ 08:00 AM</option>
                      <option value="രാവിലെ 09:30 AM">രാവിലെ 09:30 AM</option>
                      <option value="ഉച്ചയ്ക്ക് 01:30 PM">ഉച്ചയ്ക്ക് 01:30 PM</option>
                      <option value="വൈകുന്നേരം 04:00 PM">വൈകുന്നേരം 04:00 PM</option>
                    </select>
                  </div>
                </div>

                {/* Assigned Worker Dropdown */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">ചുമതലയുള്ള തൊഴിലാളി (Assigned Worker)</label>
                  <select
                    value={schedWorker}
                    onChange={(e) => setSchedWorker(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-xl font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none"
                  >
                    <option value="">-- തൊഴിലാളിയെ തിരഞ്ഞെടുക്കുക --</option>
                    {Array.from({ length: 50 }, (_, i) => i + 1).map((num) => {
                      const name = workerNamesMap[num] || `തൊഴിലാളി #${num}`;
                      return (
                        <option key={num} value={name}>
                          #{num} - {name}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Status Selector */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">വർക്ക് സ്റ്റാറ്റസ്</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSchedStatus('new')}
                      className={`p-2 rounded-xl text-xs font-bold border flex items-center justify-center gap-1 ${
                        schedStatus === 'new' ? 'bg-rose-600 text-white border-rose-600' : 'bg-[#f8fafc] text-slate-700 border-slate-200'
                      }`}
                    >
                      🔴 പുതിയത്
                    </button>
                    <button
                      type="button"
                      onClick={() => setSchedStatus('contacted')}
                      className={`p-2 rounded-xl text-xs font-bold border flex items-center justify-center gap-1 ${
                        schedStatus === 'contacted' ? 'bg-amber-600 text-white border-amber-600' : 'bg-[#f8fafc] text-slate-700 border-slate-200'
                      }`}
                    >
                      🟡 ഷെഡ്യൂൾ ചെയ്തു
                    </button>
                    <button
                      type="button"
                      onClick={() => setSchedStatus('accepted')}
                      className={`p-2 rounded-xl text-xs font-bold border flex items-center justify-center gap-1 ${
                        schedStatus === 'accepted' ? 'bg-blue-600 text-white border-blue-600' : 'bg-[#f8fafc] text-slate-700 border-slate-200'
                      }`}
                    >
                      🔵 ഇൻ പ്രോഗ്രസ്
                    </button>
                    <button
                      type="button"
                      onClick={() => setSchedStatus('completed')}
                      className={`p-2 rounded-xl text-xs font-bold border flex items-center justify-center gap-1 ${
                        schedStatus === 'completed' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-[#f8fafc] text-slate-700 border-slate-200'
                      }`}
                    >
                      🟢 പൂർത്തിയായി
                    </button>
                  </div>
                </div>

                {/* Coordinates Preview */}
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-1 text-[11px] text-slate-600">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">മാപ്പ് അക്ഷാംശം / രേഖാംശം (Coordinates):</span>
                    <span className="font-mono text-emerald-800 font-bold">{schedLat.toFixed(4)}, {schedLng.toFixed(4)}</span>
                  </div>
                  <p className="text-[10px] text-slate-500">കോളയാട് ഹെഡ് ഓഫീസിൽ നിന്നുമുള്ള ദൂരം: {calculateDistanceKm(11.8797, 75.7142, schedLat, schedLng)} KM</p>
                </div>
              </div>

              {/* Modal Save / Cancel buttons */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsScheduleModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
                >
                  റദ്ദാക്കുക
                </button>
                <button
                  type="button"
                  onClick={handleSaveSchedule}
                  disabled={schedSaving}
                  className="px-5 py-2 bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition shadow-md flex items-center gap-1.5 disabled:opacity-50"
                >
                  {schedSaving ? (
                    <span>സേവ് ചെയ്യുന്നു...</span>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>ഷെഡ്യൂൾ സേവ് ചെയ്യുക</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const handleServiceRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLeadError('');

    if (!leadName.trim()) {
      setLeadError('നിങ്ങളുടെ പേര് നൽകുക');
      return;
    }
    if (!leadPhone.trim() || leadPhone.replace(/\D/g, '').length < 10) {
      setLeadError('ശരിയായ 10 അക്ക ഫോൺ നമ്പർ നൽകുക');
      return;
    }
    if (leadServices.length === 0) {
      setLeadError('ആവശ്യമുള്ള കുറഞ്ഞത് ഒരു സേവനമെങ്കിലും തിരഞ്ഞെടുക്കുക');
      return;
    }

    setLeadSubmitting(true);
    try {
      const payload = {
        customerName: leadName.trim(),
        customerPhone: leadPhone.trim(),
        customerLocation: leadLocation.trim() || 'കോളയാട്',
        selectedServices: leadServices,
        additionalDetails: leadNotes.trim(),
        preferredDate: leadDate.trim()
      };

      const res = await fetch('/api/submit-service-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Failed to submit callback request');

      setLeadSuccess(true);
      setLeadName('');
      setLeadPhone('');
      setLeadNotes('');
      setLeadDate('');
      loadServiceRequests();
    } catch (err) {
      console.error(err);
      setLeadError('സമർപ്പിക്കാൻ കഴിഞ്ഞില്ല. ദയവായി വീണ്ടും ശ്രമിക്കുക.');
    } finally {
      setLeadSubmitting(false);
    }
  };

  const handleUpdateServiceRequestStatus = async (id: string, newStatus: 'new' | 'contacted' | 'accepted' | 'completed') => {
    try {
      const res = await fetch('/api/update-service-request-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus })
      });
      if (res.ok) {
        loadServiceRequests();
      }
    } catch (err) {
      console.error('Failed to update lead status', err);
    }
  };

  const handleDeleteServiceRequest = async (id: string) => {
    if (!confirm('ഈ കസ്റ്റമർ കോൾ ബാക്ക് റിക്വസ്റ്റ് ഡിലീറ്റ് ചെയ്യണമെന്നുറപ്പാണോ?')) return;
    try {
      const res = await fetch('/api/delete-service-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      if (res.ok) {
        loadServiceRequests();
      }
    } catch (err) {
      console.error('Failed to delete lead request', err);
    }
  };

  // Update target worker when entryFor or activeWorker changes
  useEffect(() => {
    if (entryFor === 'self') {
      setTargetWorkerNumber(activeWorkerNumber);
      setTargetWorkerName(activeWorkerName);
    }
  }, [entryFor, activeWorkerNumber, activeWorkerName]);

  const loadSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        setBotToken(data.telegramBotToken || '');
        setBossChatId(data.ownerChatId || '');
        if (data.businessPhone) {
          setBusinessPhone(data.businessPhone);
          localStorage.setItem('worklog_business_phone', data.businessPhone);
        }
      }
    } catch (err) {
      console.error('Failed to load settings', err);
    }
  };

  const loadLogs = async () => {
    setLoadingLogs(true);
    try {
      const q = query(collection(db, 'work_logs'), orderBy('date', 'desc'), limit(100));
      const snap = await getDocs(q);
      const list: WorkLog[] = [];
      const nameMap: Record<number, string> = { ...workerNamesMap };

      snap.forEach((doc) => {
        const item = doc.data() as any;
        list.push({ id: doc.id, ...item });
        if (item.workerNumber && item.workerName && !item.workerName.startsWith('തൊഴിലാളി')) {
          nameMap[item.workerNumber] = item.workerName;
        }
      });

      setLogs(list);
      setWorkerNamesMap(nameMap);
      localStorage.setItem('worklog_names_map', JSON.stringify(nameMap));

      // Auto update active worker name if saved name exists
      if (nameMap[activeWorkerNumber] && (!activeWorkerName || activeWorkerName.startsWith('തൊഴിലാളി'))) {
        setActiveWorkerName(nameMap[activeWorkerNumber]);
      }
    } catch (err) {
      console.error('Failed to load logs', err);
    } finally {
      setLoadingLogs(false);
    }
  };

  // Helper to record worker name
  const saveNameForWorker = (num: number, name: string) => {
    const cleanName = name.trim();
    if (!cleanName) return;
    setWorkerNamesMap((prev) => {
      const updated = { ...prev, [num]: cleanName };
      localStorage.setItem('worklog_names_map', JSON.stringify(updated));
      return updated;
    });
  };

  // Save active profile to localStorage
  const handleSaveProfile = (num: number, name: string) => {
    const cleanName = name.trim() || workerNamesMap[num] || `തൊഴിലാളി ${num}`;
    setActiveWorkerNumber(num);
    setActiveWorkerName(cleanName);
    saveNameForWorker(num, cleanName);
    localStorage.setItem('worklog_active_number', String(num));
    localStorage.setItem('worklog_active_name', cleanName);
    setIsProfileModalOpen(false);
    if (entryFor === 'self') {
      setTargetWorkerNumber(num);
      setTargetWorkerName(cleanName);
    }
  };

  // Handle Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!siteName.trim()) {
      setFormError('സൈറ്റിന്റെ പേര് / സ്ഥലം രേഖപ്പെടുത്തുക');
      return;
    }
    if (!workDescription.trim()) {
      setFormError('ചെയ്ത ജോലിയുടെ വിവരങ്ങൾ രേഖപ്പെടുത്തുക');
      return;
    }

    // Determine target date
    const today = new Date();
    let computedDate = today.toISOString().split('T')[0];
    if (dateType === 'yesterday') {
      const yest = new Date(today);
      yest.setDate(today.getDate() - 1);
      computedDate = yest.toISOString().split('T')[0];
    } else if (dateType === 'custom') {
      computedDate = customDate;
    }

    setSubmitting(true);
    try {
      const finalThach = isCustomThach ? (Number(customThachInput) || 1) : thachCount;
      const finalName = targetWorkerName.trim() || workerNamesMap[targetWorkerNumber] || `തൊഴിലാളി #${targetWorkerNumber}`;
      
      saveNameForWorker(targetWorkerNumber, finalName);
      if (targetWorkerNumber === activeWorkerNumber) {
        setActiveWorkerName(finalName);
        localStorage.setItem('worklog_active_name', finalName);
      }

      const payload = {
        workerNumber: targetWorkerNumber,
        workerName: finalName,
        date: computedDate,
        siteName: siteName.trim(),
        workDescription: workDescription.trim(),
        thachCount: finalThach,
        vehicleRent: Number(vehicleRent) || 0,
        foodExpense: Number(foodExpense) || 0,
        toolsRent: Number(toolsRent) || 0,
        otherExpense: Number(otherExpense) || 0,
        submittedBy: `തൊഴിലാളി #${activeWorkerNumber} (${activeWorkerName})`
      };

      const res = await fetch('/api/submit-work-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error('Failed to submit work log');
      }

      setLastSubmittedWorker(targetWorkerNumber);
      setSubmitSuccess(true);
      
      // Reset form
      setWorkDescription('');
      setVehicleRent('');
      setFoodExpense('');
      setToolsRent('');
      setOtherExpense('');
      
      // Refresh logs list
      loadLogs();
    } catch (err) {
      console.error(err);
      setFormError('വിവരങ്ങൾ സേവ് ചെയ്യാൻ കഴിഞ്ഞില്ല. ദയവായി വീണ്ടും ശ്രമിക്കുക.');
    } finally {
      setSubmitting(false);
    }
  };

  // Save Bot & Business Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setSettingsMessage(null);
    try {
      const res = await fetch('/api/setup-telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: botToken.trim(),
          chatId: bossChatId.trim(),
          businessPhone: businessPhone.trim()
        })
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem('worklog_business_phone', businessPhone.trim());
        setSettingsMessage({
          text: '✅ ബോട്ട് & ബിസിനസ്സ് ഫോൺ നമ്പർ വിജയകരമായി സേവ് ചെയ്തു!',
          isError: false
        });
      } else {
        setSettingsMessage({
          text: '❌ ' + (data.message || 'പരാജയപ്പെട്ടു'),
          isError: true
        });
      }
    } catch (err) {
      setSettingsMessage({
        text: '❌ സെർവറുമായി ബന്ധപ്പെടാൻ സാധിച്ചില്ല',
        isError: true
      });
    } finally {
      setSavingSettings(false);
    }
  };

  // CSV Export for workers/supervisor
  const handleExportCSV = () => {
    const filtered = filterWorkerNumber === 'all' 
      ? logs 
      : logs.filter(l => l.workerNumber === filterWorkerNumber);

    const headers = ['നമ്പർ (Worker #)', 'പേര് (Name)', 'തീയതി (Date)', 'സൈറ്റ് (Site)', 'ജോലി (Work)', 'വണ്ടി വാടക (Vehicle)', 'ഫുഡ് (Food)', 'ഉപകരണങ്ങൾ (Tools)', 'മറ്റുള്ളവ (Other)', 'ആകെ (Total)', 'രേഖപ്പെടുത്തിയത് (Submitted By)'];
    const rows = filtered.map(l => {
      const tot = (Number(l.vehicleRent) || 0) + (Number(l.foodExpense) || 0) + (Number(l.toolsRent) || 0) + (Number(l.otherExpense) || 0);
      return [
        l.workerNumber,
        `"${l.workerName}"`,
        l.date,
        `"${l.siteName}"`,
        `"${l.workDescription.replace(/"/g, '""')}"`,
        l.vehicleRent || 0,
        l.foodExpense || 0,
        l.toolsRent || 0,
        l.otherExpense || 0,
        tot,
        `"${l.submittedBy || ''}"`
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Work_Logs_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Toggle selected service in callback form
  const toggleLeadService = (svcName: string) => {
    setLeadServices(prev => 
      prev.includes(svcName) ? prev.filter(s => s !== svcName) : [...prev, svcName]
    );
  };

  // Render Public Services Landing Page JSX - Exterior Solutions
  const renderPublicServicesSection = () => {
    // Calculate Estimated Price Range based on choices
    const calculateEstimate = () => {
      let baseMin = 0;
      let baseMax = 0;
      let timeline = '1 - 2 ദിവസങ്ങൾ';

      if (calcService === 'painting') {
        const rateMin = calcQuality === 'standard' ? 12 : calcQuality === 'premium' ? 18 : 25;
        const rateMax = calcQuality === 'standard' ? 15 : calcQuality === 'premium' ? 22 : 32;
        baseMin = calcUnits * rateMin;
        baseMax = calcUnits * rateMax;
        timeline = calcUnits > 2000 ? '4 - 6 ദിവസങ്ങൾ' : calcUnits > 1000 ? '2 - 3 ദിവസങ്ങൾ' : '1 - 2 ദിവസങ്ങൾ';
      } else if (calcService === 'terrace') {
        const rateMin = calcQuality === 'standard' ? 22 : calcQuality === 'premium' ? 32 : 45;
        const rateMax = calcQuality === 'standard' ? 28 : calcQuality === 'premium' ? 38 : 55;
        baseMin = calcUnits * rateMin;
        baseMax = calcUnits * rateMax;
        timeline = calcUnits > 1500 ? '3 - 4 ദിവസങ്ങൾ' : '1 - 2 ദിവസങ്ങൾ';
      } else if (calcService === 'wall_moss') {
        const rateMin = calcQuality === 'standard' ? 6 : calcQuality === 'premium' ? 10 : 14;
        const rateMax = calcQuality === 'standard' ? 8 : calcQuality === 'premium' ? 12 : 18;
        baseMin = calcUnits * rateMin;
        baseMax = calcUnits * rateMax;
        timeline = '1 ദിവസം';
      } else if (calcService === 'well') {
        baseMin = Math.max(1800, calcUnits * 70);
        baseMax = Math.max(2500, calcUnits * 95);
        timeline = '3 - 6 മണിക്കൂർ (സെയിം ഡേ)';
      } else if (calcService === 'tank') {
        baseMin = calcUnits <= 1000 ? 1200 : calcUnits <= 2000 ? 1800 : 2500;
        baseMax = calcUnits <= 1000 ? 1600 : calcUnits <= 2000 ? 2400 : 3500;
        timeline = '2 - 3 മണിക്കൂർ';
      }

      return {
        min: Math.round(baseMin),
        max: Math.round(baseMax),
        timeline
      };
    };

    const currentEstimate = calculateEstimate();

    const availableServices = [
      {
        id: 'painting',
        title: 'എക്സ്റ്റീരിയർ പെയിന്റിംഗ് & ടെക്സ്ചർ',
        titleEn: 'Exterior Painting & Weatherproof Coating',
        sub: 'വീടുകളുടെയും കെട്ടിടങ്ങളുടെയും പുറം ഭിത്തികളിൽ കാലാവസ്ഥയെ ചെറുക്കുന്ന അപെക്സ് / റോയൽ ഫിനിഷിംഗ്',
        subEn: 'Exterior House Painting, Primer & Weather Seal Apex Coatings',
        category: 'painting',
        keywords: ['പെയിന്റിംഗ്', 'പെയിന്റ്', 'painting', 'paint', 'painter', 'exterior', 'house', 'wall', 'painting work', 'home', 'കോളയാട്', 'പേരാവൂർ', 'ഇരിട്ടി', 'മട്ടന്നൂർ'],
        icon: Paintbrush,
        badge: '10 വർഷം ഈടുനിൽക്കുന്നത്',
        priceTag: '₹12 - ₹25 / sq.ft',
        color: 'from-emerald-600 to-teal-800'
      },
      {
        id: 'roofseal_paint',
        title: 'ടെറസ് പായൽ മാറ്റി വാട്ടർപ്രൂഫ് റൂഫ് സീൽ',
        titleEn: 'Terrace Waterproofing & RoofSeal Coating',
        sub: 'ടെറസിലെ പായലും കറയും കഴുകി ചോർച്ച പൂർണ്ണമായി തടയാൻ പോളിയുറിത്തീൻ വാട്ടർപ്രൂഫ് റൂഫ് സീൽ കോട്ടിംഗ്',
        subEn: 'High Pressure Terrace Wash, Leak Proofing & Elastic RoofSeal',
        category: 'moss_roofseal',
        keywords: ['ടെറസ്', 'പായൽ', 'റൂഫ്സീൽ', 'വാട്ടർപ്രൂഫിംഗ്', 'terrace', 'roofseal', 'roof seal', 'payal', 'moss', 'leakproof', 'waterproof', 'leakage', 'charcha'],
        icon: Sparkles,
        badge: '100% Leak Proof Shield',
        priceTag: '₹25 - ₹45 / sq.ft',
        color: 'from-amber-500 to-orange-600'
      },
      {
        id: 'well_cleaning',
        title: 'കിണർ ഡീപ്പ് ക്ലീനിംഗ് & സ്ലഡ്ജ് പമ്പിംഗ്',
        titleEn: 'Deep Well Cleaning & Sludge Pumping',
        sub: 'കിണറിലെ വെള്ളം ഹൈ-പവർ പമ്പ് ഉപയോഗിച്ച് വറ്റിച്ച് അടിത്തട്ടിലെ ചെളിയും പാർശ്വങ്ങളിലെ പായലും ശുചീകരിക്കുന്നു',
        subEn: 'Complete Well Pumping, Wall Scrubbing & Sludge Removal',
        category: 'well_cleaning',
        keywords: ['കിണർ', 'വൃത്തിയാക്കൽ', 'kinar', 'well', 'clean', 'cleaning', 'vrithiyakkal', 'sludge', 'water pump', 'cheli', 'കോളയാട്', 'പേരാവൂർ'],
        icon: Droplets,
        badge: 'ഹൈ-പ്രഷർ സക്ഷൻ',
        priceTag: 'സെയിം ഡേ ക്ലീനിംഗ്',
        color: 'from-blue-600 to-cyan-700'
      },
      {
        id: 'tank_cleaning',
        title: 'വാട്ടർ ടാങ്ക് ഡിസ്ഇൻഫെക്ഷൻ & ക്ലീനിംഗ്',
        titleEn: 'Overhead & Underground Water Tank Sanitization',
        sub: 'വാട്ടർ ടാങ്കുകളിലെ പായൽ, അഴുക്ക്, ബാക്ടീരിയ എന്നിവ ഫുഡ്-ഗ്രേഡ് സാനിറ്റൈസിംഗ് രീതിയിൽ ശുദ്ധീകരിക്കുന്നു',
        subEn: 'Pressure Wash & UV Sanitized Overhead Water Tank Service',
        category: 'tank_cleaning',
        keywords: ['വാട്ടർ', 'ടാങ്ക്', 'ക്ലീനിംഗ്', 'water tank', 'tank', 'clean', 'cleaning', 'sanitization', 'water', 'സുരക്ഷിത ജലം'],
        icon: ShieldCheck,
        badge: 'ഫുഡ് ഗ്രേഡ് സാനിറ്റൈസ്ഡ്',
        priceTag: 'Starting at ₹1,200',
        color: 'from-teal-600 to-emerald-700'
      },
      {
        id: 'wall_moss_paint',
        title: 'ചുറ്റുമതിലിലെ പായൽ കളഞ്ഞ് വാഷ് & പെയിന്റ്',
        titleEn: 'Compound Wall Moss Removal & Apex Paint',
        sub: 'മതിലുകളിലെ കറുത്ത പായലും പായൽ തന്തുക്കളും ഹൈ-പ്രഷർ വാഷറിലൂടെ കഴുകി ആന്റി-ഫംഗൽ പെയിന്റ് അടിക്കുന്നു',
        subEn: 'Pressure Wash Wall Scrubbing & Weather Guard Wall Paint',
        category: 'moss_roofseal',
        keywords: ['മതിൽ', 'പായൽ', 'പെയിന്റ്', 'wall', 'moss', 'cleaning', 'moss removal', 'paint', 'payal', 'mathil', 'pressure wash'],
        icon: HomeIcon,
        badge: 'Anti-Fungal Protection',
        priceTag: '₹8 - ₹14 / sq.ft',
        color: 'from-slate-700 to-slate-900'
      },
      {
        id: 'general_wash',
        title: 'ഇന്റർലോക്ക് & ഡ്രൈവ്‌വേ പ്രഷർ വാഷിംഗ്',
        titleEn: 'Interlock, Driveway & Tile Power Washing',
        sub: 'മുറ്റത്തെ ടൈൽസ്, ഇന്റർലോക്ക് തറകൾ, ആർച്ച് സ്ട്രക്ചറുകൾ എന്നിവയിലെ ചെളിയും പായലും പൂർണ്ണമായി കഴുകുന്നു',
        subEn: 'Driveway Power Washing, Interlock Cleaning & Tile Wash',
        category: 'general_wash',
        keywords: ['പ്രഷർ', 'വാഷിംഗ്', 'ക്ലീനിംഗ്', 'interlock', 'tiles', 'floor', 'power wash', 'driveway'],
        icon: Wrench,
        badge: 'സ്പാർക്ലിംഗ് ക്ലീൻ',
        priceTag: 'ക്വിക്ക് സർവീസ്',
        color: 'from-indigo-600 to-purple-800'
      }
    ];

    // Filter by search query
    const filteredServices = availableServices.filter(svc => {
      const matchesCategory = selectedServiceCategory === 'all' || svc.category === selectedServiceCategory;
      if (!matchesCategory) return false;

      if (!serviceSearchQuery.trim()) return true;
      const q = serviceSearchQuery.toLowerCase().trim();

      const inTitle = svc.title.toLowerCase().includes(q);
      const inTitleEn = svc.titleEn.toLowerCase().includes(q);
      const inSub = svc.sub.toLowerCase().includes(q);
      const inSubEn = svc.subEn.toLowerCase().includes(q);
      const inKeywords = svc.keywords.some(kw => kw.toLowerCase().includes(q));

      return inTitle || inTitleEn || inSub || inSubEn || inKeywords;
    });

    return (
      <div className="space-y-8 pb-16">
        
        {/* Modern Corporate Hero Header Banner */}
        <div className="relative bg-slate-900 rounded-3xl p-6 md:p-8 text-white border border-slate-800 shadow-2xl overflow-hidden">
          {/* Subtle Background Glow Elements */}
          <div className="absolute -top-12 -right-12 w-64 h-64 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-12 -left-12 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 space-y-5">
            
            {/* Top Brand Taglines */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-800/80 pb-4">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 bg-emerald-500/20 border border-emerald-400/30 rounded-full text-[11px] font-bold text-emerald-300 flex items-center gap-1.5 shadow-sm">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  സർട്ടിഫൈഡ് എക്സ്റ്റീരിയർ കോൺട്രാക്ടർമാർ
                </span>
                <span className="px-3 py-1 bg-emerald-500/20 border border-emerald-400/30 rounded-full text-[11px] font-bold text-emerald-300 hidden sm:inline-flex items-center gap-1">
                  ✓ 100% ക്വാളിറ്റി ഗ്യാരന്റി
                </span>
              </div>
              <span className="text-[11px] font-medium text-slate-400 bg-slate-800/90 px-3 py-1 rounded-xl border border-slate-700/60 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                കോളയാട് • പേരാവൂർ • ഇരിട്ടി • മട്ടന്നൂർ (20 KM Radius)
              </span>
            </div>

            {/* Main Brand Title & Description */}
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-800 p-0.5 shadow-lg shrink-0">
                  <div className="w-full h-full bg-slate-900 rounded-[14px] flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-emerald-400" />
                  </div>
                </div>
                <div>
                  <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
                    EXTERIOR SOLUTIONS
                    <span className="text-xs font-semibold px-2 py-0.5 bg-emerald-600 text-white rounded-md tracking-normal">OFFICIAL</span>
                  </h2>
                  <p className="text-xs font-semibold text-emerald-400 tracking-wide">
                    പ്രൊഫഷണൽ എക്സ്റ്റീരിയർ പെയിന്റിംഗ്, കിണർ & ടാങ്ക് ക്ലീനിംഗ് സർവീസസ്
                  </p>
                </div>
              </div>

              <p className="text-xs md:text-sm text-slate-300 leading-relaxed max-w-2xl pt-1">
                വീടുകൾക്കും കെട്ടിടങ്ങൾക്കും ഏറ്റവും മനോഹരമായ പുറം അലങ്കാരം, ചോർച്ച തടയുന്ന വാട്ടർപ്രൂഫ് റൂഫ് സീൽ, കിണറുകളുടെയും വാട്ടർ ടാങ്കുകളുടെയും ഹൈ-പ്രഷർ ശുചീകരണം എന്നിവ അത്യാധുനിക ഉപകരണങ്ങളോടെ ചെയ്തു നൽകുന്നു.
              </p>
            </div>

            {/* Key Trust Credentials Badges */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              <div className="bg-slate-800/60 border border-slate-700/60 p-2.5 rounded-2xl text-center space-y-0.5">
                <p className="text-[10px] text-slate-400 font-medium">ലേബർ ഗ്യാരന്റി</p>
                <p className="text-xs font-bold text-emerald-300">100% ലീക്ക് പ്രൂഫ്</p>
              </div>
              <div className="bg-slate-800/60 border border-slate-700/60 p-2.5 rounded-2xl text-center space-y-0.5">
                <p className="text-[10px] text-slate-400 font-medium">സൈറ്റ് സർവേ</p>
                <p className="text-xs font-bold text-amber-300">1 മണിക്കൂറിനകം</p>
              </div>
              <div className="bg-slate-800/60 border border-slate-700/60 p-2.5 rounded-2xl text-center space-y-0.5">
                <p className="text-[10px] text-slate-400 font-medium">പെയിന്റ് മെറ്റീരിയൽ</p>
                <p className="text-xs font-bold text-emerald-300">Asian Apex / Berger</p>
              </div>
              <div className="bg-slate-800/60 border border-slate-700/60 p-2.5 rounded-2xl text-center space-y-0.5">
                <p className="text-[10px] text-slate-400 font-medium">വർക്കർമാർ</p>
                <p className="text-xs font-bold text-blue-300">പരിശീലനം ലഭിച്ചവർ</p>
              </div>
            </div>

            {/* Direct Quick Call & WhatsApp Action Buttons */}
            <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <a
                href={`tel:+91${businessPhone.replace(/\D/g, '')}`}
                className="flex items-center justify-center gap-2.5 py-3.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs md:text-sm rounded-2xl shadow-xl border border-emerald-400/40 transition active:scale-95 group"
              >
                <PhoneCall className="w-4 h-4 group-hover:animate-bounce" />
                <span>നേരിട്ട് വിളിക്കാൻ: +91 {businessPhone}</span>
              </a>
              <a
                href={`https://wa.me/91${businessPhone.replace(/\D/g, "")}?text=Hello%20Exterior%20Solutions!%20I%20need%20a%20free%20quote.`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2.5 py-3.5 px-4 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs md:text-sm rounded-2xl shadow-xl border border-slate-700 transition active:scale-95"
              >
                <MessageSquare className="w-4 h-4 text-emerald-400" />
                <span>WhatsApp വഴി മെസ്സേജ് അയക്കുക</span>
              </a>
            </div>

          </div>
        </div>

        {/* Interactive Instant Cost & Time Estimator Widget */}
        <div className="bg-white rounded-3xl p-5 md:p-7 border border-slate-200/90 shadow-lg space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                ⚡ ഇന്ററാക്ടീവ് ടൂൾ
              </span>
              <h3 className="text-base md:text-lg font-bold text-slate-900 mt-1 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-600" />
                പണിയുടെ ചിലവ് കണക്കാക്കുക (Instant Cost Estimator)
              </h3>
            </div>
            <span className="text-xs text-slate-500">
              ഒരു മിനിറ്റിൽ കണക്കാക്കാം
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Left Options Controls */}
            <div className="lg:col-span-7 space-y-4">
              
              {/* Step 1: Select Service */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">1. പണിയുടെ തരം തിരഞ്ഞെടുക്കുക (Job Type):</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { id: 'painting', label: '🎨 എക്സ്റ്റീരിയർ പെയിന്റിംഗ്', unitLabel: 'sq.ft' },
                    { id: 'terrace', label: '🏠 ടെറസ് റൂഫ് സീൽ', unitLabel: 'sq.ft' },
                    { id: 'wall_moss', label: '🧱 മതിൽ വാഷിംഗ് & പെയിന്റ്', unitLabel: 'sq.ft' },
                    { id: 'well', label: '🚰 കിണർ ക്ലീനിംഗ്', unitLabel: 'അടി (Depth)' },
                    { id: 'tank', label: '💧 വാട്ടർ ടാങ്ക്', unitLabel: 'ലിറ്റർ (Capacity)' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setCalcService(item.id as any);
                        if (item.id === 'painting' || item.id === 'terrace' || item.id === 'wall_moss') setCalcUnits(1200);
                        else if (item.id === 'well') setCalcUnits(35);
                        else if (item.id === 'tank') setCalcUnits(1000);
                      }}
                      className={`p-2.5 rounded-2xl border text-left text-xs font-bold transition ${
                        calcService === item.id 
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-md scale-[1.02]' 
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Step 2: Quantity Slider / Input */}
              <div className="space-y-2 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                  <span>
                    2. അളവ് (Size / Area):
                  </span>
                  <span className="text-emerald-700 text-sm font-mono bg-white px-3 py-1 rounded-xl border border-slate-200 shadow-sm">
                    {calcUnits.toLocaleString()} {calcService === 'well' ? 'അടി (Depth)' : calcService === 'tank' ? 'Liters' : 'sq.ft'}
                  </span>
                </div>

                <input
                  type="range"
                  min={calcService === 'well' ? 15 : calcService === 'tank' ? 500 : 300}
                  max={calcService === 'well' ? 80 : calcService === 'tank' ? 5000 : 4000}
                  step={calcService === 'well' ? 5 : calcService === 'tank' ? 250 : 100}
                  value={calcUnits}
                  onChange={(e) => setCalcUnits(Number(e.target.value))}
                  className="w-full accent-emerald-600 cursor-pointer h-2 bg-slate-200 rounded-lg"
                />

                <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold">
                  <span>{calcService === 'well' ? '15 അടി' : calcService === 'tank' ? '500 L' : '300 sq.ft'}</span>
                  <span>{calcService === 'well' ? '80 അടി' : calcService === 'tank' ? '5000 L' : '4,000 sq.ft'}</span>
                </div>
              </div>

              {/* Step 3: Finish Quality Tier */}
              {calcService !== 'well' && calcService !== 'tank' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">3. ക്വാളിറ്റി തിരഞ്ഞെടുക്കുക (Material Quality):</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'standard', title: 'Standard', desc: 'ബഡ്ജറ്റ് കോട്ടിംഗ്' },
                      { id: 'premium', title: 'Premium Weather Shield', desc: 'അപെക്സ് കോട്ടിംഗ്' },
                      { id: 'ultra', title: 'Ultra RoofSeal Pro', desc: 'അത്യുത്തമം (10 Yrs)' },
                    ].map((tier) => (
                      <button
                        key={tier.id}
                        type="button"
                        onClick={() => setCalcQuality(tier.id as any)}
                        className={`p-2.5 rounded-2xl border text-center text-xs transition ${
                          calcQuality === tier.id
                            ? 'bg-slate-900 text-white border-slate-900 shadow-md'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <p className="font-bold">{tier.title}</p>
                        <p className={`text-[10px] mt-0.5 ${calcQuality === tier.id ? 'text-emerald-300' : 'text-slate-500'}`}>{tier.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

            </div>

            {/* Right Display Output Card */}
            <div className="lg:col-span-5 bg-gradient-to-br from-emerald-900 via-teal-950 to-slate-900 text-white p-5 md:p-6 rounded-3xl border border-emerald-500/30 shadow-xl space-y-4">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-widest block">
                  കണക്കാക്കിയ ഏകദേശ സംഖ്യ:
                </span>
                <div className="text-2xl md:text-3xl font-extrabold text-amber-300 font-mono tracking-tight">
                  ₹{currentEstimate.min.toLocaleString()} - ₹{currentEstimate.max.toLocaleString()}
                </div>
                <p className="text-[11px] text-slate-300 pt-1">
                  *മെറ്റീരിയൽ + ലേബർ ചാർജ് ഉൾപ്പെടെയുള്ള അനുമാന തുക.
                </p>
              </div>

              <div className="border-t border-emerald-500/20 pt-3 space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-300">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-emerald-400" />
                    പൂർത്തിയാക്കാൻ എടുക്കുന്ന സമയം:
                  </span>
                  <span className="font-bold text-white">{currentEstimate.timeline}</span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    സൈറ്റ് വിസിറ്റ് & സർവേ:
                  </span>
                  <span className="font-bold text-emerald-300">സൗജന്യം (Free)</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setLeadServices([
                    calcService === 'painting' ? 'എക്സ്റ്റീരിയർ പെയിന്റിംഗ് & ടെക്സ്ചർ' :
                    calcService === 'terrace' ? 'ടെറസ് പായൽ മാറ്റി വാട്ടർപ്രൂഫ് റൂഫ് സീൽ' :
                    calcService === 'wall_moss' ? 'ചുറ്റുമതിലിലെ പായൽ കളഞ്ഞ് വാഷ് & പെയിന്റ്' :
                    calcService === 'well' ? 'കിണർ ഡീപ്പ് ക്ലീനിംഗ് & സ്ലഡ്ജ് പമ്പിംഗ്' : 'വാട്ടർ ടാങ്ക് ഡിസ്ഇൻഫെക്ഷൻ & ക്ലീനിംഗ്'
                  ]);
                  setLeadNotes(`Estimated Area: ${calcUnits} (${calcService}), Budget: ₹${currentEstimate.min} - ₹${currentEstimate.max}`);
                  const formEl = document.getElementById('callback-request-form');
                  if (formEl) formEl.scrollIntoView({ behavior: 'smooth' });
                }}
                className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs rounded-2xl shadow-lg border border-amber-300 transition active:scale-95 flex items-center justify-center gap-2"
              >
                <span>ഈ എസ്റ്റിമേറ്റിനായി ഫ്രീ സൈറ്റ് വിസിറ്റ് ക്ലെയിം ചെയ്യുക</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

          </div>
        </div>

        {/* Multi-Lingual Search & Filter Section */}
        <div className="bg-white rounded-3xl p-4 md:p-5 border border-slate-200 shadow-sm space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Search className="w-4 h-4 text-emerald-600" />
              <span>സേവനങ്ങൾ തിരയുക (Search Any Language)</span>
            </h3>
            <span className="text-[10px] font-bold px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full flex items-center gap-1">
              <Globe className="w-3 h-3 text-emerald-600" />
              മലയാളം • English • Manglish • हिंदी
            </span>
          </div>

          {/* Search Input Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={serviceSearchQuery}
              onChange={(e) => setServiceSearchQuery(e.target.value)}
              placeholder="ഉദാഹരണത്തിന്: kinar, painting, tank, roofseal, പായൽ, കുആൻ..."
              className="w-full h-11 pl-10 pr-9 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition"
            />
            {serviceSearchQuery && (
              <button
                type="button"
                onClick={() => setServiceSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Category Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
            {[
              { id: 'all', label: 'എല്ലാം (All)' },
              { id: 'painting', label: '🎨 പെയിന്റിംഗ് (Painting)' },
              { id: 'well_cleaning', label: '🚰 കിണർ ക്ലീനിംഗ് (Well Clean)' },
              { id: 'tank_cleaning', label: '💧 ടാങ്ക് ക്ലീനിംഗ് (Tank Clean)' },
              { id: 'moss_roofseal', label: '🏠 പായൽ & റൂഫ്സീൽ (RoofSeal)' },
            ].map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedServiceCategory(cat.id)}
                className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition text-[11px] ${
                  selectedServiceCategory === cat.id
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Services Grid */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              ലഭ്യമായ പ്രൊഫഷണൽ സേവനങ്ങൾ ({filteredServices.length}):
            </h3>
            {serviceSearchQuery && (
              <span className="text-xs text-slate-500">
                Found for "{serviceSearchQuery}"
              </span>
            )}
          </div>

          {filteredServices.length === 0 ? (
            <div className="p-8 bg-white rounded-3xl border border-slate-200 text-center space-y-2">
              <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
              <p className="text-sm font-bold text-slate-800">സേവനങ്ങളൊന്നും കണ്ടില്ല!</p>
              <p className="text-xs text-slate-500">മറ്റൊരു വാക്ക് അല്ലെങ്കിൽ ഇംഗ്ലീഷിലോ മലയാളത്തിലോ വീണ്ടും ടൈപ്പ് ചെയ്തു നോക്കൂ.</p>
              <button
                onClick={() => { setServiceSearchQuery(''); setSelectedServiceCategory('all'); }}
                className="mt-2 text-xs font-bold text-emerald-600 hover:underline"
              >
                എല്ലാ സേവനങ്ങളും കാണിക്കുക
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredServices.map((svc) => {
                const Icon = svc.icon;
                return (
                  <div 
                    key={svc.id}
                    className="bg-white rounded-2xl p-4 md:p-5 border border-slate-200 shadow-sm flex flex-col justify-between gap-3 hover:border-emerald-300 transition group hover:shadow-md"
                  >
                    <div className="flex items-start gap-3.5">
                      <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${svc.color} text-white flex items-center justify-center shrink-0 shadow-md group-hover:scale-105 transition duration-300`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <h4 className="text-sm font-bold text-slate-900 leading-tight">{svc.title}</h4>
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md shrink-0">
                            {svc.badge}
                          </span>
                        </div>
                        <p className="text-[11px] font-semibold text-emerald-700 leading-tight">{svc.titleEn}</p>
                        <p className="text-xs text-slate-600 leading-relaxed pt-0.5">{svc.sub}</p>
                      </div>
                    </div>

                    <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-900 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200/60 font-mono">
                        {svc.priceTag}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          if (!leadServices.includes(svc.title)) {
                            setLeadServices(prev => [...prev, svc.title]);
                          }
                          const formEl = document.getElementById('callback-request-form');
                          if (formEl) formEl.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="py-1.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold rounded-xl transition flex items-center gap-1 active:scale-95 shadow-sm"
                      >
                        <span>ഈ സേവനം ബുക്ക് ചെയ്യുക</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Quality Guarantee & Service Commitment */}
        <div className="bg-slate-900 text-white rounded-3xl p-5 md:p-6 border border-slate-800 shadow-lg space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold flex items-center gap-2 text-emerald-400">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>ഗുണനിലവാര വാഗ്ദാനം (Quality Commitment)</span>
            </h3>
            <span className="text-[10px] font-bold px-2.5 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full">
              100% Genuine Work
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-300">
            <div className="bg-slate-800/80 p-3.5 rounded-2xl border border-slate-700/60 space-y-1">
              <p className="font-bold text-white flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                പക്ക മെറ്റീരിയലുകൾ
              </p>
              <p className="text-[11px] text-slate-400">ഏഷ്യൻ അപെക്സ്, ബെർജർ പോലുള്ള ഒറിജിനൽ വെതർ സീൽ പെയിന്റുകൾ മാത്രം.</p>
            </div>
            <div className="bg-slate-800/80 p-3.5 rounded-2xl border border-slate-700/60 space-y-1">
              <p className="font-bold text-white flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-amber-400" />
                ഫ്രീ സൈറ്റ് ഇൻസ്‌പെക്ഷൻ
              </p>
              <p className="text-[11px] text-slate-400">കോളയാട് 20 KM ചുറ്റളവിൽ നേരിട്ടെത്തി സൈറ്റ് സർവേയും കൃത്യമായ കണക്കും നൽകുന്നു.</p>
            </div>
            <div className="bg-slate-800/80 p-3.5 rounded-2xl border border-slate-700/60 space-y-1">
              <p className="font-bold text-white flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-blue-400" />
                സുരക്ഷിത ശുചീകരണം
              </p>
              <p className="text-[11px] text-slate-400">കിണറും വാട്ടർ ടാങ്കുകളും ആധുനിക സക്ഷൻ പമ്പുകൾ ഉപയോഗിച്ച് കൃത്യമായി ക്ലീൻ ചെയ്യുന്നു.</p>
            </div>
          </div>
        </div>

        {/* Callback Request Form */}
        <div id="callback-request-form" className="bg-white rounded-3xl p-5 md:p-7 border border-slate-200 shadow-xl space-y-5">
          <div className="border-b border-slate-100 pb-3 space-y-1">
            <h3 className="text-base md:text-lg font-bold text-slate-900 flex items-center gap-2">
              <PhoneCall className="w-5 h-5 text-emerald-600" />
              സൗജന്യ സൈറ്റ് സർവേ & കോൾ ബാക്ക് (Request Free Inspection)
            </h3>
            <p className="text-xs text-slate-500">
              നിങ്ങളുടെ വിവരങ്ങൾ നൽകിയാൽ ഞങ്ങളുടെ ടെക്നീഷ്യൻ നേരിട്ട് വിളിച്ച് സമയം തിട്ടപ്പെടുത്തുന്നതാണ്!
            </p>
          </div>

          {leadSuccess ? (
            <div className="p-6 bg-emerald-50 rounded-2xl border border-emerald-200 text-center space-y-3 animate-fade-in">
              <div className="w-14 h-14 bg-emerald-600 text-white rounded-full flex items-center justify-center mx-auto shadow-md">
                <Check className="w-8 h-8 stroke-[3]" />
              </div>
              <h4 className="text-lg font-bold text-emerald-900">വിവരങ്ങൾ വിജയകരമായി ലഭിച്ചു!</h4>
              <p className="text-xs text-slate-700 leading-relaxed">
                നിങ്ങൾ നൽകിയ വിവരങ്ങൾ ഞങ്ങളുടെ ടീമിന് ലഭിച്ചിട്ടുണ്ട്. <b>കോളയാട് 20 KM ചുറ്റളവിൽ</b> ലഭ്യമായ എക്സ്പെർട്ട് ടീം ഉടൻ നിങ്ങളെ ഫോണിൽ ബന്ധപ്പെടും.
              </p>
              <button
                onClick={() => setLeadSuccess(false)}
                className="py-2.5 px-6 bg-emerald-700 text-white font-bold text-xs rounded-xl hover:bg-emerald-600 transition shadow-sm"
              >
                മറ്റൊരു അപേക്ഷ നൽകുക
              </button>
            </div>
          ) : (
            <form onSubmit={handleServiceRequestSubmit} className="space-y-4">
              
              {/* Customer Name */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">നിങ്ങളുടെ പേര് (Name) *</label>
                <input
                  type="text"
                  required
                  value={leadName}
                  onChange={(e) => setLeadName(e.target.value)}
                  placeholder="ഉദാഹരണത്തിന്: സുരേഷ് കുമാർ"
                  className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition"
                />
              </div>

              {/* Phone Number */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">ഫോൺ നമ്പർ (Phone Number) *</label>
                <input
                  type="tel"
                  required
                  value={leadPhone}
                  onChange={(e) => setLeadPhone(e.target.value)}
                  placeholder="10 അക്ക മൊബൈൽ നമ്പർ"
                  className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition"
                />
              </div>

              {/* Location */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">നിങ്ങളുടെ സ്ഥലം (Location/Place)</label>
                <input
                  type="text"
                  value={leadLocation}
                  onChange={(e) => setLeadLocation(e.target.value)}
                  placeholder="ഉദാഹരണത്തിന്: കോളയാട്, പേരാവൂർ, ഇരിട്ടി, മട്ടന്നൂർ..."
                  className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition"
                />
              </div>

              {/* Select Required Services */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 block">ആവശ്യമുള്ള സേവനം തിരഞ്ഞെടുക്കുക (Select Services) *</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    'എക്സ്റ്റീരിയർ പെയിന്റിംഗ് & ടെക്സ്ചർ',
                    'ടെറസ് പായൽ മാറ്റി വാട്ടർപ്രൂഫ് റൂഫ് സീൽ',
                    'കിണർ ഡീപ്പ് ക്ലീനിംഗ് & സ്ലഡ്ജ് പമ്പിംഗ്',
                    'വാട്ടർ ടാങ്ക് ഡിസ്ഇൻഫെക്ഷൻ & ക്ലീനിംഗ്',
                    'ചുറ്റുമതിലിലെ പായൽ കളഞ്ഞ് വാഷ് & പെയിന്റ്',
                    'ഇന്റർലോക്ക് & ഡ്രൈവ്‌വേ പ്രഷർ വാഷിംഗ്'
                  ].map((serviceName) => {
                    const isChecked = leadServices.includes(serviceName);
                    return (
                      <button
                        type="button"
                        key={serviceName}
                        onClick={() => toggleLeadService(serviceName)}
                        className={`p-2.5 rounded-xl border text-left text-xs font-semibold transition flex items-center justify-between gap-2 ${
                          isChecked 
                            ? 'bg-emerald-50 border-emerald-500 text-emerald-900 shadow-sm' 
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <span>{serviceName}</span>
                        <div className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 ${
                          isChecked ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300 bg-white'
                        }`}>
                          {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Preferred Date or Time */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">സൗകര്യപ്രദമായ സമയം / തീയതി (Preferred Time)</label>
                <input
                  type="text"
                  value={leadDate}
                  onChange={(e) => setLeadDate(e.target.value)}
                  placeholder="ഉദാഹരണത്തിന്: നാളെ രാവിലെ 10 മണിക്ക്"
                  className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition"
                />
              </div>

              {/* Additional Details */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">മറ്റ് കുറിപ്പുകൾ (Additional Details)</label>
                <textarea
                  rows={2}
                  value={leadNotes}
                  onChange={(e) => setLeadNotes(e.target.value)}
                  placeholder="പണിയുടെ വലിപ്പം, മറ്റ് വിവരങ്ങൾ..."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none resize-none transition"
                />
              </div>

              {leadError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>{leadError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={leadSubmitting}
                className="w-full h-12 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl border border-emerald-500 shadow-md shadow-emerald-900/20 transition active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {leadSubmitting ? (
                  <span>സമർപ്പിക്കുന്നു...</span>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>സൗജന്യ അപേക്ഷ സമർപ്പിക്കുക (Submit Request)</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Google Business Profile Setup Guide Card */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-950 rounded-3xl p-5 md:p-6 border border-slate-800 shadow-xl space-y-3 text-white">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center shrink-0 font-bold shadow-md">
              <Globe className="w-5 h-5 text-slate-950" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm md:text-base font-bold text-white">
                ഗൂഗിളിൽ തിരയുമ്പോൾ ഫോൺ നമ്പറും ലൊക്കേഷനും കാണാൻ (Google Business Profile)
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                ആരെങ്കിലും ഗൂഗിളിൽ <span className="font-semibold text-amber-300 font-mono">"Exterior Solutions"</span>, <span className="font-semibold text-amber-300 font-mono">"kinar cleaning easily"</span> അല്ലെങ്കിൽ <span className="font-semibold text-amber-300 font-mono">"കോളയാട് പെയിന്റിംഗ്"</span> എന്ന് സെർച്ച് ചെയ്യുമ്പോൾ നേരിട്ട് വിളിക്കാനുള്ള കോൾ ബട്ടൺ കാണാൻ സൗജന്യമായി സെറ്റപ്പ് ചെയ്യാം:
              </p>
            </div>
          </div>

          <div className="bg-slate-800/80 p-4 rounded-2xl border border-slate-700/80 space-y-2.5 text-xs text-slate-200">
            <div className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 font-bold flex items-center justify-center shrink-0 text-[11px]">1</span>
              <p><b>Google Business Profile</b> വിസിറ്റ് ചെയ്യുക: <a href="https://business.google.com" target="_blank" rel="noopener noreferrer" className="text-amber-400 underline font-bold">business.google.com</a></p>
            </div>
            <div className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 font-bold flex items-center justify-center shrink-0 text-[11px]">2</span>
              <p>ബിസിനസ്സ് പേര്: <b>"Exterior Solutions Kolayad"</b> എന്ന് നൽകുക. സർവീസ് ഏരിയ <b>Kolayad, Peravoor, Iritty</b> ചേർക്കുക.</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 font-bold flex items-center justify-center shrink-0 text-[11px]">3</span>
              <p>നിങ്ങളുടെ ഫോൺ നമ്പർ (<b>{businessPhone}</b>) ഉം ഈ വെബ്‌സൈറ്റ് അഡ്രസ്സും കൊടുത്താൽ ഗൂഗിൾ സെർച്ചിൽ നിങ്ങളുടെ ഡയറക്ട് കോൾ ബട്ടൺ ലൈവാകും!</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
              ഈ വെബ്സൈറ്റ് ലിങ്ക് ഗൂഗിൾ ബിസിനസ്സിൽ പേസ്റ്റ് ചെയ്യാം
            </span>
            <a
              href="https://business.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="py-2 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition shadow-md flex items-center gap-1"
            >
              <span>ഗൂഗിൾ ബിസിനസ്സ് തുറക്കുക</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Floating Mobile Sticky Contact Bar */}
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur border-t border-slate-800 p-3 flex items-center justify-around gap-2 max-w-xl mx-auto shadow-2xl md:hidden">
          <a
            href={`tel:+91${businessPhone.replace(/\D/g, '')}`}
            className="flex-1 py-3 bg-emerald-600 active:bg-emerald-500 text-white font-extrabold text-xs rounded-2xl flex items-center justify-center gap-2 shadow-lg"
          >
            <PhoneCall className="w-4 h-4" />
            <span>വിളിക്കുക ({businessPhone})</span>
          </a>
          <a
            href={`https://wa.me/91${businessPhone.replace(/\D/g, "")}?text=Hello%20Exterior%20Solutions!`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 py-3 bg-slate-800 active:bg-slate-700 text-white font-extrabold text-xs rounded-2xl flex items-center justify-center gap-2 border border-slate-700 shadow-lg"
          >
            <MessageSquare className="w-4 h-4 text-emerald-400" />
            <span>WhatsApp</span>
          </a>
        </div>

      </div>
    );
  };

  // Render Admin Lead Requests Management Tab JSX
  const renderLeadsTab = () => {
    return (
      <div className="space-y-4">
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <PhoneCall className="w-5 h-5 text-emerald-600" />
                കസ്റ്റമർ കോൾ ബാക്ക് ലീഡുകൾ ({serviceRequests.length})
              </h3>
              <p className="text-xs text-slate-500">
                ഗൂഗിൾ തിരച്ചിലിലൂടെ ലഭിച്ച കസ്റ്റമർ കോൾ ബാക്ക് അപേക്ഷകൾ
              </p>
            </div>
            <button
              onClick={loadServiceRequests}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-700 transition"
              title="അപ്‌ഡേറ്റ് ചെയ്യുക"
            >
              റിഫ്രഷ് 🔄
            </button>
          </div>

          {loadingServiceRequests ? (
            <p className="text-xs text-slate-500 text-center py-6">ലോഡ് ചെയ്യുന്നു...</p>
          ) : serviceRequests.length === 0 ? (
            <div className="py-8 text-center space-y-2">
              <p className="text-sm font-bold text-slate-600">പുതിയ കസ്റ്റമർ റിക്വസ്റ്റുകൾ ഒന്നും ലഭിച്ചിട്ടില്ല</p>
              <p className="text-xs text-slate-400">ആളുകൾ ഗൂഗിളിൽ തിരഞ്ഞു കോൾ ബാക്ക് ഫോം പൂരിപ്പിക്കുമ്പോൾ ഇവിടെ കാണാം.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {serviceRequests.map((req) => (
                <div 
                  key={req.id} 
                  className={`p-4 rounded-2xl border transition space-y-3 ${
                    req.status === 'new' 
                      ? 'bg-amber-50/80 border-amber-300 shadow-sm' 
                      : req.status === 'completed' 
                      ? 'bg-emerald-50/50 border-emerald-200' 
                      : 'bg-white border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">{req.customerName}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                          📍 {req.customerLocation}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 pt-0.5">
                        <a
                          href={`tel:${req.customerPhone}`}
                          className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 px-2.5 py-1 rounded-lg border border-emerald-300"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          <span>{req.customerPhone}</span>
                        </a>
                        <a
                          href={`https://wa.me/91${req.customerPhone.replace(/\D/g, '')}?text=%E0%B4%B9%E0%B4%B2%E0%B5%8B%20${encodeURIComponent(req.customerName)},%20WorkLog%20%E0%B4%B8%E0%B5%87%E0%B4%B5%E0%B4%A8%E0%B4%99%E0%B5%8D%E0%B4%99%E0%B4%B3%E0%B5%8D%E0%B4%95%E0%B5%8D%E0%B4%95%E0%B4%BE%E0%B4%AF%E0%B4%BF%20%E0%B4%AC%E0%B4%A0%E0%B4%A7%E0%B4%AA%E0%B5%8D%E0%B4%AA%E0%B5%86%E0%B4%A1%E0%B5%81%E0%B4%A8%E0%B5%8D%E0%B4%A8%E0%B5%81.`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-bold text-teal-800 bg-teal-100 hover:bg-teal-200 px-2.5 py-1 rounded-lg border border-teal-300"
                        >
                          <MessageSquare className="w-3.5 h-3.5 text-teal-600" />
                          <span>WhatsApp</span>
                        </a>
                      </div>
                    </div>

                    <button
                      onClick={() => req.id && handleDeleteServiceRequest(req.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                      title="ഡിലീറ്റ് ചെയ്യുക"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Selected Services Badges */}
                  <div className="flex flex-wrap gap-1">
                    {req.selectedServices.map((s, idx) => (
                      <span key={idx} className="text-[10px] font-bold bg-white border border-slate-300 text-slate-800 px-2 py-0.5 rounded-md">
                        🛠️ {s}
                      </span>
                    ))}
                  </div>

                  {req.preferredDate && (
                    <p className="text-xs text-slate-600">
                      <b>സൗകര്യപ്രദമായ സമയം:</b> {req.preferredDate}
                    </p>
                  )}
                  {req.additionalDetails && (
                    <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded-xl border border-slate-200">
                      <b>കുറിപ്പ്:</b> {req.additionalDetails}
                    </p>
                  )}

                  {/* Status Selector */}
                  <div className="pt-2 border-t border-slate-200/60 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-slate-500">സ്റ്റാറ്റസ്:</span>
                    <div className="flex flex-wrap gap-1">
                      {[
                        { key: 'new', label: '🔴 പുതിയത്' },
                        { key: 'contacted', label: '🟡 വിളിച്ചു' },
                        { key: 'accepted', label: '🔵 ഏറ്റെടുത്തു' },
                        { key: 'completed', label: '🟢 പൂർത്തിയായി' }
                      ].map((st) => (
                        <button
                          key={st.key}
                          onClick={() => req.id && handleUpdateServiceRequestStatus(req.id, st.key as any)}
                          className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition ${
                            req.status === st.key 
                              ? 'bg-slate-900 text-white border-slate-900 shadow-sm' 
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          {st.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Filtered Logs
  const displayedLogs = filterWorkerNumber === 'all'
    ? logs
    : logs.filter(l => l.workerNumber === filterWorkerNumber);

  // Live total expense calculation in form
  const currentTotalExpense = 
    (Number(vehicleRent) || 0) + 
    (Number(foodExpense) || 0) + 
    (Number(toolsRent) || 0) + 
    (Number(otherExpense) || 0);

  // App Password Lock Screen (Password: 4646)
  if (!isAppUnlocked) {
    if (showPublicPageOnLock) {
      return (
        <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans pb-12 selection:bg-emerald-200">
          <header className="sticky top-0 z-30 bg-emerald-900 text-white shadow-md border-b border-emerald-800">
            <div className="max-w-xl mx-auto px-4 h-16 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <LogoIcon className="w-8 h-8" />
                <div>
                  <h1 className="text-sm font-bold text-white">കോളയാട് സർവ്വീസ് കേന്ദ്രം</h1>
                  <p className="text-[10px] text-emerald-200 flex items-center gap-1">
                    <span>20 KM ചുറ്റളവ്</span>
                    <span>•</span>
                    <a href={`tel:+91${businessPhone.replace(/\D/g, '')}`} className="font-bold underline hover:text-white">
                      📞 {businessPhone}
                    </a>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowPublicPageOnLock(false)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl border border-emerald-600 transition"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>തൊഴിലാളി ലോഗിൻ</span>
              </button>
            </div>
          </header>
          <main className="flex-1 max-w-xl w-full mx-auto p-4">
            {renderPublicServicesSection()}
          </main>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4 selection:bg-emerald-500 selection:text-white">
        <div className="w-full max-w-sm bg-slate-800/90 backdrop-blur border border-slate-700/80 rounded-3xl p-6 shadow-2xl space-y-5 text-center">
          
          {/* Header & Logo */}
          <div className="space-y-3">
            <div className="flex justify-center">
              <LogoIcon className="w-16 h-16 shadow-2xl ring-4 ring-emerald-500/20" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-wide">WorkLog Pro</h1>
              <p className="text-xs text-slate-400 mt-1">തൊഴിലാളി ഡയറി - സെക്യൂരിറ്റി ലോഗിൻ</p>
            </div>
          </div>

          {/* Public Services Shortcut Banner */}
          <button
            onClick={() => setShowPublicPageOnLock(true)}
            className="w-full p-3 bg-gradient-to-r from-emerald-900/90 to-teal-900/90 hover:from-emerald-800 hover:to-teal-800 border border-emerald-500/40 rounded-2xl text-left flex items-center justify-between gap-2 shadow-md transition active:scale-[0.98]"
          >
            <div className="space-y-0.5">
              <span className="text-[11px] font-bold text-emerald-300 block flex items-center gap-1">
                <Globe className="w-3.5 h-3.5 text-emerald-400" />
                പൊതുജനങ്ങൾക്കായി:
              </span>
              <span className="text-xs font-bold text-white block">
                പെയിന്റിംഗ്, കിണർ & ടാങ്ക് ക്ലീനിംഗ് (കോളയാട് 20 KM)
              </span>
            </div>
            <ChevronRight className="w-5 h-5 text-emerald-400 shrink-0" />
          </button>

          {/* Password Prompt */}
          <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-700/50 space-y-3">
            <p className="text-xs text-slate-300 font-semibold flex items-center justify-center gap-1.5">
              <Lock className="w-4 h-4 text-emerald-400" />
              ആപ്പിലേക്ക് ലോഗിൻ ചെയ്യാൻ പാസ്‌വേഡ് നൽകുക
            </p>

            <form onSubmit={handleLoginSubmit} className="space-y-3">
              <div className="relative">
                <input 
                  type="password"
                  inputMode="numeric"
                  value={passwordInput}
                  onChange={(e) => { setPasswordInput(e.target.value); setLoginError(''); }}
                  placeholder="പാസ്‌വേഡ് ടൈപ്പ് ചെയ്യുക"
                  className="w-full text-center text-2xl font-mono tracking-widest bg-slate-950 border border-slate-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 rounded-xl py-3 text-white placeholder:text-slate-600 placeholder:text-sm placeholder:tracking-normal outline-none transition"
                  autoFocus
                />
              </div>

              {loginError && (
                <div className="p-2.5 bg-rose-500/20 border border-rose-500/40 rounded-xl text-xs font-bold text-rose-300 flex items-center justify-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{loginError}</span>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl border border-emerald-500 shadow-lg shadow-emerald-900/40 transition active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <Unlock className="w-4 h-4" />
                പ്രവേശിക്കുക (Login)
              </button>
            </form>
          </div>

          {/* Touch Keypad for Easy Mobile Entry */}
          <div className="space-y-2">
            <span className="text-[11px] text-slate-400 font-medium">കീപാഡ് ഉപയോഗിച്ച് ടൈപ്പ് ചെയ്യുക:</span>
            <div className="grid grid-cols-3 gap-2 max-w-[260px] mx-auto">
              {['1','2','3','4','5','6','7','8','9'].map((digit) => (
                <button
                  key={digit}
                  onClick={() => handleKeypadPress(digit)}
                  className="h-12 bg-slate-700/60 hover:bg-slate-700 text-white font-bold text-lg rounded-xl border border-slate-600/60 transition active:scale-95 active:bg-emerald-600 flex items-center justify-center"
                >
                  {digit}
                </button>
              ))}
              <button
                onClick={handleKeypadClear}
                className="h-12 bg-slate-800 text-slate-400 hover:text-white text-xs font-bold rounded-xl border border-slate-700 transition active:scale-95 flex items-center justify-center"
              >
                CLEAR
              </button>
              <button
                onClick={() => handleKeypadPress('0')}
                className="h-12 bg-slate-700/60 hover:bg-slate-700 text-white font-bold text-lg rounded-xl border border-slate-600/60 transition active:scale-95 active:bg-emerald-600 flex items-center justify-center"
              >
                0
              </button>
              <button
                onClick={handleKeypadDelete}
                className="h-12 bg-slate-800 text-slate-400 hover:text-white text-xs font-bold rounded-xl border border-slate-700 transition active:scale-95 flex items-center justify-center"
              >
                ⌫
              </button>
            </div>
          </div>

        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans pb-12 selection:bg-emerald-200">
      
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-emerald-800 text-white shadow-md border-b border-emerald-700">
        <div className="max-w-xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <LogoIcon className="w-9 h-9 shadow-sm" />
            <div>
              <h1 className="text-base font-bold tracking-tight text-white leading-tight">WorkLog Pro</h1>
              <p className="text-[10px] text-emerald-200 font-medium">തൊഴിലാളി വർക്ക് മാനേജർ</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* PWA Install Button */}
            {!isInstalled && (isInstallable || isIOS) && (
              <button 
                onClick={isInstallable ? install : () => setShowIOSGuide(true)}
                className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold px-2.5 py-1.5 rounded-xl border border-emerald-500 transition active:scale-95 shadow-sm"
                title="ആപ്പ് ഫോണിൽ ഇൻസ്റ്റാൾ ചെയ്യുക"
              >
                <Download className="w-3.5 h-3.5" />
                <span>ഇൻസ്റ്റാൾ</span>
              </button>
            )}

            {/* Active Worker Profile Badge */}
            <button 
              onClick={() => setIsProfileModalOpen(true)}
              className="flex items-center gap-1.5 bg-emerald-900/80 hover:bg-emerald-900 text-emerald-100 text-xs px-3 py-1.5 rounded-xl border border-emerald-700/80 transition active:scale-95"
            >
              <div className="w-5 h-5 rounded-full bg-emerald-500 text-white font-bold text-[10px] flex items-center justify-center">
                {activeWorkerNumber}
              </div>
              <span className="font-semibold max-w-[80px] truncate">{activeWorkerName}</span>
            </button>

            {/* Telegram Bot Settings trigger */}
            <button 
              onClick={() => setIsSettingsModalOpen(true)}
              className="w-9 h-9 rounded-xl bg-emerald-700 hover:bg-emerald-600 border border-emerald-600 flex items-center justify-center text-emerald-100 transition active:scale-95"
              title="ബോട്ട് സെറ്റിംഗ്സ്"
            >
              <Bot className="w-4.5 h-4.5" />
            </button>

            {/* Lock App / Logout Button */}
            <button 
              onClick={handleLockApp}
              className="w-9 h-9 rounded-xl bg-emerald-900/80 hover:bg-emerald-900 border border-emerald-700/80 flex items-center justify-center text-emerald-200 hover:text-white transition active:scale-95"
              title="ലോഗ് ഔട്ട് ചെയ്യുക / ലോക്ക് ചെയ്യുക"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-xl w-full mx-auto p-4 space-y-4">

        {/* Tab Switcher: Only 2 Main Pages (Add Work & Reports) */}
        <div className="bg-slate-200/90 p-1.5 rounded-2xl flex items-center gap-1.5 border border-slate-300/60 shadow-inner">
          <button 
            onClick={() => { setActiveTab('add'); setSubmitSuccess(false); }}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs md:text-sm font-bold transition flex items-center justify-center gap-2 ${
              activeTab === 'add' 
                ? 'bg-white text-emerald-800 shadow-sm' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <PlusCircle className="w-4 h-4 text-emerald-600" />
            <span>1. വർക്ക് ചേർക്കുക</span>
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs md:text-sm font-bold transition flex items-center justify-center gap-2 ${
              activeTab === 'history' 
                ? 'bg-white text-emerald-800 shadow-sm' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <History className="w-4 h-4 text-emerald-600" />
            <span>2. റിപ്പോർട്ടുകൾ (റിപ്പോർട്ട്)</span>
          </button>
        </div>

        {/* TAB 1: ADD WORK DETAILS */}
        {activeTab === 'add' && (
          <div>
            {submitSuccess ? (
              <div className="bg-white rounded-3xl p-6 border border-emerald-200 text-center shadow-lg shadow-emerald-900/5 mt-2 animate-fade-in">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-10 h-10" />
                </div>
                <h2 className="text-xl font-bold text-slate-800 mb-1">വിവരങ്ങൾ വിജയകരമായി ചേർത്തു!</h2>
                <p className="text-xs text-slate-600 leading-relaxed mb-4">
                  തൊഴിലാളി <span className="font-bold text-emerald-700">#{lastSubmittedWorker}</span> ന്റെ ജോലി വിവരങ്ങളും ചിലവുകളും സേവ് ചെയ്തു. മുതലാളിക്ക് ടെലിഗ്രാമിൽ നോട്ടിഫിക്കേഷൻ അയച്ചിട്ടുണ്ട്.
                </p>
                <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-100 text-[11px] text-emerald-800 mb-6 text-left space-y-1">
                  <p>💡 <b>മുതലാളിക്ക് ടെലിഗ്രാമിൽ:</b></p>
                  <p>മുതലാളി ടെലിഗ്രാം ബോട്ടിൽ <code>{lastSubmittedWorker}</code> അല്ലെങ്കിൽ <code>/{lastSubmittedWorker}</code> എന്ന് അയച്ചാൽ ഈ വിവരങ്ങൾ കാണാം!</p>
                </div>
                <button 
                  onClick={() => setSubmitSuccess(false)}
                  className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-md transition active:scale-[0.98]"
                >
                  മറ്റൊരു ജോലി വിവരങ്ങൾ ചേർക്കുക
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="bg-white rounded-3xl p-5 md:p-6 border border-slate-200 shadow-sm space-y-5">
                
                {/* Whose work details section */}
                <div className="p-4 bg-emerald-50/70 rounded-2xl border border-emerald-200/80 space-y-3">
                  <span className="text-xs font-bold text-emerald-900 block flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-emerald-700" />
                    ആരുടെ ജോലി വിവരങ്ങൾ ആണ് ചേർക്കുന്നത്?
                  </span>

                  {/* Toggle: Self vs Another Worker */}
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      type="button"
                      onClick={() => setEntryFor('self')}
                      className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                        entryFor === 'self' 
                          ? 'bg-emerald-700 text-white shadow-sm' 
                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      എന്റെ സ്വന്തം (#{activeWorkerNumber})
                    </button>
                    <button 
                      type="button"
                      onClick={() => setEntryFor('other')}
                      className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                        entryFor === 'other' 
                          ? 'bg-emerald-700 text-white shadow-sm' 
                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      മറ്റൊരു തൊഴിലാളിയുടെ
                    </button>
                  </div>

                  {/* Worker Number Selection (1 to 50) */}
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <div className="col-span-1">
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        നമ്പർ (1-50):
                      </label>
                      <select 
                        value={targetWorkerNumber}
                        onChange={(e) => {
                          const n = parseInt(e.target.value, 10);
                          setTargetWorkerNumber(n);
                          setTargetWorkerName(workerNamesMap[n] || '');
                        }}
                        className="w-full h-11 px-2.5 rounded-xl border border-slate-300 text-slate-800 text-sm font-bold bg-white focus:outline-none focus:border-emerald-500 font-mono"
                      >
                        {Array.from({ length: 50 }, (_, i) => i + 1).map((num) => (
                          <option key={num} value={num}>
                            #{num} {workerNamesMap[num] ? `(${workerNamesMap[num]})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-span-2">
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        തൊഴിലാളിയുടെ പേര്:
                      </label>
                      <input 
                        type="text"
                        required
                        value={targetWorkerName}
                        onChange={(e) => setTargetWorkerName(e.target.value)}
                        placeholder={`തൊഴിലാളി #${targetWorkerNumber} പേര് ടൈപ്പ് ചെയ്യുക`}
                        className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-slate-800 text-xs font-semibold bg-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                </div>

                {formError && (
                  <div className="p-3 bg-rose-50 border-l-4 border-rose-500 rounded-r-xl text-rose-700 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                {/* Date Selection */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                    ജോലി ചെയ്ത ദിവസം (Date):
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button 
                      type="button"
                      onClick={() => setDateType('today')}
                      className={`h-10 text-xs font-semibold rounded-xl border transition ${
                        dateType === 'today' 
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-800 font-bold' 
                          : 'bg-slate-50 border-slate-200 text-slate-600'
                      }`}
                    >
                      ഇന്ന് (Today)
                    </button>
                    <button 
                      type="button"
                      onClick={() => setDateType('yesterday')}
                      className={`h-10 text-xs font-semibold rounded-xl border transition ${
                        dateType === 'yesterday' 
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-800 font-bold' 
                          : 'bg-slate-50 border-slate-200 text-slate-600'
                      }`}
                    >
                      ഇന്നലെ (Yesterday)
                    </button>
                    <button 
                      type="button"
                      onClick={() => setDateType('custom')}
                      className={`h-10 text-xs font-semibold rounded-xl border transition ${
                        dateType === 'custom' 
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-800 font-bold' 
                          : 'bg-slate-50 border-slate-200 text-slate-600'
                      }`}
                    >
                      മറ്റ് ദിവസം
                    </button>
                  </div>
                  {dateType === 'custom' && (
                    <input 
                      type="date"
                      required
                      value={customDate}
                      onChange={(e) => setCustomDate(e.target.value)}
                      className="w-full h-11 mt-2 px-3.5 rounded-xl border border-slate-300 text-slate-800 text-sm focus:outline-none focus:border-emerald-500"
                    />
                  )}
                </div>

                {/* Thach Selection */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Briefcase className="w-3.5 h-3.5 text-emerald-600" />
                      തച്ച് / ഹാജർ (Work Shift) തെരഞ്ഞെടുക്കുക:
                    </span>
                    <span className="text-xs font-extrabold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200 shadow-2xs">
                      {isCustomThach ? `${customThachInput || 0} തച്ച്` : `${thachCount} തച്ച്`}
                    </span>
                  </label>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {/* അര തച്ച് (0.5) */}
                    <button 
                      type="button"
                      onClick={() => { setThachCount(0.5); setIsCustomThach(false); }}
                      className={`h-12 px-2 text-xs font-bold rounded-2xl border transition flex items-center justify-between gap-1.5 ${
                        !isCustomThach && thachCount === 0.5 
                          ? 'bg-emerald-700 text-white border-emerald-700 shadow-md ring-2 ring-emerald-500/30' 
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex flex-col text-left">
                        <span className="leading-tight">അര തച്ച്</span>
                        <span className="text-[10px] opacity-80 font-mono font-medium">(0.5 തച്ച്)</span>
                      </div>
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${!isCustomThach && thachCount === 0.5 ? 'bg-white text-emerald-700' : 'bg-slate-200 text-slate-400'}`}>
                        {!isCustomThach && thachCount === 0.5 ? <CheckCircle className="w-4 h-4 fill-emerald-700 text-white" /> : <div className="w-2 h-2 rounded-full bg-slate-300" />}
                      </div>
                    </button>

                    {/* ഒരു തച്ച് (1.0) */}
                    <button 
                      type="button"
                      onClick={() => { setThachCount(1.0); setIsCustomThach(false); }}
                      className={`h-12 px-2 text-xs font-bold rounded-2xl border transition flex items-center justify-between gap-1.5 ${
                        !isCustomThach && thachCount === 1.0 
                          ? 'bg-emerald-700 text-white border-emerald-700 shadow-md ring-2 ring-emerald-500/30' 
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex flex-col text-left">
                        <span className="leading-tight">ഒരു തച്ച്</span>
                        <span className="text-[10px] opacity-80 font-mono font-medium">(1.0 തച്ച്)</span>
                      </div>
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${!isCustomThach && thachCount === 1.0 ? 'bg-white text-emerald-700' : 'bg-slate-200 text-slate-400'}`}>
                        {!isCustomThach && thachCount === 1.0 ? <CheckCircle className="w-4 h-4 fill-emerald-700 text-white" /> : <div className="w-2 h-2 rounded-full bg-slate-300" />}
                      </div>
                    </button>

                    {/* ഒന്നര തച്ച് (1.5) */}
                    <button 
                      type="button"
                      onClick={() => { setThachCount(1.5); setIsCustomThach(false); }}
                      className={`h-12 px-2 text-xs font-bold rounded-2xl border transition flex items-center justify-between gap-1.5 ${
                        !isCustomThach && thachCount === 1.5 
                          ? 'bg-emerald-700 text-white border-emerald-700 shadow-md ring-2 ring-emerald-500/30' 
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex flex-col text-left">
                        <span className="leading-tight">ഒന്നര തച്ച്</span>
                        <span className="text-[10px] opacity-80 font-mono font-medium">(1.5 തച്ച്)</span>
                      </div>
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${!isCustomThach && thachCount === 1.5 ? 'bg-white text-emerald-700' : 'bg-slate-200 text-slate-400'}`}>
                        {!isCustomThach && thachCount === 1.5 ? <CheckCircle className="w-4 h-4 fill-emerald-700 text-white" /> : <div className="w-2 h-2 rounded-full bg-slate-300" />}
                      </div>
                    </button>

                    {/* രണ്ട് തച്ച് (2.0) */}
                    <button 
                      type="button"
                      onClick={() => { setThachCount(2.0); setIsCustomThach(false); }}
                      className={`h-12 px-2 text-xs font-bold rounded-2xl border transition flex items-center justify-between gap-1.5 ${
                        !isCustomThach && thachCount === 2.0 
                          ? 'bg-emerald-700 text-white border-emerald-700 shadow-md ring-2 ring-emerald-500/30' 
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex flex-col text-left">
                        <span className="leading-tight">രണ്ട് തച്ച്</span>
                        <span className="text-[10px] opacity-80 font-mono font-medium">(2.0 തച്ച്)</span>
                      </div>
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${!isCustomThach && thachCount === 2.0 ? 'bg-white text-emerald-700' : 'bg-slate-200 text-slate-400'}`}>
                        {!isCustomThach && thachCount === 2.0 ? <CheckCircle className="w-4 h-4 fill-emerald-700 text-white" /> : <div className="w-2 h-2 rounded-full bg-slate-300" />}
                      </div>
                    </button>
                  </div>

                  <div className="mt-2 text-right">
                    {!isCustomThach ? (
                      <button 
                        type="button"
                        onClick={() => setIsCustomThach(true)}
                        className="text-[11px] text-emerald-700 font-bold hover:underline"
                      >
                        + മറ്റ് തച്ച് നൽകുക (Custom)
                      </button>
                    ) : (
                      <div className="flex items-center gap-2 justify-end mt-2 animate-fade-in bg-slate-50 p-2 rounded-xl border border-slate-200">
                        <span className="text-xs font-semibold text-slate-600">മറ്റ് തച്ച് എണ്ണം:</span>
                        <input 
                          type="number"
                          step="0.25"
                          min="0.1"
                          max="10"
                          value={customThachInput}
                          onChange={(e) => setCustomThachInput(e.target.value)}
                          className="w-24 h-9 px-3 text-xs font-bold font-mono rounded-xl border border-slate-300 text-slate-800 bg-white"
                        />
                        <button 
                          type="button"
                          onClick={() => setIsCustomThach(false)}
                          className="text-xs text-slate-500 hover:text-slate-700 font-bold px-2 py-1"
                        >
                          ക്ലോസ്
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Site Name & Quick Site Selection */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                      സൈറ്റിന്റെ പേര് / സ്ഥലം (Site Name) <span className="text-rose-500">*</span>
                    </label>
                  </div>

                  {/* List of Sites added by any worker */}
                  {Array.from(new Set(logs.map(l => l.siteName).filter(s => s && s.trim().length > 0))).length > 0 && (
                    <div className="mb-2 bg-emerald-50/80 p-2.5 rounded-2xl border border-emerald-200/80 space-y-1.5">
                      <span className="text-[11px] font-bold text-emerald-900 block flex items-center gap-1">
                        📌 മറ്റുള്ളവർ add ചെയ്ത സ്ഥലങ്ങൾ (ക്ലിക്ക് ചെയ്ത് തെരഞ്ഞെടുക്കാം):
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {Array.from(new Set(logs.map(l => l.siteName).filter(s => s && s.trim().length > 0))).map((site, idx) => {
                          const isSelected = siteName.trim().toLowerCase() === site.trim().toLowerCase();
                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setSiteName(site)}
                              className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition flex items-center gap-1 active:scale-95 ${
                                isSelected
                                  ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                                  : 'bg-white text-emerald-900 border-emerald-200 hover:bg-emerald-100/60'
                              }`}
                            >
                              <MapPin className="w-3 h-3 text-emerald-500 shrink-0" />
                              <span>{site}</span>
                              {isSelected && <CheckCircle className="w-3 h-3 text-white ml-0.5" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <input 
                    type="text"
                    required
                    list="sites-autocomplete-list"
                    placeholder="സ്ഥലം തെരഞ്ഞെടുക്കുക അല്ലെങ്കിൽ ടൈപ്പ് ചെയ്യുക (ഉദാ: കലൂർ, വില്ല പ്രോജക്റ്റ്)"
                    value={siteName}
                    onChange={(e) => setSiteName(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-slate-800 text-sm focus:outline-none focus:border-emerald-500 bg-white"
                  />
                  <datalist id="sites-autocomplete-list">
                    {Array.from(new Set(logs.map(l => l.siteName).filter(s => s && s.trim().length > 0))).map((site, idx) => (
                      <option key={idx} value={site} />
                    ))}
                  </datalist>
                </div>

                {/* Work Details Description */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                    <Wrench className="w-3.5 h-3.5 text-emerald-600" />
                    ചെയ്ത ജോലി വിവരങ്ങൾ (Work Description) <span className="text-rose-500">*</span>
                  </label>
                  <textarea 
                    required
                    rows={3}
                    placeholder="ഉദാ: വാർപ്പ് പണി, പെയിന്റിംഗ്, ഇലക്ട്രിക്കൽ വയറിംഗ്..."
                    value={workDescription}
                    onChange={(e) => setWorkDescription(e.target.value)}
                    className="w-full p-3.5 rounded-xl border border-slate-300 text-slate-800 text-sm focus:outline-none focus:border-emerald-500 resize-none"
                  />
                </div>

                {/* Expenses Section */}
                <div className="pt-2 border-t border-slate-200">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <DollarSign className="w-4 h-4 text-emerald-600" />
                      ചിലവുകൾ (Expenses - ഉണ്ടെങ്കിൽ നൽകുക)
                    </span>
                    <span className="text-xs font-bold text-emerald-700 font-mono">
                      ആകെ: ₹{currentTotalExpense}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {/* Vehicle Rent */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1 flex items-center gap-1">
                        <Truck className="w-3 h-3 text-slate-400" />
                        വണ്ടി വാടക:
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold">₹</span>
                        <input 
                          type="number"
                          min="0"
                          placeholder="0"
                          value={vehicleRent}
                          onChange={(e) => setVehicleRent(e.target.value)}
                          className="w-full h-10 pl-7 pr-3 rounded-xl border border-slate-300 text-slate-800 text-sm font-mono tabular-nums focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>

                    {/* Food Expense */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1 flex items-center gap-1">
                        <Utensils className="w-3 h-3 text-slate-400" />
                        ഫുഡ് എക്സ്പെൻസ്:
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold">₹</span>
                        <input 
                          type="number"
                          min="0"
                          placeholder="0"
                          value={foodExpense}
                          onChange={(e) => setFoodExpense(e.target.value)}
                          className="w-full h-10 pl-7 pr-3 rounded-xl border border-slate-300 text-slate-800 text-sm font-mono tabular-nums focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>

                    {/* Tools / Equipment Rent */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1 flex items-center gap-1">
                        <Wrench className="w-3 h-3 text-slate-400" />
                        ഉപകരണ വാടക:
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold">₹</span>
                        <input 
                          type="number"
                          min="0"
                          placeholder="0"
                          value={toolsRent}
                          onChange={(e) => setToolsRent(e.target.value)}
                          className="w-full h-10 pl-7 pr-3 rounded-xl border border-slate-300 text-slate-800 text-sm font-mono tabular-nums focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>

                    {/* Other Expense */}
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1 flex items-center gap-1">
                        <DollarSign className="w-3 h-3 text-slate-400" />
                        മറ്റ് ചിലവുകൾ:
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold">₹</span>
                        <input 
                          type="number"
                          min="0"
                          placeholder="0"
                          value={otherExpense}
                          onChange={(e) => setOtherExpense(e.target.value)}
                          className="w-full h-10 pl-7 pr-3 rounded-xl border border-slate-300 text-slate-800 text-sm font-mono tabular-nums focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Submit Button */}
                <button 
                  type="submit"
                  disabled={submitting}
                  className="w-full h-13 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-700/20 active:scale-[0.98] transition disabled:opacity-60"
                >
                  {submitting ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      സേവ് ചെയ്യുന്നു...
                    </span>
                  ) : (
                    <>
                      <Send className="w-4.5 h-4.5" />
                      വിവരങ്ങൾ സേവ് ചെയ്യുക (Submit Work)
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        )}

        {/* TAB 2: RECENT LOGS & REPORTS */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            
            {/* Filter Bar & Export */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between gap-3">
              <div className="flex-1">
                <label className="block text-[10px] font-bold text-slate-500 mb-1">ഫിൽട്ടർ ചെയ്യുക (Worker #):</label>
                <select 
                  value={filterWorkerNumber}
                  onChange={(e) => setFilterWorkerNumber(e.target.value === 'all' ? 'all' : parseInt(e.target.value, 10))}
                  className="w-full h-9 px-3 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 bg-white"
                >
                  <option value="all">എല്ലാ തൊഴിലാളികളും (All 1-50)</option>
                  {Array.from({ length: 50 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>തൊഴിലാളി #{n}</option>
                  ))}
                </select>
              </div>

              <div className="self-end">
                <button 
                  onClick={handleExportCSV}
                  className="h-9 px-3.5 bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow transition active:scale-95"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  Excel / CSV
                </button>
              </div>
            </div>

            {/* List of Entries */}
            {loadingLogs ? (
              <div className="text-center py-12 text-slate-400 text-xs flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                ലോഡിംഗ്...
              </div>
            ) : displayedLogs.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center text-slate-400 text-xs">
                വിവരങ്ങൾ ഒന്നും കണ്ടെത്തിയില്ല.
              </div>
            ) : (
              <div className="space-y-3">
                {displayedLogs.map((log) => {
                  const dailyTotal = (Number(log.vehicleRent) || 0) + (Number(log.foodExpense) || 0) + (Number(log.toolsRent) || 0) + (Number(log.otherExpense) || 0);
                  return (
                    <div key={log.id} className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-2.5">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center font-mono">
                            #{log.workerNumber}
                          </span>
                          <span className="font-bold text-xs text-slate-800">{log.workerName}</span>
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 text-[10px] font-bold rounded-md border border-emerald-200">
                            {log.thachCount || 1} തച്ച്
                          </span>
                        </div>
                        <span className="text-[11px] font-semibold text-slate-500 font-mono">{log.date}</span>
                      </div>

                      <div>
                        <div className="flex items-center gap-1 text-xs font-semibold text-slate-700">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          <span>{log.siteName}</span>
                        </div>
                        <p className="text-xs text-slate-600 mt-1 pl-4.5 leading-relaxed">{log.workDescription}</p>
                      </div>

                      {/* Card Footer with Expenses and Edit/Delete Actions */}
                      <div className="pt-2 border-t border-slate-100 space-y-2">
                        <div className="flex items-center justify-between text-[11px]">
                          <div className="text-slate-500 flex items-center gap-2">
                            <span>വണ്ടി: ₹{log.vehicleRent || 0}</span>
                            <span>·</span>
                            <span>ഫുഡ്: ₹{log.foodExpense || 0}</span>
                            <span>·</span>
                            <span>ഉപകരണം: ₹{log.toolsRent || 0}</span>
                          </div>
                          <span className="font-bold text-emerald-700 font-mono text-xs">
                            ആകെ: ₹{dailyTotal}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-2 text-[10px] pt-1 border-t border-slate-50">
                          <span className="text-slate-400 italic">
                            {log.submittedBy || ''}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button 
                              onClick={() => handleOpenEdit(log)}
                              className="px-2.5 py-1 text-[11px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 rounded-lg flex items-center gap-1 transition active:scale-95"
                            >
                              <Pencil className="w-3 h-3 text-amber-600" />
                              <span>എഡിറ്റ് (Edit)</span>
                            </button>
                            <button 
                              onClick={() => setDeletingLog(log)}
                              className="px-2.5 py-1 text-[11px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200/80 rounded-lg flex items-center gap-1 transition active:scale-95"
                            >
                              <Trash2 className="w-3 h-3 text-rose-600" />
                              <span>ഡിലീറ്റ് (Delete)</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}


      </main>

      {/* MODAL 1: CHANGE ACTIVE WORKER PROFILE */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full border border-slate-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-800">തൊഴിലാളി പ്രൊഫൈൽ മാറ്റുക</h3>
              <button 
                onClick={() => setIsProfileModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              ഈ ഫോണിൽ ഉപയോഗിക്കുന്ന തൊഴിലാളിയുടെ നമ്പറും (1 മുതൽ 50 വരെ) പേരും നൽകുക:
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">നിങ്ങളുടെ നമ്പർ (1-50):</label>
                <select 
                  defaultValue={activeWorkerNumber}
                  id="profileNumSelect"
                  onChange={(e) => {
                    const n = parseInt(e.target.value, 10);
                    const nameInput = document.getElementById('profileNameInput') as HTMLInputElement;
                    if (nameInput) {
                      nameInput.value = workerNamesMap[n] || '';
                    }
                  }}
                  className="w-full h-11 px-3 rounded-xl border border-slate-300 text-sm font-bold bg-white"
                >
                  {Array.from({ length: 50 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      #{n} {workerNamesMap[n] ? `(${workerNamesMap[n]})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">നിങ്ങളുടെ പേര്:</label>
                <input 
                  type="text"
                  id="profileNameInput"
                  defaultValue={activeWorkerName}
                  placeholder="ഉദാ: ഷാജി കെ."
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <button 
                onClick={() => {
                  const numEl = document.getElementById('profileNumSelect') as HTMLSelectElement;
                  const nameEl = document.getElementById('profileNameInput') as HTMLInputElement;
                  if (numEl && nameEl) {
                    handleSaveProfile(parseInt(numEl.value, 10), nameEl.value.trim() || `തൊഴിലാളി #${numEl.value}`);
                  }
                }}
                className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow transition mt-2"
              >
                സേവ് ചെയ്യുക (Save Profile)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: TELEGRAM BOT SETTINGS */}
      {isSettingsModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-200 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-bold text-slate-800">ടെലിഗ്രാം ബോട്ട് സെറ്റിംഗ്സ്</h3>
              </div>
              <button 
                onClick={() => setIsSettingsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              മുതലാളിക്ക് റിപ്പോർട്ടുകൾ ലഭിക്കാൻ ടെലിഗ്രാം ബോട്ട് ടോക്കണും ചാറ്റ് ഐഡിയും ഇവിടെ നൽകുക.
            </p>

            {settingsMessage && (
              <div className={`p-3 rounded-xl text-xs font-semibold ${settingsMessage.isError ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-800'}`}>
                {settingsMessage.text}
              </div>
            )}

            <form onSubmit={handleSaveSettings} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-emerald-600" />
                  ബിസിനസ്സ് ഫോൺ നമ്പർ (Google സെർച്ച് ചെയ്യുന്നവർക്ക് വിളിക്കാൻ):
                </label>
                <input 
                  type="tel"
                  placeholder="ഉദാ: 9400000000"
                  value={businessPhone}
                  onChange={(e) => setBusinessPhone(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs font-mono font-bold text-slate-900 focus:border-emerald-500 focus:outline-none"
                />
                <p className="text-[10px] text-slate-400 mt-0.5">
                  ഗൂഗിളിൽ തിരഞ്ഞു ഈ വെബ്‌സൈറ്റിൽ എത്തുന്ന ആളുകൾക്ക് നേരിട്ട് വിളിക്കാനായി ഈ ഫോൺ നമ്പർ കാണിക്കും.
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  ടെലിഗ്രാം ബോട്ട് ടോക്കൺ (Bot Token):
                </label>
                <input 
                  type="password"
                  placeholder="123456789:ABCdef..."
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  മുതലാളിയുടെ Chat ID (Optional):
                </label>
                <input 
                  type="text"
                  placeholder="ഉദാ: 987654321"
                  value={bossChatId}
                  onChange={(e) => setBossChatId(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs font-mono"
                />
                <p className="text-[10px] text-slate-400 mt-0.5">
                  ഇവിടെ നൽകിയാൽ വർക്ക് സബ്മിറ്റ് ചെയ്യുമ്പോൾ തത്സമയം മുതലാളിക്ക് മെസ്സേജ് എത്തും.
                </p>
              </div>

              <button 
                type="submit"
                disabled={savingSettings}
                className="w-full h-11 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow transition active:scale-98 disabled:opacity-50"
              >
                {savingSettings ? 'സേവ് ചെയ്യുന്നു...' : 'ബോട്ട് സേവ് ചെയ്ത് കണക്റ്റ് ചെയ്യുക'}
              </button>
            </form>

            {/* Simple Instructions */}
            <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 text-xs text-slate-700 space-y-2">
              <h4 className="font-bold text-emerald-900 flex items-center gap-1">
                <Info className="w-3.5 h-3.5" />
                മുതലാളി ബോട്ട് ഉപയോഗിക്കേണ്ട വിധം:
              </h4>
              <ul className="space-y-1.5 text-[11px] list-disc list-inside">
                <li>മുതലാളി ടെലിഗ്രാം ബോട്ടിൽ <b>1 മുതൽ 50 വരെയുള്ള ഏതെങ്കിലും നമ്പർ</b> (ഉദാ: <code className="bg-emerald-100 px-1 py-0.5 rounded">5</code>) അയച്ചാൽ ആ തൊഴിലാളിയുടെ മുഴുവൻ റിപ്പോർട്ടും കിട്ടും.</li>
                <li><code className="bg-emerald-100 px-1 py-0.5 rounded">/today</code> - ഇന്നത്തെ എല്ലാ വിവരങ്ങളും ലഭിക്കും.</li>
                <li><code className="bg-emerald-100 px-1 py-0.5 rounded">/all</code> - എല്ലാ തൊഴിലാളികളുടെയും സംഗ്രഹം ലഭിക്കും.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: EDIT WORK LOG REPORT */}
      {editingLog && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-5 md:p-6 max-w-lg w-full border border-slate-200 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Pencil className="w-5 h-5 text-amber-600" />
                <h3 className="text-base font-bold text-slate-800">വർക്ക് റിപ്പോർട്ട് എഡിറ്റ് ചെയ്യുക</h3>
              </div>
              <button 
                onClick={() => setEditingLog(null)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              
              {/* Worker number and name */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">തൊഴിലാളി #:</label>
                  <select 
                    value={editForm.workerNumber}
                    onChange={(e) => {
                      const n = parseInt(e.target.value, 10);
                      setEditForm(prev => ({
                        ...prev,
                        workerNumber: n,
                        workerName: workerNamesMap[n] || prev.workerName
                      }));
                    }}
                    className="w-full h-10 px-2 rounded-xl border border-slate-300 text-xs font-mono font-bold bg-white"
                  >
                    {Array.from({ length: 50 }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>#{n}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">പേര്:</label>
                  <input 
                    type="text"
                    required
                    value={editForm.workerName}
                    onChange={(e) => setEditForm(prev => ({ ...prev, workerName: e.target.value }))}
                    className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs font-semibold bg-white"
                  />
                </div>
              </div>

              {/* Date & Thach */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">തീയതി (Date):</label>
                  <input 
                    type="date"
                    required
                    value={editForm.date}
                    onChange={(e) => setEditForm(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs font-semibold bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">തച്ച് (Shift):</label>
                  <select 
                    value={editForm.thachCount}
                    onChange={(e) => setEditForm(prev => ({ ...prev, thachCount: parseFloat(e.target.value) }))}
                    className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs font-bold font-mono bg-white"
                  >
                    <option value={0.5}>അര തച്ച് (0.5)</option>
                    <option value={1.0}>ഒരു തച്ച് (1.0)</option>
                    <option value={1.5}>ഒന്നര തച്ച് (1.5)</option>
                    <option value={2.0}>രണ്ട് തച്ച് (2.0)</option>
                  </select>
                </div>
              </div>

              {/* Site Name */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">സൈറ്റ് / സ്ഥലം:</label>
                <input 
                  type="text"
                  required
                  list="edit-sites-autocomplete"
                  value={editForm.siteName}
                  onChange={(e) => setEditForm(prev => ({ ...prev, siteName: e.target.value }))}
                  className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs font-semibold bg-white"
                />
                <datalist id="edit-sites-autocomplete">
                  {Array.from(new Set(logs.map(l => l.siteName).filter(Boolean))).map((site, idx) => (
                    <option key={idx} value={site} />
                  ))}
                </datalist>
              </div>

              {/* Work Description */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">ജോലി വിവരങ്ങൾ:</label>
                <textarea 
                  required
                  rows={2}
                  value={editForm.workDescription}
                  onChange={(e) => setEditForm(prev => ({ ...prev, workDescription: e.target.value }))}
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs font-medium resize-none bg-white"
                />
              </div>

              {/* Expenses */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
                <span className="text-[11px] font-bold text-slate-700 block">ചിലവുകൾ (Expenses):</span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-0.5">വണ്ടി വാടക:</label>
                    <input 
                      type="number"
                      min="0"
                      value={editForm.vehicleRent}
                      onChange={(e) => setEditForm(prev => ({ ...prev, vehicleRent: e.target.value }))}
                      className="w-full h-9 px-2.5 rounded-lg border border-slate-300 font-mono text-xs bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-0.5">ഫുഡ്:</label>
                    <input 
                      type="number"
                      min="0"
                      value={editForm.foodExpense}
                      onChange={(e) => setEditForm(prev => ({ ...prev, foodExpense: e.target.value }))}
                      className="w-full h-9 px-2.5 rounded-lg border border-slate-300 font-mono text-xs bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-0.5">ഉപകരണ വാടക:</label>
                    <input 
                      type="number"
                      min="0"
                      value={editForm.toolsRent}
                      onChange={(e) => setEditForm(prev => ({ ...prev, toolsRent: e.target.value }))}
                      className="w-full h-9 px-2.5 rounded-lg border border-slate-300 font-mono text-xs bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-0.5">മറ്റ് ചിലവുകൾ:</label>
                    <input 
                      type="number"
                      min="0"
                      value={editForm.otherExpense}
                      onChange={(e) => setEditForm(prev => ({ ...prev, otherExpense: e.target.value }))}
                      className="w-full h-9 px-2.5 rounded-lg border border-slate-300 font-mono text-xs bg-white"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button 
                  type="button"
                  onClick={() => setEditingLog(null)}
                  className="flex-1 h-11 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition"
                >
                  ക്യാൻസൽ
                </button>
                <button 
                  type="submit"
                  disabled={updatingLog}
                  className="flex-1 h-11 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs shadow transition active:scale-98 disabled:opacity-50"
                >
                  {updatingLog ? 'സേവ് ചെയ്യുന്നു...' : 'മാറ്റങ്ങൾ സേവ് ചെയ്യുക'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: DELETE CONFIRMATION */}
      {deletingLog && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full border border-slate-200 shadow-2xl space-y-4">
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-800">റിപ്പോർട്ട് ഡിലീറ്റ് ചെയ്യണോ?</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                തൊഴിലാളി <span className="font-bold text-slate-800">#{deletingLog.workerNumber} ({deletingLog.workerName})</span> ന്റെ ഈ ദിവസം (<span className="font-mono font-semibold">{deletingLog.date}</span>) ലെ വർക്ക് വിവരങ്ങൾ ഡിലീറ്റ് ചെയ്യുന്നതാണ്.
              </p>
            </div>

            <div className="p-3 bg-rose-50 rounded-2xl border border-rose-100 text-xs text-rose-900 space-y-1">
              <p>📍 <b>സൈറ്റ്:</b> {deletingLog.siteName}</p>
              <p>🛠️ <b>ജോലി:</b> {deletingLog.workDescription}</p>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button 
                type="button"
                onClick={() => setDeletingLog(null)}
                className="flex-1 h-11 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition"
              >
                വേണ്ട (Cancel)
              </button>
              <button 
                type="button"
                disabled={deletingInProgress}
                onClick={handleDeleteLog}
                className="flex-1 h-11 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow transition active:scale-98 disabled:opacity-50"
              >
                {deletingInProgress ? 'ഡിലീറ്റ് ചെയ്യുന്നു...' : 'അതെ, ഡിലീറ്റ് ചെയ്യുക'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
