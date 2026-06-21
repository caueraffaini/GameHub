import { useState } from 'react';
import { create } from 'zustand';
import { 
  User as UserIcon, 
  MapPin, 
  Tv, 
  Award, 
  Lock, 
  CheckCircle, 
  AlertTriangle,
  LogOut
} from 'lucide-react';
import { useAuthStore } from './shared/auth-store';
import type { UserProfile } from './shared/auth-store';
import AuthGuard from './shared/AuthGuard';

// Define layout tabs
type Tab = 'profile' | 'facilities' | 'matchmaking' | 'tournaments';

// Domain model definitions mirroring backend DTO boundaries
interface PublicUserDTO {
  id: string;
  nickname: string;
  instituteId: string;
  courseId: string;
  eloRating: number;
  teamTag: string;
}

// Zustand store for local UI state
interface AppStore {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  queueStatus: 'IDLE' | 'QUEUED' | 'MATCHED' | 'HOMELESS_RECOVERING';
  setQueueStatus: (status: AppStore['queueStatus']) => void;
  ticketLock: string | null;
  setTicketLock: (lock: string | null) => void;
}

const useAppStore = create<AppStore>((set) => ({
  activeTab: 'matchmaking',
  setActiveTab: (tab) => set({ activeTab: tab }),
  queueStatus: 'IDLE',
  setQueueStatus: (status) => set({ queueStatus: status }),
  ticketLock: null,
  setTicketLock: (lock) => set({ ticketLock: lock }),
}));

export default function App() {
  return (
    <AuthGuard>
      <GameHubApp />
    </AuthGuard>
  );
}

function GameHubApp() {
  const { 
    activeTab, 
    setActiveTab, 
    queueStatus,
    setQueueStatus,
    ticketLock,
    setTicketLock
  } = useAppStore();

  const { user, setSession, clearSession } = useAuthStore();
  const [notification, setNotification] = useState<{
    type: 'success' | 'warning' | 'info';
    message: string;
  } | null>(null);

  // If user session is cleared, fallback logic (should be handled by AuthGuard anyway)
  if (!user) {
    return null;
  }

  // Convert Private user to Public DTO projection safely
  const publicProjection: PublicUserDTO = {
    id: user.id,
    nickname: user.nickname,
    instituteId: user.instituteId,
    courseId: user.courseId,
    eloRating: 1642, // Seeded ELO rank
    teamTag: 'ICMC-ALPHA',
  };

  // Simulate O(1) Redis duplicate ticket guard
  const handleJoinQueue = () => {
    if (queueStatus === 'QUEUED') return;

    // Simulate writing the lock key gamehub:ticket_lock:{userId}:{gameType}
    const lockKey = `gamehub:ticket_lock:${user.id}:BOLA_8`;
    setTicketLock(lockKey);
    setQueueStatus('QUEUED');
    setNotification({
      type: 'success',
      message: `Redis Lock acquired: ${lockKey} (Expires 600s). Enqueued in ZSET: gamehub:${user.instituteId.toLowerCase()}:queue:bola_8`,
    });
  };

  // Simulate "Matched but Homeless" OCC version check collision
  const handleSimulateOccCollision = () => {
    if (queueStatus !== 'QUEUED') {
      setNotification({
        type: 'warning',
        message: 'Must join matchmaking queue first to simulate allocation.',
      });
      return;
    }

    setNotification({
      type: 'info',
      message: 'Allocating Play Area Table... Checking OCC version column...',
    });

    setTimeout(() => {
      // Trigger simulation failure
      setQueueStatus('HOMELESS_RECOVERING');
      setNotification({
        type: 'warning',
        message: 'OptimisticLockException triggered: Version column collision on PlayArea table! Rolling back transaction...',
      });

      // Recover and re-add ticket to the front of ZSET with priority score 0
      setTimeout(() => {
        setNotification({
          type: 'success',
          message: 'Recovery loop finished: Ticket re-inserted with priority score 0 (absolute front priority).',
        });
        setQueueStatus('QUEUED');
      }, 3000);
    }, 1500);
  };

  const handleLeaveQueue = () => {
    setQueueStatus('IDLE');
    setTicketLock(null);
    setNotification({
      type: 'info',
      message: 'Redis Lock released, matchmaking ticket cancelled.',
    });
  };

  const handleUpdateProfile = (fields: Partial<UserProfile>) => {
    const updatedUser = { ...user, ...fields };
    // Synchronize to the Auth Store session state
    const mockPayload = {
      sub: updatedUser.id,
      roles: ['STUDENT'],
      instituteId: updatedUser.instituteId,
      courseId: updatedUser.courseId,
    };
    const mockToken = `header.${btoa(JSON.stringify(mockPayload))}.signature`;
    setSession(mockToken, updatedUser);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-black text-white">
      {/* 1. DESKTOP SIDEBAR: Hidden on mobile viewports */}
      <aside className="hidden md:flex md:w-64 flex-col bg-surface border-r-2 border-primary">
        {/* Brand/Mascot header */}
        <div className="p-6 border-b-2 border-primary flex items-center gap-3">
          <div className="w-8 h-8 bg-accent text-black font-bold flex items-center justify-center geometric-bevel-sm">
            GH
          </div>
          <span className="font-extrabold tracking-widest text-lg text-white">GAMEHUB</span>
        </div>

        {/* Sidebar Nav links */}
        <nav className="flex-1 px-4 py-6 space-y-2">
          <button
            onClick={() => setActiveTab('matchmaking')}
            className={`w-full flex items-center gap-3 px-4 py-3 text-left font-bold border ${
              activeTab === 'matchmaking'
                ? 'bg-primary border-accent text-accent glow-accent'
                : 'border-transparent text-gray-400 hover:text-white hover:bg-primary/20'
            }`}
          >
            <Tv className="w-5 h-5" />
            <span>Matchmaking</span>
          </button>

          <button
            onClick={() => setActiveTab('facilities')}
            className={`w-full flex items-center gap-3 px-4 py-3 text-left font-bold border ${
              activeTab === 'facilities'
                ? 'bg-primary border-accent text-accent glow-accent'
                : 'border-transparent text-gray-400 hover:text-white hover:bg-primary/20'
            }`}
          >
            <MapPin className="w-5 h-5" />
            <span>Play Areas</span>
          </button>

          <button
            onClick={() => setActiveTab('tournaments')}
            className={`w-full flex items-center gap-3 px-4 py-3 text-left font-bold border ${
              activeTab === 'tournaments'
                ? 'bg-primary border-accent text-accent glow-accent'
                : 'border-transparent text-gray-400 hover:text-white hover:bg-primary/20'
            }`}
          >
            <Award className="w-5 h-5" />
            <span>Tournaments</span>
          </button>

          <button
            onClick={() => setActiveTab('profile')}
            className={`w-full flex items-center gap-3 px-4 py-3 text-left font-bold border ${
              activeTab === 'profile'
                ? 'bg-primary border-accent text-accent glow-accent'
                : 'border-transparent text-gray-400 hover:text-white hover:bg-primary/20'
            }`}
          >
            <UserIcon className="w-5 h-5" />
            <span>Profile & Settings</span>
          </button>
        </nav>

        {/* Device Status footer */}
        <div className="p-4 border-t-2 border-primary bg-black/40 text-xs flex flex-col gap-1 text-gray-400">
          <div>Client: Capacitor v5.0 (WebKit)</div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
            <span>Real-time presence active</span>
          </div>
        </div>
      </aside>

      {/* Main viewport area */}
      <main className="flex-1 flex flex-col min-w-0 bg-black overflow-y-auto pb-24 md:pb-0">
        {/* Top Header */}
        <header className="h-16 border-b-2 border-primary bg-surface/80 backdrop-blur flex items-center justify-between px-6 sticky top-0 z-30">
          <div className="flex items-center gap-3 md:hidden">
            <div className="w-8 h-8 bg-accent text-black font-bold flex items-center justify-center geometric-bevel-sm">
              GH
            </div>
            <span className="font-extrabold tracking-widest text-white">GAMEHUB</span>
          </div>
          <div className="hidden md:block text-gray-400 text-sm font-semibold">
            Modular Monolith Framework — USP Portal
          </div>

          <div className="flex items-center gap-4">
            {/* Status indicators */}
            <div className="hidden sm:flex items-center gap-2 bg-black px-3 py-1 border border-primary text-xs">
              <span className="text-gray-400">Campus:</span>
              <span className="text-accent font-bold">{user.instituteId}</span>
            </div>
            <div className="bg-primary/40 px-3 py-1 border border-accent/40 text-xs flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span className="font-bold text-gray-200">ONLINE</span>
            </div>
          </div>
        </header>

        {/* Dynamic content render frame */}
        <div className="flex-1 p-6 max-w-5xl mx-auto w-full space-y-6">
          {/* Global Toast Notifications */}
          {notification && (
            <div className={`p-4 border flex gap-3 items-start ${
              notification.type === 'success' ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200' :
              notification.type === 'warning' ? 'bg-amber-950/40 border-highlight/50 text-highlight' :
              'bg-blue-950/40 border-blue-500/50 text-blue-200'
            }`}>
              {notification.type === 'warning' ? <AlertTriangle className="w-5 h-5 shrink-0" /> : <CheckCircle className="w-5 h-5 shrink-0" />}
              <div className="text-sm">
                <p className="font-bold uppercase tracking-wider text-xs">System Alert</p>
                <p className="mt-0.5 font-medium">{notification.message}</p>
              </div>
              <button 
                onClick={() => setNotification(null)}
                className="ml-auto text-xs opacity-60 hover:opacity-100 uppercase font-bold"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* TAB 1: MATCHMAKING */}
          {activeTab === 'matchmaking' && (
            <div className="space-y-6">
              <div className="bg-surface border-2 border-primary p-6 space-y-4">
                <h2 className="text-xl font-bold tracking-wider text-accent border-b border-primary pb-2">
                  CAMPUS MATCHMAKING HUB
                </h2>
                <p className="text-sm text-gray-300">
                  Select game mode to match with available students at {user.instituteId}. Queue utilizes native Redis ZSET score ranking.
                </p>

                {/* Queue status control block */}
                <div className="bg-black border border-primary p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Current Status</span>
                    <div className="flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-full animate-pulse ${
                        queueStatus === 'QUEUED' ? 'bg-accent' : 
                        queueStatus === 'HOMELESS_RECOVERING' ? 'bg-highlight' : 'bg-gray-600'
                      }`}></span>
                      <span className="font-extrabold tracking-wider text-lg text-white">
                        {queueStatus === 'IDLE' && 'DISCONNECTED / IDLE'}
                        {queueStatus === 'QUEUED' && 'MATCHING IN PROGRESS'}
                        {queueStatus === 'HOMELESS_RECOVERING' && 'HOMELESS RECOVERY LOOP'}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    {queueStatus === 'IDLE' ? (
                      <button
                        onClick={handleJoinQueue}
                        className="geometric-bevel bg-primary hover:bg-primary/80 border border-accent text-accent font-bold px-6 py-2.5 uppercase text-sm tracking-wider"
                      >
                        Enter Queue (8-Ball)
                      </button>
                    ) : (
                      <button
                        onClick={handleLeaveQueue}
                        className="geometric-bevel bg-red-950/60 hover:bg-red-900 border border-red-500 text-red-200 font-bold px-6 py-2.5 uppercase text-sm tracking-wider"
                      >
                        Cancel Match
                      </button>
                    )}
                  </div>
                </div>

                {/* Concurrency guard simulation block */}
                {queueStatus !== 'IDLE' && (
                  <div className="border border-primary bg-black/40 p-4 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-highlight uppercase">
                      <AlertTriangle className="w-4 h-4" />
                      <span>Concurrency Simulation Dashboard</span>
                    </div>
                    <p className="text-xs text-gray-400">
                      Simulate a conflict transaction collision (Optimistic Concurrency Control failure) when reserving table resources.
                    </p>
                    <button
                      onClick={handleSimulateOccCollision}
                      disabled={queueStatus === 'HOMELESS_RECOVERING'}
                      className="geometric-bevel-sm bg-surface hover:bg-primary/20 border border-highlight text-highlight font-bold px-4 py-2 text-xs uppercase"
                    >
                      {queueStatus === 'HOMELESS_RECOVERING' ? 'Running Recovery...' : 'Simulate OCC Reservation Clash'}
                    </button>
                  </div>
                )}
              </div>

              {/* Active Ticket Locks Status Monitor */}
              <div className="bg-surface border border-primary p-4 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
                  <Lock className="w-4 h-4" />
                  <span>O(1) Ticket Locks Monitor</span>
                </div>
                <div className="text-xs font-mono bg-black p-3 border border-primary/60 text-gray-300">
                  {ticketLock ? (
                    <div>
                      <span className="text-emerald-400">redis&gt;</span> GET {ticketLock}
                      <div className="text-gray-400 mt-1">Value: "{user.id}" (Lock Status: ACQUIRED, TTL: 582s)</div>
                    </div>
                  ) : (
                    <span className="text-gray-500">No active Redis transaction locks found for current profile.</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: FACILITIES */}
          {activeTab === 'facilities' && (
            <div className="bg-surface border-2 border-primary p-6 space-y-6">
              <h2 className="text-xl font-bold tracking-wider text-accent border-b border-primary pb-2">
                PHYSICAL PLAY AREAS
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {/* Physical Area 1 */}
                <div className="border border-primary bg-black p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-extrabold text-lg">Billiard Table 01</h3>
                      <span className="text-xs text-gray-400">Location: Sports Hall Pavilion</span>
                    </div>
                    <span className="text-xs bg-emerald-950/60 border border-emerald-500 text-emerald-200 px-2 py-0.5 font-bold">
                      EMPTY
                    </span>
                  </div>
                  <div className="border-t border-primary/40 pt-2 text-xs space-y-1 text-gray-300">
                    <div><span className="text-gray-500">Supported Games:</span> BOLA_8, SNOOKER</div>
                    <div><span className="text-gray-500">Lock Rule:</span> Booking blocks overlap games on Table 01.</div>
                  </div>
                  <button className="w-full geometric-bevel-sm bg-primary/40 border border-primary text-white font-bold py-1.5 text-xs hover:bg-primary">
                    View Schedule Matrix
                  </button>
                </div>

                {/* Physical Area 2 */}
                <div className="border border-primary bg-black p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-extrabold text-lg">Pebolim Table 02</h3>
                      <span className="text-xs text-gray-400">Location: Student Center Lobby</span>
                    </div>
                    <span className="text-xs bg-red-950/60 border border-red-500 text-red-200 px-2 py-0.5 font-bold">
                      MATCH_IN_PROGRESS
                    </span>
                  </div>
                  <div className="border-t border-primary/40 pt-2 text-xs space-y-1 text-gray-300">
                    <div><span className="text-gray-500">Supported Games:</span> PEBOLIM</div>
                    <div><span className="text-gray-500">Current Players:</span> USP_Slayer vs. ICMC_Boss</div>
                  </div>
                  <button className="w-full geometric-bevel-sm bg-primary/40 border border-primary text-white font-bold py-1.5 text-xs hover:bg-primary">
                    View Schedule Matrix
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: TOURNAMENTS */}
          {activeTab === 'tournaments' && (
            <div className="bg-surface border-2 border-primary p-6 space-y-6">
              <h2 className="text-xl font-bold tracking-wider text-accent border-b border-primary pb-2">
                ACTIVE TOURNAMENTS
              </h2>
              
              {/* Bracket Tree layout */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-lg text-white">ICMC Autumn Cup (8-Ball Pool)</span>
                  <span className="text-xs bg-highlight text-black font-extrabold px-2 py-0.5">
                    STAGE: QUARTERFINALS
                  </span>
                </div>

                <div className="border border-primary bg-black p-6 space-y-6 overflow-x-auto">
                  <div className="flex items-center gap-8 min-w-[500px] justify-between">
                    {/* Quarterfinal Match list */}
                    <div className="space-y-4">
                      <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Quarterfinals</div>
                      
                      {/* Match 1 */}
                      <div className="border border-primary bg-surface/50 w-48 text-xs">
                        <div className="p-2 border-b border-primary/50 flex justify-between bg-primary/20">
                          <span>USP_Slayer</span>
                          <span className="font-bold text-accent">11</span>
                        </div>
                        <div className="p-2 flex justify-between">
                          <span className="text-gray-400">ICMC_Boss</span>
                          <span className="font-bold text-gray-500">4</span>
                        </div>
                      </div>

                      {/* Match 2 */}
                      <div className="border border-primary bg-surface/50 w-48 text-xs">
                        <div className="p-2 border-b border-primary/50 flex justify-between bg-primary/20">
                          <span>T-Bone_99</span>
                          <span className="font-bold text-accent">11</span>
                        </div>
                        <div className="p-2 flex justify-between">
                          <span className="text-gray-400">USP_Fighter</span>
                          <span className="font-bold text-gray-500">9</span>
                        </div>
                      </div>
                    </div>

                    {/* Connectors representation */}
                    <div className="w-8 border-y-2 border-r-2 border-primary h-16 self-center"></div>

                    {/* Semifinal Match list */}
                    <div className="space-y-4">
                      <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Semifinals</div>
                      
                      <div className="border border-primary bg-surface/50 w-48 text-xs">
                        <div className="p-2 border-b border-primary/50 flex justify-between">
                          <span>USP_Slayer</span>
                          <span className="text-gray-500">—</span>
                        </div>
                        <div className="p-2 flex justify-between">
                          <span>T-Bone_99</span>
                          <span className="text-gray-500">—</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: PROFILE & SETTINGS */}
          {activeTab === 'profile' && (
            <div className="grid gap-6 md:grid-cols-5 items-start">
              
              {/* PrivateUserDTO edit form panel */}
              <div className="bg-surface border-2 border-primary p-6 space-y-6 md:col-span-3">
                <div className="flex justify-between items-center border-b border-primary pb-2">
                  <h2 className="text-xl font-bold tracking-wider text-accent uppercase">
                    Private Profile Settings
                  </h2>
                  <button 
                    onClick={clearSession}
                    className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 font-bold uppercase tracking-wider"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Log Out</span>
                  </button>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Full Name</label>
                    <input
                      type="text"
                      value={user.fullName}
                      onChange={(e) => handleUpdateProfile({ fullName: e.target.value })}
                      className="w-full bg-black border border-primary px-3 py-2 text-sm text-white focus:outline-none focus:border-accent"
                    />
                  </div>

                  <div className="grid gap-4 grid-cols-2">
                    <div>
                      <label className="block text-xs font-bold uppercase text-gray-400 mb-1">NUSP ID</label>
                      <input
                        type="text"
                        value={user.nusp}
                        disabled
                        className="w-full bg-black/50 border border-primary/40 px-3 py-2 text-sm text-gray-500 cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Birth Date</label>
                      <input
                        type="date"
                        value={user.birthDate}
                        onChange={(e) => handleUpdateProfile({ birthDate: e.target.value })}
                        className="w-full bg-black border border-primary px-3 py-2 text-sm text-white focus:outline-none focus:border-accent"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Email Address</label>
                    <input
                      type="email"
                      value={user.email}
                      onChange={(e) => handleUpdateProfile({ email: e.target.value })}
                      className="w-full bg-black border border-primary px-3 py-2 text-sm text-white focus:outline-none focus:border-accent"
                    />
                  </div>

                  {/* Secure 4-digit PIN section */}
                  <div className="border-t border-primary/40 pt-4">
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs font-bold uppercase text-gray-400">Security Profile PIN</label>
                      <span className="text-[10px] text-gray-500">Argon2 Session Protection</span>
                    </div>
                    
                    <div className="flex gap-4 items-center">
                      <div className="flex gap-1.5">
                        <span className="w-3 h-3 rounded-full bg-accent"></span>
                        <span className="w-3 h-3 rounded-full bg-accent"></span>
                        <span className="w-3 h-3 rounded-full bg-accent"></span>
                        <span className="w-3 h-3 rounded-full bg-accent"></span>
                      </div>
                      <span className="text-xs text-gray-400 font-mono">(PIN encrypted)</span>
                      
                      <button 
                        onClick={() => {
                          const newPin = prompt('Enter new 4-digit PIN:');
                          if (newPin && /^\d{4}$/.test(newPin)) {
                            // PIN change simulates setting rotated session
                            setNotification({
                              type: 'success',
                              message: 'PIN successfully updated. Asynchronous Argon2 hashing applied in domain layer.',
                            });
                          } else if (newPin) {
                            alert('PIN must be exactly 4 digits!');
                          }
                        }}
                        className="ml-auto geometric-bevel-sm bg-primary border border-accent hover:bg-accent hover:text-black text-accent text-xs font-bold px-3 py-1.5 uppercase transition-colors"
                      >
                        Reset PIN
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* PublicUserDTO display component */}
              <div className="space-y-4 md:col-span-2">
                <span className="text-xs font-extrabold text-gray-400 uppercase tracking-widest block">
                  Public Card Preview
                </span>
                
                {/* Public profile card frame */}
                <div className="bg-surface border-2 border-accent p-6 space-y-6 relative overflow-hidden glow-accent">
                  {/* Decorative emblem corner */}
                  <div className="absolute top-0 right-0 w-12 h-12 bg-accent/20 border-l border-b border-accent/40 flex items-center justify-center font-bold text-accent text-xs">
                    ★
                  </div>

                  {/* Nickname header */}
                  <div className="space-y-1">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Student Profile</span>
                    <h3 className="text-2xl font-black text-white tracking-wide">{publicProjection.nickname}</h3>
                  </div>

                  {/* Core display tags */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-black/60 p-2.5 border border-primary">
                      <span className="text-gray-500 block text-[10px] uppercase font-bold">Institute</span>
                      <span className="text-white font-extrabold">{publicProjection.instituteId}</span>
                    </div>
                    <div className="bg-black/60 p-2.5 border border-primary">
                      <span className="text-gray-500 block text-[10px] uppercase font-bold">Team</span>
                      <span className="text-white font-extrabold">{publicProjection.teamTag}</span>
                    </div>
                  </div>

                  {/* ELO badge highlight display */}
                  <div className="bg-primary/20 p-4 border border-accent flex justify-between items-center bg-gradient-to-r from-primary/30 to-black/20">
                    <div className="space-y-0.5">
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Rank Pool Score</span>
                      <span className="text-lg font-black text-highlight flex items-center gap-1.5">
                        <Award className="w-5 h-5 shrink-0" />
                        <span>{publicProjection.eloRating} ELO</span>
                      </span>
                    </div>
                    <span className="text-[10px] font-bold border border-highlight text-highlight px-2 py-0.5 tracking-widest uppercase">
                      GOLD TIER
                    </span>
                  </div>
                </div>
              </div>

            </div>
          )}
        </div>
      </main>

      {/* 2. MOBILE BOTTOM BAR: Hidden on desktop viewports */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-surface border-t-2 border-primary flex justify-around items-center z-40">
        <button
          onClick={() => setActiveTab('matchmaking')}
          className={`flex flex-col items-center justify-center w-full h-full text-[10px] font-bold ${
            activeTab === 'matchmaking' ? 'text-accent border-t-2 border-accent' : 'text-gray-400'
          }`}
        >
          <Tv className="w-5 h-5" />
          <span className="mt-1">Matchmaking</span>
        </button>

        <button
          onClick={() => setActiveTab('facilities')}
          className={`flex flex-col items-center justify-center w-full h-full text-[10px] font-bold ${
            activeTab === 'facilities' ? 'text-accent border-t-2 border-accent' : 'text-gray-400'
          }`}
        >
          <MapPin className="w-5 h-5" />
          <span className="mt-1">Play Areas</span>
        </button>

        <button
          onClick={() => setActiveTab('tournaments')}
          className={`flex flex-col items-center justify-center w-full h-full text-[10px] font-bold ${
            activeTab === 'tournaments' ? 'text-accent border-t-2 border-accent' : 'text-gray-400'
          }`}
        >
          <Award className="w-5 h-5" />
          <span className="mt-1">Tournaments</span>
        </button>

        <button
          onClick={() => setActiveTab('profile')}
          className={`flex flex-col items-center justify-center w-full h-full text-[10px] font-bold ${
            activeTab === 'profile' ? 'text-accent border-t-2 border-accent' : 'text-gray-400'
          }`}
        >
          <UserIcon className="w-5 h-5" />
          <span className="mt-1">Profile</span>
        </button>
      </nav>
    </div>
  );
}
