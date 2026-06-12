import { useState, useEffect } from 'react';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { Student, Attendance, Salary, TutorProfile, UserProfile } from '../types';
import { 
  collection, 
  getDocs, 
  query, 
  where, 
  getDoc,
  doc,
  setDoc,
  deleteDoc
} from 'firebase/firestore';
import { deleteUser } from 'firebase/auth';
import { 
  User, 
  BookOpen, 
  CalendarDays, 
  CheckCircle2, 
  FileText, 
  Coins, 
  PhoneCall, 
  Award, 
  GraduationCap,
  LogOut,
  ShieldAlert,
  Trash2
} from 'lucide-react';

interface ParentDashboardProps {
  user: UserProfile;
  onSignOut: () => void;
}

const formatMonthName = (ym: string): string => {
  if (!ym || ym.length !== 7) return ym;
  const [year, month] = ym.split('-');
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const mIndex = parseInt(month, 10) - 1;
  if (mIndex >= 0 && mIndex < 12) {
    return `${months[mIndex]} ${year}`;
  }
  return ym;
};

export default function ParentDashboard({ user, onSignOut }: ParentDashboardProps) {
  const [activeTab, setActiveTab] = useState<'children' | 'tutors' | 'attendance' | 'bills'>('children');
  const [children, setChildren] = useState<Student[]>([]);
  const [tutorProfiles, setTutorProfiles] = useState<{[tutorUid: string]: TutorProfile}>({});
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [salaries, setSalaries] = useState<Salary[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);

  // Parent Focus States for Month Attendance Report
  const [parentFocusStudentId, setParentFocusStudentId] = useState<string>('');
  const [parentFocusMonth, setParentFocusMonth] = useState<string>(new Date().toISOString().slice(0, 7));

  // Deletion States
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteErrorMsg, setDeleteErrorMsg] = useState('');

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    setDeleteErrorMsg('');
    try {
      const currentUser = auth.currentUser;
      if (currentUser) {
        const userDocPath = `users/${user.uid}`;
        try {
          await deleteDoc(doc(db, 'users', user.uid));
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, userDocPath);
        }
        await deleteUser(currentUser);
        window.location.reload();
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/requires-recent-login') {
        setDeleteErrorMsg('Please sign out and sign back in to perform this action, as it requires recent credentials.');
      } else {
        setDeleteErrorMsg('Failed to delete account. Please try again or re-authenticate.');
      }
    } finally {
      setIsDeleting(false);
    }
  };

  // Parent Custom Tutor Info / Memo
  const [tutorNotes, setTutorNotes] = useState<{[tutorUid: string]: string}>(() => {
    const stored = localStorage.getItem(`parent_tutor_notes_${user.uid}`);
    return stored ? JSON.parse(stored) : {};
  });
  const [activeNoteTutorUid, setActiveNoteTutorUid] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');
  const [noteSuccess, setNoteSuccess] = useState('');

  // Fetch Parent linked data
  const fetchParentData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch Students matching parent's email
      const qChildren = query(
        collection(db, 'students'), 
        where('parentEmail', '==', user.email.toLowerCase().trim())
      );
      const resChildren = await getDocs(qChildren);
      const childrenList = resChildren.docs.map(doc => ({
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date()
      })) as Student[];
      setChildren(childrenList);

      if (childrenList.length > 0) {
        // Unique tutor UIDs from kids
        const tutorUids = Array.from(new Set(childrenList.map(c => c.tutorUid)));
        
        // 2. Fetch linked tutor profiles
        const loadedTutorProfiles: {[tutorId: string]: TutorProfile} = {};
        for (const tId of tutorUids) {
          const tDoc = await getDoc(doc(db, 'tutorProfiles', tId));
          if (tDoc.exists()) {
            loadedTutorProfiles[tId] = tDoc.data() as TutorProfile;
          } else {
            // fallback profile
            loadedTutorProfiles[tId] = {
              tutorUid: tId,
              name: 'Assigned Tutor',
              email: 'Contact tutor directly',
              phone: 'Not Specified',
              qualification: 'Home Tutor',
              experience: 'N/A',
              subjects: [],
              bio: 'Profile not yet finalized by the tutor.',
              updatedAt: new Date()
            };
          }
        }
        setTutorProfiles(loadedTutorProfiles);

        // 3. Fetch matched child attendances
        const childIds = childrenList.map(c => c.id);
        const qAttend = query(collection(db, 'attendance'), where('studentId', 'in', childIds));
        const resAttend = await getDocs(qAttend);
        const attendanceList = resAttend.docs.map(doc => ({
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate() || new Date()
        })) as Attendance[];
        setAttendances(attendanceList);

        // 4. Fetch linked salaries invoices
        const qSal = query(collection(db, 'salaries'), where('parentEmail', '==', user.email.toLowerCase().trim()));
        const resSal = await getDocs(qSal);
        const salariesList = resSal.docs.map(doc => ({
          ...doc.data(),
          paidAt: doc.data().paidAt?.toDate() || null
        })) as Salary[];
        setSalaries(salariesList);
      }

    } catch (err) {
      handleFirestoreError(err, OperationType.GET, 'multiple_collections_parent');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchParentData();
  }, [user.uid, user.email]);

  // Handle saving private tutor notes
  const saveTutorNote = (tId: string) => {
    setNoteSuccess('');
    const newNotes = { ...tutorNotes, [tId]: editingNoteText };
    setTutorNotes(newNotes);
    localStorage.setItem(`parent_tutor_notes_${user.uid}`, JSON.stringify(newNotes));
    setNoteSuccess('Private notes stored locally successfully!');
    setTimeout(() => setNoteSuccess(''), 3000);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-8rem)] gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
        <p className="text-sm font-medium text-gray-400 font-mono">Syncing Parent database from cloud...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-mixed-gradient font-sans relative">
      
      {/* Sidebar - Desktop */}
      <aside className="w-64 bg-slate-900 flex flex-col h-full shrink-0 z-30 hidden md:flex border-r border-slate-800">
        <div className="p-6 border-b border-slate-800 bg-slate-950/40 font-display">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-xl flex items-center justify-center font-bold text-white shadow-md shadow-indigo-500/20 transform hover:rotate-6 transition-transform">P</div>
            <span className="text-white font-display font-bold text-lg tracking-tight">Parent Portal</span>
          </div>
        </div>
        
        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          <button
            onClick={() => setActiveTab('children')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-semibold cursor-pointer ${
              activeTab === 'children' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>My Students</span>
          </button>

          <button
            onClick={() => setActiveTab('tutors')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-semibold cursor-pointer ${
              activeTab === 'tutors' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Tutor Contact Cards</span>
          </button>

          <button
            onClick={() => setActiveTab('attendance')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-semibold cursor-pointer ${
              activeTab === 'attendance' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
            }`}
          >
            <CalendarDays className="w-4 h-4" />
            <span>Attendance Grids</span>
          </button>

          <button
            onClick={() => setActiveTab('bills')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-semibold cursor-pointer ${
              activeTab === 'bills' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
            }`}
          >
            <Coins className="w-4 h-4" />
            <span>Tuition Bills</span>
          </button>
        </nav>
        
        {/* Sidebar Footer */}
        <div className="p-4 border-t border-slate-800 flex flex-col gap-3">
          <div className="flex items-center gap-3 px-2 py-1">
            <div className="w-8 h-8 rounded-full bg-indigo-500 text-white font-bold flex items-center justify-center text-xs">
              {user.displayName.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <span className="block text-xs font-semibold text-white truncate">{user.displayName}</span>
              <span className="block text-[10px] text-slate-500 font-mono truncate">{user.email}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-center text-xs font-medium">
            <button
              onClick={onSignOut}
              className="py-2.5 bg-slate-800 hover:bg-slate-755 text-slate-350 hover:text-white rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
            <button
              onClick={() => {
                setDeleteErrorMsg('');
                setShowDeleteModal(true);
              }}
              className="py-2.5 bg-slate-800 hover:bg-red-950/40 text-slate-350 hover:text-red-400 rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Pane */}
      <main className="flex-1 flex flex-col h-full bg-mixed-gradient/45 overflow-y-auto">
        {/* Top Header */}
        <header className="h-18 bg-mixed-creamy/75 backdrop-blur-md border-b border-indigo-100/40 flex items-center justify-between px-6 sm:px-8 sticky top-0 z-10 shrink-0">
          <div className="flex items-center gap-3 md:gap-0">
            {/* Mobile Nav Header */}
            <div className="md:hidden flex items-center gap-2 font-display">
              <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-xl flex items-center justify-center font-bold text-white text-xs shadow-md">P</div>
              <span className="font-display font-display font-extrabold text-md tracking-tight text-slate-900 leading-none">ParentPortal</span>
            </div>
            
            <h1 className="hidden md:block text-lg font-display font-extrabold text-slate-905 tracking-tight capitalize">
              {activeTab === 'children' ? 'My Students Classes & Schedules' : `${activeTab} Pane`}
            </h1>
          </div>

          <div className="flex items-center gap-4">
            {/* Status Badge */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-slate-50 border border-slate-200 text-slate-600 rounded-lg text-[10px] font-bold uppercase tracking-wider">
              <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
              <span>Parent Portal Active</span>
            </div>
            
            {/* Mobile Sign Out Option */}
            <button
              onClick={onSignOut}
              className="md:hidden flex items-center gap-1 text-xs text-slate-500 font-medium bg-slate-100/80 px-2.5 py-1.5 rounded-lg border border-slate-200 animate-in fade-in"
            >
              <LogOut className="w-3.5 h-3.5 text-slate-500" />
              <span>Sign Out</span>
            </button>
          </div>
        </header>

        {/* Floating Mobile Tabs (only on mobile) */}
        <div className="md:hidden bg-white border-b border-slate-200 px-4 py-2 flex items-center gap-1 rounded-xl mx-4 mt-4 overflow-x-auto shrink-0 scrollbar-none" id="parent-mobile-tabs">
          {[
            { id: 'children', label: 'Students', icon: BookOpen },
            { id: 'tutors', label: 'Tutors', icon: User },
            { id: 'attendance', label: 'Attendance', icon: CalendarDays },
            { id: 'bills', label: 'Bills', icon: Coins },
          ].map(tab => {
            const IconComp = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg shrink-0 transition-colors cursor-pointer ${
                  activeTab === tab.id ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <IconComp className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>

        {/* Tab Content Block */}
        <div className="p-4 sm:p-8 flex flex-col gap-6 max-w-7xl w-full mx-auto">
          
          {/* Summary stats row on desktop */}
          {children.length > 0 && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in duration-300">
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
                <span className="text-[10px] uppercase text-slate-400 font-bold tracking-wider font-sans">Enrolled Students</span>
                <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-mono mt-2">{children.length}</span>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                <span className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Total Monthly Fees</span>
                <span className="text-2xl sm:text-3xl font-extrabold text-indigo-650 font-mono mt-2">৳{children.reduce((acc, curr) => acc + curr.salaryAmount, 0)}</span>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                <span className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Unmarked Dues items</span>
                <span className="text-2xl sm:text-3xl font-extrabold text-amber-500 font-mono mt-2">{salaries.filter(s => s.status === 'pending').length}</span>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                <span className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Class Logs Stored</span>
                <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-mono mt-2">{attendances.length}</span>
              </div>
            </div>
          )}

      {/* NO LINKED CHILDREN EXPLAINER */}
      {children.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-150 p-10 max-w-xl mx-auto text-center space-y-4 shadow-sm">
          <div className="bg-amber-50 text-amber-700 p-4 rounded-full w-14 h-14 flex items-center justify-center mx-auto border border-amber-100">
            <Coins className="w-7 h-7" />
          </div>
          <h2 className="text-md font-bold text-slate-900">No linked student records found</h2>
          <div className="text-xs text-gray-500 leading-relaxed space-y-2">
            <p>Your authenticated email: <strong className="text-slate-800 font-mono select-all font-bold">{user.email}</strong></p>
            <p className="text-[11px] text-gray-400">
              For security, ask your child's home tutor to add your email as the registered parent email. Once they register your child, all schedules, contact cards, and dues bills will automatically sync here!
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          
          {/* CHILD PROFILES ACTIVE TAB */}
          {activeTab === 'children' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {children.map(child => {
                const tutor = tutorProfiles[child.tutorUid];
                return (
                  <div key={child.id} className="bg-white rounded-2xl p-6 border border-gray-150 shadow-sm space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-150">{child.grade}</span>
                        <h2 className="text-lg font-bold text-gray-900 mt-2">{child.name}</h2>
                      </div>
                      <div className="text-right">
                        <span className="block text-[10px] text-gray-400 font-sans uppercase">Monthly salary</span>
                        <span className="block text-md font-bold text-indigo-650">৳{child.salaryAmount}</span>
                      </div>
                    </div>

                    <div className="border-t border-gray-100 pt-3.5 space-y-2 text-xs text-slate-500">
                      <div>
                        <span className="font-bold text-slate-700">Subjects taught:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {child.subjects.map((sub, idx) => (
                            <span key={idx} className="text-[9px] uppercase tracking-wider font-bold bg-gray-50 px-2 py-0.5 rounded border">{sub}</span>
                          ))}
                        </div>
                      </div>
                      <p className="pt-2"><span className="font-bold text-slate-700">Home Session Address:</span> {child.address}</p>
                      {child.contactInfo && (
                        <p className="pt-1"><span className="font-bold text-slate-750">Contact Info:</span> {child.contactInfo}</p>
                      )}
                      <p className="pt-1"><span className="font-bold text-slate-700">Tutoring Days:</span> {child.tutoringDays?.join(', ') || 'N/A'}</p>
                      
                      {/* Academic Progress & Feedback */}
                      <div className="pt-2 border-t border-indigo-50 mt-2">
                        <span className="font-bold text-indigo-950 block mb-1">Academic Progress:</span>
                        {child.progressNotes ? (
                          <p className="p-2.5 bg-indigo-50/40 text-indigo-900 rounded-lg text-xs leading-normal border border-indigo-100/50">
                            {child.progressNotes}
                          </p>
                        ) : (
                          <p className="text-[11px] font-medium text-gray-400 italic">No academic progress observations reported yet by this tutor.</p>
                        )}
                      </div>
                    </div>

                    {tutor && (
                      <div className="mt-4 p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between text-xs">
                        <div>
                          <span className="block text-[10px] text-gray-400 leading-none">Your Assigned Tutor</span>
                          <span className="font-bold text-slate-800 mt-1 block">{tutor.name}</span>
                        </div>
                        <a href={`tel:${tutor.phone}`} className="flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-gray-100 text-blue-600 border border-gray-200 text-[11px] font-semibold rounded-lg transition-colors">
                          <PhoneCall className="w-3 h-3" />
                          <span>Call Tutor</span>
                        </a>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* TUTOR CONTACT CARDS ACTIVE TAB */}
          {activeTab === 'tutors' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
              
              {/* TUTOR CONTACT CARD DECK */}
              <div className="lg:col-span-2 space-y-4">
                <h2 className="text-md font-bold text-gray-900">Linked Tutor Directory({Object.keys(tutorProfiles).length})</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(Object.values(tutorProfiles) as TutorProfile[]).map((tutor: TutorProfile) => (
                    <div 
                      key={tutor.tutorUid} 
                      onClick={() => {
                        setActiveNoteTutorUid(tutor.tutorUid);
                        setEditingNoteText(tutorNotes[tutor.tutorUid] || '');
                      }}
                      className={`bg-white rounded-xl p-5 border cursor-pointer transition-all hover:bg-slate-50/50 ${
                        activeNoteTutorUid === tutor.tutorUid ? 'border-blue-500 ring-2 ring-blue-500/10' : 'border-gray-200'
                      }`}
                    >
                      <div className="space-y-3.5">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-indigo-50 rounded-xl text-indigo-600">
                            <GraduationCap className="w-5 h-5 animate-pulse" />
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-slate-900">{tutor.name}</h3>
                            <p className="text-[10px] text-gray-400 font-mono mt-0.5">{tutor.email}</p>
                          </div>
                        </div>

                        <div className="border-t border-gray-100 pt-3 space-y-1.5 text-xs text-slate-500">
                          <p><span className="font-semibold text-slate-700">Phone: </span>{tutor.phone}</p>
                          <p><span className="font-semibold text-slate-700">Qualification: </span>{tutor.qualification}</p>
                          <p><span className="font-semibold text-slate-700">Experience: </span>{tutor.experience}</p>
                        </div>

                        {tutor.subjects && tutor.subjects.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1.5">
                            {tutor.subjects.map((s, idx) => (
                              <span key={idx} className="text-[9px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">{s}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* STORE PRIVATE NOTES / TUTOR MEMOS */}
              <div className="lg:col-span-1 bg-white rounded-2xl p-6 border border-gray-150 shadow-sm space-y-4">
                <h2 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-blue-500" />
                  <span>Store Tutor Info & Notes</span>
                </h2>
                <p className="text-xs text-gray-500">
                  Select a tutor from the left to save custom private memos or payment deadlines locally for your own reference.
                </p>

                {activeNoteTutorUid ? (
                  <div className="space-y-4">
                    <div className="p-2 border border-blue-50 rounded-lg bg-blue-50/20 text-xs">
                      <span className="font-bold text-slate-800">Writing Notes for: </span>
                      {tutorProfiles[activeNoteTutorUid]?.name || 'Selected Tutor'}
                    </div>

                    <textarea
                      rows={4}
                      placeholder="e.g. Regular timings are Mon/Wed 5 PM. Prefers bank transfer. Key points..."
                      value={editingNoteText}
                      onChange={(e) => setEditingNoteText(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-gray-200 focus:border-indigo-500 focus:bg-white text-xs rounded-lg outline-none transition-all resize-none font-sans"
                    ></textarea>

                    {noteSuccess && (
                      <div className="p-2 bg-emerald-50 text-emerald-800 border border-emerald-100 text-[11px] font-semibold rounded-lg">
                        {noteSuccess}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => saveTutorNote(activeNoteTutorUid)}
                      className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer text-center"
                    >
                      Save Private Tutor Notes
                    </button>

                    {/* Associated Child Session progress, attendance records, and payment history under this selected Tutor */}
                    {(() => {
                      const selectedTutorKids = children.filter(c => c.tutorUid === activeNoteTutorUid);
                      if (selectedTutorKids.length === 0) return null;
                      return (
                        <div className="space-y-3 pt-4 border-t border-slate-100 mt-2">
                          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest text-[10px]">Your Child's Connected Stats</h3>
                          {selectedTutorKids.map(kid => {
                            const kidAttendances = attendances.filter(a => a.studentId === kid.id);
                            const kidPayments = salaries.filter(s => s.studentId === kid.id);
                            return (
                              <div key={kid.id} className="p-3 bg-slate-50 border border-slate-150 rounded-xl space-y-2.5 text-xs">
                                <div className="flex items-center justify-between font-bold text-slate-900 border-b border-dashed pb-1">
                                  <span>{kid.name}</span>
                                  <span className="font-mono text-[10px] text-indigo-650">{kid.grade}</span>
                                </div>
                                
                                {/* Academic progress */}
                                <div>
                                  <span className="text-[10px] font-bold text-slate-500 block">Academic Progress:</span>
                                  <p className="text-slate-650 text-[10px] italic mt-0.5 leading-relaxed">
                                    {kid.progressNotes || 'No academic remarks submitted yet by the tutor.'}
                                  </p>
                                </div>

                                {/* Attendance Logs */}
                                <div>
                                  <span className="text-[10px] font-bold text-slate-500 block mb-1">Session Attendance Logs:</span>
                                  {kidAttendances.length === 0 ? (
                                    <span className="text-[10px] text-slate-400 italic">No logs logged yet.</span>
                                  ) : (
                                    <div className="flex flex-wrap gap-1">
                                      {kidAttendances.slice(0, 5).map(att => (
                                        <span key={att.id} className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                                          att.status === 'present' ? 'bg-emerald-50 text-emerald-800 border-emerald-100' :
                                          att.status === 'absent' ? 'bg-rose-50 text-rose-800 border-rose-100' :
                                          'bg-amber-50 text-amber-800 border-amber-100'
                                        }`} title={att.date}>
                                          {att.status.slice(0, 3).toUpperCase()}
                                        </span>
                                      ))}
                                      {kidAttendances.length > 5 && (
                                        <span className="text-[9px] text-slate-400 font-mono flex items-center px-1 font-bold">+{kidAttendances.length - 5} more</span>
                                      )}
                                    </div>
                                  )}
                                </div>

                                {/* Salaries / payments details */}
                                <div>
                                  <span className="text-[10px] font-bold text-slate-500 block mb-1">Tuition Dues & Billing:</span>
                                  {kidPayments.length === 0 ? (
                                    <span className="text-[10px] text-slate-400 italic">No invoices registered yet.</span>
                                  ) : (
                                    <div className="space-y-1 max-h-24 overflow-y-auto">
                                      {kidPayments.map(sal => (
                                        <div key={sal.id} className="flex justify-between items-center text-[10px] p-1.5 bg-white border border-slate-100 rounded">
                                          <span className="font-sans text-slate-550">{formatMonthName(sal.month)}</span>
                                          <div className="flex items-center gap-1.5">
                                            <span className="font-bold text-slate-800">৳{sal.amount}</span>
                                            <span className={`text-[8px] font-bold uppercase tracking-wider px-1.5 rounded-full ${
                                              sal.status === 'paid' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-750'
                                            }`}>
                                              {sal.status}
                                            </span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  <div className="p-6 text-center text-xs text-gray-400 font-medium border border-dashed rounded-xl">
                    No tutor selected. Click a tutor directory card left to write notes.
                  </div>
                )}
              </div>

            </div>
          )}

          {/* ATTENDANCE GRIDS ACTIVE TAB */}
          {activeTab === 'attendance' && (
            <div className="bg-white rounded-2xl p-6 border border-gray-150 shadow-sm space-y-6">
              <div>
                <h2 className="text-md font-bold text-gray-900">Academic Attendance logs</h2>
                <p className="text-xs text-gray-500">Review class histories logged dynamically by the respective home tutor.</p>
              </div>

              {attendances.length === 0 ? (
                <div className="text-center p-12 text-gray-400 font-medium">
                  No attendance entries signed by tutors yet.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {children.map(child => {
                    const childLogs = attendances.filter(a => a.studentId === child.id);
                    return (
                      <div key={child.id} className="border border-gray-150 rounded-xl p-5 space-y-4">
                        <div className="flex items-center justify-between border-b pb-2">
                          <h3 className="font-bold text-slate-900 text-sm">{child.name}</h3>
                          <span className="text-[10px] font-mono uppercase bg-gray-100 px-2 py-0.5 rounded text-gray-600">Total entries: {childLogs.length}</span>
                        </div>

                        {childLogs.length === 0 ? (
                          <p className="text-xs text-gray-400 italic">No attendance records submitted for this child.</p>
                        ) : (
                          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                            {childLogs.map(log => (
                              <div key={log.id} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg hover:bg-slate-100/50 transition-colors text-xs text-slate-600">
                                <span className="font-mono font-medium">{log.date}</span>
                                <span className={`inline-flex items-center gap-1 font-semibold uppercase text-[9px] tracking-wider px-2 py-0.5 rounded border ${
                                  log.status === 'present'
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-100'
                                    : log.status === 'absent'
                                    ? 'bg-rose-50 text-rose-800 border-rose-100'
                                    : 'bg-amber-50 text-amber-800 border-amber-100'
                                }`}>
                                  {log.status}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* SEPARATE OPTION FOR VIEWING EACH STUDENT FULL MONTH ATTENDANCE */}
              {children.length > 0 && (
                <div className="mt-8 pt-6 border-t border-slate-100 space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">Student Monthly Attendance Analyzer</h3>
                    <p className="text-xs text-gray-400 mt-1 font-sans">Select any student and month to calculate exact attendance percentages and view full daily sheets.</p>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
                    <div className="flex flex-wrap gap-3 items-center">
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Select Student</span>
                        <select
                          value={parentFocusStudentId || (children[0]?.id || '')}
                          onChange={(e) => setParentFocusStudentId(e.target.value)}
                          className="px-3 py-1.5 bg-white border border-gray-250 rounded-lg text-xs font-semibold outline-none focus:border-indigo-500"
                        >
                          <option value="">-- Choose Student --</option>
                          {children.map(std => (
                            <option key={std.id} value={std.id}>{std.name} ({std.grade})</option>
                          ))}
                        </select>
                      </div>

                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Select Month</span>
                        <input
                          type="month"
                          value={parentFocusMonth}
                          onChange={(e) => setParentFocusMonth(e.target.value)}
                          className="px-3 py-1.5 bg-white border border-gray-255 rounded-lg text-xs font-semibold outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>

                    {(() => {
                      const activeStdId = parentFocusStudentId || children[0]?.id;
                      if (!activeStdId) return null;

                      const activeStudentObj = children.find(s => s.id === activeStdId);

                      // Filter logs for this student and this month
                      const monthLogs = attendances.filter(a => {
                        return a.studentId === activeStdId && a.date.startsWith(parentFocusMonth);
                      });

                      const presents = monthLogs.filter(a => a.status === 'present').length;
                      const gaps = monthLogs.filter(a => a.status === 'absent').length;
                      const tookOffs = monthLogs.filter(a => a.status === 'took_off').length;
                      const holidays = monthLogs.filter(a => a.status === 'holiday').length;
                      const gapCovereds = monthLogs.filter(a => a.status === 'gap_covered').length;

                      const totalLogged = monthLogs.length;
                      // Formula for percentage: (presents + gapCovereds) / (presents + gaps + tookOffs + gapCovereds) * 100
                      const denominator = presents + gaps + tookOffs + gapCovereds;
                      const attendancePercentage = denominator > 0 
                        ? Math.round(((presents + gapCovereds) / denominator) * 100) 
                        : 100;

                      return (
                        <div className="bg-white border border-slate-150 rounded-xl p-4 mt-2 space-y-4">
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-3">
                            <div>
                              <h4 className="text-sm font-bold text-slate-800">{activeStudentObj?.name}'s Full Month Statistics</h4>
                              <p className="text-[11px] text-slate-400 mt-0.5 font-sans">Summary data computed for {formatMonthName(parentFocusMonth)}.</p>
                            </div>
                            <div className="bg-indigo-50 border border-indigo-150 rounded-xl px-4 py-2 text-center">
                              <span className="block text-[9px] uppercase font-bold tracking-wider text-indigo-500">Attendance Percentage</span>
                              <span className="text-xl font-black text-indigo-700 font-mono">
                                {monthLogs.length === 0 ? '—' : `${attendancePercentage}%`}
                              </span>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
                            <div className="p-2 bg-emerald-50 rounded-lg border border-emerald-100/60">
                              <span className="block text-[8px] uppercase tracking-wider font-extrabold text-emerald-500">Presences (Taken)</span>
                              <span className="text-xs font-mono font-extrabold text-emerald-800">{presents}</span>
                            </div>
                            <div className="p-2 bg-indigo-50 rounded-lg border border-indigo-100/60">
                              <span className="block text-[8px] uppercase tracking-wider font-extrabold text-indigo-500">Gaps Covered</span>
                              <span className="text-xs font-mono font-extrabold text-indigo-800">{gapCovereds}</span>
                            </div>
                            <div className="p-2 bg-rose-50 rounded-lg border border-rose-100/60">
                              <span className="block text-[8px] uppercase tracking-wider font-extrabold text-rose-500">Absents</span>
                              <span className="text-xs font-mono font-extrabold text-rose-800">{gaps}</span>
                            </div>
                            <div className="p-2 bg-amber-50 rounded-lg border border-amber-100/60">
                              <span className="block text-[8px] uppercase tracking-wider font-extrabold text-amber-500">Took Off</span>
                              <span className="text-xs font-mono font-extrabold text-amber-800">{tookOffs}</span>
                            </div>
                            <div className="p-2 bg-sky-50 rounded-lg border border-sky-100/60">
                              <span className="block text-[8px] uppercase tracking-wider font-extrabold text-sky-500">Holidays</span>
                              <span className="text-xs font-mono font-extrabold text-sky-800">{holidays}</span>
                            </div>
                          </div>

                          {monthLogs.length === 0 ? (
                            <div className="bg-slate-50 text-slate-450 text-xs italic p-6 rounded-lg text-center border border-dashed border-slate-200">
                              No historical logs entered for this student in {formatMonthName(parentFocusMonth)}.
                            </div>
                          ) : (
                            <div className="overflow-hidden border border-slate-150 rounded-lg">
                              <table className="min-w-full divide-y divide-slate-150 text-xs">
                                <thead className="bg-slate-50">
                                  <tr>
                                    <th className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Date</th>
                                    <th className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Attendance Status</th>
                                    <th className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Covered Absence Date</th>
                                  </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-slate-100 font-sans text-xs">
                                  {monthLogs
                                    .sort((a, b) => a.date.localeCompare(b.date))
                                    .map(log => (
                                      <tr key={log.id} className="hover:bg-slate-50/50">
                                        <td className="px-4 py-2 font-mono font-medium text-slate-700">{log.date}</td>
                                        <td className="px-4 py-2">
                                          <span className={`inline-flex px-2 py-0.5 rounded text-[9px] uppercase font-bold tracking-wider border ${
                                            log.status === 'present' ? 'bg-emerald-50 text-emerald-800 border-emerald-100' :
                                            log.status === 'absent' ? 'bg-rose-50 text-rose-800 border-rose-150' :
                                            log.status === 'holiday' ? 'bg-sky-50 text-sky-800 border-sky-100' :
                                            log.status === 'took_off' ? 'bg-amber-50 text-amber-800 border-amber-100' :
                                            'bg-indigo-50 text-indigo-800 border-indigo-100'
                                          }`}>
                                            {log.status === 'took_off' ? 'Took Off' : log.status === 'gap_covered' ? 'Gap Covered' : log.status}
                                          </span>
                                        </td>
                                        <td className="px-4 py-2 font-mono text-slate-500">
                                          {log.status === 'gap_covered' && log.gapCoveredDate ? log.gapCoveredDate : '—'}
                                        </td>
                                      </tr>
                                    ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TUITION BILLS TAB */}
          {activeTab === 'bills' && (
            <div className="bg-white rounded-2xl p-6 border border-gray-150 shadow-sm space-y-6">
              <div>
                <h2 className="text-md font-bold text-gray-900">Track Salaries & Tuition Payments</h2>
                <p className="text-xs text-gray-500">View upcoming fee invoices and marked transaction receipts logged by tutors.</p>
              </div>

              {salaries.length === 0 ? (
                <div className="text-center p-12 text-gray-400 font-medium">
                  No billing statements registered in database yet.
                </div>
              ) : (
                <div className="border border-gray-150 rounded-xl overflow-hidden divide-y divide-gray-150">
                  <table className="min-w-full divide-y divide-gray-200 text-sm text-slate-600">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Student Name</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider font-mono">Invoice Month</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Salary Amount</th>
                        <th className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Receipt Status</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Payment Date</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-150">
                      {salaries.map(sal => {
                        const associatedKid = children.find(c => c.id === sal.studentId);
                        return (
                          <tr key={sal.id} className="hover:bg-slate-50/40">
                            <td className="px-6 py-4 whitespace-nowrap font-bold text-slate-900">{associatedKid?.name || 'Assigned Student'}</td>
                            <td className="px-6 py-4 whitespace-nowrap font-sans text-xs">{formatMonthName(sal.month)}</td>
                            <td className="px-6 py-4 whitespace-nowrap font-bold text-slate-800">৳{sal.amount}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider ${
                                sal.status === 'paid'
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-100'
                                  : 'bg-rose-50 text-rose-800 border border-rose-100'
                              }`}>
                                {sal.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-left text-xs text-slate-500 font-mono font-bold">
                              {sal.status === 'paid' ? (sal.receivedDate || sal.paidAt?.toString().split('T')[0] || 'Cleared') : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

        </div>
      )}

      </div>
    </main>

  {/* Delete Account Modal Layout */}
  {showDeleteModal && (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-red-50 rounded-xl text-red-600">
            <ShieldAlert className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 leading-snug">Delete your Parent Profile?</h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              This action is absolutely permanent and cannot be undone. We will erase your credentials, delete private tutor note records, and completely purge your authentication state.
            </p>
          </div>
        </div>

        {deleteErrorMsg && (
          <div className="mt-4 p-3 bg-red-50 border border-red-100 text-red-700 text-xs rounded-xl font-medium">
            {deleteErrorMsg}
          </div>
        )}

        <div className="mt-6 flex gap-3 justify-end text-xs">
          <button
            type="button"
            onClick={() => setShowDeleteModal(false)}
            className="px-4 py-2.5 border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 rounded-xl font-semibold cursor-pointer transition-colors"
            disabled={isDeleting}
          >
            No, Cancel
          </button>
          <button
            type="button"
            onClick={handleDeleteAccount}
            className="px-4 py-2.5 bg-red-600 text-white hover:bg-red-700 rounded-xl font-semibold cursor-pointer transition-colors flex items-center gap-1.5 shadow-md hover:shadow-red-200"
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting Forever...' : 'Yes, Delete Account'}
          </button>
        </div>
      </div>
    </div>
  )}

</div>
);
}
