import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Play, Pause, RotateCcw, Volume2, VolumeX, FastForward, Rewind, 
  ChevronRight, ChevronLeft, Video, Mic, Monitor, Sparkles, CheckCircle2, 
  ArrowRight, ShieldCheck, TrendingUp, Users, DollarSign, Clock, Smartphone, 
  MessageSquare, FileText, ExternalLink, Copy, Check, Eye, Maximize2, Minimize2,
  Car, Compass, Award, Layers, AlertCircle, BarChart3, HelpCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface Chapter {
  id: number;
  timecode: string;
  durationSeconds: number;
  title: string;
  subtitle: string;
  category: 'Genesis' | 'Growth' | 'Technology' | 'Operations' | 'Finance' | 'Vision';
  keyMetric: { label: string; value: string; detail: string };
  script: string;
  keyPoints: string[];
  visualType: 'genesis_shift' | 'dual_shift_clock' | 'head_drivers' | 'growth_funnel' | 'whatsapp_chaos' | 'whatsapp_bot' | 'role_hierarchy' | 'wallet_slabs' | 'daily_ledger' | 'settlement_check' | 'driver_portal' | 'scale_roadmap';
}

const CHAPTERS: Chapter[] = [
  {
    id: 1,
    timecode: "00:00",
    durationSeconds: 60,
    title: "The ₹40,000 Genesis",
    subtitle: "Bootstrapping an Urban Mobility Machine in Bangalore",
    category: "Genesis",
    keyMetric: { label: "Initial Capital", value: "₹40,000", detail: "Self-funded bootstrapping" },
    script: "Welcome, investors and partners. My name is the founder of Encho Enterprises, and what you are seeing today was not built in a comfortable Silicon Valley incubator. In Bangalore, I started Encho Cabs with a capital of just 40,000 rupees and a relentless technical skillset. I didn't wait for multi-million dollar venture rounds. I personally went to Kerala, ran targeted digital campaigns, and began recruiting drivers to Bangalore. We promised them what no other fleet operator gave them: clean accommodation, food, hands-on training, and a guaranteed high-earning career driving on Uber, Ola, and Rapido. This is the story of how 40,000 rupees transformed into an automated fleet empire.",
    keyPoints: [
      "Started with exactly ₹40,000 INR self-funded seed capital",
      "Direct driver recruitment from Kerala to Bangalore",
      "Comprehensive package: Accommodation, Food allowance & Professional Training",
      "Zero reliance on third-party agencies from Day 1"
    ],
    visualType: 'genesis_shift'
  },
  {
    id: 2,
    timecode: "01:00",
    durationSeconds: 60,
    title: "The 24-Hour Car Sweating Model",
    subtitle: "Morning Shift (4am-4pm) & Night Shift (4pm-4am)",
    category: "Operations",
    keyMetric: { label: "Asset Utilization", value: "24 Hours / Day", detail: "Zero idle vehicle time" },
    script: "To make our unit economics unbeatable, we engineered the 24-hour car sweating model. In standard fleet operations, vehicles sit parked 12 hours a day losing capital value. At Encho, every vehicle worked 24 hours continuously. Shift one: 4:00 AM to 4:00 PM for the morning driver. Shift two: 4:00 PM to 4:00 AM for the night driver. While the cars ran 24 hours across Bangalore's busiest pickup zones, for me as a solo founder, it was a true 24-hour workday. I personally managed handovers, verified fuel receipts, supervised vehicle sanitation, and kept our fleet on the road without missing a single hour.",
    keyPoints: [
      "Dual 12-hour shifts maximize asset returns by 200%",
      "Morning Driver: 04:00 AM to 04:00 PM peak commute window",
      "Night Driver: 04:00 PM to 04:00 AM night life & airport window",
      "Founder oversaw continuous 24-hour operations in early phase"
    ],
    visualType: 'dual_shift_clock'
  },
  {
    id: 3,
    timecode: "02:00",
    durationSeconds: 60,
    title: "The 4 Head Drivers Layer",
    subtitle: "Delegating Operations & Mentoring Emerging Drivers",
    category: "Operations",
    keyMetric: { label: "Core Operations", value: "4 Head Drivers", detail: "Field leadership team" },
    script: "As our vehicle count grew, personal bandwidth hit its physical limit. Rather than hiring expensive MBA managers who don't understand the street reality, I identified our four most honest, disciplined, high-earning drivers and promoted them into Head Drivers. These four veterans took over driver onboarding, route mentoring in Bangalore, vehicle maintenance inspections, and emergency breakdown coordination. This operational layer established deep peer-to-peer trust and freed me to tackle our next massive challenge: legalizing the enterprise and building proprietary software.",
    keyPoints: [
      "Internal promotion of top-performing, reliable drivers",
      "Peer mentorship on Bangalore routes, traffic, and platform algorithms",
      "Rapid on-ground dispute resolution and vehicle maintenance checks",
      "Encho Enterprises formally licensed and legalized as an authorized fleet"
    ],
    visualType: 'head_drivers'
  },
  {
    id: 4,
    timecode: "03:00",
    durationSeconds: 60,
    title: "The Viral Marketing Funnel",
    subtitle: "Hyper-Optimized Kerala Ads at ₹1.5 - ₹3 Cost Per Lead",
    category: "Growth",
    keyMetric: { label: "Cost Per Lead (CPL)", value: "₹1.5 - ₹3.0", detail: "Industry benchmark is ₹60-₹150" },
    script: "Every mobility company bleeds money on driver acquisition. Typical aggregators spend 2,000 to 5,000 rupees to onboard a single active driver. Using my technical digital marketing expertise, I flipped this equation completely. We created raw, sincere video testimonials of our Kerala drivers showing their real weekly earnings, clean accommodation, and Bangalore lifestyle. By precision-targeting Tier-2 and Tier-3 towns across Kerala, I optimized our Meta ad campaigns to an astonishing 1.5 to 3 rupees per inbound lead. We turned driver recruitment into an infinite viral growth engine.",
    keyPoints: [
      "Customer/Driver Acquisition Cost crushed from industry ₹100+ to ₹1.5-₹3",
      "Authentic driver video testimonials built genuine community trust",
      "Hyper-targeted campaigns focused on Tier-2 & Tier-3 Kerala districts",
      "Massive viral word-of-mouth compounding organic referrals"
    ],
    visualType: 'growth_funnel'
  },
  {
    id: 5,
    timecode: "04:00",
    durationSeconds: 60,
    title: "The 1,000-Lead Daily Flood",
    subtitle: "When Viral Marketing Breaks Traditional Staff Handlers",
    category: "Growth",
    keyMetric: { label: "Inbound Volume", value: "500 - 1,000 / Day", detail: "WhatsApp inquiry rush" },
    script: "Success brought a near-fatal bottleneck. In single 24-hour marketing pushes, between 500 and 1,000 fresh inquiries flooded our official WhatsApp lines. I expanded our hiring team to five full-time staff, but human chaos ensued. Multiple staff members were accidentally calling the same driver simultaneously. Hot leads cooled down before someone could reply. Drivers asking simple questions about room location or advance payments got delayed responses. We realized that third-party CRM tools were both too expensive and utterly unsuited for high-velocity WhatsApp fleet hiring.",
    keyPoints: [
      "500 to 1,000 inquiries flooding WhatsApp every 24 hours",
      "Double-calling friction caused by disconnected staff spreadsheets",
      "The 'Golden 5-Minute Window': Hot leads cool down rapidly",
      "Decision made: Engineer a custom WhatsApp Leads Handler platform"
    ],
    visualType: 'whatsapp_chaos'
  },
  {
    id: 6,
    timecode: "05:00",
    durationSeconds: 60,
    title: "The Encho WhatsApp Leads Engine",
    subtitle: "Instant AI Chatbot & Proof-of-Earnings Verification",
    category: "Technology",
    keyMetric: { label: "Response Latency", value: "< 2 Seconds", detail: "Instant chatbot engagement" },
    script: "To master the flood, I coded the Encho WhatsApp Leads Handler from scratch. When a prospective driver messages our WhatsApp, our automated chatbot instantly greets them, answers frequent queries regarding daily earnings, room facilities, and vehicle types, and gathers their driving license and experience details. Furthermore, to eliminate skepticism, we built a dedicated public Driver Earnings Verification page into the system. Prospective drivers can self-verify the actual live bank payouts of our drivers, building impenetrable trust before human staff ever place a phone call.",
    keyPoints: [
      "Instant 24/7 conversational chatbot handles the first-contact wave",
      "Automated qualification: DL status, Bangalore familiarity, shift readiness",
      "Public Driver Earnings Verification Page eliminates recruitment skepticism",
      "Seamless handover from automated bot to human hiring counselor"
    ],
    visualType: 'whatsapp_bot'
  },
  {
    id: 7,
    timecode: "06:00",
    durationSeconds: 60,
    title: "Role Hierarchy & The God's Eye Pool",
    subtitle: "Admin, Managers, and Staff with Zero Collision",
    category: "Technology",
    keyMetric: { label: "Lead Collisions", value: "0 Collisions", detail: "Atomic lead claiming pool" },
    script: "In our Leads Handler software, we implemented a strict three-tier organizational hierarchy: Admin at the top, Managers in the middle, and Staff at the frontline. Inbound leads land into a shared pool. Staff claim leads atomically into their private work queue—completely eliminating double-calling. Managers can monitor staff conversion metrics, step in to assist with high-intent drivers, and reassign stalled leads. Meanwhile, with the Admin 'God's Eye' dashboard, leadership tracks overall cost per acquisition, team velocity, and conversion ratios in real time.",
    keyPoints: [
      "Three-tier RBAC architecture: Admin → Managers → Staff counselors",
      "Atomic 'Claim from Pool' mechanic ensures zero double-dialing",
      "Manager supervisory controls: Reassign stale leads and audit calls",
      "God's Eye executive telemetry tracks conversion rate by campaign"
    ],
    visualType: 'role_hierarchy'
  },
  {
    id: 8,
    timecode: "07:00",
    durationSeconds: 60,
    title: "The Core ERP: Driver Wallet & Slabs",
    subtitle: "Dynamic Trip-Incentive Rental Slabs (Gemini-3pro Platform)",
    category: "Finance",
    keyMetric: { label: "Trip Tiers", value: "5 Rental Slabs", detail: "More trips = Lower car rent" },
    script: "Now let's examine the crown jewel of our technology stack: the Encho Driver Wallet and Accounting ERP, open-source on GitHub under Gemini-3pro-Enchocabs-Software. Generic accounting tools like Tally fail in taxi fleets because rental rates must be dynamic. We engineered an incentive slab structure: 0 to 45 weekly trips charges 950 rupees per day. 46 to 59 trips drops to 850 rupees. 60 to 64 trips drops to 772 rupees. 65 to 69 trips drops to 700 rupees. And 70-plus trips drops to just 550 rupees per day! The harder the driver works, the lower their car rent, perfectly aligning driver incentives with company volume.",
    keyPoints: [
      "Dynamic trip-based rental pricing drives driver motivation",
      "0-45 Trips: ₹950/day | 46-59 Trips: ₹850/day | 60-64 Trips: ₹772/day",
      "65-69 Trips: ₹700/day | 70+ Trips: ₹550/day (High-performer rate)",
      "Automated calculation eliminates manual spreadsheet disputes"
    ],
    visualType: 'wallet_slabs'
  },
  {
    id: 9,
    timecode: "08:00",
    durationSeconds: 60,
    title: "The Daily Collection Ledger",
    subtitle: "Live Auditing, Outlier Detection, and Instant Calculation",
    category: "Finance",
    keyMetric: { label: "Audit Precision", value: "±₹0.00", detail: "Automated daily collection reconciliation" },
    script: "Every single day, collections from Uber, Ola, and direct customer cash are logged into our Daily Entry Engine. The software automatically applies the mathematical formula: Payout equals Collection minus Vehicle Rent minus Fuel plus Due plus Wallet Week minus Expenses. What makes our system FAANG-grade is built-in outlier detection. If a driver logs collections 2.5 times higher or 70 percent lower than their personal 30-day moving average, our system flags an immediate alert for admin review. No fraud, no missing fuel bills, and zero human calculation errors.",
    keyPoints: [
      "Strict financial formula: Payout = Collection - Rent - Fuel + Due + Wallet - Exp",
      "Automated Outlier Detection flags anomalies >2.5x historical baseline",
      "60-day auto-windowing with full multi-year ledger pagination",
      "Supports offline entry sync for supervisors working in basement garages"
    ],
    visualType: 'daily_ledger'
  },
  {
    id: 10,
    timecode: "09:00",
    durationSeconds: 60,
    title: "Company Settlement & Fraud Check",
    subtitle: "Uber/Ola Settlement vs Driver Cash Reconciliation",
    category: "Finance",
    keyMetric: { label: "Settlement Tolerance", value: "< ₹5.00", detail: "Strict balance validation check" },
    script: "Every Monday, aggregators release consolidated company settlement sheets. In traditional fleets, reconciliations take days and leave tens of thousands in unnoticed leakage. In Encho, we upload the raw company file and our software executes a cross-reconciliation fraud check. It sums driver wallet adjustments against company wallet balances. If the discrepancy exceeds 5 rupees, the system highlights the exact driver and transaction for investigation. We also automatically apportion our 4,666 rupees weekly room rent overhead per hub, delivering a mathematically verified net profit or loss figure.",
    keyPoints: [
      "Automated import and parsing of Uber & Ola weekly settlement files",
      "Fraud Check diff validates (Drivers Wallet + Company Wallet) < ₹100 tolerance",
      "Apportions ₹4,666 weekly room rent per hostel hub to isolate net profitability",
      "Zero accounting leakage across hundreds of active vehicle rosters"
    ],
    visualType: 'settlement_check'
  },
  {
    id: 11,
    timecode: "10:00",
    durationSeconds: 60,
    title: "The Driver Transparency Portal",
    subtitle: "Mobile-First Verified Payouts, Duty Roster & Food Allowance",
    category: "Technology",
    keyMetric: { label: "Dispute Rate", value: "0.0%", detail: "Zero payment disputes recorded" },
    script: "The greatest secret to Encho's high driver retention is our dedicated Driver Portal. Drivers don't have to plead with accountants to know what they earned. Each driver simply enters their phone number or scans their assigned car QR code on their smartphone. Instantly, they see their duty schedule, shift timings, verified daily collections, fuel credit approvals, food allowance deductions, and finalized net weekly payout. This transparent, respectful technology makes drivers choose Encho over any other fleet in southern India.",
    keyPoints: [
      "Direct mobile phone or car QR login for every active driver",
      "Live view of verified collections, fuel credit, and food allowances",
      "Real-time slab progress bar showing how many trips needed to lower rent",
      "Generates long-term driver loyalty and strong organic word-of-mouth"
    ],
    visualType: 'driver_portal'
  },
  {
    id: 12,
    timecode: "11:00",
    durationSeconds: 60,
    title: "700+ Drivers Scaled & The Investment Opportunity",
    subtitle: "From ₹40K Bootstrap to India's Premier Mobility SaaS Platform",
    category: "Vision",
    keyMetric: { label: "Total Drivers Scaled", value: "700+ Drivers", detail: "Over 3 years in Bangalore" },
    script: "In three years, we scaled from a 40,000 rupee seed to more than 700 drivers trained, housed, and deployed across Bangalore. We built both software platforms entirely in-house: the Gemini-3pro Driver Wallet ERP and the Encho WhatsApp Leads Engine. We proved that we can acquire drivers for 1.5 rupees, keep vehicles on the road 24 hours a day, eliminate accounting leakage, and maintain zero driver disputes. As an investor, you are not backing an unproven presentation slide. You are backing an operational, battle-tested machine ready for multi-city capital deployment.",
    keyPoints: [
      "700+ drivers successfully onboarded and scaled across 3 operating years",
      "Two proprietary production platforms engineered and validated in real operations",
      "Ready to expand to Hyderabad, Chennai, and Mumbai with fresh vehicle capital",
      "Looking for visionary growth partners to scale Encho into a national brand"
    ],
    visualType: 'scale_roadmap'
  }
];

export default function InvestorShowcasePage() {
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [voiceRate, setVoiceRate] = useState(1.0);
  const [selectedVoiceName, setSelectedVoiceName] = useState<string>('');
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [currentTimeSeconds, setCurrentTimeSeconds] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [viewMode, setViewMode] = useState<'cinematic' | 'live_demo' | 'teleprompter' | 'script'>('cinematic');
  const [copiedScript, setCopiedScript] = useState(false);
  const [isWebcamActive, setIsWebcamActive] = useState(false);
  const [ambientSoundActive, setAmbientSoundActive] = useState(false);

  // Audio / Speech Synthesis refs
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const speechTimerRef = useRef<any>(null);
  const webcamVideoRef = useRef<HTMLVideoElement | null>(null);
  const webcamStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);

  const currentChapter = CHAPTERS[currentChapterIndex];

  // Initialize Speech Voices
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        setAvailableVoices(voices);
        // Prioritize natural English voices
        const preferred = voices.find(v => 
          (v.lang.startsWith('en') && (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Oliver') || v.name.includes('Daniel') || v.name.includes('India')))
        ) || voices.find(v => v.lang.startsWith('en')) || voices[0];
        if (preferred) setSelectedVoiceName(preferred.name);
      }
    };

    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  // Web Speech playback logic
  const stopSpeech = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (speechTimerRef.current) {
      clearInterval(speechTimerRef.current);
      speechTimerRef.current = null;
    }
    setIsPlaying(false);
  };

  const playChapterSpeech = (index: number) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      alert("Text-to-Speech is not supported in this browser.");
      return;
    }

    window.speechSynthesis.cancel();
    const chapter = CHAPTERS[index];
    if (!chapter) return;

    const utterance = new SpeechSynthesisUtterance(chapter.script);
    utteranceRef.current = utterance;

    if (selectedVoiceName) {
      const voice = availableVoices.find(v => v.name === selectedVoiceName);
      if (voice) utterance.voice = voice;
    }

    utterance.rate = voiceRate;
    utterance.pitch = 1.0;

    utterance.onstart = () => {
      setIsPlaying(true);
      setCurrentTimeSeconds(index * 60);
    };

    utterance.onend = () => {
      // Auto-advance to next chapter if available
      if (index < CHAPTERS.length - 1) {
        setCurrentChapterIndex(index + 1);
        playChapterSpeech(index + 1);
      } else {
        stopSpeech();
      }
    };

    utterance.onerror = (e) => {
      console.warn("Speech synthesis notice:", e);
      setIsPlaying(false);
    };

    window.speechSynthesis.speak(utterance);
    setIsPlaying(true);
  };

  const togglePlayPause = () => {
    if (isPlaying) {
      stopSpeech();
    } else {
      playChapterSpeech(currentChapterIndex);
    }
  };

  const handleSelectChapter = (index: number) => {
    stopSpeech();
    setCurrentChapterIndex(index);
    setCurrentTimeSeconds(index * 60);
  };

  const handleNextChapter = () => {
    if (currentChapterIndex < CHAPTERS.length - 1) {
      handleSelectChapter(currentChapterIndex + 1);
    }
  };

  const handlePrevChapter = () => {
    if (currentChapterIndex > 0) {
      handleSelectChapter(currentChapterIndex - 1);
    }
  };

  // Ambient sound generator for cinematic presentation feel
  const toggleAmbientSound = () => {
    try {
      if (ambientSoundActive) {
        if (oscillatorRef.current) {
          oscillatorRef.current.stop();
          oscillatorRef.current.disconnect();
          oscillatorRef.current = null;
        }
        setAmbientSoundActive(false);
      } else {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        audioContextRef.current = ctx;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(55, ctx.currentTime); // Low 55Hz soothing drone
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(120, ctx.currentTime);

        gain.gain.setValueAtTime(0.015, ctx.currentTime); // Very subtle background
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        osc.start();

        oscillatorRef.current = osc;
        setAmbientSoundActive(true);
      }
    } catch (e) {
      console.warn("WebAudio ambient sound init skipped:", e);
    }
  };

  // Webcam picture-in-picture for recording practice
  const toggleWebcam = async () => {
    if (isWebcamActive) {
      if (webcamStreamRef.current) {
        webcamStreamRef.current.getTracks().forEach(t => t.stop());
        webcamStreamRef.current = null;
      }
      setIsWebcamActive(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 480, height: 360 }, audio: false });
        webcamStreamRef.current = stream;
        if (webcamVideoRef.current) {
          webcamVideoRef.current.srcObject = stream;
          webcamVideoRef.current.play();
        }
        setIsWebcamActive(true);
      } catch (err: any) {
        alert("Camera access was not granted: " + (err.message || 'Permission denied'));
      }
    }
  };

  useEffect(() => {
    return () => {
      stopSpeech();
      if (webcamStreamRef.current) {
        webcamStreamRef.current.getTracks().forEach(t => t.stop());
      }
      if (oscillatorRef.current) {
        oscillatorRef.current.stop();
      }
    };
  }, []);

  const copyFullPitchScript = () => {
    const fullText = CHAPTERS.map(c => 
      `### [${c.timecode}] Chapter ${c.id}: ${c.title} (${c.subtitle})\nKey Metric: ${c.keyMetric.label} = ${c.keyMetric.value}\n\n"${c.script}"\n\nKey Proof Points:\n${c.keyPoints.map(p => `• ${p}`).join('\n')}\n`
    ).join('\n---\n\n');

    navigator.clipboard.writeText(fullText).then(() => {
      setCopiedScript(true);
      setTimeout(() => setCopiedScript(false), 2500);
    });
  };

  const totalTimeSeconds = 12 * 60; // 720s
  const currentChapterTimeSec = (currentChapterIndex * 60);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white pb-24">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-4 md:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-9 h-9 bg-gradient-to-tr from-indigo-600 to-violet-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/30 group-hover:scale-105 transition-transform">
              <span className="text-white font-extrabold text-lg tracking-tighter">E</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-white tracking-tight">ENCHO <span className="text-indigo-400">ENTERPRISES</span></span>
                <span className="text-[10px] uppercase font-black tracking-widest px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Investor Pitch Studio
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">12-Minute Interactive Proof-of-Work Weapon</p>
            </div>
          </Link>
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center gap-1.5 bg-slate-800/80 p-1 rounded-xl border border-slate-700/60">
          <button
            onClick={() => setViewMode('cinematic')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              viewMode === 'cinematic' 
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-bold' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Video size={14} />
            <span className="hidden sm:inline">Cinematic Tour</span>
          </button>
          <button
            onClick={() => setViewMode('live_demo')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              viewMode === 'live_demo' 
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-bold' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Monitor size={14} />
            <span className="hidden sm:inline">Live Simulator</span>
          </button>
          <button
            onClick={() => setViewMode('teleprompter')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              viewMode === 'teleprompter' 
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-bold' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Mic size={14} />
            <span className="hidden sm:inline">Teleprompter</span>
          </button>
          <button
            onClick={() => setViewMode('script')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              viewMode === 'script' 
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-bold' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText size={14} />
            <span className="hidden sm:inline">Full Script</span>
          </button>
        </div>

        {/* Quick External Actions */}
        <div className="flex items-center gap-2">
          <Link
            to="/app"
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700 transition-all"
          >
            <BarChart3 size={14} />
            <span>Open ERP Console</span>
          </Link>
          <Link
            to="/portal"
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 rounded-xl text-xs font-semibold border border-indigo-500/30 transition-all"
          >
            <Smartphone size={14} />
            <span>Driver Portal</span>
          </Link>
        </div>
      </header>

      {/* Hero Headline & Key Proof Metrics */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-4">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-slate-800/80">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <ShieldCheck size={12} /> Battle-Tested Fleet Engine
              </span>
              <span className="text-slate-500 text-xs">•</span>
              <span className="text-xs text-slate-400 font-medium">Bangalore, India</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
              The 12-Minute <span className="bg-gradient-to-r from-indigo-400 via-violet-300 to-indigo-200 bg-clip-text text-transparent">Proof-of-Work</span> Showcase
            </h1>
            <p className="text-slate-400 text-sm mt-1.5 max-w-2xl leading-relaxed">
              From ₹40,000 capital and 24-hour car sweating to a viral ₹1.5 CPL Kerala acquisition engine, 700+ drivers, and custom ERP accounting.
            </p>
          </div>

          {/* Quick Metrics Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-2xl">
              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Initial Capital</p>
              <p className="text-base font-extrabold text-white mt-0.5">₹40,000</p>
              <p className="text-[10px] text-emerald-400 mt-0.5">100% Bootstrap</p>
            </div>
            <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-2xl">
              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Acquisition Cost</p>
              <p className="text-base font-extrabold text-indigo-400 mt-0.5">₹1.5 - ₹3</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Per Meta Lead</p>
            </div>
            <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-2xl">
              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Total Drivers</p>
              <p className="text-base font-extrabold text-violet-400 mt-0.5">700+</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Hired in 3 Yrs</p>
            </div>
            <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-2xl">
              <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Shift Sweating</p>
              <p className="text-base font-extrabold text-amber-400 mt-0.5">24 Hours</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Day + Night Shift</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Studio Viewport */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Stage / Screen / Teleprompter (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Main Visual Screen Card */}
          <div className="relative bg-slate-900/90 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl shadow-indigo-950/20">
            
            {/* Top Stage Header */}
            <div className="px-6 py-4 bg-slate-900/95 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="flex h-3 w-3 relative">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isPlaying ? 'bg-indigo-400 opacity-75' : 'bg-slate-500 opacity-20'}`}></span>
                  <span className={`relative inline-flex rounded-full h-3 w-3 ${isPlaying ? 'bg-indigo-500' : 'bg-slate-600'}`}></span>
                </span>
                <div>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Chapter {currentChapter.id} of 12 • {currentChapter.timecode}
                  </span>
                  <h3 className="text-base font-extrabold text-white tracking-tight leading-snug">
                    {currentChapter.title}
                  </h3>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={toggleAmbientSound}
                  className={`p-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors border ${
                    ambientSoundActive 
                      ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40' 
                      : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                  }`}
                  title="Toggle Cinematic Ambient Synth Drone"
                >
                  <Sparkles size={14} className={ambientSoundActive ? 'animate-spin' : ''} />
                  <span className="text-[11px] hidden sm:inline">{ambientSoundActive ? 'Drone On' : 'Ambient'}</span>
                </button>
                <button
                  onClick={toggleWebcam}
                  className={`p-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors border ${
                    isWebcamActive 
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' 
                      : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                  }`}
                  title="Toggle Camera Picture-in-Picture for Pitch Recording"
                >
                  <Video size={14} />
                  <span className="text-[11px] hidden sm:inline">{isWebcamActive ? 'Cam On' : 'Cam'}</span>
                </button>
              </div>
            </div>

            {/* Webcam Picture-in-Picture overlay */}
            {isWebcamActive && (
              <div className="absolute top-16 right-4 z-30 w-44 h-32 bg-slate-950 rounded-2xl border-2 border-indigo-500/60 shadow-2xl overflow-hidden">
                <video ref={webcamVideoRef} autoPlay playsInline muted className="w-full h-full object-cover transform -scale-x-100" />
                <div className="absolute bottom-1.5 left-2 bg-slate-950/80 px-1.5 py-0.5 rounded text-[9px] font-bold text-rose-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span> REC FEED
                </div>
              </div>
            )}

            {/* Interactive Screen Display Area */}
            <div className="p-6 md:p-8 min-h-[420px] flex flex-col justify-between bg-gradient-to-b from-slate-900/60 via-slate-900 to-slate-950/90">
              
              {/* Dynamic Visual Mockup based on Chapter VisualType */}
              <div className="w-full">
                {currentChapter.visualType === 'genesis_shift' && (
                  <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-6 space-y-6">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                      <div>
                        <span className="text-[10px] font-black uppercase text-indigo-400 tracking-wider">Genesis Blueprint</span>
                        <h4 className="text-xl font-bold text-white mt-0.5">Bangalore Street-Hustle Deployment</h4>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-slate-400">Seed Outlay</span>
                        <p className="text-xl font-black text-emerald-400">₹40,000</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800">
                        <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-2 font-bold text-sm">1</div>
                        <h5 className="font-bold text-sm text-slate-200">Kerala Recruitment</h5>
                        <p className="text-xs text-slate-400 mt-1">Direct outreach bringing committed drivers from Kerala to Bangalore.</p>
                      </div>
                      <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800">
                        <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-2 font-bold text-sm">2</div>
                        <h5 className="font-bold text-sm text-slate-200">Food & Stay Provided</h5>
                        <p className="text-xs text-slate-400 mt-1">Hostel accommodation and food allowance removed driver migration friction.</p>
                      </div>
                      <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800">
                        <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-2 font-bold text-sm">3</div>
                        <h5 className="font-bold text-sm text-slate-200">24-Hr Car Sweating</h5>
                        <p className="text-xs text-slate-400 mt-1">Zero idle vehicle downtime with consecutive 12-hour driver handovers.</p>
                      </div>
                    </div>
                  </div>
                )}

                {currentChapter.visualType === 'dual_shift_clock' && (
                  <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-lg font-bold text-white flex items-center gap-2">
                        <Clock className="text-indigo-400" size={18} />
                        Continuous 24-Hour Car Sweating Cycle
                      </h4>
                      <span className="text-xs bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full font-bold">100% Asset Sweating</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                      {/* Morning Shift */}
                      <div className="bg-gradient-to-br from-amber-500/10 to-slate-900 p-5 rounded-2xl border border-amber-500/30">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">Shift A (Morning)</span>
                          <span className="text-sm font-black text-white bg-amber-500/20 px-2 py-0.5 rounded-lg">4 AM – 4 PM</span>
                        </div>
                        <p className="text-xs text-slate-300 mt-1">Captures high-surge Bangalore morning office commutes, tech park runs, and airport morning departures.</p>
                        <div className="mt-4 pt-3 border-t border-slate-800 flex justify-between text-xs">
                          <span className="text-slate-400">Average Daily Trips</span>
                          <span className="font-bold text-amber-300">12 – 16 Trips</span>
                        </div>
                      </div>

                      {/* Night Shift */}
                      <div className="bg-gradient-to-br from-indigo-500/10 to-slate-900 p-5 rounded-2xl border border-indigo-500/30">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Shift B (Night)</span>
                          <span className="text-sm font-black text-white bg-indigo-500/20 px-2 py-0.5 rounded-lg">4 PM – 4 AM</span>
                        </div>
                        <p className="text-xs text-slate-300 mt-1">Captures evening rush hour, late-night Bangalore return trips, and midnight airport arrivals with lower traffic congestion.</p>
                        <div className="mt-4 pt-3 border-t border-slate-800 flex justify-between text-xs">
                          <span className="text-slate-400">Average Daily Trips</span>
                          <span className="font-bold text-indigo-300">11 – 15 Trips</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {currentChapter.visualType === 'head_drivers' && (
                  <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-6">
                    <h4 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                      <Users className="text-indigo-400" size={18} />
                      Field Leadership: The 4 Head Drivers Roster
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { title: "Induction & Training", desc: "Routes & Uber/Ola app mastery" },
                        { title: "Vehicle Quality", desc: "Shift handovers & pre-ride audits" },
                        { title: "Hostel & Food", desc: "Driver welfare & room discipline" },
                        { title: "24/7 Breakdown", desc: "Emergency on-road assistance" },
                      ].map((item, i) => (
                        <div key={i} className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl text-center">
                          <div className="w-8 h-8 rounded-full bg-indigo-600/30 text-indigo-400 flex items-center justify-center font-bold mx-auto mb-2 text-xs">
                            H{i + 1}
                          </div>
                          <h6 className="font-bold text-xs text-white">{item.title}</h6>
                          <p className="text-[11px] text-slate-400 mt-1 leading-tight">{item.desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {currentChapter.visualType === 'growth_funnel' && (
                  <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-lg font-bold text-white flex items-center gap-2">
                        <TrendingUp className="text-emerald-400" size={18} />
                        Kerala Viral Acquisition Funnel (₹1.5 - ₹3 CPL)
                      </h4>
                      <span className="text-xs bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded-full">Meta Optimized</span>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center gap-4 bg-slate-900/90 p-3 rounded-xl border border-slate-800">
                        <div className="w-24 text-xs font-bold text-slate-400">Step 1: Video Ad</div>
                        <div className="flex-1 bg-slate-800 rounded-full h-3 overflow-hidden">
                          <div className="bg-indigo-500 h-full w-[95%]"></div>
                        </div>
                        <span className="text-xs font-bold text-white">Authentic Driver Testimonials</span>
                      </div>
                      <div className="flex items-center gap-4 bg-slate-900/90 p-3 rounded-xl border border-slate-800">
                        <div className="w-24 text-xs font-bold text-slate-400">Step 2: WhatsApp</div>
                        <div className="flex-1 bg-slate-800 rounded-full h-3 overflow-hidden">
                          <div className="bg-emerald-500 h-full w-[78%]"></div>
                        </div>
                        <span className="text-xs font-bold text-emerald-300">500-1,000 Inquiries / 24h</span>
                      </div>
                      <div className="flex items-center gap-4 bg-slate-900/90 p-3 rounded-xl border border-slate-800">
                        <div className="w-24 text-xs font-bold text-slate-400">Step 3: Verification</div>
                        <div className="flex-1 bg-slate-800 rounded-full h-3 overflow-hidden">
                          <div className="bg-violet-500 h-full w-[55%]"></div>
                        </div>
                        <span className="text-xs font-bold text-violet-300">Public Driver Earnings Page</span>
                      </div>
                      <div className="flex items-center gap-4 bg-slate-900/90 p-3 rounded-xl border border-slate-800">
                        <div className="w-24 text-xs font-bold text-slate-400">Step 4: Bangalore</div>
                        <div className="flex-1 bg-slate-800 rounded-full h-3 overflow-hidden">
                          <div className="bg-amber-500 h-full w-[38%]"></div>
                        </div>
                        <span className="text-xs font-bold text-amber-300">700+ Hired & Onboarded</span>
                      </div>
                    </div>
                  </div>
                )}

                {currentChapter.visualType === 'whatsapp_chaos' && (
                  <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-lg font-bold text-rose-400 flex items-center gap-2">
                        <AlertCircle size={18} />
                        The Operational Crisis: 1,000 Unstructured Leads
                      </h4>
                      <span className="text-xs bg-rose-500/20 text-rose-300 px-2.5 py-0.5 rounded-full font-bold">The Bottleneck</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="bg-rose-950/20 border border-rose-900/40 p-4 rounded-xl">
                        <p className="text-xs font-bold text-rose-300 uppercase">Friction #1: Double-Calling</p>
                        <p className="text-xs text-slate-300 mt-1">Staff A and Staff B dialing the same candidate within 10 minutes, annoying drivers and damaging company reputation.</p>
                      </div>
                      <div className="bg-rose-950/20 border border-rose-900/40 p-4 rounded-xl">
                        <p className="text-xs font-bold text-rose-300 uppercase">Friction #2: Cooling Leads</p>
                        <p className="text-xs text-slate-300 mt-1">Without an instant responder, drivers eager to migrate went to competitor fleets if not responded to within 15 minutes.</p>
                      </div>
                    </div>
                  </div>
                )}

                {currentChapter.visualType === 'whatsapp_bot' && (
                  <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-base font-bold text-white flex items-center gap-2">
                        <MessageSquare className="text-emerald-400" size={16} />
                        Encho WhatsApp Leads Engine Simulator
                      </h4>
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-bold px-2 py-0.5 rounded-full">Bot Active</span>
                    </div>

                    <div className="space-y-2.5 text-xs max-h-56 overflow-y-auto font-mono bg-slate-900/90 p-4 rounded-xl border border-slate-800">
                      <div className="flex justify-start">
                        <div className="bg-slate-800 p-2.5 rounded-xl max-w-[80%] text-slate-200">
                          <span className="text-[9px] block text-slate-400 font-sans mb-1">Inbound Candidate (Kerala) • 10:02 AM</span>
                          Namaskaram sir, I saw your video. Can I get a car in Bangalore? What about room and food?
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <div className="bg-emerald-950/80 border border-emerald-800/40 p-2.5 rounded-xl max-w-[80%] text-emerald-100">
                          <span className="text-[9px] block text-emerald-400 font-sans mb-1">Encho Automated Bot • 10:02 AM (Instant)</span>
                          Namaskaram! Welcome to Encho Enterprises Bangalore. Yes! We provide Free Room, Food Allowance & Clean Uber/Ola vehicles. Please reply with: 1) Years of driving experience 2) Do you have valid Commercial DL?
                        </div>
                      </div>
                      <div className="flex justify-start">
                        <div className="bg-slate-800 p-2.5 rounded-xl max-w-[80%] text-slate-200">
                          <span className="text-[9px] block text-slate-400 font-sans mb-1">Inbound Candidate • 10:03 AM</span>
                          Yes, 4 years badge DL. Ready to come this Monday.
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <div className="bg-indigo-950/80 border border-indigo-800/40 p-2.5 rounded-xl max-w-[80%] text-indigo-100">
                          <span className="text-[9px] block text-indigo-400 font-sans mb-1">Encho System Bot • 10:03 AM</span>
                          🔥 Qualified Lead added to Staff Pool! Assigned to Hiring Counselor. View our live driver earnings here: encho.in/drivers-earnings
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {currentChapter.visualType === 'role_hierarchy' && (
                  <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-6">
                    <h4 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                      <Layers className="text-indigo-400" size={18} />
                      Role Hierarchy & The God's Eye Lead Pool
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="bg-slate-900 p-4 rounded-xl border border-indigo-500/40 text-center">
                        <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Tier 1</span>
                        <h5 className="font-extrabold text-white text-base mt-1">Super Admin</h5>
                        <p className="text-xs text-slate-400 mt-1">"God's Eye" bird's eye view. Tracks fleet revenue, CPL, global lead flow & staff conversion quotas.</p>
                      </div>
                      <div className="bg-slate-900 p-4 rounded-xl border border-violet-500/40 text-center">
                        <span className="text-[10px] font-bold text-violet-400 uppercase tracking-wider">Tier 2</span>
                        <h5 className="font-extrabold text-white text-base mt-1">Managers</h5>
                        <p className="text-xs text-slate-400 mt-1">Supervises 5 staff members. Reassigns stale leads, audits audio calls & assists high-intent drivers.</p>
                      </div>
                      <div className="bg-slate-900 p-4 rounded-xl border border-emerald-500/40 text-center">
                        <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Tier 3</span>
                        <h5 className="font-extrabold text-white text-base mt-1">Staff Counselors</h5>
                        <p className="text-xs text-slate-400 mt-1">Claims hot leads atomically from shared pool. 0 double-calling collisions. Manages pipeline to arrival.</p>
                      </div>
                    </div>
                  </div>
                )}

                {currentChapter.visualType === 'wallet_slabs' && (
                  <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-base font-bold text-white flex items-center gap-2">
                        <DollarSign className="text-emerald-400" size={18} />
                        Encho Dynamic Rental Slabs: Harder Work = Cheaper Rent
                      </h4>
                      <span className="text-xs bg-indigo-500/20 text-indigo-300 font-bold px-2 py-0.5 rounded-full">Gemini-3pro ERP</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-center">
                      <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                        <p className="text-[10px] text-slate-400 uppercase">0 – 45 Trips</p>
                        <p className="text-lg font-black text-rose-400 mt-1">₹950<span className="text-[10px] text-slate-400">/day</span></p>
                        <span className="text-[9px] text-slate-500">Base Slab</span>
                      </div>
                      <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                        <p className="text-[10px] text-slate-400 uppercase">46 – 59 Trips</p>
                        <p className="text-lg font-black text-amber-400 mt-1">₹850<span className="text-[10px] text-slate-400">/day</span></p>
                        <span className="text-[9px] text-emerald-400">Save ₹100/d</span>
                      </div>
                      <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                        <p className="text-[10px] text-slate-400 uppercase">60 – 64 Trips</p>
                        <p className="text-lg font-black text-indigo-400 mt-1">₹772<span className="text-[10px] text-slate-400">/day</span></p>
                        <span className="text-[9px] text-emerald-400">Save ₹178/d</span>
                      </div>
                      <div className="bg-slate-900 p-3 rounded-xl border border-slate-800">
                        <p className="text-[10px] text-slate-400 uppercase">65 – 69 Trips</p>
                        <p className="text-lg font-black text-violet-400 mt-1">₹700<span className="text-[10px] text-slate-400">/day</span></p>
                        <span className="text-[9px] text-emerald-400">Save ₹250/d</span>
                      </div>
                      <div className="bg-slate-900 p-3 rounded-xl border border-emerald-500/40 bg-emerald-950/20 col-span-2 sm:col-span-1">
                        <p className="text-[10px] text-emerald-300 uppercase font-bold">70+ Trips</p>
                        <p className="text-lg font-black text-emerald-400 mt-1">₹550<span className="text-[10px] text-slate-400">/day</span></p>
                        <span className="text-[9px] text-emerald-300 font-bold">Save ₹400/d</span>
                      </div>
                    </div>
                  </div>
                )}

                {currentChapter.visualType === 'daily_ledger' && (
                  <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-6">
                    <h4 className="text-base font-bold text-white mb-3 flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <FileText className="text-indigo-400" size={16} />
                        Daily Collection Ledger & Outlier Detection
                      </span>
                      <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded">Formula: Payout = Collection - Rent - Fuel + Due</span>
                    </h4>

                    <div className="overflow-x-auto text-xs">
                      <table className="w-full text-left font-mono">
                        <thead className="bg-slate-900 text-slate-400 text-[10px] uppercase">
                          <tr>
                            <th className="p-2">Date / Shift</th>
                            <th className="p-2">Driver</th>
                            <th className="p-2 text-right">Collection</th>
                            <th className="p-2 text-right">Rent</th>
                            <th className="p-2 text-right">Net Payout</th>
                            <th className="p-2 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 text-slate-300">
                          <tr>
                            <td className="p-2">12-08-2026 (Day)</td>
                            <td className="p-2 font-bold text-white">Muhammed Ubais</td>
                            <td className="p-2 text-right text-emerald-400">₹1,000</td>
                            <td className="p-2 text-right text-rose-400">₹950</td>
                            <td className="p-2 text-right font-bold text-emerald-300">+₹50</td>
                            <td className="p-2 text-center"><span className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-500/20 text-emerald-300">Audited</span></td>
                          </tr>
                          <tr>
                            <td className="p-2">11-08-2026 (Day)</td>
                            <td className="p-2 font-bold text-white">MUHAMMED ELAVATTASSERY</td>
                            <td className="p-2 text-right text-emerald-400">₹3,150</td>
                            <td className="p-2 text-right text-rose-400">₹800</td>
                            <td className="p-2 text-right font-bold text-emerald-300">+₹2,350</td>
                            <td className="p-2 text-center"><span className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-500/20 text-emerald-300">Audited</span></td>
                          </tr>
                          <tr>
                            <td className="p-2">10-08-2026 (Night)</td>
                            <td className="p-2 font-bold text-white">Muhammed Ubais</td>
                            <td className="p-2 text-right text-slate-400">₹0</td>
                            <td className="p-2 text-right text-rose-400">₹950</td>
                            <td className="p-2 text-right font-bold text-rose-400">-₹950</td>
                            <td className="p-2 text-center"><span className="px-1.5 py-0.5 rounded text-[9px] bg-amber-500/20 text-amber-300">Due Added</span></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {currentChapter.visualType === 'settlement_check' && (
                  <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-base font-bold text-white flex items-center gap-2">
                        <ShieldCheck className="text-emerald-400" size={18} />
                        Automated Settlement Cross-Reconciliation & Fraud Guard
                      </h4>
                      <span className="text-xs bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded-full">Delta &lt; ₹5.00</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
                      <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                        <span className="text-[10px] text-slate-400 uppercase font-bold">Company Aggregator Payout</span>
                        <p className="text-xl font-extrabold text-white mt-1">₹1,84,500</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">Uber & Ola Statement</p>
                      </div>
                      <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                        <span className="text-[10px] text-slate-400 uppercase font-bold">Hostel Overhead (Weekly)</span>
                        <p className="text-xl font-extrabold text-rose-400 mt-1">₹4,666</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">Room rent deducted</p>
                      </div>
                      <div className="bg-slate-900 p-4 rounded-xl border border-emerald-500/30 bg-emerald-950/20">
                        <span className="text-[10px] text-emerald-300 uppercase font-bold">Net Encho Profit</span>
                        <p className="text-xl font-extrabold text-emerald-400 mt-1">+₹38,240</p>
                        <p className="text-[10px] text-emerald-400 mt-0.5">100% Cash Flow Positive</p>
                      </div>
                    </div>
                  </div>
                )}

                {currentChapter.visualType === 'driver_portal' && (
                  <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-6 flex flex-col sm:flex-row items-center gap-6">
                    <div className="w-56 bg-slate-900 rounded-3xl border-4 border-slate-700 p-4 shadow-xl shrink-0 font-sans">
                      <div className="w-12 h-1 bg-slate-700 rounded-full mx-auto mb-3"></div>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 mb-2">
                        <span>Driver Portal</span>
                        <span className="text-emerald-400 font-bold">LIVE</span>
                      </div>
                      <p className="text-xs font-bold text-white">Muhammed Ubais</p>
                      <p className="text-[9px] text-slate-400">Shift: 4:00 AM - 4:00 PM</p>
                      <div className="mt-3 bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-[10px]">
                        <span className="text-slate-400 block">Weekly Payout:</span>
                        <span className="text-base font-extrabold text-emerald-400">₹8,450</span>
                      </div>
                      <div className="mt-2 text-[9px] text-slate-400 space-y-1">
                        <div className="flex justify-between"><span>Trips Completed:</span><span className="text-white font-bold">54</span></div>
                        <div className="flex justify-between"><span>Food Allowance:</span><span className="text-rose-400">-₹700</span></div>
                        <div className="flex justify-between"><span>Fuel Reimbursement:</span><span className="text-emerald-400">+₹1,200</span></div>
                      </div>
                    </div>

                    <div className="flex-1 space-y-3">
                      <h4 className="text-lg font-bold text-white">Why Encho Achieved 0% Payment Disputes</h4>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        In typical Indian fleets, drivers argue every week over unexplained vehicle rent deductions, missing cash receipts, and arbitrary fines. 
                        Encho solved this with complete digital transparency. Every single driver can open their mobile phone, review daily collections, verify trip slab milestones, and inspect fuel credits in real time.
                      </p>
                      <div className="flex items-center gap-2 pt-2">
                        <Link to="/portal" className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
                          Test Driver Portal Live <ExternalLink size={12} />
                        </Link>
                      </div>
                    </div>
                  </div>
                )}

                {currentChapter.visualType === 'scale_roadmap' && (
                  <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-6">
                    <h4 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                      <Award className="text-indigo-400" size={18} />
                      Encho Expansion Blueprint: From 700 to 5,000 Fleet
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
                        <span className="text-[10px] text-indigo-400 uppercase font-bold">Phase 1 (Proven)</span>
                        <h6 className="font-bold text-white text-sm mt-1">Bangalore Core (700+ Drivers)</h6>
                        <p className="text-xs text-slate-400 mt-1">₹40K capital bootstrap, 24-hr sweating, zero dispute ERP platform validated.</p>
                      </div>
                      <div className="bg-slate-900 p-4 rounded-xl border border-violet-500/40">
                        <span className="text-[10px] text-violet-400 uppercase font-bold">Phase 2 (Current)</span>
                        <h6 className="font-bold text-white text-sm mt-1">Master Marketing Engine</h6>
                        <p className="text-xs text-slate-400 mt-1">Automated WhatsApp Lead handler scaling driver onboarding to 2,000 monthly inquiries.</p>
                      </div>
                      <div className="bg-slate-900 p-4 rounded-xl border border-emerald-500/40 bg-emerald-950/10">
                        <span className="text-[10px] text-emerald-400 uppercase font-bold">Phase 3 (Investment)</span>
                        <h6 className="font-bold text-white text-sm mt-1">Pan-South India Scale</h6>
                        <p className="text-xs text-slate-400 mt-1">Expanding fleet corridors into Hyderabad, Chennai, and Cochin with institutional capital.</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Subtitles & Spoken Narrative Display */}
              <div className="mt-6 pt-4 border-t border-slate-800/80">
                <div className="flex items-center justify-between text-[11px] text-slate-400 mb-2 font-mono">
                  <span className="flex items-center gap-1.5 text-indigo-400 font-bold">
                    <Mic size={12} /> Live Narrative Transcript
                  </span>
                  <span>Chapter {currentChapter.id} / 12 ({currentChapter.timecode})</span>
                </div>
                <p className="text-sm md:text-base text-slate-200 font-medium leading-relaxed italic bg-slate-950/50 p-4 rounded-2xl border border-slate-800/60 shadow-inner">
                  "{currentChapter.script}"
                </p>
              </div>

            </div>

            {/* Bottom Playback & Voiceover Controls Bar */}
            <div className="px-6 py-4 bg-slate-900 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
              
              {/* Play / Next / Prev buttons */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handlePrevChapter}
                  disabled={currentChapterIndex === 0}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 transition-colors"
                  title="Previous Chapter"
                >
                  <Rewind size={18} />
                </button>

                <button
                  onClick={togglePlayPause}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition-all active:scale-95"
                >
                  {isPlaying ? (
                    <>
                      <Pause size={18} /> <span>Pause Voiceover</span>
                    </>
                  ) : (
                    <>
                      <Play size={18} fill="currentColor" /> <span>Play Chapter Voiceover</span>
                    </>
                  )}
                </button>

                <button
                  onClick={handleNextChapter}
                  disabled={currentChapterIndex === CHAPTERS.length - 1}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 transition-colors"
                  title="Next Chapter"
                >
                  <FastForward size={18} />
                </button>

                <button
                  onClick={() => handleSelectChapter(currentChapterIndex)}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
                  title="Restart Chapter"
                >
                  <RotateCcw size={16} />
                </button>
              </div>

              {/* Voice Speed & Voice Selector */}
              <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                {/* Voice Selection */}
                {availableVoices.length > 0 && (
                  <select
                    value={selectedVoiceName}
                    onChange={(e) => {
                      setSelectedVoiceName(e.target.value);
                      if (isPlaying) {
                        stopSpeech();
                        setTimeout(() => playChapterSpeech(currentChapterIndex), 100);
                      }
                    }}
                    className="bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 max-w-[140px] truncate"
                    title="Select Voice"
                  >
                    {availableVoices.map((v) => (
                      <option key={v.name} value={v.name}>
                        {v.name} ({v.lang})
                      </option>
                    ))}
                  </select>
                )}

                {/* Speed Multiplier */}
                <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-xl border border-slate-700">
                  {[1.0, 1.25, 1.5].map((rate) => (
                    <button
                      key={rate}
                      onClick={() => {
                        setVoiceRate(rate);
                        if (isPlaying) {
                          stopSpeech();
                          setTimeout(() => playChapterSpeech(currentChapterIndex), 100);
                        }
                      }}
                      className={`px-2 py-1 rounded-lg text-xs font-bold transition-all ${
                        voiceRate === rate ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {rate}x
                    </button>
                  ))}
                </div>
              </div>

            </div>
          </div>

          {/* Key Proof Points for Active Chapter */}
          <div className="bg-slate-900/70 border border-slate-800 p-6 rounded-3xl">
            <h4 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
              <CheckCircle2 size={16} className="text-indigo-400" />
              Chapter {currentChapter.id} Investor Takeaways
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {currentChapter.keyPoints.map((point, idx) => (
                <div key={idx} className="flex items-start gap-2.5 text-xs text-slate-300 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0"></span>
                  <span className="leading-relaxed">{point}</span>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Right Column: 12-Chapter Interactive Timeline & Script Drawer (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Chapter Timeline Navigation Card */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-xl">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Clock className="text-indigo-400" size={16} />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">12-Min Chapters</h3>
              </div>
              <button
                onClick={copyFullPitchScript}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1"
                title="Copy entire 12-minute script"
              >
                {copiedScript ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                <span>{copiedScript ? 'Copied!' : 'Copy Script'}</span>
              </button>
            </div>

            {/* Scrollable Chapter List */}
            <div className="space-y-1.5 max-h-[520px] overflow-y-auto pr-1 scrollbar-thin">
              {CHAPTERS.map((ch, idx) => {
                const isSelected = idx === currentChapterIndex;
                return (
                  <button
                    key={ch.id}
                    onClick={() => handleSelectChapter(idx)}
                    className={`w-full text-left p-3 rounded-2xl border transition-all flex items-center justify-between group ${
                      isSelected
                        ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-md shadow-indigo-950'
                        : 'bg-slate-950/50 border-slate-800 hover:bg-slate-800/50 hover:border-slate-700 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${
                        isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 group-hover:text-white'
                      }`}>
                        {ch.id}
                      </div>
                      <div className="truncate">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-mono font-bold text-indigo-400">{ch.timecode}</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">{ch.category}</span>
                        </div>
                        <p className={`text-xs font-bold truncate mt-0.5 ${isSelected ? 'text-white' : 'text-slate-200'}`}>
                          {ch.title}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0 ml-2">
                      <ChevronRight size={14} className={isSelected ? 'text-indigo-400 translate-x-0.5' : 'text-slate-600 group-hover:text-slate-400'} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* GitHub Tech Verification Card */}
          <div className="bg-gradient-to-br from-slate-900 to-indigo-950/40 border border-slate-800 rounded-3xl p-5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-2">
              <Compass size={14} className="text-indigo-400" />
              Direct Open-Source Repositories
            </h4>
            <p className="text-xs text-slate-300 mb-4 leading-relaxed">
              Verify the code yourself. Both systems are fully engineered, deployed, and operating in production.
            </p>

            <div className="space-y-2">
              <a
                href="https://github.com/ajitzz/Gemini-3pro-Enchocabs-Software.git"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between p-3 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-900 transition-all group"
              >
                <div>
                  <p className="text-xs font-bold text-white group-hover:text-indigo-400 transition-colors">Gemini-3pro-Enchocabs-Software</p>
                  <p className="text-[10px] text-slate-400">Driver Wallet & Accounting Core ERP</p>
                </div>
                <ExternalLink size={14} className="text-slate-500 group-hover:text-indigo-400" />
              </a>

              <a
                href="https://github.com/ajitzz/Encho-enterprises-WhatsApp-Leads-Handler.git"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between p-3 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-emerald-500/50 hover:bg-slate-900 transition-all group"
              >
                <div>
                  <p className="text-xs font-bold text-white group-hover:text-emerald-400 transition-colors">Encho-WhatsApp-Leads-Handler</p>
                  <p className="text-[10px] text-slate-400">Automated Bot & Lead Pool System</p>
                </div>
                <ExternalLink size={14} className="text-slate-500 group-hover:text-emerald-400" />
              </a>
            </div>
          </div>

          {/* Quick Pitch Summary Box */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Founder Conviction</h4>
            <p className="text-xs text-slate-300 italic leading-relaxed">
              "We didn't just build software. We built the software to survive our own fleet operations. When technology is forged under 24-hour street pressure in Bangalore, it works flawlessly."
            </p>
            <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
              <span>Ajith • Founder, Encho Enterprises</span>
              <span className="text-emerald-400 font-bold">Bangalore Fleet Active</span>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
