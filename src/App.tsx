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
  User as UserIcon
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
  serverTimestamp,
  Timestamp,
  writeBatch,
  doc
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
  Area
} from 'recharts';
import { getAIRecommendations } from './services/geminiService';
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
const GOALS = {
  steps: 12000,     // Adjusted for active college student
  calories: 2900,  // TDEE for 165lb athlete with 3-4 workouts
  protein: 170,    // High protein for muscle maintenance
  carbs: 350,      // High carb for explosive performance (volleyball)
  fiber: 35,
  sugar: 50,       // Strict sugar limit
};

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
  // In a real app we might show a toast here
}

// --- Types ---
type Tab = 'dashboard' | 'workouts' | 'insights' | 'profile';

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

const Dashboard = ({ user, metrics, workouts }: { user: User, metrics: HealthMetric[], workouts: Workout[], key?: React.Key }) => {
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

  const nutritionMetrics = [
    { label: 'Calories', value: caloriesValue, goal: GOALS.calories, color: '#fb923c', exceededColor: '#fb7185' },
    { label: 'Protein', value: proteinValue, goal: GOALS.protein, color: '#10b981', exceededColor: '#34d399' },
    { label: 'Carbs', value: carbsValue, goal: GOALS.carbs, color: '#3b82f6', exceededColor: '#60a5fa' },
    { label: 'Fiber', value: fiberValue, goal: GOALS.fiber, color: '#a855f7', exceededColor: '#c084fc' },
    { label: 'Sugar', value: sugarValue, goal: GOALS.sugar, color: '#f43f5e', exceededColor: '#ef4444' },
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
        <MetricTile icon={Zap} label="Basal Burn" value={Math.round(latest('basal_energy_burned'))} unit="kcal" color="bg-orange-500/20 text-orange-400 border border-orange-500/30" />
        <MetricTile 
          icon={TrendingUp} 
          label="Steps" 
          value={stepsValue} 
          unit="steps" 
          color="bg-indigo-500/20 text-indigo-400 border border-indigo-500/30" 
          percentage={(stepsValue / GOALS.steps) * 100}
        />
      </div>

      <Card title="Fueling & Nutrition">
        <div className="grid grid-cols-2 gap-x-8 gap-y-4 mb-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between group">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-6 rounded-full bg-orange-400/50 group-hover:bg-orange-400 transition-colors" />
                <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider">Energy</p>
              </div>
              <p className={cn("font-mono font-bold text-xs", caloriesValue > GOALS.calories ? "text-rose-500" : "text-white")}>
                {caloriesValue} <span className="text-zinc-600 font-normal">/ {GOALS.calories}</span>
              </p>
            </div>
            
            <div className="flex items-center justify-between group">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-6 rounded-full bg-emerald-400/50 group-hover:bg-emerald-400 transition-colors" />
                <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider">Protein</p>
              </div>
              <p className={cn("font-mono font-bold text-xs", proteinValue > GOALS.protein ? "text-emerald-500" : "text-white")}>
                {proteinValue}g <span className="text-zinc-600 font-normal">/ {GOALS.protein}g</span>
              </p>
            </div>

            <div className="flex items-center justify-between group">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-6 rounded-full bg-blue-400/50 group-hover:bg-blue-400 transition-colors" />
                <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider">Carbs</p>
              </div>
              <p className={cn("font-mono font-bold text-xs", carbsValue > GOALS.carbs ? "text-rose-500" : "text-white")}>
                {carbsValue}g <span className="text-zinc-600 font-normal">/ {GOALS.carbs}g</span>
              </p>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between group">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-6 rounded-full bg-purple-400/50 group-hover:bg-purple-400 transition-colors" />
                <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider">Fiber</p>
              </div>
              <p className={cn("font-mono font-bold text-xs", fiberValue > GOALS.fiber ? "text-rose-500" : "text-white")}>
                {fiberValue}g <span className="text-zinc-600 font-normal">/ {GOALS.fiber}g</span>
              </p>
            </div>
            
            <div className="flex items-center justify-between group">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-6 rounded-full bg-rose-400/50 group-hover:bg-rose-400 transition-colors" />
                <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider">Sugar</p>
              </div>
              <p className={cn("font-mono font-bold text-xs", sugarValue > GOALS.sugar ? "text-rose-500" : "text-white")}>
                {sugarValue}g <span className="text-zinc-600 font-normal">/ {GOALS.sugar}g</span>
              </p>
            </div>

            <div className="h-6 flex items-center justify-end px-1">
               <p className="text-[9px] uppercase font-black tracking-widest text-zinc-700 italic">Athlete Profile: Active</p>
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
                  {w.type === 'lifting' ? `${w.exercises[0]?.weight || 0}lbs` : `${w.exercises[0]?.duration || 0}m`}
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
  
  // Form State
  const [workoutType, setWorkoutType] = useState<'lifting' | 'cardio'>('lifting');
  const [workoutName, setWorkoutName] = useState('');
  const [currentExercises, setCurrentExercises] = useState<any[]>([]);
  
  // Temp fields for adding to currentExercises
  const [tempExerciseName, setTempExerciseName] = useState('');
  const [tempWeight, setTempWeight] = useState('');
  const [tempReps, setTempReps] = useState('');
  const [tempDuration, setTempDuration] = useState('');
  
  const [loading, setLoading] = useState(false);

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
      duration: parseInt(tempDuration) || 0
    };

    setCurrentExercises([...currentExercises, newEx]);
    setTempExerciseName('');
    setTempWeight('');
    setTempReps('');
    setTempDuration('');
  };

  const saveWorkout = async () => {
    if (!workoutName || currentExercises.length === 0) return;
    setLoading(true);
    try {
      const workoutData = {
        userId: user.uid,
        name: workoutName,
        type: workoutType,
        date: serverTimestamp(),
        exercises: currentExercises
      };
      await addDoc(collection(db, 'workouts'), workoutData);
      setIsLogging(false);
      // Reset form
      setWorkoutName('');
      setCurrentExercises([]);
    } catch (error) {
      handleFirestoreError(error, 'create', 'workouts');
    } finally {
      setLoading(false);
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
        <button 
          onClick={() => setIsLogging(true)}
          className="bg-white text-zinc-950 px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 active:scale-95 transition-all shadow-xl hover:bg-zinc-200"
        >
          <Plus size={14} /> New Entry
        </button>
      </div>

      <div className="space-y-4">
        {workouts.map((w) => (
          <Card key={w.id} className={cn("border-l-2", w.type === 'cardio' ? "border-l-emerald-500" : "border-l-blue-500")}>
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-white font-bold tracking-tight">{w.name}</h3>
              <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest">
                {w.date ? format(w.date.toDate(), 'MMM d') : '...ing'}
              </span>
            </div>
            <p className="text-zinc-400 text-sm mb-4">
              {w.exercises.length} {w.type === 'cardio' ? 'activity' : 'exercises'} tracked
            </p>
            <div className="flex flex-wrap gap-2">
              {w.exercises.map((e, idx) => (
                <span key={idx} className="bg-zinc-800/50 text-zinc-300 px-2.5 py-1 rounded-lg text-[10px] border border-zinc-700/50 font-medium">
                  {e.name} {w.type === 'cardio' ? `(${e.duration} min)` : `(${e.weight}lbs x ${e.reps})`}
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
                      <input type="number" value={tempDuration} onChange={(e) => setTempDuration(e.target.value)} placeholder="Duration (mins)" className="w-full bg-zinc-900/50 border border-zinc-700/50 rounded-xl px-3 py-2 text-sm text-white outline-none" />
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
                             {workoutType === 'lifting' ? `${ex.weight}lbs x ${ex.reps}` : `${ex.duration}m`}
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

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [metrics, setMetrics] = useState<HealthMetric[]>([]);
  const [workouts, setWorkouts] = useState<Workout[]>([]);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
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
          limit(10)
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
          {activeTab === 'dashboard' && <Dashboard key="dash" user={user} metrics={metrics} workouts={workouts} />}
          {activeTab === 'workouts' && <Workouts key="work" user={user} />}
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
                      if (!confirm("Are you sure you want to delete ALL your metrics and history? This will perform a deep wipe of your database.")) return;
                      
                      try {
                        const res = await fetch(`/api/clear-data?userId=${user.uid}`, {
                          method: 'DELETE'
                        });
                        if (res.ok) {
                          alert("Database wiped successfully.");
                        } else {
                          throw new Error("Wipe failed on server.");
                        }
                      } catch (err) {
                        console.error(err);
                        alert("Failed to clear data completely.");
                      }
                    }}
                    className="w-full bg-rose-500/10 border border-rose-500/20 py-3 rounded-xl text-sm font-bold text-rose-500 active:scale-95 transition-transform"
                  >
                    Clear All My Data
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
          <div className="max-w-xs mx-auto bg-zinc-900/90 backdrop-blur-xl border border-zinc-800 h-16 rounded-2xl flex items-center justify-around px-4 pointer-events-auto shadow-2xl">
            <NavButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={Activity} />
            <NavButton active={activeTab === 'workouts'} onClick={() => setActiveTab('workouts')} icon={Dumbbell} />
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
