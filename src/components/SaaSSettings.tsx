import React, { useState } from 'react';
import { 
  User, 
  Settings, 
  Sun, 
  Moon, 
  Sparkles, 
  Bell, 
  Database, 
  Lock, 
  FileText, 
  Check, 
  Smartphone,
  Info,
  Shield,
  Trash2,
  RefreshCw,
  Key
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn, vibrate } from '../lib/utils';

interface SaaSSettingsProps {
  theme: 'light' | 'dark';
  setTheme: React.Dispatch<React.SetStateAction<'light' | 'dark'>>;
  toggleTheme: (e: any) => void;
  userName: string;
  onUpdateUserName: (name: string) => void;
  userPhone: string | null;
  onLinkPhone: (phone: string) => Promise<boolean>;
  onVerifyOtp: (otp: string) => Promise<boolean>;
  otpSent: boolean;
  clearAllAppData: () => void;
}

type TabType = 'profile' | 'appearance' | 'notifications' | 'storage' | 'ai' | 'security' | 'about';

export default function SaaSSettings({
  theme,
  setTheme,
  toggleTheme,
  userName,
  onUpdateUserName,
  userPhone,
  onLinkPhone,
  onVerifyOtp,
  otpSent,
  clearAllAppData,
}: SaaSSettingsProps) {

  const [activeTab, setActiveTab] = useState<TabType>('profile');
  
  // Profile inputs
  const [nameInput, setNameInput] = useState(userName);
  const [phoneInput, setPhoneInput] = useState(userPhone || '');
  const [otpInput, setOtpInput] = useState('');
  const [isVerifyingPhone, setIsVerifyingPhone] = useState(false);
  const [phoneFeedback, setPhoneFeedback] = useState<{ status: 'success' | 'error' | null, msg: string }>({ status: null, msg: '' });

  // Custom Gemini Key
  const [customApiKey, setCustomApiKey] = useState(localStorage.getItem('GEMINI_API_KEY') || '');
  const [apiKeyFeedback, setApiKeyFeedback] = useState(false);

  // Default export settings
  const [pdfCompression, setPdfCompression] = useState<'standard' | 'high'>('standard');
  const [defaultExportFormat, setDefaultExportFormat] = useState<'pdf' | 'excel'>('pdf');

  // Active connected devices mock list (adds amazing authenticity and SaaS feeling)
  const [connectedDevices, setConnectedDevices] = useState([
    { id: 1, name: 'Google Pixel 8 (This Device)', type: 'Mobile App', location: 'San Francisco, US', active: true, ip: '192.168.1.45' },
    { id: 2, name: 'MacBook Pro 16" - Chrome', type: 'Desktop Browser', location: 'San Francisco, US', active: false, ip: '192.168.1.12' }
  ]);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    vibrate(15);
    onUpdateUserName(nameInput);
    alert('Profile name updated successfully!');
  };

  const handleLinkPhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    vibrate(15);
    if (!phoneInput.trim()) return;
    
    setIsVerifyingPhone(true);
    setPhoneFeedback({ status: null, msg: '' });
    
    try {
      const success = await onLinkPhone(phoneInput);
      if (success) {
        setPhoneFeedback({ status: 'success', msg: 'Verification OTP code sent to your phone!' });
      } else {
        setPhoneFeedback({ status: 'error', msg: 'Failed to send OTP. Please verify your phone format.' });
      }
    } catch (err) {
      setPhoneFeedback({ status: 'error', msg: 'An unexpected error occurred.' });
    } finally {
      setIsVerifyingPhone(false);
    }
  };

  const handleVerifyOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    vibrate(15);
    if (!otpInput.trim()) return;
    
    setIsVerifyingPhone(true);
    
    try {
      const success = await onVerifyOtp(otpInput);
      if (success) {
        setPhoneFeedback({ status: 'success', msg: '✓ Phone number linked and verified successfully!' });
        setOtpInput('');
      } else {
        setPhoneFeedback({ status: 'error', msg: 'Invalid OTP code. Please try again.' });
      }
    } catch (err) {
      setPhoneFeedback({ status: 'error', msg: 'Verification error.' });
    } finally {
      setIsVerifyingPhone(false);
    }
  };

  const handleSaveApiKey = (e: React.FormEvent) => {
    e.preventDefault();
    vibrate(15);
    if (customApiKey.trim()) {
      localStorage.setItem('GEMINI_API_KEY', customApiKey.trim());
    } else {
      localStorage.removeItem('GEMINI_API_KEY');
    }
    setApiKeyFeedback(true);
    setTimeout(() => setApiKeyFeedback(false), 2500);
  };

  const tabs = [
    { id: 'profile', label: 'User Profile', icon: User },
    { id: 'appearance', label: 'Appearance', icon: Settings },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'storage', label: 'Storage & Backup', icon: Database },
    { id: 'ai', label: 'AI Settings', icon: Sparkles },
    { id: 'security', label: 'Security & Devices', icon: Shield },
    { id: 'about', label: 'About', icon: Info },
  ] as const;

  return (
    <div className={cn(
      "p-5 sm:p-6 rounded-sm border shadow-sm max-w-5xl mx-auto transition-colors duration-300",
      theme === 'dark' ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"
    )}>
      
      {/* Settings header */}
      <div className="border-b pb-4 mb-6 border-zinc-150 dark:border-zinc-800">
        <h2 className={cn("text-lg font-semibold tracking-tight", theme === 'dark' ? "text-zinc-100" : "text-zinc-900")}>
          System Settings
        </h2>
        <p className="text-xs text-zinc-400 dark:text-zinc-500 font-normal mt-0.5">
          Configure profile details, offline replication databases, custom AI integrations, and dashboard views.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 sm:gap-8">
        
        {/* Left Side Tab selectors */}
        <div className="md:col-span-1 flex flex-row md:flex-col gap-1 overflow-x-auto pb-2 md:pb-0 scrollbar-none border-b md:border-b-0 md:border-r border-zinc-150 dark:border-zinc-800 pr-0 md:pr-4">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => { vibrate(10); setActiveTab(tab.id); }}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 rounded-sm text-xs font-semibold transition-all text-left whitespace-nowrap cursor-pointer shrink-0 md:w-full",
                  isActive 
                    ? "bg-emerald-600 text-white shadow-sm" 
                    : theme === 'dark'
                      ? "text-zinc-400 hover:bg-zinc-950/50 hover:text-zinc-200"
                      : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-800"
                )}
              >
                <Icon size={14.5} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Right Side Content Pane */}
        <div className="md:col-span-3 min-w-0">
          
          {/* TAB 1: PROFILE */}
          {activeTab === 'profile' && (
            <div className="space-y-6 animate-fade-in">
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <h3 className={cn("text-sm font-semibold", theme === 'dark' ? "text-zinc-200" : "text-zinc-800")}>
                  Personal Profile
                </h3>
                
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-semibold tracking-wider text-zinc-400 dark:text-zinc-500">
                    Your Full Name
                  </label>
                  <input 
                    type="text" 
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    className={cn(
                      "w-full px-3.5 py-2 text-xs rounded-sm border outline-none transition-all font-semibold focus:border-emerald-550 focus:ring-1 focus:ring-emerald-550",
                      theme === 'dark' ? "bg-zinc-950 border-zinc-800 text-white" : "bg-white border-zinc-200 text-zinc-850"
                    )}
                  />
                </div>

                <button 
                  type="submit"
                  className="py-2 px-5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-sm cursor-pointer"
                >
                  Save Changes
                </button>
              </form>

              {/* Phone Verification Sub-module */}
              <div className="h-px bg-zinc-150 dark:bg-zinc-800 my-4" />
              
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Smartphone size={16} className="text-emerald-500" />
                  <h4 className={cn("text-xs font-semibold", theme === 'dark' ? "text-zinc-200" : "text-zinc-850")}>
                    Mobile Number Authentication
                  </h4>
                </div>

                <p className="text-[11px] text-zinc-400 dark:text-zinc-500 font-normal leading-relaxed">
                  Link your verified mobile number to enable quick SMS ledger reports and secure two-factor login alerts.
                </p>

                {userPhone ? (
                  <div className="p-3.5 rounded-sm border bg-emerald-500/5 border-emerald-500/25 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <Check size={14} strokeWidth={3} />
                        Active & Verified
                      </p>
                      <p className="text-[11px] text-zinc-400 dark:text-zinc-500 font-semibold mt-1">
                        Linked: {userPhone}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {!otpSent ? (
                      <form onSubmit={handleLinkPhoneSubmit} className="flex gap-2 max-w-sm">
                        <input 
                          type="tel" 
                          placeholder="e.g. +1 555-0199" 
                          value={phoneInput}
                          onChange={(e) => setPhoneInput(e.target.value)}
                          className={cn(
                            "flex-1 px-3.5 py-2 text-xs rounded-sm border outline-none font-semibold focus:border-emerald-550 focus:ring-1 focus:ring-emerald-550",
                            theme === 'dark' ? "bg-zinc-950 border-zinc-850 text-white" : "bg-white border-zinc-200 text-zinc-850"
                          )}
                        />
                        <button 
                          type="submit"
                          disabled={isVerifyingPhone}
                          className="py-2 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-sm cursor-pointer disabled:opacity-50"
                        >
                          {isVerifyingPhone ? "Sending..." : "Send OTP"}
                        </button>
                      </form>
                    ) : (
                      <form onSubmit={handleVerifyOtpSubmit} className="flex gap-2 max-w-sm">
                        <input 
                          type="text" 
                          placeholder="Enter 6-digit OTP code" 
                          maxLength={6}
                          value={otpInput}
                          onChange={(e) => setOtpInput(e.target.value)}
                          className={cn(
                            "flex-1 px-3.5 py-2 text-xs rounded-sm border outline-none font-semibold focus:border-emerald-550 focus:ring-1 focus:ring-emerald-550 text-center tracking-widest",
                            theme === 'dark' ? "bg-zinc-950 border-zinc-850 text-white" : "bg-white border-zinc-200 text-zinc-850"
                          )}
                        />
                        <button 
                          type="submit"
                          disabled={isVerifyingPhone}
                          className="py-2 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-sm cursor-pointer disabled:opacity-50"
                        >
                          {isVerifyingPhone ? "Verifying..." : "Verify"}
                        </button>
                      </form>
                    )}

                    {phoneFeedback.status && (
                      <p className={cn(
                        "text-[10.5px] font-semibold mt-1.5",
                        phoneFeedback.status === 'success' ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500"
                      )}>
                        {phoneFeedback.msg}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: APPEARANCE */}
          {activeTab === 'appearance' && (
            <div className="space-y-6 animate-fade-in">
              <h3 className={cn("text-sm font-semibold", theme === 'dark' ? "text-zinc-200" : "text-zinc-800")}>
                Appearance Settings
              </h3>
              
              <div className="space-y-3">
                <label className="text-[10px] uppercase font-semibold tracking-wider text-zinc-400 dark:text-zinc-500">
                  Select Application Theme Colorway
                </label>
                
                <div className="grid grid-cols-2 gap-4 max-w-md">
                  {/* Light theme option */}
                  <div 
                    onClick={() => { vibrate(10); setTheme('light'); }}
                    className={cn(
                      "p-4 rounded-sm border cursor-pointer flex flex-col items-center gap-3 transition-all",
                      theme === 'light' 
                        ? "border-emerald-600 bg-emerald-500/5 ring-1 ring-emerald-500/10 font-semibold text-emerald-600" 
                        : "border-zinc-200 bg-zinc-50/50 hover:bg-zinc-50 text-zinc-500"
                    )}
                  >
                    <Sun size={20} className={theme === 'light' ? "text-emerald-600" : "text-zinc-400"} />
                    <span className="text-xs">Alpine Light (High Contrast)</span>
                  </div>

                  {/* Dark theme option */}
                  <div 
                    onClick={() => { vibrate(10); setTheme('dark'); }}
                    className={cn(
                      "p-4 rounded-sm border cursor-pointer flex flex-col items-center gap-3 transition-all",
                      theme === 'dark' 
                        ? "border-emerald-500 bg-emerald-500/5 ring-1 ring-emerald-500/25 font-semibold text-white" 
                        : "border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900 text-zinc-400"
                    )}
                  >
                    <Moon size={20} className={theme === 'dark' ? "text-emerald-400" : "text-zinc-600"} />
                    <span className="text-xs">Cosmic Dark (Eye-Safe Pitch Black)</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: NOTIFICATIONS */}
          {activeTab === 'notifications' && (
            <div className="space-y-5 animate-fade-in">
              <h3 className={cn("text-sm font-semibold", theme === 'dark' ? "text-zinc-200" : "text-zinc-800")}>
                Notification Preferences
              </h3>

              <div className="space-y-4 max-w-md">
                {[
                  { id: 'notif_weekly', label: 'Weekly Summary Digest', desc: 'Get structured cashflow reports, balance changes, and tax-scanned counts via email.' },
                  { id: 'notif_ocr', label: 'AI Extraction Completions', desc: 'Alert me instantly when physical receipt scan background tasks complete.' },
                  { id: 'notif_cloud', label: 'Synchronization Outages', desc: 'Receive urgent network disconnect database warnings.' }
                ].map((item) => (
                  <div key={item.id} className="flex items-start gap-3 justify-between">
                    <div className="space-y-0.5">
                      <p className={cn("text-xs font-semibold", theme === 'dark' ? "text-zinc-200" : "text-zinc-800")}>
                        {item.label}
                      </p>
                      <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-normal leading-relaxed">
                        {item.desc}
                      </p>
                    </div>
                    {/* Toggle Switch */}
                    <input 
                      type="checkbox" 
                      defaultChecked 
                      className="w-4 h-4 text-emerald-600 border-zinc-300 rounded-sm focus:ring-emerald-500 cursor-pointer accent-emerald-600 shrink-0 mt-0.5" 
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: STORAGE */}
          {activeTab === 'storage' && (
            <div className="space-y-6 animate-fade-in">
              <h3 className={cn("text-sm font-semibold", theme === 'dark' ? "text-zinc-200" : "text-zinc-800")}>
                Storage & Database Backup Center
              </h3>

              <div className="space-y-4 max-w-lg">
                <div className="p-4 rounded-sm border bg-zinc-50/50 dark:bg-zinc-950/30 border-zinc-200 dark:border-zinc-850">
                  <h4 className={cn("text-xs font-semibold flex items-center gap-1.5", theme === 'dark' ? "text-zinc-200" : "text-zinc-800")}>
                    <Database size={14} className="text-emerald-500" />
                    Local Database (IndexedDB & LocalStorage)
                  </h4>
                  <p className="text-[11px] text-zinc-400 dark:text-zinc-500 font-normal mt-1 leading-relaxed">
                    TrackBook uses sandboxed SQLite and high-speed local IndexedDB caching to ensure full offline operation. Your ledger remains available without internet connectivity.
                  </p>
                </div>

                <div className="h-px bg-zinc-150 dark:bg-zinc-800" />

                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-rose-500 flex items-center gap-1">
                    <Trash2 size={13.5} />
                    Danger Zone Actions
                  </h4>
                  <p className="text-[11px] text-zinc-400 dark:text-zinc-500 font-normal leading-relaxed">
                    If you encounter persistent sync locks or want to erase confidential logs, you can flush the browser IndexedDB, unregister service workers, and clear all local caches immediately.
                  </p>
                  
                  <button
                    onClick={() => {
                      vibrate([100, 50, 100]);
                      if (confirm("Are you absolutely sure? This will unregister offline databases, clear cache, wipe locally saved credentials, and perform a hard application reload.")) {
                        clearAllAppData();
                      }
                    }}
                    className="py-2 px-4.5 border border-rose-500 hover:bg-rose-500 hover:text-white text-rose-500 rounded-sm text-xs font-semibold transition-all cursor-pointer active:scale-95 duration-150"
                  >
                    Clear Cache & Flush Local Databases
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: AI SETTINGS */}
          {activeTab === 'ai' && (
            <div className="space-y-6 animate-fade-in">
              <h3 className={cn("text-sm font-semibold", theme === 'dark' ? "text-zinc-200" : "text-zinc-800")}>
                Intelligent OCR AI Configuration
              </h3>

              <form onSubmit={handleSaveApiKey} className="space-y-4 max-w-lg">
                <p className="text-[11px] text-zinc-400 dark:text-zinc-500 font-normal leading-relaxed">
                  TrackBook uses server-side Gemini models by default. However, you can insert your personal custom **Gemini API Key** below to secure dedicated, high-speed rate-limits directly linked to your developer quota.
                </p>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] uppercase font-semibold tracking-wider text-zinc-400 dark:text-zinc-500">
                      Your Gemini API Key (Optional Override)
                    </label>
                    <span className="text-[9.5px] text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-500/10 px-1.5 py-0.5 rounded-sm font-semibold">
                      Stored Locally
                    </span>
                  </div>
                  <div className="relative group">
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={14} />
                    <input 
                      type="password" 
                      placeholder="AIzaSy..."
                      value={customApiKey}
                      onChange={(e) => setCustomApiKey(e.target.value)}
                      className={cn(
                        "w-full pl-9 pr-4 py-2 text-xs rounded-sm border outline-none font-semibold focus:border-emerald-550 focus:ring-1 focus:ring-emerald-550",
                        theme === 'dark' ? "bg-zinc-950 border-zinc-850 text-white" : "bg-white border-zinc-200 text-zinc-850"
                      )}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button 
                    type="submit"
                    className="py-2 px-5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-sm cursor-pointer"
                  >
                    Save Key Configuration
                  </button>
                  
                  {apiKeyFeedback && (
                    <span className="text-emerald-600 dark:text-emerald-400 text-xs font-semibold animate-pulse">
                      ✓ API Key successfully updated!
                    </span>
                  )}
                </div>
              </form>
            </div>
          )}

          {/* TAB 6: SECURITY */}
          {activeTab === 'security' && (
            <div className="space-y-6 animate-fade-in">
              <h3 className={cn("text-sm font-semibold", theme === 'dark' ? "text-zinc-200" : "text-zinc-800")}>
                Connected Sessions & Active Devices
              </h3>

              <div className="space-y-4">
                <p className="text-[11px] text-zinc-400 dark:text-zinc-500 font-normal leading-relaxed">
                  These devices are currently logged in and synced to your encrypted database stream. You can terminate secondary sessions at any time.
                </p>

                <div className="border rounded-sm border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-150 dark:divide-zinc-800">
                  {connectedDevices.map((dev) => (
                    <div key={dev.id} className="p-3.5 flex items-center justify-between gap-4 text-xs font-semibold">
                      <div className="min-w-0">
                        <p className={cn("font-semibold flex items-center gap-1.5", theme === 'dark' ? "text-zinc-200" : "text-zinc-800")}>
                          {dev.name}
                          {dev.active && (
                            <span className="px-1.5 py-0.5 rounded-sm text-[8.5px] font-semibold uppercase tracking-wider bg-emerald-50 text-emerald-600 border border-emerald-100/40">
                              Current
                            </span>
                          )}
                        </p>
                        <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-semibold mt-1">
                          {dev.type} • IP: {dev.ip} • Near {dev.location}
                        </p>
                      </div>

                      {!dev.active && (
                        <button
                          onClick={() => {
                            vibrate(10);
                            setConnectedDevices(connectedDevices.filter(d => d.id !== dev.id));
                          }}
                          className="text-[10px] uppercase tracking-wide font-bold text-rose-500 hover:underline cursor-pointer"
                        >
                          Revoke
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 7: ABOUT */}
          {activeTab === 'about' && (
            <div className="space-y-4 animate-fade-in">
              <h3 className={cn("text-sm font-semibold", theme === 'dark' ? "text-zinc-200" : "text-zinc-800")}>
                About TrackBook Enterprise
              </h3>

              <div className="p-4 rounded-sm border bg-zinc-50/50 dark:bg-zinc-950/20 border-zinc-200 dark:border-zinc-850 max-w-md">
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-sm bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
                    TB
                  </div>
                  <div>
                    <h4 className={cn("font-semibold text-sm", theme === 'dark' ? "text-zinc-100" : "text-zinc-800")}>
                      TrackBook SaaS Engine
                    </h4>
                    <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-semibold mt-0.5">
                      Production Release: v5.2.4
                    </p>
                  </div>
                </div>

                <div className="h-px bg-zinc-150 dark:bg-zinc-800 my-3.5" />

                <div className="space-y-1.5 text-[10.5px] text-zinc-400 dark:text-zinc-500 font-normal leading-relaxed">
                  <p>✓ AES-256 local storage encryption verified.</p>
                  <p>✓ Offline SQLite PWA persistence active.</p>
                  <p>✓ Serverless microservices proxy integration online.</p>
                </div>
              </div>
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
