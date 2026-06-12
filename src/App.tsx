import { useEffect, useState } from 'react';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from './firebase';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { UserProfile } from './types';
import Onboarding from './components/Onboarding';
import TutorDashboard from './components/TutorDashboard';
import ParentDashboard from './components/ParentDashboard';
import { 
  GraduationCap, 
  ShieldCheck, 
  Sparkles, 
  CalendarDays, 
  Coins, 
  ClipboardCheck, 
  Layers 
} from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [onboardingRequired, setOnboardingRequired] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [authError, setAuthError] = useState('');

  // Track Firebase authenticated state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setIsAuthLoading(true);
      setAuthError('');
      if (user) {
        setCurrentUser(user);
        
        // Fetch User Profile document from Firestore
        const userDocPath = `users/${user.uid}`;
        try {
          const profileDoc = await getDoc(doc(db, 'users', user.uid));
          if (profileDoc.exists()) {
            const data = profileDoc.data();
            setUserProfile({
              ...data,
              createdAt: data.createdAt?.toDate() || new Date()
            } as UserProfile);
            setOnboardingRequired(false);
          } else {
            // Document doesn't exist, trigger onboarding
            setOnboardingRequired(true);
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, userDocPath);
          setAuthError('Authentication succeeded but we failed to fetch your profile settings.');
        }
      } else {
        setCurrentUser(null);
        setUserProfile(null);
        setOnboardingRequired(false);
      }
      setIsAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Handle Google Popup sign-in
  const handleSignIn = async () => {
    setAuthError('');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      console.error(err);
      if (err.code !== 'auth/popup-closed-by-user') {
        setAuthError('Sign in failed. Please try again or check your popup blocker.');
      }
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  const handleOnboardingCompleted = (newProfile: UserProfile) => {
    setUserProfile(newProfile);
    setOnboardingRequired(false);
  };

  if (isAuthLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50/50 gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
        <p className="text-sm font-medium text-gray-400 font-mono">Verifying authorization state...</p>
      </div>
    );
  }

  // RENDER LANDING PAGE (Unauthenticated state)
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-mixed-gradient text-slate-850 font-sans flex flex-col justify-between relative overflow-hidden">
        
        {/* Ambient background decoration shapes */}
        <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-indigo-200/40 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] rounded-full bg-emerald-100/40 blur-[130px] pointer-events-none" />
        
        {/* Simple Top Header */}
        <header className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between border-b border-indigo-100/40 bg-mixed-creamy/65 backdrop-blur-md sticky top-0 z-50">
          <div className="flex items-center gap-2.5">
            <div className="bg-gradient-to-br from-indigo-500 to-indigo-700 text-white p-2 rounded-2xl shadow-lg flex items-center justify-center transform hover:rotate-6 transition-transform">
              <CalendarDays className="w-5 h-5 animate-pulse" id="landing-brand-icon" />
            </div>
            <span className="font-display font-extrabold text-xl tracking-tight bg-gradient-to-r from-slate-900 to-indigo-950 bg-clip-text text-transparent">TutorConnect</span>
          </div>
          <span className="text-[10px] font-mono text-indigo-700 bg-indigo-50 border border-indigo-100/50 px-3.5 py-1.5 rounded-full uppercase tracking-wider font-bold">Stable Release v1.2</span>
        </header>
 
        {/* HERO SECTION */}
        <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10 md:py-16 flex flex-col lg:flex-row items-center gap-12 lg:gap-16 flex-1 relative z-10">
          
          {/* Explanation Text */}
          <div className="lg:w-6/12 space-y-6 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-50 to-indigo-100/80 border border-indigo-150 text-indigo-850 text-[11px] font-bold px-4 py-2 rounded-full uppercase tracking-widest shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600 animate-spin-slow" />
              <span>Durable Cloud Database Synced</span>
            </div>
 
            <h1 className="text-4.5xl sm:text-5.5xl font-display font-extrabold tracking-tight text-slate-900 leading-none">
              Supercharge Home Tutoring & <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent underline decoration-indigo-200 decoration-wavy">Parent Updates</span>.
            </h1>
            
            <p className="text-slate-500 text-sm sm:text-base max-w-lg leading-relaxed mx-auto lg:mx-0 font-medium">
              A bespoke full-stack workspace linking dedicated educators and parent houses instantly. Access class calendar records, academic feedback notes, student portfolios, and pristine monthly financial statements.
            </p>
 
            {/* Core Value points */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md mx-auto lg:mx-0 pt-2 text-left">
              <div className="flex items-start gap-4 bg-mixed-card-warm/95 p-4.5 rounded-2xl border border-indigo-100/40 shadow-sm hover:translate-y-[-2px] hover:shadow-md hover:border-indigo-150 transition-all duration-300">
                <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
                  <ClipboardCheck className="w-5 h-5 flex-shrink-0" />
                </div>
                <div>
                  <h4 className="font-display font-bold text-slate-950 text-sm">Attendance logs</h4>
                  <p className="text-[11px] text-slate-400 mt-1 leading-normal font-medium">Tutors mark logs instantly, and parents inspect the historical sessions live.</p>
                </div>
              </div>
 
              <div className="flex items-start gap-4 bg-mixed-card-warm/95 p-4.5 rounded-2xl border border-indigo-100/40 shadow-sm hover:translate-y-[-2px] hover:shadow-md hover:border-indigo-150 transition-all duration-300">
                <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
                  <Coins className="w-5 h-5 flex-shrink-0" />
                </div>
                <div>
                  <h4 className="font-display font-bold text-slate-950 text-sm">Secure Tuition Ledger</h4>
                  <p className="text-[11px] text-slate-400 mt-1 leading-normal font-medium">No missing payments. Track monthly dues and structured salary logs securely.</p>
                </div>
              </div>
            </div>
          </div>
 
          {/* DUAL LOGIN CARD DECK */}
          <div className="lg:w-6/12 w-full max-w-md bg-mixed-creamy/90 rounded-3xl p-8 border border-indigo-100/45 shadow-2xl space-y-6 relative hover:shadow-indigo-100/50 transition-all duration-500 backdrop-blur-md">
            <div className="absolute top-3 right-3">
              <span className="inline-flex h-3 w-3 rounded-full bg-indigo-400 animate-ping absolute opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
            </div>
 
            <div className="text-center space-y-3">
              <div className="p-3 bg-gradient-to-br from-indigo-50 to-indigo-100/55 text-indigo-650 rounded-2xl w-14 h-14 flex items-center justify-center mx-auto border border-indigo-150 shadow-sm">
                <Layers className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-display font-extrabold text-slate-950">Access Portal</h2>
              <p className="text-xs text-slate-400 font-medium">Sign in to claim your dashboard panel with verified credentials.</p>
            </div>
 
            {authError && (
              <div className="p-3 bg-red-50 border border-red-100 text-red-700 text-xs font-medium rounded-xl animate-shake">
                {authError}
              </div>
            )}
 
            <div className="space-y-4 pt-2">
              
              {/* Login CTA */}
              <button
                onClick={handleSignIn}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 hover:scale-[1.01] active:scale-[0.99] text-white font-bold text-sm rounded-xl transition-all shadow-lg shadow-indigo-200 hover:shadow-xl hover:shadow-indigo-300 flex items-center justify-center gap-3 cursor-pointer text-center font-display"
                id="btn-google-login"
              >
                <span>Continue secure Google Sign-in</span>
              </button>
 
              <div className="flex items-center justify-center gap-4 py-2 opacity-80">
                <div className="h-px bg-slate-200 flex-1"></div>
                <span className="text-[10px] text-slate-450 font-mono uppercase font-bold tracking-widest whitespace-nowrap">Dashboard Roles Included</span>
                <div className="h-px bg-slate-200 flex-1"></div>
              </div>
 
              {/* Roles visual cards descriptions */}
              <div className="grid grid-cols-2 gap-3.5 text-xs text-left">
                <div className="p-4 border border-emerald-100 bg-mixed-card-cool/70 rounded-2xl space-y-2 leading-relaxed transition-all hover:bg-emerald-50/40">
                  <div className="p-1.5 bg-emerald-600 text-white rounded-lg w-7 h-7 flex items-center justify-center shadow-sm">
                    <GraduationCap className="w-4 h-4" />
                  </div>
                  <span className="font-display font-extrabold text-emerald-900 block leading-none">Tutor System</span>
                  <span className="text-[10px] text-slate-500 block leading-normal font-medium">Add, edit classes, log observations feedback & download pdf-like TXT reports.</span>
                </div>
 
                <div className="p-4 border border-blue-100 bg-mixed-card-cool/70 rounded-2xl space-y-2 leading-relaxed transition-all hover:bg-blue-50/40">
                  <div className="p-1.5 bg-blue-600 text-white rounded-lg w-7 h-7 flex items-center justify-center shadow-sm">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <span className="font-display font-extrabold text-blue-900 block leading-none">Parent Portal</span>
                  <span className="text-[10px] text-slate-500 block leading-normal font-medium">Browse class history rosters, audit school progress notes, and check pending tuition invoices.</span>
                </div>
              </div>
 
            </div>
          </div>
 
        </main>
 
        <footer className="border-t border-indigo-100/40 bg-mixed-creamy/50 py-6 text-center select-none z-10 relative">
          <p className="text-[10px] font-mono text-slate-400 uppercase tracking-widest font-bold">
            TutorConnect Systems inc &bull; Protected by Firebase rules
          </p>
        </footer>
 
      </div>
    );
  }

  // RENDER ONBOARDING FLOW (Role declaration)
  if (onboardingRequired) {
    return (
      <div className="min-h-screen bg-mixed-gradient">
        <header className="h-16 px-4 bg-mixed-creamy/80 border-b border-indigo-100/40 sticky top-0 flex items-center justify-between z-40 backdrop-blur-md">
          <div className="flex items-center gap-2 max-w-7xl mx-auto w-full">
            <div className="bg-gradient-to-br from-indigo-500 to-indigo-700 text-white p-1.5 rounded-lg flex items-center justify-center">
              <Layers className="w-4.5 h-4.5" />
            </div>
            <span className="font-display font-bold text-md text-gray-900 leading-none">Registering Profile</span>
          </div>
        </header>
        <Onboarding
          uid={currentUser.uid}
          email={currentUser.email}
          defaultName={currentUser.displayName || ''}
          onCompleted={handleOnboardingCompleted}
        />
      </div>
    );
  }

  // RENDER MAIN DASHBOARD WITH ACTIVE ROLE IN PROFILE
  return (
    <div className="min-h-screen bg-mixed-gradient text-slate-800 font-sans">
      {userProfile && (
        <div className="animate-in fade-in duration-300">
          {userProfile.role === 'tutor' ? (
            <TutorDashboard user={userProfile} onSignOut={handleSignOut} />
          ) : (
            <ParentDashboard user={userProfile} onSignOut={handleSignOut} />
          )}
        </div>
      )}
    </div>
  );
}
