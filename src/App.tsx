import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Dumbbell, 
  BrainCircuit, 
  Settings, 
  Plus, 
  TrendingUp, 
  Calendar,
  Heart,
  Zap,
  Weight,
  Flame,
  ChevronRight,
  LogOut,
  User as UserIcon,
  Trash2,
  Droplet,
  Award,
  Trophy,
  Medal,
  Star,
  Shield,
  Crown,
  Sun,
  Moon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  onSnapshot, 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  addDoc,
  deleteDoc, 
  serverTimestamp,
  Timestamp,
  writeBatch,
  doc,
  setDoc
} from 'firebase/firestore';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged,
  signOut,
  User
} from 'firebase/auth';
import { db, auth } from './lib/firebase';
import { cn } from './lib/utils';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar
} from 'recharts';
import { getAIRecommendations, generateRecoveryWorkout } from './services/geminiService';
interface FirestoreErrorInfo {
  error: string;
  operationType: 'create' | 'update' | 'delete' | 'list' | 'get' | 'write';
  path: string | null;
  authInfo: {
    userId: string;
    email: string;
    emailVerified: boolean;
    isAnonymous: boolean;
    providerInfo: { providerId: string; displayName: string; email: string; }[];
  }
}

import { 
  ProgressRing, 
  MultiProgressRing 
} from './components/ProgressRings';

// --- Constants ---
const DEFAULT_GOALS = {
  steps: 12000,
  calories: 2900,
  protein: 170,
  carbs: 350,
  fiber: 35,
  sugar: 50,
};

// --- Types ---
type Tab = 'dashboard' | 'workouts' | 'progression' | 'insights' | 'profile';

interface UserGoals {
  steps: number;
  calories: number;
  protein: number;
  carbs: number;
  fiber: number;
  sugar: number;
}

function handleFirestoreError(error: any, operationType: FirestoreErrorInfo['operationType'], path: string | null = null) {
  const authInfo = auth.currentUser ? {
    userId: auth.currentUser.uid,
    email: auth.currentUser.email || "",
    emailVerified: auth.currentUser.emailVerified,
    isAnonymous: auth.currentUser.isAnonymous,
    providerInfo: auth.currentUser.providerData.map(p => ({
      providerId: p.providerId,
      displayName: p.displayName || "",
      email: p.email || ""
    }))
  } : {
    userId: "unauthenticated",
    email: "",
    emailVerified: false,
    isAnonymous: false,
    providerInfo: []
  };

  const info: FirestoreErrorInfo = {
    error: error.message,
    operationType,
    path,
    authInfo
  };

  console.error("Firestore Error:", JSON.stringify(info, null, 2));
}

interface HealthMetric {
  id: string;
  userId: string;
  type: string;
  value: number;
  unit: string;
  timestamp: Timestamp;
}

interface Workout {
  id: string;
  userId: string;
  name: string;
  type: 'lifting' | 'cardio';
  date: Timestamp;
  exercises: any[];
  notes?: string;
}

// --- Components ---

const MUSCLE_GROUPS = [
  'Neck', 'Shoulders', 'Chest', 'Lats', 
  'Middle Back', 'Lower Back', 'Abs', 'Obliques',
  'Biceps', 'Triceps', 'Forearms', 
  'Glutes', 'Quads', 'Hamstrings', 'Calves'
];

const AIRecoveryPlanner = ({ onClose, onWorkoutGenerated }: { onClose: () => void, onWorkoutGenerated: (workout: any) => void }) => {
  const [soreMuscles, setSoreMuscles] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const toggleMuscle = (m: string) => {
    setSoreMuscles(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]);
  };

  const handleGenerate = async () => {
    setLoading(true);
    const result = await generateRecoveryWorkout(soreMuscles);
    setLoading(false);
    if (result) {
      onWorkoutGenerated(result);
    }
  };

  return (
    <div className="fixed inset-0 bg-zinc-950/90 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-4 overflow-y-auto">
      <motion.div 
        initial={{ y: 100 }} 
        animate={{ y: 0 }}
        className="bg-zinc-900 border border-zinc-800 w-full max-w-md rounded-[32px] p-8 shadow-2xl my-auto"
      >
        <div className="flex items-center gap-3 mb-6">
           <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20">
             <BrainCircuit size={20} />
           </div>
           <div>
             <h2 className="text-xl font-bold text-white tracking-tight">AI Recovery Planner</h2>
             <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest">Select Sore Muscles</p>
           </div>
        </div>
        
        <div className="flex flex-wrap gap-2 mb-8">
          {MUSCLE_GROUPS.map(m => {
            const isSore = soreMuscles.includes(m);
            return (
              <button
                key={m}
                onClick={() => toggleMuscle(m)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all border",
                  isSore 
                    ? "bg-rose-500/20 border-rose-500/50 text-rose-400 font-bold" 
                    : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400/70 hover:bg-emerald-500/20 hover:text-emerald-400"
                )}
              >
                {m} {isSore ? '🔥' : '✅'}
              </button>
            )
          })}
        </div>

        <div className="flex gap-4">
          <button 
            onClick={onClose} 
            disabled={loading}
            className="flex-1 text-zinc-500 font-bold py-4 text-sm hover:text-zinc-300 transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleGenerate}
            disabled={loading}
            className="flex-1 bg-white text-zinc-950 font-bold py-4 rounded-2xl text-sm shadow-lg active:scale-95 transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <div className="w-4 h-4 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" /> : <BrainCircuit size={16} />}
            {loading ? 'Analyzing...' : 'Generate Plan'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const Card = ({ children, className, title }: { children: React.ReactNode, className?: string, title?: string, key?: React.Key }) => (
  <div className={cn("glass-card rounded-2xl p-5 mb-4", className)}>
    {title && <h3 className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-4">{title}</h3>}
    {children}
  </div>
);

const MetricTile = ({ icon: Icon, label, value, unit, color, percentage }: { icon: any, label: string, value: string | number, unit: string, color: string, percentage?: number }) => (
  <div className="glass-card p-4 rounded-2xl flex flex-col justify-between aspect-square relative overflow-hidden group">
    <div className="flex justify-between items-start">
      <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center", color)}>
        <Icon size={19} className="text-white" />
      </div>
      {percentage !== undefined && (
        <ProgressRing 
          size={36} 
          strokeWidth={4} 
          percentage={percentage} 
          color="currentColor" 
          className={cn(color.split(' ')[1])} // Extract text color from color prop
        />
      )}
    </div>
    <div className="relative z-10">
      <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider">{label}</p>
      <div className="flex items-baseline gap-1">
        <span className="stat-value text-2xl font-bold text-white tracking-tighter">{value}</span>
        <span className="text-zinc-500 text-[10px] uppercase font-bold">{unit}</span>
      </div>
    </div>
    
    {/* Optional background glow on hover or if high percentage */}
    {percentage && percentage > 100 && (
      <div className="absolute -bottom-8 -right-8 w-16 h-16 bg-blue-500/10 blur-xl rounded-full" />
    )}
  </div>
);

const Dashboard = ({ user, metrics, workouts, userGoals }: { user: User, metrics: HealthMetric[], workouts: Workout[], userGoals: UserGoals, key?: React.Key }) => {
  // Extract latest metrics for the current day
  const latest = (types: string | string[]) => {
    const typeArray = Array.isArray(types) ? types : [types];
    const found = metrics.find(m => 
      typeArray.some(t => m.type.toLowerCase() === t.toLowerCase())
    );
    return found ? found.value : 0;
  };

  const formatHeight = (val: number) => {
    if (!val) return "--";
    // Detect if value is in feet (5.x) or inches (70.x)
    const inches = val < 10 ? val * 12 : val;
    const feet = Math.floor(inches / 12);
    const remainingInches = Math.round(inches % 12);
    return `${feet}'${remainingInches}"`;
  };

  const stepsValue = Math.round(latest(['step_count', 'steps']));
  const stepsData = metrics
    .filter(m => m.type === 'step_count' || m.type === 'steps' || m.type === 'Step Count')
    .slice(0, 7)
    .map(m => ({ date: format(m.timestamp.toDate(), 'MMM d'), val: m.value }))
    .reverse();
    
  const caloriesValue = Math.round(latest('dietary_energy'));
  const proteinValue = Math.round(latest('protein'));
  const carbsValue = Math.round(latest('carbohydrates'));
  const fiberValue = Math.round(latest('fiber'));
  const sugarValue = Math.round(latest(['dietary_sugar', 'sugar']));

  // Water Tracking calculation
  const todayStart = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());
  const todaysWater = metrics.filter(m => {
    if (m.type !== 'water_intake' || !m.timestamp) return false;
    const d = m.timestamp.toDate();
    return d >= todayStart && d <= todayEnd;
  }).reduce((sum, m) => sum + m.value, 0);

  const handleAddWater = async (amount: number) => {
    try {
      await addDoc(collection(db, 'health_metrics'), {
        userId: user.uid,
        source: 'manual',
        type: 'water_intake',
        value: amount,
        unit: 'oz',
        timestamp: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, 'create', 'health_metrics');
    }
  };

  // Consistency Heatmap logic (last 35 days)
  const todayForHeatmap = new Date();
  const heatmapData = Array.from({ length: 35 }).map((_, i) => {
    const day = subDays(todayForHeatmap, 34 - i);
    const dayStart = startOfDay(day);
    const dayEnd = endOfDay(day);
    const dailyWorkouts = workouts.filter(w => {
      if (!w.date) return false;
      const wDate = w.date.toDate();
      return wDate >= dayStart && wDate <= dayEnd;
    });
    return { 
      date: day, 
      count: dailyWorkouts.length
    };
  });

  const nutritionMetrics = [
    { label: 'Calories', value: caloriesValue, goal: userGoals.calories, color: '#fb923c', exceededColor: '#fb7185' },
    { label: 'Protein', value: proteinValue, goal: userGoals.protein, color: '#10b981', exceededColor: '#34d399' },
    { label: 'Carbs', value: carbsValue, goal: userGoals.carbs, color: '#3b82f6', exceededColor: '#60a5fa' },
    { label: 'Fiber', value: fiberValue, goal: userGoals.fiber, color: '#a855f7', exceededColor: '#c084fc' },
    { label: 'Sugar', value: sugarValue, goal: userGoals.sugar, color: '#f43f5e', exceededColor: '#ef4444' },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} 
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="pb-24"
    >
      <header className="mb-8 px-1">
        <div className="flex items-center justify-between">
           <div>
            <h1 className="text-2xl font-bold tracking-tight text-white mb-1 italic">Vitalis <span className="text-zinc-500 font-normal ml-1 text-sm not-italic">v2.1</span></h1>
            <div className="flex items-center gap-2">
              <div className="indicator-pulse"></div>
              <span className="text-[10px] uppercase tracking-widest text-zinc-400 font-semibold italic">Tailscale Node: Ubuntu-VM • Live</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-emerald-500 p-[2px] shadow-lg">
            <div className="w-full h-full rounded-full bg-zinc-950 flex items-center justify-center font-bold text-xs text-white overflow-hidden">
              {user.photoURL ? <img src={user.photoURL} alt="User" /> : user.displayName?.substring(0, 2).toUpperCase()}
            </div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <MetricTile icon={Activity} label="Readiness" value={latest(['resting_energy', 'basal_energy_burned']) > 0 ? "88" : "--"} unit="/ 100" color="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" />
        <MetricTile icon={Flame} label="Active Burn" value={Math.round(latest('active_energy'))} unit="kcal" color="bg-blue-500/20 text-blue-400 border border-blue-500/30" />
        
        {/* Water Tracker Tile */}
        <div className={cn("glass-card p-3.5 rounded-2xl flex flex-col justify-between aspect-square relative overflow-hidden group transition-all", todaysWater >= 128 ? "bg-emerald-500/10 border-emerald-500/30" : "bg-cyan-500/10 border-cyan-500/20")}>
          <div className="flex justify-between items-start">
            <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center relative z-10", todaysWater >= 128 ? "bg-emerald-500/20 text-emerald-400" : "bg-cyan-500/20 text-cyan-400")}>
              <Droplet size={19} className="text-current" />
            </div>
            <ProgressRing 
              size={36} 
              strokeWidth={4} 
              percentage={Math.min((todaysWater / 128) * 100, 100)} 
              color="currentColor" 
              className={todaysWater >= 128 ? "text-emerald-500" : "text-cyan-400"} 
            />
          </div>
          <div className="relative z-10 pt-1 flex flex-col">
            <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider">Water Intake</p>
            <div className="flex items-baseline gap-1">
              <span className="stat-value text-2xl font-bold text-white tracking-tighter">{todaysWater}</span>
              <span className="text-zinc-500 text-[10px] uppercase font-bold">/ 128 oz</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1.5 mt-auto pt-2 relative z-10">
            <button 
              onClick={() => handleAddWater(12)}
              className={cn("text-[8px] font-bold uppercase tracking-widest py-2 rounded-[10px] active:scale-95 transition-all text-white", todaysWater >= 128 ? "bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-100" : "bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-100")}
            >
              + Cup
            </button>
            <button 
              onClick={() => handleAddWater(24)}
              className={cn("text-[8px] font-bold uppercase tracking-widest py-2 rounded-[10px] active:scale-95 transition-all text-white", todaysWater >= 128 ? "bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-100" : "bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-100")}
            >
              + Bottle
            </button>
          </div>
          {todaysWater >= 128 && (
            <div className="absolute -bottom-8 -right-8 w-24 h-24 bg-emerald-500/10 blur-2xl rounded-full pointer-events-none" />
          )}
        </div>

        <MetricTile 
          icon={TrendingUp} 
          label="Steps" 
          value={stepsValue} 
          unit="steps" 
          color="bg-indigo-500/20 text-indigo-400 border border-indigo-500/30" 
          percentage={(stepsValue / userGoals.steps) * 100}
        />
      </div>

      <Card title="Fueling & Nutrition">
        <div className="grid grid-cols-2 gap-x-4 gap-y-4 mb-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between group gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <div className="w-1 h-5 rounded-full bg-orange-400/50 group-hover:bg-orange-400 transition-colors shrink-0" />
                <p className="text-zinc-500 text-[9px] uppercase font-bold tracking-tight truncate">Energy</p>
              </div>
              <p className={cn("font-mono font-bold text-[10px] whitespace-nowrap", caloriesValue > userGoals.calories ? "text-rose-500" : "text-white")}>
                {caloriesValue} <span className="text-zinc-600 font-normal">/{userGoals.calories}</span>
              </p>
            </div>
            
            <div className="flex items-center justify-between group gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <div className="w-1 h-5 rounded-full bg-emerald-400/50 group-hover:bg-emerald-400 transition-colors shrink-0" />
                <p className="text-zinc-500 text-[9px] uppercase font-bold tracking-tight truncate">Protein</p>
              </div>
              <p className={cn("font-mono font-bold text-[10px] whitespace-nowrap", proteinValue > userGoals.protein ? "text-emerald-500" : "text-white")}>
                {proteinValue}g <span className="text-zinc-600 font-normal">/{userGoals.protein}g</span>
              </p>
            </div>

            <div className="flex items-center justify-between group gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <div className="w-1 h-5 rounded-full bg-blue-400/50 group-hover:bg-blue-400 transition-colors shrink-0" />
                <p className="text-zinc-500 text-[9px] uppercase font-bold tracking-tight truncate">Carbs</p>
              </div>
              <p className={cn("font-mono font-bold text-[10px] whitespace-nowrap", carbsValue > userGoals.carbs ? "text-rose-500" : "text-white")}>
                {carbsValue}g <span className="text-zinc-600 font-normal">/{userGoals.carbs}g</span>
              </p>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between group gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <div className="w-1 h-5 rounded-full bg-purple-400/50 group-hover:bg-purple-400 transition-colors shrink-0" />
                <p className="text-zinc-500 text-[9px] uppercase font-bold tracking-tight truncate">Fiber</p>
              </div>
              <p className={cn("font-mono font-bold text-[10px] whitespace-nowrap", fiberValue > userGoals.fiber ? "text-rose-500" : "text-white")}>
                {fiberValue}g <span className="text-zinc-600 font-normal">/{userGoals.fiber}g</span>
              </p>
            </div>
            
            <div className="flex items-center justify-between group gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <div className="w-1 h-5 rounded-full bg-rose-400/50 group-hover:bg-rose-400 transition-colors shrink-0" />
                <p className="text-zinc-500 text-[9px] uppercase font-bold tracking-tight truncate">Sugar</p>
              </div>
              <p className={cn("font-mono font-bold text-[10px] whitespace-nowrap", sugarValue > userGoals.sugar ? "text-rose-500" : "text-white")}>
                {sugarValue}g <span className="text-zinc-600 font-normal">/{userGoals.sugar}g</span>
              </p>
            </div>

            <div className="h-5 flex items-center justify-end px-0.5">
               <p className="text-[8px] uppercase font-black tracking-tighter text-zinc-700 italic">Static Context: CLB-VB</p>
            </div>
          </div>
        </div>
        
        <div className="bg-zinc-800/30 rounded-xl p-3 flex justify-between items-center mt-6 border border-zinc-800/50">
           <div>
             <p className="text-zinc-500 text-[10px] uppercase font-bold">Weight Progress</p>
             <p className="text-white font-bold">{Math.round(latest(['weight', 'body_mass', 'weight_body_mass']))} <span className="text-zinc-500 text-[10px]">lbs</span></p>
           </div>
           <div className="flex gap-4">
             {latest(['height', 'body_height']) > 0 && (
               <div className="text-right">
                 <p className="text-zinc-500 text-[10px] uppercase font-bold">Height</p>
                 <p className="text-white font-bold">{formatHeight(latest(['height', 'body_height']))}</p>
               </div>
             )}
           </div>
        </div>
      </Card>

      <Card title="WORKOUT CONSISTENCY HEATMAP">
        <div className="grid grid-cols-7 gap-1.5 mt-2">
          {heatmapData.map((data, idx) => {
            let bgColor = "bg-zinc-800/30";
            if (data.count === 1) bgColor = "bg-emerald-500/40 border-emerald-500/20 shadow-[0_0_8px_rgba(16,185,129,0.15)]";
            else if (data.count === 2) bgColor = "bg-emerald-500/70 border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.25)]";
            else if (data.count > 2) bgColor = "bg-emerald-500 border-emerald-400 shadow-[0_0_16px_rgba(16,185,129,0.4)]";
            
            return (
              <div 
                key={idx} 
                className={cn(
                  "aspect-square rounded-[4px] border border-zinc-800/50 transition-all hover:scale-125 hover:z-10 hover:border-zinc-300", 
                  bgColor
                )}
                title={`${format(data.date, 'MMM d')}: ${data.count} sessions`}
              />
            );
          })}
        </div>
        <div className="flex items-center justify-between mt-5 px-1">
          <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Last 35 Days</p>
          <div className="flex items-center gap-1.5">
            <p className="text-zinc-500 text-[9px] font-bold uppercase tracking-widest">Less</p>
            <div className="flex gap-1">
              <div className="w-2.5 h-2.5 rounded-[2px] bg-zinc-800/30 border border-zinc-800/50" />
              <div className="w-2.5 h-2.5 rounded-[2px] bg-emerald-500/40 border border-emerald-500/20" />
              <div className="w-2.5 h-2.5 rounded-[2px] bg-emerald-500/70 border border-emerald-500/40" />
              <div className="w-2.5 h-2.5 rounded-[2px] bg-emerald-500 border border-emerald-400" />
            </div>
            <p className="text-zinc-500 text-[9px] font-bold uppercase tracking-widest ml-1">More</p>
          </div>
        </div>
      </Card>

      <Card title="Activity Trends">
        <div className="h-52 w-full mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={stepsData.length ? stepsData : [{date: 'Mon', val: 4000}, {date: 'Tue', val: 7500}, {date: 'Wed', val: 6200}, {date: 'Thu', val: 9100}, {date: 'Fri', val: 8432}]}>
              <defs>
                <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" opacity={0.3} />
              <XAxis dataKey="date" stroke="#52525b" fontSize={10} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip 
                contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '12px', fontSize: '12px' }}
                itemStyle={{ color: '#3b82f6' }}
              />
              <Area type="monotone" dataKey="val" stroke="#3b82f6" fillOpacity={1} fill="url(#colorVal)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card title="Session History">
        {workouts.slice(0, 3).map((w) => (
          <div key={w.id} className="flex items-center justify-between py-4 border-b border-zinc-800 last:border-0 pl-1">
            <div className="flex items-center gap-4">
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center border",
                w.type === 'lifting' ? "bg-blue-500/10 border-blue-500/20 text-blue-500" : "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
              )}>
                {w.type === 'lifting' ? <Dumbbell size={18} /> : <Heart size={18} />}
              </div>
              <div>
                <p className="text-white font-bold text-sm tracking-tight">{w.name}</p>
                <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">
                   {w.date ? format(w.date.toDate(), 'MMM d') : '...ing'} • {w.exercises.length} {w.type === 'cardio' ? 'activity' : 'exercises'}
                </p>
              </div>
            </div>
            <div className="text-right">
               <span className="text-zinc-400 text-xs font-mono">
                  {w.type === 'lifting' ? `${w.exercises[0]?.weight || 0}lbs` : `${w.exercises[0]?.distance ? w.exercises[0].distance + 'mi' : (w.exercises[0]?.duration || 0) + 'm'}`}
               </span>
            </div>
          </div>
        ))}
        {workouts.length === 0 && (
           <p className="text-zinc-600 text-xs text-center py-4 italic">No recent sessions found.</p>
        )}
      </Card>
    </motion.div>
  );
};

const Workouts = ({ user }: { user: User, key?: React.Key }) => {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [isLogging, setIsLogging] = useState(false);
  const [isAIPlannerOpen, setIsAIPlannerOpen] = useState(false);
  
  // Form State
  const [workoutType, setWorkoutType] = useState<'lifting' | 'cardio'>('lifting');
  const [workoutName, setWorkoutName] = useState('');
  const [workoutDate, setWorkoutDate] = useState<string>(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [currentExercises, setCurrentExercises] = useState<any[]>([]);
  
  // Temp fields for adding to currentExercises
  const [tempExerciseName, setTempExerciseName] = useState('');
  const [tempWeight, setTempWeight] = useState('');
  const [tempReps, setTempReps] = useState('');
  const [tempDuration, setTempDuration] = useState('');
  const [tempDistance, setTempDistance] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'workouts'),
      where('userId', '==', user.uid),
      orderBy('date', 'desc'),
      limit(20)
    );
    return onSnapshot(q, (snapshot) => {
      setWorkouts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Workout)));
    }, (error) => {
      handleFirestoreError(error, 'list', 'workouts');
    });
  }, [user.uid]);

  const addExerciseToSession = () => {
    if (!tempExerciseName) return;
    
    const newEx = workoutType === 'lifting' ? {
      name: tempExerciseName,
      weight: parseFloat(tempWeight) || 0,
      reps: parseInt(tempReps) || 0,
      unit: 'lbs'
    } : {
      name: tempExerciseName,
      duration: parseInt(tempDuration) || 0,
      distance: parseFloat(tempDistance) || 0
    };

    setCurrentExercises([...currentExercises, newEx]);
    setTempExerciseName('');
    setTempWeight('');
    setTempReps('');
    setTempDuration('');
    setTempDistance('');
  };

  const saveWorkout = async () => {
    if (!workoutName || currentExercises.length === 0) return;
    setLoading(true);
    try {
      const workoutData = {
        userId: user.uid,
        name: workoutName,
        type: workoutType,
        date: workoutDate ? Timestamp.fromDate(new Date(workoutDate)) : serverTimestamp(),
        exercises: currentExercises
      };
      await addDoc(collection(db, 'workouts'), workoutData);
      setIsLogging(false);
      // Reset form
      setWorkoutName('');
      setWorkoutDate(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
      setCurrentExercises([]);
    } catch (error) {
      handleFirestoreError(error, 'create', 'workouts');
    } finally {
      setLoading(false);
    }
  };

  const deleteWorkout = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (deletingId !== id) {
      setDeletingId(id);
      setTimeout(() => setDeletingId(null), 3000);
      return;
    }
    try {
      await deleteDoc(doc(db, 'workouts', id));
      setDeletingId(null);
    } catch (error) {
      handleFirestoreError(error, 'delete', 'workouts');
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }} 
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className="pb-24"
    >
      <div className="flex justify-between items-center mb-8 px-1">
        <h1 className="text-2xl font-bold tracking-tight text-white">Log Session</h1>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsAIPlannerOpen(true)}
            className="bg-purple-500/20 text-purple-400 border border-purple-500/30 px-3 h-9 rounded-xl flex items-center justify-center active:scale-95 transition-all outline-none"
            title="AI Recovery Workout"
          >
            <BrainCircuit size={16} />
          </button>
          <button 
            onClick={() => setIsLogging(true)}
            className="bg-white text-zinc-950 px-4 h-9 rounded-xl text-[11px] font-bold flex items-center gap-1.5 active:scale-95 transition-all shadow-xl hover:bg-zinc-200"
          >
            <Plus size={14} /> New Log
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {workouts.map((w) => (
          <Card key={w.id} className={cn("border-l-2", w.type === 'cardio' ? "border-l-emerald-500" : "border-l-blue-500")}>
            <div className="flex justify-between items-start mb-2 group-header">
              <div>
                <h3 className="text-white font-bold tracking-tight">{w.name}</h3>
                <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest">
                  {w.date ? format(w.date.toDate(), 'MMM d, h:mm a') : '...ing'}
                </span>
              </div>
              <button 
                onClick={(e) => deleteWorkout(w.id, e)}
                className={cn(
                  "transition-colors p-1 rounded-md",
                  deletingId === w.id 
                    ? "bg-rose-500 text-white" 
                    : "text-zinc-600 hover:text-rose-500 hover:bg-rose-500/10"
                )}
                title={deletingId === w.id ? "Click again to confirm" : "Delete Session"}
              >
                <Trash2 size={16} />
              </button>
            </div>
            <p className="text-zinc-400 text-sm mb-4">
              {w.exercises.length} {w.type === 'cardio' ? 'activity' : 'exercises'} tracked
            </p>
            <div className="flex flex-wrap gap-2">
              {w.exercises.map((e, idx) => (
                <span key={idx} className="bg-zinc-800/50 text-zinc-300 px-2.5 py-1 rounded-lg text-[10px] border border-zinc-700/50 font-medium">
                  {e.name} {w.type === 'cardio' ? `(${e.distance ? e.distance + 'mi, ' : ''}${e.duration} min)` : `(${e.weight}lbs x ${e.reps})`}
                </span>
              ))}
            </div>
          </Card>
        ))}
        {workouts.length === 0 && (
          <div className="text-center py-24 bg-zinc-900/30 rounded-3xl border border-dashed border-zinc-800">
            <Dumbbell className="mx-auto text-zinc-800 mb-4" size={48} />
            <p className="text-zinc-600 font-medium italic">Your training archive is empty.</p>
          </div>
        )}
      </div>

      {isAIPlannerOpen && (
        <AIRecoveryPlanner 
          onClose={() => setIsAIPlannerOpen(false)}
          onWorkoutGenerated={(aiWorkout) => {
            setIsAIPlannerOpen(false);
            
            // Populate the Quick Log Form and open it
            setWorkoutType(aiWorkout.type || 'lifting');
            setWorkoutName(aiWorkout.name || 'AI Recovery Session');
            if (aiWorkout.exercises && Array.isArray(aiWorkout.exercises)) {
              setCurrentExercises(aiWorkout.exercises.map((e: any) => ({
                name: e.name || 'Unknown',
                weight: e.weight || 0,
                reps: e.reps || 0,
                unit: e.unit || 'lbs'
              })));
            } else {
              setCurrentExercises([]);
            }
            setIsLogging(true);
          }}
        />
      )}

      {isLogging && (
        <div className="fixed inset-0 bg-zinc-950/90 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-4 overflow-y-auto">
          <motion.div 
            initial={{ y: 100 }} 
            animate={{ y: 0 }}
            className="bg-zinc-900 border border-zinc-800 w-full max-w-md rounded-[32px] p-8 shadow-2xl my-auto"
          >
            <h2 className="text-xl font-bold mb-6 text-white tracking-tight">Quick Log</h2>
            
            <div className="flex p-1 bg-zinc-800/50 rounded-xl mb-6">
               <button 
                onClick={() => {setWorkoutType('lifting'); setCurrentExercises([]);}}
                className={cn("flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all", workoutType === 'lifting' ? "bg-white text-zinc-950 shadow-lg" : "text-zinc-500")}
               >
                 Lifting
               </button>
               <button 
                onClick={() => {setWorkoutType('cardio'); setCurrentExercises([]);}}
                className={cn("flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all", workoutType === 'cardio' ? "bg-white text-zinc-950 shadow-lg" : "text-zinc-500")}
               >
                 Cardio
               </button>
            </div>

            <div className="space-y-4 mb-6">
               <div className="space-y-1.5">
                  <label className="text-[10px] uppercase text-zinc-500 font-bold tracking-widest">Session Name</label>
                  <input 
                    value={workoutName}
                    onChange={(e) => setWorkoutName(e.target.value)}
                    placeholder="Morning Session..." 
                    className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                  />
               </div>

               <div className="space-y-1.5">
                  <label className="text-[10px] uppercase text-zinc-500 font-bold tracking-widest">Date & Time</label>
                  <input 
                    type="datetime-local"
                    value={workoutDate}
                    onChange={(e) => setWorkoutDate(e.target.value)}
                    className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all [color-scheme:dark]"
                  />
               </div>

               <div className="bg-zinc-800/30 p-4 rounded-2xl border border-zinc-800/50">
                  <p className="text-[10px] uppercase text-zinc-500 font-bold tracking-widest mb-3">Add Entry</p>
                  <div className="space-y-4">
                    <input 
                      value={tempExerciseName}
                      onChange={(e) => setTempExerciseName(e.target.value)}
                      placeholder={workoutType === 'lifting' ? "Exercise (e.g. Squat)" : "Activity (e.g. Run)"}
                      className="w-full bg-zinc-900/50 border border-zinc-700/50 rounded-xl px-3 py-2 text-sm text-white focus:ring-1 focus:ring-blue-500 outline-none"
                    />
                    
                    {workoutType === 'lifting' ? (
                      <div className="grid grid-cols-2 gap-3">
                        <input type="number" value={tempWeight} onChange={(e) => setTempWeight(e.target.value)} placeholder="Weight (lbs)" className="bg-zinc-900/50 border border-zinc-700/50 rounded-xl px-3 py-2 text-sm text-white outline-none" />
                        <input type="number" value={tempReps} onChange={(e) => setTempReps(e.target.value)} placeholder="Reps" className="bg-zinc-900/50 border border-zinc-700/50 rounded-xl px-3 py-2 text-sm text-white outline-none" />
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3">
                        <input type="number" value={tempDistance} onChange={(e) => setTempDistance(e.target.value)} placeholder="Distance (miles)" className="w-full bg-zinc-900/50 border border-zinc-700/50 rounded-xl px-3 py-2 text-sm text-white outline-none" />
                        <input type="number" value={tempDuration} onChange={(e) => setTempDuration(e.target.value)} placeholder="Duration (mins)" className="w-full bg-zinc-900/50 border border-zinc-700/50 rounded-xl px-3 py-2 text-sm text-white outline-none" />
                      </div>
                    )}

                    <button 
                      onClick={addExerciseToSession}
                      className="w-full bg-zinc-800 text-white font-bold py-2 rounded-xl text-[10px] uppercase tracking-widest border border-zinc-700 hover:bg-zinc-700 transition-colors"
                    >
                      + Add to List
                    </button>
                  </div>
               </div>

               {currentExercises.length > 0 && (
                 <div className="space-y-2">
                    <p className="text-[10px] uppercase text-zinc-500 font-bold tracking-widest">Added ({currentExercises.length})</p>
                    <div className="max-h-24 overflow-y-auto space-y-1 pr-1">
                      {currentExercises.map((ex, i) => (
                        <div key={i} className="flex justify-between items-center bg-zinc-800/40 px-3 py-2 rounded-lg border border-zinc-800/50">
                           <span className="text-zinc-200 text-xs font-medium">{ex.name}</span>
                           <span className="text-zinc-500 text-[10px] font-mono">
                             {workoutType === 'lifting' ? `${ex.weight}lbs x ${ex.reps}` : `${ex.distance ? ex.distance + 'mi, ' : ''}${ex.duration}m`}
                           </span>
                        </div>
                      ))}
                    </div>
                 </div>
               )}
            </div>

            <div className="flex gap-4">
              <button 
                onClick={() => {setIsLogging(false); setCurrentExercises([]);}} 
                disabled={loading}
                className="flex-1 text-zinc-500 font-bold py-4 text-sm hover:text-zinc-300"
              >
                Discard
              </button>
              <button 
                onClick={saveWorkout}
                disabled={loading || !workoutName || currentExercises.length === 0}
                className="flex-1 bg-white text-zinc-950 font-bold py-4 rounded-2xl text-sm shadow-lg active:scale-95 transition-transform disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Save Session'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
};


const Insights = ({ user, metrics }: { user: User, metrics: HealthMetric[], key?: React.Key }) => {
  const [insights, setInsights] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    const res = await getAIRecommendations({ metrics, workouts: [] });
    setInsights(res);
    setLoading(false);
  };

  useEffect(() => {
    if (metrics.length > 0 && insights.length === 0) {
      generate();
    }
  }, [metrics]);

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }} 
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="pb-24"
    >
      <div className="flex justify-between items-center mb-8 px-1">
         <div className="flex items-center gap-3">
           <div className="p-2 bg-blue-500/20 rounded-xl">
             <BrainCircuit className="text-blue-400" size={24} />
           </div>
           <h1 className="text-2xl font-bold tracking-tight text-white italic">AI Narratives</h1>
         </div>
         <button 
           onClick={generate}
           disabled={loading}
           className="bg-zinc-900 border border-zinc-800 p-2.5 rounded-xl text-zinc-400 hover:text-zinc-200 active:scale-95 transition-all"
         >
           <Zap size={18} className={loading ? "animate-pulse" : ""} />
         </button>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="py-32 text-center">
            <div className="w-12 h-12 bg-blue-500/10 rounded-full border border-blue-500/20 flex items-center justify-center mx-auto mb-4 animate-pulse">
               <Zap className="text-blue-500" size={24} />
            </div>
            <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest italic">Decrypting bio-metrics...</p>
          </div>
        ) : (
          insights.map((insight, idx) => (
            <Card key={idx} className={cn(
              "ai-glow border-l-2 bg-zinc-900/60",
              insight.category === 'recovery' ? "border-l-emerald-500" : 
              insight.category === 'performance' ? "border-l-blue-500" : "border-l-zinc-500"
            )}>
              <div className="flex justify-between items-center mb-3">
                <span className={cn(
                  "text-[10px] font-black uppercase tracking-[0.2em]",
                  insight.category === 'recovery' ? "text-emerald-500" : 
                  insight.category === 'performance' ? "text-blue-500" : "text-zinc-500"
                )}>
                  {insight.category} Insight
                </span>
                <span className="text-[10px] font-bold text-zinc-600">Conf: 94%</span>
              </div>
              <h3 className="text-white font-bold mb-2 tracking-tight text-lg">{insight.title}</h3>
              <p className="text-zinc-400 text-sm leading-relaxed font-medium">{insight.content}</p>
            </Card>
          ))
        )}
      </div>
    </motion.div>
  );
};

const Progression = ({ workouts, metrics = [], userGoals }: { workouts: Workout[], metrics?: HealthMetric[], userGoals?: UserGoals, key?: React.Key }) => {
  const trackingKeys = ['Squat', 'Bench Press', 'Deadlift', '3 Mile Run'];
  const exerciseData: Record<string, {date: string, val: number, _dateDate: Date}[]> = {
    'Squat': [],
    'Bench Press': [],
    'Deadlift': [],
    '3 Mile Run': []
  };
  
  workouts.forEach(w => {
    const dateStr = w.date ? format(w.date.toDate(), 'MMM d') : 'Now';
    
    w.exercises.forEach(ex => {
      if (!ex || !ex.name) return;
      const name = ex.name.trim().toLowerCase();
      
      if (w.type === 'lifting') {
        if (name.includes('squat') && ex.weight > 0) {
          exerciseData['Squat'].push({ date: dateStr, val: ex.weight, _dateDate: w.date ? w.date.toDate() : new Date() });
        } else if (name.includes('bench') && ex.weight > 0) {
          exerciseData['Bench Press'].push({ date: dateStr, val: ex.weight, _dateDate: w.date ? w.date.toDate() : new Date() });
        } else if (name.includes('deadlift') && ex.weight > 0) {
          exerciseData['Deadlift'].push({ date: dateStr, val: ex.weight, _dateDate: w.date ? w.date.toDate() : new Date() });
        }
      } else if (w.type === 'cardio') {
        // Track 3 mile runs (allow margin of 2.8 to 3.2 miles)
        if (name.includes('run') && ex.distance >= 2.8 && ex.distance <= 3.2 && ex.duration > 0) {
          exerciseData['3 Mile Run'].push({ date: dateStr, val: ex.duration, _dateDate: w.date ? w.date.toDate() : new Date() });
        }
      }
    });
  });

  const prs = trackingKeys.map(key => {
    const historical = exerciseData[key].sort((a, b) => a._dateDate.getTime() - b._dateDate.getTime());
    if (historical.length === 0) return null;

    const isRun = key === '3 Mile Run';
    const bestVal = isRun ? Math.min(...historical.map(h => h.val)) : Math.max(...historical.map(h => h.val));
    const unit = isRun ? 'mins' : 'lbs';
    
    const chartDataMap = new Map();
    historical.forEach(h => {
      if (!chartDataMap.has(h.date)) {
        chartDataMap.set(h.date, h.val);
      } else {
        const existing = chartDataMap.get(h.date);
        chartDataMap.set(h.date, isRun ? Math.min(existing, h.val) : Math.max(existing, h.val));
      }
    });

    const chartData = Array.from(chartDataMap.entries()).map(([date, val]) => ({ date, val }));

    return {
      name: key,
      bestVal,
      unit,
      data: chartData,
      count: historical.length,
      isRun
    };
  }).filter((pr): pr is NonNullable<typeof pr> => pr !== null);

  // Badges Calculation
  const achievements = [
    {
      id: 'first_workout',
      title: 'Initiation',
      desc: 'Log your first workout session.',
      icon: Trophy,
      color: 'text-zinc-300',
      bg: 'bg-zinc-800/80 border-zinc-700/80 shadow-lg',
      unlocked: workouts.length > 0
    },
    {
      id: 'consistency',
      title: 'Consistency',
      desc: 'Log 10 total sessions.',
      icon: Star,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10 border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.15)]',
      unlocked: workouts.length >= 10
    },
    {
      id: 'century_mark',
      title: 'Century Mark',
      desc: 'Complete 100 workout sessions.',
      icon: Crown,
      color: 'text-yellow-500',
      bg: 'bg-yellow-500/10 border-yellow-500/30 shadow-[0_0_15px_rgba(234,179,8,0.15)]',
      unlocked: workouts.length >= 100
    },
    {
      id: 'iron_lungs',
      title: 'Iron Lungs',
      desc: 'Run 3+ miles in a single session.',
      icon: Heart,
      color: 'text-rose-500',
      bg: 'bg-rose-500/10 border-rose-500/30 shadow-[0_0_15px_rgba(244,63,94,0.15)]',
      unlocked: workouts.some(w => w.type === 'cardio' && w.exercises.some(e => e.distance >= 3 && e.name.toLowerCase().includes('run')))
    },
    {
      id: 'hydro_homie',
      title: 'Hydro Homie',
      desc: 'Track 128 oz of water in a single day.',
      icon: Droplet,
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/10 border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.15)]',
      // Check metrics for >= 128 oz in a single day
      unlocked: (() => {
        const waterByDate: Record<string, number> = {};
        metrics.forEach(m => {
          if (m.type === 'water_intake' && m.timestamp) {
            const dateStr = format(m.timestamp.toDate(), 'yyyy-MM-dd');
            waterByDate[dateStr] = (waterByDate[dateStr] || 0) + m.value;
          }
        });
        return Object.values(waterByDate).some(val => val >= 128);
      })()
    },
    {
      id: 'heavy_lifter',
      title: 'Heavy Lifter',
      desc: 'Log a lift over 225 lbs.',
      icon: Shield,
      color: 'text-purple-500',
      bg: 'bg-purple-500/10 border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.15)]',
      unlocked: workouts.some(w => w.type === 'lifting' && w.exercises.some(e => e.weight >= 225))
    },
    {
      id: 'early_bird',
      title: 'Early Bird',
      desc: 'Log a session before 6 AM.',
      icon: Sun,
      color: 'text-orange-400',
      bg: 'bg-orange-500/10 border-orange-500/30 shadow-[0_0_15px_rgba(249,115,22,0.15)]',
      unlocked: workouts.some(w => w.date && w.date.toDate().getHours() < 6 && w.date.toDate().getHours() >= 4)
    },
    {
      id: 'night_owl',
      title: 'Night Owl',
      desc: 'Log a session after 9 PM.',
      icon: Moon,
      color: 'text-indigo-400',
      bg: 'bg-indigo-500/10 border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.15)]',
      unlocked: workouts.some(w => w.date && w.date.toDate().getHours() >= 21)
    },
    {
      id: 'beast_mode',
      title: 'Beast Mode',
      desc: 'Log 10+ exercises in one session.',
      icon: Flame,
      color: 'text-red-500',
      bg: 'bg-red-500/10 border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.15)]',
      unlocked: workouts.some(w => w.exercises && w.exercises.length >= 10)
    },
    {
      id: 'marathoner',
      title: 'Marathoner',
      desc: 'Run 10+ miles in a single session.',
      icon: Activity,
      color: 'text-pink-500',
      bg: 'bg-pink-500/10 border-pink-500/30 shadow-[0_0_15px_rgba(236,72,153,0.15)]',
      unlocked: workouts.some(w => w.type === 'cardio' && w.exercises.some(e => e.distance >= 10 && e.name.toLowerCase().includes('run')))
    }
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }} 
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className="pb-24"
    >
      <div className="flex justify-between items-center mb-8 px-1">
        <h1 className="text-2xl font-bold tracking-tight text-white line-clamp-1">Progression</h1>
      </div>

      <Card title="PR Tracker">
        {prs.length === 0 ? (
        <div className="text-center py-24 bg-zinc-900/30 rounded-3xl border border-dashed border-zinc-800">
           <TrendingUp className="mx-auto text-zinc-800 mb-4" size={48} />
           <p className="text-zinc-600 font-medium italic">Log one of your core tracking targets to see charts. (Squat, Bench, Deadlift, or 3 Mile Run).</p>
        </div>
      ) : (
        <div className="space-y-6">
          {prs.map((pr, idx) => (
            <Card key={idx} title={`${pr.name} (${pr.isRun ? 'Fastest' : 'Max Weight'})`}>
              <div className="flex justify-between items-end mb-4">
                <span className="text-2xl font-black text-blue-400">{pr.bestVal} <span className="text-sm text-zinc-500 font-medium">{pr.unit}</span></span>
              </div>
              <div className="h-40 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={pr.data}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" opacity={0.3} />
                    <XAxis dataKey="date" stroke="#52525b" fontSize={10} axisLine={false} tickLine={false} />
                    <YAxis hide domain={['dataMin - (dataMin * 0.2)', 'dataMax + (dataMax * 0.2)']} />
                    <Tooltip 
                      cursor={{fill: '#27272a', opacity: 0.2}}
                      contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '12px', fontSize: '12px' }}
                      itemStyle={{ color: '#60a5fa' }}
                    />
                    <Bar dataKey="val" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          ))}
        </div>
      )}
      </Card>

      <Card title="Achievements & Milestones" className="mt-6">
        <div className="grid grid-cols-2 gap-3 mb-2">
          {achievements.map(badge => {
            const isUnlocked = badge.unlocked;
            return (
              <div 
                key={badge.id}
                className={cn(
                  "relative p-4 rounded-2xl border transition-all duration-300 flex flex-col items-center text-center gap-2",
                  isUnlocked ? badge.bg : "bg-zinc-900/40 border-zinc-800/50 grayscale opacity-60"
                )}
              >
                {!isUnlocked && (
                  <div className="absolute top-2 right-2 p-1 bg-zinc-800 rounded-full text-zinc-500">
                     <Award size={10} />
                  </div>
                )}
                
                <div className={cn("p-3 rounded-full flex items-center justify-center", isUnlocked ? badge.color + " bg-black/20" : "bg-black/40 text-zinc-600")}>
                  <badge.icon size={24} className={isUnlocked ? "drop-shadow-lg" : ""} />
                </div>
                
                <div>
                  <h4 className={cn("font-bold text-sm tracking-tight", isUnlocked ? "text-white" : "text-zinc-500")}>
                    {badge.title}
                  </h4>
                  <p className={cn("text-[9px] uppercase font-bold tracking-widest mt-1", isUnlocked ? "text-zinc-400" : "text-zinc-600")}>
                    {badge.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </motion.div>
  );
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [metrics, setMetrics] = useState<HealthMetric[]>([]);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [userGoals, setUserGoals] = useState<UserGoals>(DEFAULT_GOALS);
  const [isEditingGoals, setIsEditingGoals] = useState(false);
  const [tempGoals, setTempGoals] = useState<UserGoals>(DEFAULT_GOALS);
  const [confirmWipe, setConfirmWipe] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        // Fetch user goals
        onSnapshot(doc(db, 'users', u.uid), (docSnap) => {
          if (docSnap.exists() && docSnap.data().goals) {
            setUserGoals(docSnap.data().goals);
            setTempGoals(docSnap.data().goals);
          } else {
            // Document might not exist or goals not set, write defaults
            setDoc(doc(db, 'users', u.uid), { goals: DEFAULT_GOALS }, { merge: true }).catch(e => console.error("Could not set default goals", e));
          }
        });

        // Fetch metrics
        const mq = query(
          collection(db, 'health_metrics'),
          where('userId', '==', u.uid),
          orderBy('timestamp', 'desc'),
          limit(250)
        );
        onSnapshot(mq, (snapshot) => {
          setMetrics(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as HealthMetric)));
        }, (error) => {
          handleFirestoreError(error, 'list', 'health_metrics');
        });

        // Fetch workouts for dashboard
        const wq = query(
          collection(db, 'workouts'),
          where('userId', '==', u.uid),
          orderBy('date', 'desc'),
          limit(150)
        );
        onSnapshot(wq, (snapshot) => {
          setWorkouts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Workout)));
        }, (error) => {
          handleFirestoreError(error, 'list', 'workouts');
        });
      }
    });
  }, []);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      // Use local persistence to ensure session survives reloads
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error("Login Error:", error);
      alert(`Login Failed: ${error.message}\nCheck if your domain is authorized in Firebase Console.`);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-8">
        <div className="w-20 h-20 bg-zinc-900 rounded-3xl flex items-center justify-center mb-8 border border-zinc-800">
           <Activity className="text-orange-500" size={40} />
        </div>
        <h1 className="text-4xl font-black italic tracking-tighter mb-2">VITALIS</h1>
        <p className="text-zinc-500 text-center mb-12 max-w-xs">Your personal performance lab. Track metrics, log lifts, and unlock AI insights.</p>
        <button 
          onClick={handleLogin}
          className="w-full max-w-xs bg-white text-black font-bold py-4 rounded-2xl flex items-center justify-center gap-3 active:scale-95 transition-transform"
        >
          <img src="https://www.google.com/favicon.ico" className="w-4 h-4" alt="Google" />
          Connect with Google
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-sans selection:bg-blue-500/30">
      <div className="max-w-md mx-auto p-6 min-h-screen relative">
        
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && <Dashboard key="dash" user={user} metrics={metrics} workouts={workouts} userGoals={userGoals} />}
          {activeTab === 'workouts' && <Workouts key="work" user={user} />}
          {activeTab === 'progression' && <Progression key="prog" workouts={workouts} metrics={metrics} userGoals={userGoals} />}
          {activeTab === 'insights' && <Insights key="ins" user={user} metrics={metrics} />}
          {activeTab === 'profile' && (
            <motion.div key="prof" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pb-24">
              <h1 className="text-2xl font-bold mb-6">Profile</h1>
              <Card>
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 rounded-2xl bg-zinc-800 flex items-center justify-center overflow-hidden border border-zinc-700">
                    {user.photoURL ? <img src={user.photoURL} className="w-full h-full object-cover" alt="Avatar" /> : <UserIcon className="text-zinc-500" />}
                  </div>
                  <div>
                    <p className="text-white font-bold">{user.displayName}</p>
                    <p className="text-zinc-500 text-xs">{user.email}</p>
                  </div>
                </div>
                <div className="space-y-1">
                   <button onClick={() => signOut(auth)} className="w-full flex items-center justify-between py-3 text-rose-500 text-sm font-medium">
                     Logout <LogOut size={16} />
                   </button>
                </div>
              </Card>

              <Card title="Goals Configuration">
                {isEditingGoals ? (
                  <div className="space-y-3">
                    {Object.keys(DEFAULT_GOALS).map((key) => (
                      <div key={key} className="flex items-center justify-between">
                        <span className="text-zinc-400 capitalize text-sm">{key}</span>
                        <input 
                          type="number" 
                          value={tempGoals[key as keyof UserGoals]} 
                          onChange={(e) => setTempGoals({...tempGoals, [key]: Number(e.target.value)})}
                          className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1 w-24 text-right text-white text-sm"
                        />
                      </div>
                    ))}
                    <div className="flex gap-2 mt-4">
                      <button onClick={() => {setIsEditingGoals(false); setTempGoals(userGoals);}} className="flex-1 py-2 rounded-lg text-sm font-bold text-zinc-500 border border-zinc-800">Cancel</button>
                      <button onClick={async () => {
                        await setDoc(doc(db, 'users', user.uid), { goals: tempGoals }, { merge: true });
                        setIsEditingGoals(false);
                      }} className="flex-1 bg-white text-black py-2 rounded-lg text-sm font-bold">Save</button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-zinc-800/50 p-3 rounded-lg text-center">
                        <p className="text-[10px] text-zinc-500 font-bold uppercase mb-1">Steps</p>
                        <p className="font-bold text-sm">{userGoals.steps}</p>
                      </div>
                      <div className="bg-zinc-800/50 p-3 rounded-lg text-center">
                        <p className="text-[10px] text-zinc-500 font-bold uppercase mb-1">Calories</p>
                        <p className="font-bold text-sm">{userGoals.calories}</p>
                      </div>
                      <div className="bg-zinc-800/50 p-3 rounded-lg text-center">
                        <p className="text-[10px] text-zinc-500 font-bold uppercase mb-1">Protein</p>
                        <p className="font-bold text-sm">{userGoals.protein}g</p>
                      </div>
                    </div>
                    <button onClick={() => setIsEditingGoals(true)} className="w-full bg-zinc-800 text-white font-bold py-2 rounded-lg text-xs uppercase tracking-widest hover:bg-zinc-700 transition">Edit Goals</button>
                  </div>
                )}
              </Card>

              <Card title="Database Accuracy Check">
                <p className="text-zinc-400 text-sm mb-4 italic">
                  Compare these records against your "All Health Data" in the iOS Health App.
                </p>
                <div className="space-y-3">
                  <div className="bg-zinc-800/50 rounded-xl p-4 border border-zinc-700/50">
                    <div className="flex justify-between items-center mb-4">
                      <div>
                        <p className="text-zinc-500 text-[10px] uppercase font-bold">Total Records</p>
                        <p className="text-white font-bold text-lg">{metrics.length}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-zinc-500 text-[10px] uppercase font-bold">Last Sync</p>
                        <p className="text-white font-medium text-xs">
                          {metrics[0] ? format(metrics[0].timestamp.toDate(), 'MMM d, h:mm a') : 'Never'}
                        </p>
                      </div>
                    </div>
                    
                    <div className="max-h-60 overflow-y-auto space-y-2 pr-1 border-t border-zinc-800 pt-4">
                      {metrics.length === 0 && <p className="text-zinc-600 text-xs italic text-center py-4">No data records found.</p>}
                      {metrics.slice(0, 50).map((m) => (
                        <div key={m.id} className="flex justify-between items-center bg-black/20 p-2 rounded-lg border border-zinc-800/30">
                          <div className="flex flex-col gap-1">
                            <p className="text-white font-bold text-[11px] capitalize flex items-center gap-2">
                              {m.type.replace(/_/g, ' ')}
                              {m.source === 'seeded_demo' && <span className="bg-orange-500/10 text-orange-500 px-1.5 py-0.5 rounded text-[8px] uppercase">Mock</span>}
                            </p>
                            <p className="text-zinc-500 text-[9px] uppercase tracking-tighter">
                              {format(m.timestamp.toDate(), 'MM/dd HH:mm:ss')}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-blue-400 font-mono font-bold text-xs">{m.value} {m.unit}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>

              <Card title="Danger Zone">
                <p className="text-zinc-400 text-sm mb-4">
                  Permanently delete your metrics. Mock data can be removed separately.
                </p>
                <div className="space-y-3">
                  <button 
                    onClick={async () => {
                      if (!confirmWipe) {
                        setConfirmWipe(true);
                        setTimeout(() => setConfirmWipe(false), 3000);
                        return;
                      }
                      
                      try {
                        const res = await fetch(`/api/clear-data?userId=${user.uid}`, {
                          method: 'DELETE'
                        });
                        if (res.ok) {
                          setConfirmWipe(false);
                        } else {
                          throw new Error("Wipe failed on server.");
                        }
                      } catch (err) {
                        console.error(err);
                      }
                    }}
                    className="w-full bg-rose-500/10 border border-rose-500/20 py-3 rounded-xl text-sm font-bold text-rose-500 active:scale-95 transition-transform"
                  >
                    {confirmWipe ? "Click again to confirm wipe" : "Clear All My Data"}
                  </button>
                </div>
              </Card>

              <Card title="Data Integration">
                <p className="text-zinc-400 text-sm mb-4 leading-relaxed">
                  To sync your health data, use the Shortcuts app on iPhone with the "Auto Health Export" action pointing to:
                </p>
                <div className="bg-zinc-800 p-3 rounded-lg flex flex-col gap-2 mb-4">
                  <p className="text-[10px] text-zinc-500 uppercase font-bold">API Endpoint</p>
                  <code className="text-blue-400 text-[10px] break-all">{window.location.origin}/api/health-data?userId={user.uid}</code>
                </div>
                <p className="text-zinc-500 text-xs italic">
                  Tip: Copy this URL and paste it into the "JSON Destination URL" field in your health shortcut.
                </p>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom Navigation */}
        <nav className="fixed bottom-0 left-0 right-0 p-4 pb-8 bg-gradient-to-t from-black via-black/90 to-transparent pointer-events-none">
          <div className="max-w-[360px] mx-auto bg-zinc-900/90 backdrop-blur-xl border border-zinc-800 h-16 rounded-2xl flex items-center justify-around px-2 pointer-events-auto shadow-2xl">
            <NavButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={Activity} />
            <NavButton active={activeTab === 'workouts'} onClick={() => setActiveTab('workouts')} icon={Dumbbell} />
            <NavButton active={activeTab === 'progression'} onClick={() => setActiveTab('progression')} icon={TrendingUp} />
            <NavButton active={activeTab === 'insights'} onClick={() => setActiveTab('insights')} icon={BrainCircuit} />
            <NavButton active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} icon={UserIcon} />
          </div>
        </nav>
      </div>
    </div>
  );
}

const NavButton = ({ active, onClick, icon: Icon }: { active: boolean, onClick: () => void, icon: any }) => (
  <button 
    onClick={onClick}
    className={cn(
      "relative w-12 h-12 flex items-center justify-center rounded-xl transition-all",
      active ? "text-blue-400" : "text-zinc-600 hover:text-zinc-400"
    )}
  >
    {active && (
      <motion.div 
        layoutId="nav-bg"
        className="absolute inset-0 bg-blue-500/10 rounded-xl border border-blue-500/20"
      />
    )}
    <Icon size={22} strokeWidth={active ? 2.5 : 2} />
  </button>
);
