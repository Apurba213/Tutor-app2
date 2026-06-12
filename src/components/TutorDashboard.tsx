import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Student, Attendance, Salary, TutorProfile, UserProfile } from '../types';
import { 
  collection, 
  getDocs, 
  query, 
  where, 
  setDoc, 
  doc, 
  deleteDoc, 
  writeBatch,
  getDoc
} from 'firebase/firestore';
import { auth } from '../firebase';
import { deleteUser } from 'firebase/auth';
import { 
  Users, 
  CheckSquare, 
  DollarSign, 
  TrendingUp, 
  UserPen, 
  Plus, 
  Trash2, 
  FileSpreadsheet, 
  CalendarDays, 
  MapPin, 
  Mail, 
  Check, 
  AlertCircle,
  TrendingDown,
  Sparkles,
  LogOut,
  ShieldAlert,
  Download
} from 'lucide-react';

interface TutorDashboardProps {
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

export default function TutorDashboard({ user, onSignOut }: TutorDashboardProps) {
  const [activeTab, setActiveTab] = useState<'students' | 'attendance' | 'salaries' | 'reports' | 'profile'>('students');
  const [students, setStudents] = useState<Student[]>([]);
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [salaries, setSalaries] = useState<Salary[]>([]);
  const [tutorProfile, setTutorProfile] = useState<TutorProfile | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);

  // Focus states for Month Attendance Report
  const [focusStudentId, setFocusStudentId] = useState<string>('');
  const [focusMonth, setFocusMonth] = useState<string>(new Date().toISOString().slice(0, 7));

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
        setDeleteErrorMsg('Please sign out and sign back in to perform this action, as it requires recent authentication.');
      } else {
        setDeleteErrorMsg('Failed to delete account. Please try again or re-authenticate.');
      }
    } finally {
      setIsDeleting(false);
    }
  };

  // Forms and actions states
  // Student Form
  const [studName, setStudName] = useState('');
  const [studGrade, setStudGrade] = useState('');
  const [studSubjects, setStudSubjects] = useState('');
  const [studAddress, setStudAddress] = useState('');
  const [studParentEmail, setStudParentEmail] = useState('');
  const [studSalary, setStudSalary] = useState('');
  const [studTutoringDays, setStudTutoringDays] = useState<string[]>([]);
  const [studContactInfo, setStudContactInfo] = useState('');
  const [studProgressNotes, setStudProgressNotes] = useState('');
  const [studentError, setStudentError] = useState('');
  const [studentSuccess, setStudentSuccess] = useState('');

  // Student Profile Detail/Edit Modal States
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isEditingStudent, setIsEditingStudent] = useState(false);
  const [editStudName, setEditStudName] = useState('');
  const [editStudGrade, setEditStudGrade] = useState('');
  const [editStudSubjects, setEditStudSubjects] = useState('');
  const [editStudAddress, setEditStudAddress] = useState('');
  const [editStudParentEmail, setEditStudParentEmail] = useState('');
  const [editStudSalary, setEditStudSalary] = useState('');
  const [editStudTutoringDays, setEditStudTutoringDays] = useState<string[]>([]);
  const [editStudContactInfo, setEditStudContactInfo] = useState('');
  const [editStudProgressNotes, setEditStudProgressNotes] = useState('');
  const [editStudentSuccess, setEditStudentSuccess] = useState('');
  const [editStudentError, setEditStudentError] = useState('');

  const handleOpenStudentDetail = (std: Student) => {
    setSelectedStudent(std);
    setIsEditingStudent(false);
    setEditStudName(std.name);
    setEditStudGrade(std.grade);
    setEditStudSubjects(std.subjects.join(', '));
    setEditStudAddress(std.address);
    setEditStudParentEmail(std.parentEmail);
    setEditStudSalary(String(std.salaryAmount));
    setEditStudTutoringDays(std.tutoringDays || []);
    setEditStudContactInfo(std.contactInfo || '');
    setEditStudProgressNotes(std.progressNotes || '');
    setEditStudentSuccess('');
    setEditStudentError('');
  };

  // Attendance Form
  const [attendanceDate, setAttendanceDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [attendanceStatusMap, setAttendanceStatusMap] = useState<{[studentId: string]: 'present' | 'absent' | 'holiday' | 'took_off' | 'gap_covered'}>({});
  const [attendanceGapDateMap, setAttendanceGapDateMap] = useState<{[studentId: string]: string}>({});
  const [attendanceSuccess, setAttendanceSuccess] = useState('');

  // Attendance Edit/Delete States
  const [editingAttendance, setEditingAttendance] = useState<Attendance | null>(null);
  const [editAttendanceStatus, setEditAttendanceStatus] = useState<'present' | 'absent' | 'holiday' | 'took_off' | 'gap_covered'>('present');
  const [editAttendanceGapDate, setEditAttendanceGapDate] = useState('');
  const [isSavingEditAttendance, setIsSavingEditAttendance] = useState(false);

  // Salaries Form
  const [salaryMonth, setSalaryMonth] = useState(() => {
    const today = new Date();
    return today.toISOString().slice(0, 7); // YYYY-MM
  });
  const [salaryActionSuccess, setSalaryActionSuccess] = useState('');

  // Tutor Profile Form
  const [profPhone, setProfPhone] = useState('');
  const [profQual, setProfQual] = useState('');
  const [profExp, setProfExp] = useState('');
  const [profSubjects, setProfSubjects] = useState('');
  const [profBio, setProfBio] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');

  // Fetch all standard collections for this Tutor
  const fetchTutorData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch Students
      const qStudents = query(collection(db, 'students'), where('tutorUid', '==', user.uid));
      const resStudents = await getDocs(qStudents);
      const studentList = resStudents.docs.map(doc => ({
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date()
      })) as Student[];
      setStudents(studentList);

      // Initialize default attendances for today
      const defaultMap: {[studentId: string]: 'present' | 'absent' | 'holiday' | 'took_off' | 'gap_covered'} = {};
      studentList.forEach(s => {
        defaultMap[s.id] = 'present';
      });
      setAttendanceStatusMap(defaultMap);

      // 2. Fetch Attendance for Tutor
      const qAttend = query(collection(db, 'attendance'), where('tutorUid', '==', user.uid));
      const resAttend = await getDocs(qAttend);
      const attendanceList = resAttend.docs.map(doc => ({
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date()
      })) as Attendance[];
      setAttendances(attendanceList);

      // 3. Fetch Salaries logged by Tutor
      const qSal = query(collection(db, 'salaries'), where('tutorUid', '==', user.uid));
      const resSal = await getDocs(qSal);
      const salaryList = resSal.docs.map(doc => ({
        ...doc.data(),
        paidAt: doc.data().paidAt?.toDate() || null
      })) as Salary[];
      setSalaries(salaryList);

      // 4. Fetch Tutor Profile
      const tutorProfileDoc = await getDoc(doc(db, 'tutorProfiles', user.uid));
      if (tutorProfileDoc.exists()) {
        const rawProf = tutorProfileDoc.data() as TutorProfile;
        setTutorProfile(rawProf);
        setProfPhone(rawProf.phone || '');
        setProfQual(rawProf.qualification || '');
        setProfExp(rawProf.experience || '');
        setProfSubjects(rawProf.subjects?.join(', ') || '');
        setProfBio(rawProf.bio || '');
      } else {
        // Initialize an empty profile for saving later
        setProfPhone('');
        setProfQual('');
        setProfExp('');
        setProfSubjects('');
        setProfBio('');
      }

    } catch (err) {
      handleFirestoreError(err, OperationType.GET, 'multiple_collections_tutor');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTutorData();
  }, [user.uid]);

  // Handle Add Student
  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setStudentError('');
    setStudentSuccess('');

    if (!studName.trim() || !studParentEmail.trim() || !studSalary) {
      setStudentError('Please fill out Name, Parent Email, and Tuition Salary amount.');
      return;
    }

    const matchedEmail = studParentEmail.toLowerCase().trim();
    const cleanId = 'std_' + Math.random().toString(36).substring(2, 9);
    const newStudent: Student = {
      id: cleanId,
      name: studName.trim(),
      grade: studGrade.trim() || 'Any',
      subjects: studSubjects.split(',').map(s => s.trim()).filter(Boolean),
      address: studAddress.trim() || 'Not Specified',
      parentEmail: matchedEmail,
      tutorUid: user.uid,
      salaryAmount: parseInt(studSalary) || 0,
      tutoringDays: studTutoringDays,
      createdAt: new Date(),
      contactInfo: studContactInfo.trim(),
      progressNotes: studProgressNotes.trim()
    };

    try {
      await setDoc(doc(db, 'students', cleanId), {
        ...newStudent,
        createdAt: new Date()
      });
      setStudents(prev => [...prev, newStudent]);
      
      // Auto-update default attendance map for this session
      setAttendanceStatusMap(prev => ({ ...prev, [cleanId]: 'present' }));

      setStudentSuccess(`Successfully registered student: ${newStudent.name}`);
      setStudName('');
      setStudGrade('');
      setStudSubjects('');
      setStudAddress('');
      setStudParentEmail('');
      setStudSalary('');
      setStudTutoringDays([]);
      setStudContactInfo('');
      setStudProgressNotes('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `students/${cleanId}`);
      setStudentError('Failed to create student. Please verify database rules.');
    }
  };

  // Handle Delete Student
  const handleDeleteStudent = async (studId: string) => {
    if (!confirm('Are you absolutely sure you want to remove this student? All linked registers/reports will remain but unlinked.')) return;
    try {
      await deleteDoc(doc(db, 'students', studId));
      setStudents(prev => prev.filter(s => s.id !== studId));
      if (selectedStudent?.id === studId) {
        setSelectedStudent(null);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `students/${studId}`);
    }
  };

  // Handle Edit/Save Student Profile and feedback notes
  const handleSaveStudentChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditStudentSuccess('');
    setEditStudentError('');

    if (!selectedStudent) return;

    if (!editStudName.trim() || !editStudParentEmail.trim() || !editStudSalary) {
      setEditStudentError('Please fill out Name, Parent Email, and Tuition Salary amount.');
      return;
    }

    const updatedStudent: Student = {
      ...selectedStudent,
      name: editStudName.trim(),
      grade: editStudGrade.trim() || 'Any',
      subjects: editStudSubjects.split(',').map(s => s.trim()).filter(Boolean),
      address: editStudAddress.trim() || 'Not Specified',
      parentEmail: editStudParentEmail.toLowerCase().trim(),
      salaryAmount: parseInt(editStudSalary) || 0,
      tutoringDays: editStudTutoringDays,
      contactInfo: editStudContactInfo.trim(),
      progressNotes: editStudProgressNotes.trim()
    };

    try {
      await setDoc(doc(db, 'students', selectedStudent.id), {
        ...updatedStudent,
        createdAt: selectedStudent.createdAt || new Date()
      }, { merge: true });

      // Update student in local state
      setStudents(prev => prev.map(s => s.id === selectedStudent.id ? updatedStudent : s));
      setSelectedStudent(updatedStudent);
      setEditStudentSuccess('Student Profile updated successfully in Firebase!');
      setTimeout(() => {
        setIsEditingStudent(false);
      }, 1000);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `students/${selectedStudent.id}`);
      setEditStudentError('Failed to modify student. Verify Firebase rules.');
    }
  };

  // Handle Attendance submission for chosen date
  const handleSubmitAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    setAttendanceSuccess('');

    if (students.length === 0) return;

    try {
      const batch = writeBatch(db);
      const newLogs: Attendance[] = [];

      students.forEach(s => {
        const uniqueId = `att_${s.id}_${attendanceDate}`;
        const statusVal = attendanceStatusMap[s.id] || 'present';
        const newLog: Attendance = {
          id: uniqueId,
          studentId: s.id,
          date: attendanceDate,
          status: statusVal,
          tutorUid: user.uid,
          createdAt: new Date()
        };
        if (statusVal === 'gap_covered' && attendanceGapDateMap[s.id]) {
          newLog.gapCoveredDate = attendanceGapDateMap[s.id];
        }
        newLogs.push(newLog);

        const logRef = doc(db, 'attendance', uniqueId);
        batch.set(logRef, {
          ...newLog,
          createdAt: new Date()
        });
      });

      await batch.commit();

      // Refresh attendance state
      setAttendances(prev => {
        const filtered = prev.filter(a => a.date !== attendanceDate);
        return [...filtered, ...newLogs];
      });

      setAttendanceSuccess(`Successfully recorded attendance for ${attendanceDate}!`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'attendance_batch');
    }
  };

  const handleDeleteAttendance = async (id: string) => {
    if (!confirm('Are you sure you want to delete this attendance record? This will instantly remove it from the parent view.')) return;
    try {
      await deleteDoc(doc(db, 'attendance', id));
      setAttendances(prev => prev.filter(a => a.id !== id));
      setAttendanceSuccess('Attendance record deleted successfully.');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `attendance/${id}`);
    }
  };

  const handleStartEditAttendance = (att: Attendance) => {
    setEditingAttendance(att);
    setEditAttendanceStatus(att.status);
    setEditAttendanceGapDate(att.gapCoveredDate || '');
  };

  const handleSaveEditAttendanceChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAttendance) return;
    setIsSavingEditAttendance(true);
    try {
      const updatedRecord: Attendance = {
        ...editingAttendance,
        status: editAttendanceStatus,
      };
      if (editAttendanceStatus === 'gap_covered') {
        updatedRecord.gapCoveredDate = editAttendanceGapDate;
      } else {
        delete updatedRecord.gapCoveredDate;
      }

      await setDoc(doc(db, 'attendance', editingAttendance.id), {
        ...updatedRecord,
        createdAt: editingAttendance.createdAt || new Date()
      }, { merge: true });

      setAttendances(prev => prev.map(a => a.id === editingAttendance.id ? updatedRecord : a));
      setEditingAttendance(null);
      setAttendanceSuccess('Updated attendance entry successfully!');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `attendance/${editingAttendance.id}`);
    } finally {
      setIsSavingEditAttendance(false);
    }
  };

  // Generate missing monthly tuition salaries logs
  const handleGenerateInvoice = async () => {
    setSalaryActionSuccess('');
    if (students.length === 0) {
      alert('You need at least one student to create tuition bills.');
      return;
    }

    try {
      const batch = writeBatch(db);
      const newBills: Salary[] = [];

      students.forEach(s => {
        // Double check if invoice for s.id and salaryMonth already exists
        const exists = salaries.some(sal => sal.studentId === s.id && sal.month === salaryMonth);
        if (!exists) {
          const uniqueId = `sal_${s.id}_${salaryMonth}`;
          const newBill: Salary = {
            id: uniqueId,
            studentId: s.id,
            month: salaryMonth,
            amount: s.salaryAmount,
            status: 'pending',
            paidAt: null,
            tutorUid: user.uid,
            parentEmail: s.parentEmail
          };
          newBills.push(newBill);

          const salRef = doc(db, 'salaries', uniqueId);
          batch.set(salRef, newBill);
        }
      });

      if (newBills.length > 0) {
        await batch.commit();
        setSalaries(prev => [...prev, ...newBills]);
        setSalaryActionSuccess(`Successfully generated ${newBills.length} tutoring invoices for ${salaryMonth}.`);
      } else {
        setSalaryActionSuccess(`Salaries for ${salaryMonth} are already generated.`);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'salary_batch_invoice');
    }
  };

  // Toggle salary status paid vs pending
  const toggleSalaryStatus = async (sal: Salary) => {
    const updatedStatus: 'paid' | 'pending' = sal.status === 'paid' ? 'pending' : 'paid';
    const updatedPaidAt = updatedStatus === 'paid' ? new Date() : null;
    const updatedReceivedDate = updatedStatus === 'paid' ? new Date().toISOString().split('T')[0] : '';

    try {
      await setDoc(doc(db, 'salaries', sal.id), {
        ...sal,
        status: updatedStatus,
        paidAt: updatedPaidAt,
        receivedDate: updatedReceivedDate
      }, { merge: true });

      setSalaries(prev => prev.map(s => s.id === sal.id ? {
        ...s,
        status: updatedStatus,
        paidAt: updatedPaidAt,
        receivedDate: updatedReceivedDate
      } : s));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `salaries/${sal.id}`);
    }
  };

  const updateSalaryReceivedDate = async (sal: Salary, dateStr: string) => {
    try {
      await setDoc(doc(db, 'salaries', sal.id), {
        ...sal,
        receivedDate: dateStr
      }, { merge: true });

      setSalaries(prev => prev.map(s => s.id === sal.id ? {
        ...s,
        receivedDate: dateStr
      } : s));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `salaries/${sal.id}`);
    }
  };

  // Handle Profile Update
  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSuccess('');

    const profileData: TutorProfile = {
      tutorUid: user.uid,
      name: user.displayName,
      phone: profPhone.trim(),
      email: user.email,
      qualification: profQual.trim() || 'Not Specified',
      experience: profExp.trim() || 'Not Specified',
      subjects: profSubjects.split(',').map(s => s.trim()).filter(Boolean),
      bio: profBio.trim() || 'No bio specified.',
      updatedAt: new Date()
    };

    try {
      // Write profile to TutorProfiles collection
      await setDoc(doc(db, 'tutorProfiles', user.uid), {
        ...profileData,
        updatedAt: new Date()
      });
      setTutorProfile(profileData);
      setProfileSuccess('Tutor Profile updated successfully! Linked parents can immediately view this.');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `tutorProfiles/${user.uid}`);
    }
  };

  // Computing stats/reports for reports tab
  const getReportsData = () => {
    const records = attendances.filter(a => a.date.startsWith(salaryMonth));
    const totalAttendSessions = records.length;
    const presentSessions = records.filter(a => a.status === 'present').length;
    const absentSessions = records.filter(a => a.status === 'absent').length;
    const holidaySessions = records.filter(a => a.status === 'holiday').length;
    const tookOffSessions = records.filter(a => a.status === 'took_off').length;
    const gapCoveredSessions = records.filter(a => a.status === 'gap_covered').length;

    const totalTaken = presentSessions + gapCoveredSessions;
    const gapClasses = absentSessions + tookOffSessions;
    const coveredClasses = gapCoveredSessions;
    
    // Total income for current month
    const currentSalaries = salaries.filter(s => s.month === salaryMonth);
    const earnedIncome = currentSalaries.filter(s => s.status === 'paid').reduce((acc, curr) => acc + curr.amount, 0);
    const pendingIncome = currentSalaries.filter(s => s.status === 'pending').reduce((acc, curr) => acc + curr.amount, 0);

    return {
      totalAttendSessions,
      presentSessions,
      absentSessions,
      holidaySessions,
      tookOffSessions,
      gapCoveredSessions,
      totalTaken,
      gapClasses,
      coveredClasses,
      earnedIncome,
      pendingIncome,
      attendanceRate: totalAttendSessions > 0 ? Math.round(((presentSessions + gapCoveredSessions) / totalAttendSessions) * 100) : 100
    };
  };

  const reportsData = getReportsData();

  const handleExportReport = () => {
    const data = getReportsData();
    const activeSubjects = Array.from(new Set(students.flatMap(s => s.subjects || [])));
    
    let text = `==================================================\n`;
    text += `       TUTORCONNECT MONTHLY PERFORMANCE REPORT     \n`;
    text += `==================================================\n\n`;
    text += `Tutor Name: ${user.displayName || 'Authorized Tutor'}\n`;
    text += `Tutor Email: ${user.email}\n`;
    text += `Report Month: ${formatMonthName(salaryMonth)}\n`;
    text += `Generated At: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}\n\n`;
    
    text += `--------------------------------------------------\n`;
    text += `METRICS & PERFORMANCE INSIGHTS\n`;
    text += `--------------------------------------------------\n`;
    text += `Overall Attendance Rating  : ${data.attendanceRate}%\n`;
    text += `Total Logged Sessions      : ${data.totalAttendSessions}\n`;
    text += `Total Taken Classes        : ${data.totalTaken}\n`;
    text += `Total Gap Classes          : ${data.gapClasses}\n`;
    text += `Total Covered Classes      : ${data.coveredClasses}\n`;
    text += `Total Holiday Sessions     : ${data.holidaySessions}\n`;
    text += `Tuition Salaries Received  : ${data.earnedIncome} BDT\n`;
    text += `Tuition Salaries Pending   : ${data.pendingIncome} BDT\n`;
    text += `Active Subjects Covered    : ${activeSubjects.join(', ') || 'No Listed Subjects'}\n\n`;
    
    text += `--------------------------------------------------\n`;
    text += `STUDENT PERFORMANCE & BILLING PORTFOLIO\n`;
    text += `--------------------------------------------------\n`;
    
    if (students.length === 0) {
      text += `No registered students found on record for this report.\n`;
    } else {
      students.forEach((std) => {
        const studentAttendances = attendances.filter(a => a.studentId === std.id && a.date.startsWith(salaryMonth));
        const pC = studentAttendances.filter(a => a.status === 'present').length;
        const hC = studentAttendances.filter(a => a.status === 'holiday').length;
        const tC = studentAttendances.filter(a => a.status === 'took_off').length;
        const gC = studentAttendances.filter(a => a.status === 'gap_covered').length;
        const aC = studentAttendances.filter(a => a.status === 'absent').length;
        const invoice = salaries.find(sal => sal.studentId === std.id && sal.month === salaryMonth);
        
        text += `Student Name: ${std.name}\n`;
        text += `- Contact Details / Info : ${std.contactInfo || 'Not Set'}\n`;
        text += `- Class / Grade Level    : ${std.grade}\n`;
        text += `- Active Subjects        : ${std.subjects.join(', ') || 'No active subjects'}\n`;
        text += `- Home Session Address   : ${std.address}\n`;
        text += `- Attendance Breakdown   : Present: ${pC} | Gap/Absent: ${aC} | Student Took Off: ${tC} | Holiday: ${hC} | Covered Gap: ${gC} (Total: ${studentAttendances.length})\n`;
        text += `- Tally Fee Structure    : ${std.salaryAmount} BDT / month (${invoice?.status || 'no invoice generated'})\n`;
        text += `- Academic Progress Notes: ${std.progressNotes || 'No progress reports submitted for this student yet.'}\n`;
        text += `--------------------------------------------------\n`;
      });
    }
    
    text += `\n==================================================\n`;
    text += `          END OF TUTORS BOOK REPORT FILE          \n`;
    text += `==================================================\n`;

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `TutorReport_${salaryMonth}_${(user.displayName || 'Tutor').split(' ').join('_')}.txt`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-8rem)] gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
        <p className="text-sm font-medium text-gray-400 font-mono">Loading data...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-mixed-gradient font-sans relative">
      
      {/* Sidebar - Desktop */}
      <aside className="w-64 bg-slate-900 flex flex-col h-full shrink-0 z-30 hidden md:flex border-r border-slate-800">
        <div className="p-6 border-b border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-xl flex items-center justify-center font-bold text-white shadow-md shadow-indigo-500/20 transform hover:rotate-6 transition-transform">T</div>
            <span className="text-white font-display font-bold text-lg tracking-tight">Tutor's Book</span>
          </div>
        </div>
        
        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          <button
            onClick={() => setActiveTab('students')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-semibold cursor-pointer ${
              activeTab === 'students' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Student Database</span>
          </button>

          <button
            onClick={() => setActiveTab('attendance')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-semibold cursor-pointer ${
              activeTab === 'attendance' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
            }`}
          >
            <CheckSquare className="w-4 h-4" />
            <span>Class Attendance</span>
          </button>

          <button
            onClick={() => setActiveTab('salaries')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-semibold cursor-pointer ${
              activeTab === 'salaries' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            <span>Salary & Payments</span>
          </button>

          <button
            onClick={() => setActiveTab('reports')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-semibold cursor-pointer ${
              activeTab === 'reports' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Auditing Reports</span>
          </button>

          <button
            onClick={() => setActiveTab('profile')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-semibold cursor-pointer ${
              activeTab === 'profile' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
            }`}
          >
            <UserPen className="w-4 h-4" />
            <span>My Tutor Profile</span>
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
          <div className="grid grid-cols-2 gap-2 text-center text-xs">
            <button
              onClick={onSignOut}
              className="py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-350 hover:text-white rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer font-medium"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
            <button
              onClick={() => {
                setDeleteErrorMsg('');
                setShowDeleteModal(true);
              }}
              className="py-2.5 bg-slate-800 hover:bg-red-950/40 text-slate-350 hover:text-red-400 rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer font-medium"
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
            <div className="md:hidden flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-xl flex items-center justify-center font-bold text-white text-xs shadow-md">T</div>
              <span className="font-display font-black text-md tracking-tight text-slate-900">Tutor's Book</span>
            </div>
            
            <h1 className="hidden md:block text-lg font-display font-extrabold text-slate-900 tracking-tight capitalize">
              {activeTab === 'profile' ? 'My Tutor Profile Settings' : `${activeTab} Workspace`}
            </h1>
          </div>

          <div className="flex items-center gap-4">
            {/* Status Badge */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-slate-50 border border-slate-200 text-slate-600 rounded-lg text-[10px] font-bold uppercase tracking-wider">
              <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
              <span>Workspace Active</span>
            </div>
            
            {/* Mobile Sign Out Option */}
            <button
              onClick={onSignOut}
              className="md:hidden flex items-center gap-1 text-xs text-slate-500 font-medium bg-slate-100/80 px-2.5 py-1.5 rounded-lg border border-slate-200"
            >
              <LogOut className="w-3.5 h-3.5 text-slate-500" />
              <span>Sign Out</span>
            </button>
          </div>
        </header>

        {/* Floating Mobile Tabs (only on mobile) */}
        <div className="md:hidden bg-white border-b border-slate-200 px-4 py-2 flex items-center gap-1 rounded-xl mx-4 mt-4 overflow-x-auto shrink-0 scrollbar-none" id="tutor-mobile-tabs">
          {[
            { id: 'students', label: 'Students', icon: Users },
            { id: 'attendance', label: 'Attendance', icon: CheckSquare },
            { id: 'salaries', label: 'Salaries', icon: DollarSign },
            { id: 'reports', label: 'Reports', icon: TrendingUp },
            { id: 'profile', label: 'Profile', icon: UserPen },
          ].map(tab => {
            const IconComp = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg shrink-0 transition-colors cursor-pointer ${
                  activeTab === tab.id ? 'bg-indigo-650 text-white shadow-sm' : 'text-slate-500 hover:text-slate-900'
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
          {activeTab === 'students' && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in duration-300">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                <span className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Active Students</span>
                <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-mono mt-2">{students.length}</span>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                <span className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Averaged Tuition Rate</span>
                <span className="text-2xl sm:text-3xl font-extrabold text-indigo-600 font-mono mt-2">৳{students.length > 0 ? Math.round(students.reduce((acc, curr) => acc + curr.salaryAmount, 0) / students.length) : 0}</span>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                <span className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Marked Registers</span>
                <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-mono mt-2">{attendances.length}</span>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                <span className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Active Month</span>
                <span className="text-xl sm:text-2xl font-extrabold text-indigo-650 font-sans mt-2">{formatMonthName(salaryMonth)}</span>
              </div>
            </div>
          )}

          {activeTab === 'attendance' && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in duration-300">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                <span className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Submissions Logged</span>
                <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-mono mt-2">
                  {attendances.filter(a => a.date === attendanceDate).length}
                </span>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                <span className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Total History</span>
                <span className="text-2xl sm:text-3xl font-extrabold text-slate-950 font-mono mt-2">{attendances.length}</span>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                <span className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Active Student</span>
                <span className="text-2xl sm:text-3xl font-extrabold text-indigo-600 font-mono mt-2">{students.length}</span>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                <span className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Selected Date</span>
                <span className="text-md sm:text-lg font-extrabold text-indigo-650 font-mono mt-3 truncate">{attendanceDate}</span>
              </div>
            </div>
          )}

          {activeTab === 'salaries' && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in duration-300">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                <span className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Received Fee Items</span>
                <span className="text-2xl sm:text-3xl font-extrabold text-emerald-600 font-mono mt-2">
                  ৳{salaries.filter(s => s.month === salaryMonth && s.status === 'paid').reduce((a, b) => a + b.amount, 0)}
                </span>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                <span className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Pending Fee Items</span>
                <span className="text-2xl sm:text-3xl font-extrabold text-amber-500 font-mono mt-2">
                  ৳{salaries.filter(s => s.month === salaryMonth && s.status === 'pending').reduce((a, b) => a + b.amount, 0)}
                </span>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                <span className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Total Generated Dues</span>
                <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-mono mt-2">
                  {salaries.filter(s => s.month === salaryMonth).length}
                </span>
              </div>
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
                <span className="text-[10px] uppercase text-slate-400 font-bold tracking-wider">Billing Month</span>
                <span className="text-xl sm:text-2xl font-extrabold text-indigo-650 font-sans mt-2">{formatMonthName(salaryMonth)}</span>
              </div>
            </div>
          )}

          {/* RENDER ACTIVE TAB */}
          <div className="space-y-6">

        {/* STUDENTS MANAGEMENT TAB */}
        {activeTab === 'students' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            
            {/* REGISTER NEW STUDENT CARD */}
            <div className="lg:col-span-1 bg-white rounded-2xl p-6 border border-gray-150 shadow-sm space-y-5">
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-600" />
                <span>Register a Student</span>
              </h2>

              <form onSubmit={handleAddStudent} className="space-y-4" id="add-student-form">
                <div>
                  <label htmlFor="student-name" className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Student Name *</label>
                  <input
                    id="student-name"
                    type="text"
                    required
                    placeholder="e.g. Rafsan Jamil"
                    value={studName}
                    onChange={(e) => setStudName(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-250 focus:border-indigo-500 focus:bg-white text-sm rounded-lg outline-none transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="student-grade" className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Grade / Class</label>
                    <input
                      id="student-grade"
                      type="text"
                      placeholder="e.g. Class 8"
                      value={studGrade}
                      onChange={(e) => setStudGrade(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-255 focus:border-indigo-500 focus:bg-white text-sm rounded-lg outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label htmlFor="salary-amount" className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Monthly Tuition *</label>
                    <input
                      id="salary-amount"
                      type="number"
                      required
                      placeholder="e.g. 150"
                      value={studSalary}
                      onChange={(e) => setStudSalary(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-255 focus:border-indigo-500 focus:bg-white text-sm rounded-lg outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label htmlFor="parent-email" className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Parent Email *</label>
                    <input
                      id="parent-email"
                      type="email"
                      required
                      placeholder="e.g. parent@mail.com"
                      value={studParentEmail}
                      onChange={(e) => setStudParentEmail(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-255 focus:border-indigo-500 focus:bg-white text-sm rounded-lg outline-none transition-all"
                    />
                  </div>
                </div>

                <div>
                  <span className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Weekly Tutoring Days</span>
                  <div className="flex flex-wrap gap-1.5">
                    {['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map(day => {
                      const isSelected = studTutoringDays.includes(day);
                      return (
                        <button
                          type="button"
                          key={day}
                          onClick={() => {
                            if (isSelected) {
                              setStudTutoringDays(prev => prev.filter(d => d !== day));
                            } else {
                              setStudTutoringDays(prev => [...prev, day]);
                            }
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                            isSelected
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label htmlFor="student-subjects" className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Subjects (comma-separated)</label>
                  <input
                    id="student-subjects"
                    type="text"
                    placeholder="e.g. Mathematics, Physics"
                    value={studSubjects}
                    onChange={(e) => setStudSubjects(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-255 focus:border-indigo-500 focus:bg-white text-sm rounded-lg outline-none transition-all"
                  />
                </div>

                <div>
                  <label htmlFor="student-address" className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Tuition Home Address</label>
                  <textarea
                    id="student-address"
                    rows={2}
                    placeholder="e.g. 54 Road, Dhaka, Bangladesh"
                    value={studAddress}
                    onChange={(e) => setStudAddress(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-255 focus:border-indigo-500 focus:bg-white text-sm rounded-lg outline-none transition-all resize-none"
                  ></textarea>
                </div>

                <div>
                  <label htmlFor="student-contact" className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Student / Parent Contact Phone</label>
                  <input
                    id="student-contact"
                    type="text"
                    placeholder="e.g. +1 (555) 0192-384"
                    value={studContactInfo}
                    onChange={(e) => setStudContactInfo(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-255 focus:border-indigo-500 focus:bg-white text-sm rounded-lg outline-none transition-all"
                  />
                </div>

                <div>
                  <label htmlFor="student-progress" className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Initial Academic Progress Notes</label>
                  <textarea
                    id="student-progress"
                    rows={2}
                    placeholder="e.g. Solid algebraic base. Needs to practice geometry proofs."
                    value={studProgressNotes}
                    onChange={(e) => setStudProgressNotes(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-255 focus:border-indigo-500 focus:bg-white text-sm rounded-lg outline-none transition-all resize-none"
                  ></textarea>
                </div>

                {studentError && (
                  <div className="p-3 bg-red-50 text-red-700 text-xs font-medium rounded-lg border border-red-100 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                    <span>{studentError}</span>
                  </div>
                )}

                {studentSuccess && (
                  <div className="p-3 bg-emerald-50 text-emerald-700 text-xs font-medium rounded-lg border border-emerald-100 flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <span>{studentSuccess}</span>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer text-center"
                >
                  Register Student Account
                </button>
              </form>
            </div>

            {/* REGISTERED STUDENTS LIST */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-gray-900">Your Appointed Students ({students.length})</h2>
                <div className="text-[10px] font-mono text-gray-400">ROLE LINK REQUIREMENT: Parents must log in using emails set below</div>
              </div>

              {students.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-150 p-12 text-center text-gray-400 space-y-2">
                  <p className="font-medium">No students registered yet.</p>
                  <p className="text-xs">Use the side form to add your first student and begin tracking attendance.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {students.map(std => (
                    <div key={std.id} className="bg-white rounded-xl p-5 border border-gray-200 hover:border-indigo-200 transition-colors flex flex-col justify-between shadow-sm relative overflow-hidden group">
                      
                      {/* Card layout */}
                      <div className="space-y-3.5">
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="text-xs font-mono text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full font-bold">{std.grade}</span>
                            <h3 className="text-md font-bold text-slate-900 mt-2">{std.name}</h3>
                          </div>
                          
                          <button
                            onClick={() => handleDeleteStudent(std.id)}
                            className="text-gray-300 hover:text-red-500 transition-colors p-1"
                            title="Delete Student Record"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Visual subject tags */}
                        {std.subjects.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {std.subjects.map((sub, idx) => (
                              <span key={idx} className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-gray-100 text-gray-600 border border-gray-150">{sub}</span>
                            ))}
                          </div>
                        )}

                        <div className="border-t border-gray-100 pt-3 space-y-2">
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <Mail className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                            <span className="font-medium select-all">{std.parentEmail}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                            <span className="truncate">{std.address}</span>
                          </div>
                        </div>
                      </div>

                      {/* Tuition dues detail */}
                      <div className="mt-4 pt-3.5 border-t border-slate-50 flex items-center justify-between text-xs font-medium">
                        <div className="text-gray-500">
                          Days: <strong className="text-indigo-605 font-medium">{std.tutoringDays?.join(', ') || 'N/A'}</strong>
                        </div>
                        <div className="text-right">
                          <span className="text-gray-400 font-normal">Salary: </span>
                          <strong className="text-indigo-600 text-sm font-bold">৳{std.salaryAmount}</strong>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleOpenStudentDetail(std)}
                        className="mt-3 w-full py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-indigo-600 hover:border-indigo-200 font-semibold rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-slate-200"
                        title="View Attendance logs, Payment receipts and edit student progress"
                      >
                        <UserPen className="w-3.5 h-3.5" />
                        <span>Manage Profile & Details</span>
                      </button>

                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

        {/* ATTENDANCE TAB */}
        {activeTab === 'attendance' && (
          <div className="bg-white rounded-2xl p-6 border border-gray-150 shadow-sm space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-md font-bold text-gray-900">Take Class Attendance</h2>
                <p className="text-xs text-gray-500 mt-0.5">Select a date, mark students accordingly, and click save to sync attendance instantly with parents.</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-600">Session Date:</span>
                <input
                  type="date"
                  value={attendanceDate}
                  onChange={(e) => setAttendanceDate(e.target.value)}
                  className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {students.length === 0 ? (
              <div className="text-center p-12 text-gray-400 font-medium border border-dashed border-gray-200 rounded-xl">
                Please register students first under the 'Students' tab.
              </div>
            ) : (
              <form onSubmit={handleSubmitAttendance} className="space-y-6" id="attendance-log-form">
                <div className="overflow-x-auto border border-gray-150 rounded-xl">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50/50">
                      <tr>
                        <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Student Name</th>
                        <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Class / Grade</th>
                        <th className="px-6 py-3.5 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Status Status</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-150">
                      {students.map(std => {
                        const currentStatus = attendanceStatusMap[std.id] || 'present';
                        return (
                          <tr key={std.id} className="hover:bg-slate-50/40">
                            <td className="px-6 py-4 whitespace-nowrap font-bold text-gray-900">{std.name}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500">{std.grade}</td>
                            <td className="px-6 py-4 text-center">
                              <div className="flex flex-col items-center gap-2">
                                <div className="inline-flex flex-wrap rounded-lg border border-gray-205 bg-gray-50 p-1 gap-1 justify-center">
                                  
                                  <button
                                    type="button"
                                    onClick={() => setAttendanceStatusMap(prev => ({ ...prev, [std.id]: 'present' }))}
                                    className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-all ${
                                      currentStatus === 'present'
                                        ? 'bg-emerald-600 text-white shadow-sm'
                                        : 'text-gray-505 hover:bg-gray-100'
                                    }`}
                                  >
                                    Present
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => setAttendanceStatusMap(prev => ({ ...prev, [std.id]: 'absent' }))}
                                    className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-all ${
                                      currentStatus === 'absent'
                                        ? 'bg-red-600 text-white shadow-sm'
                                        : 'text-gray-505 hover:bg-gray-100'
                                    }`}
                                  >
                                    Absent
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => setAttendanceStatusMap(prev => ({ ...prev, [std.id]: 'holiday' }))}
                                    className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-all ${
                                      currentStatus === 'holiday'
                                        ? 'bg-sky-500 text-white shadow-sm'
                                        : 'text-gray-505 hover:bg-gray-100'
                                    }`}
                                  >
                                    Holiday
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => setAttendanceStatusMap(prev => ({ ...prev, [std.id]: 'took_off' }))}
                                    className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-all ${
                                      currentStatus === 'took_off'
                                        ? 'bg-amber-500 text-white shadow-sm'
                                        : 'text-gray-505 hover:bg-gray-100'
                                    }`}
                                  >
                                    Took Off
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => setAttendanceStatusMap(prev => ({ ...prev, [std.id]: 'gap_covered' }))}
                                    className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-all ${
                                      currentStatus === 'gap_covered'
                                        ? 'bg-indigo-600 text-white shadow-sm'
                                        : 'text-gray-505 hover:bg-gray-100'
                                    }`}
                                  >
                                    Gap Covered
                                  </button>

                                </div>

                                {/* Custom Gap Covered Absent Date selection */}
                                {currentStatus === 'gap_covered' && (() => {
                                  const pastAbsentDates = Array.from(new Set(
                                    attendances
                                      .filter(a => a.studentId === std.id && (a.status === 'absent' || a.status === 'took_off'))
                                      .map(a => a.date)
                                      .sort((a, b) => b.localeCompare(a)) // show newest first
                                  ));
                                  const selectedGapDate = attendanceGapDateMap[std.id] || '';

                                  return (
                                    <div className="flex flex-col sm:flex-row items-center gap-2 mt-1 animate-in slide-in-from-top-1 duration-200">
                                      <span className="text-[11px] font-bold text-indigo-650">Which date was absent?</span>
                                      {pastAbsentDates.length > 0 ? (
                                        <select
                                          value={selectedGapDate}
                                          onChange={(e) => {
                                            const val = e.target.value;
                                            setAttendanceGapDateMap(prev => ({ ...prev, [std.id]: val }));
                                          }}
                                          className="px-2 py-1 bg-white border border-gray-250 rounded-md text-[11px] font-medium outline-none"
                                        >
                                          <option value="">-- Choose past absent date --</option>
                                          {pastAbsentDates.map(dStr => (
                                            <option key={dStr} value={dStr}>{dStr}</option>
                                          ))}
                                          <option value="custom">-- Custom Other Date --</option>
                                        </select>
                                      ) : null}

                                      {(pastAbsentDates.length === 0 || selectedGapDate === 'custom' || !pastAbsentDates.includes(selectedGapDate)) && (
                                        <input
                                          type="date"
                                          value={selectedGapDate === 'custom' ? '' : selectedGapDate}
                                          onChange={(e) => {
                                            const val = e.target.value;
                                            setAttendanceGapDateMap(prev => ({ ...prev, [std.id]: val }));
                                          }}
                                          className="px-2 py-1 bg-white border border-gray-250 rounded-md text-[11px] font-medium outline-none"
                                        />
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {attendanceSuccess && (
                  <div className="p-3 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-xl border border-emerald-100 flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-500" />
                    <span>{attendanceSuccess}</span>
                  </div>
                )}

                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer text-center"
                  >
                    Save Attendance Records
                  </button>
                </div>
              </form>
            )}

            {/* GITHUB CONTRIBUTION GRIDS */}
            {students.length > 0 && (
              <div className="mt-8 pt-6 border-t border-slate-100 space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5 flex-wrap">
                    <span>Class Attendance Insights & Activity</span>
                    <span className="text-[10px] uppercase font-bold text-indigo-700 bg-indigo-50 border border-indigo-150 rounded px-1.5 py-0.5 tracking-wider">GitHub Style</span>
                  </h3>
                  <p className="text-xs text-gray-400 mt-1">Status commitment heatmaps mapped for each active student.</p>
                </div>

                <div className="grid grid-cols-1 gap-6">
                  {students.map(std => {
                    const studentLogs = attendances.filter(a => a.studentId === std.id);
                    
                    const presentCount = studentLogs.filter(a => a.status === 'present').length;
                    const absentCount = studentLogs.filter(a => a.status === 'absent').length;
                    const tookOffCount = studentLogs.filter(a => a.status === 'took_off').length;
                    const holidayCount = studentLogs.filter(a => a.status === 'holiday').length;
                    const gapCoveredCount = studentLogs.filter(a => a.status === 'gap_covered').length;

                    const totalTaken = presentCount + gapCoveredCount;
                    const gapClasses = absentCount + tookOffCount;
                    const coveredClasses = gapCoveredCount;

                    // Generate rolling 12 weeks (84 days) grid
                    const daysToRender: { date: string; status?: string }[] = [];
                    for (let i = 83; i >= 0; i--) {
                      const d = new Date();
                      d.setDate(d.getDate() - i);
                      const dateStr = d.toISOString().split('T')[0];
                      const attRecord = attendances.find(a => a.studentId === std.id && a.date === dateStr);
                      daysToRender.push({
                        date: dateStr,
                        status: attRecord?.status
                      });
                    }

                    return (
                      <div key={std.id} className="p-5 border border-slate-200 bg-slate-50/50 rounded-2xl flex flex-col xl:flex-row xl:items-center justify-between gap-6">
                        <div className="shrink-0 space-y-2">
                          <div>
                            <span className="text-[11px] font-bold text-indigo-650 tracking-wider uppercase mb-0.5 block">{std.grade}</span>
                            <h4 className="font-extrabold text-sm text-slate-900">{std.name}</h4>
                          </div>

                          {/* Stat summary cards */}
                          <div className="grid grid-cols-3 gap-2">
                            <div className="px-2.5 py-1.5 bg-emerald-50 text-emerald-850 rounded-lg border border-emerald-100">
                              <span className="block text-[8px] uppercase tracking-wider font-extrabold text-emerald-500">Taken</span>
                              <span className="text-xs font-extrabold font-mono">{totalTaken}</span>
                            </div>
                            <div className="px-2.5 py-1.5 bg-rose-50 text-rose-800 rounded-lg border border-rose-100">
                              <span className="block text-[8px] uppercase tracking-wider font-extrabold text-rose-400">Gaps</span>
                              <span className="text-xs font-extrabold font-mono">{gapClasses}</span>
                            </div>
                            <div className="px-2.5 py-1.5 bg-indigo-50 text-indigo-850 rounded-lg border border-indigo-150">
                              <span className="block text-[8px] uppercase tracking-wider font-extrabold text-indigo-400">Covered</span>
                              <span className="text-xs font-extrabold font-mono">{coveredClasses}</span>
                            </div>
                          </div>
                        </div>

                        {/* GitHub Contribution Grid Box */}
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-end mb-1 text-[9px] text-slate-400 gap-2 select-none">
                            <span>Less</span>
                            <span className="w-2.5 h-2.5 rounded-sm bg-gray-200 border border-gray-300"></span>
                            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" title="Present (Taken)"></span>
                            <span className="w-2.5 h-2.5 rounded-sm bg-indigo-605" title="Covered Gap"></span>
                            <span className="w-2.5 h-2.5 rounded-sm bg-rose-500" title="Absent (Gap)"></span>
                            <span className="w-2.5 h-2.5 rounded-sm bg-amber-400" title="Took Off"></span>
                            <span className="w-2.5 h-2.5 rounded-sm bg-sky-400" title="Holiday"></span>
                            <span>More</span>
                          </div>

                          <div className="border border-slate-200 rounded-xl p-3 bg-white">
                            {/* SVG-free layout using standard columns of week buckets */}
                            <div className="grid grid-flow-col grid-rows-7 gap-1 overflow-x-auto select-none scrollbar-thin">
                              {daysToRender.map((day, idx) => {
                                let bgClass = 'bg-gray-100 border-gray-200/40';
                                if (day.status === 'present') bgClass = 'bg-emerald-500 border-emerald-600 scale-100';
                                if (day.status === 'gap_covered') bgClass = 'bg-indigo-650 border-indigo-700 scale-100';
                                if (day.status === 'absent') bgClass = 'bg-rose-500 border-rose-600 scale-100';
                                if (day.status === 'took_off') bgClass = 'bg-amber-400 border-amber-500 scale-100';
                                if (day.status === 'holiday') bgClass = 'bg-sky-400 border-sky-500 scale-100';

                                return (
                                  <div
                                    key={idx}
                                    title={`${day.date}: ${day.status ? day.status.toUpperCase() : 'No session logged'}`}
                                    className={`w-2 h-2 rounded-[1.5px] border ${bgClass} hover:scale-125 transition-transform duration-100 cursor-pointer`}
                                  />
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ATTENDANCE RECORDS MANAGEMENT & ACTIONS LIST */}
            {students.length > 0 && (
              <div className="mt-8 pt-6 border-t border-slate-100 space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Registered Logs History</h3>
                  <p className="text-xs text-gray-400 mt-1 font-sans">Syncs automatically. Edit or delete logged entries safely.</p>
                </div>

                {attendances.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-4">No historical logs registered inside database yet.</p>
                ) : (
                  <div className="overflow-x-auto border border-gray-200 rounded-xl">
                    <table className="min-w-full divide-y divide-gray-250 text-sm">
                      <thead className="bg-gray-50/50">
                        <tr>
                          <th className="px-6 py-2.5 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Date</th>
                          <th className="px-6 py-2.5 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Student Name</th>
                          <th className="px-6 py-2.5 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Status Status</th>
                          <th className="px-6 py-2.5 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Metadata / Absent Date</th>
                          <th className="px-6 py-2.5 text-center text-[11px] font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-150">
                        {attendances
                          .sort((a, b) => b.date.localeCompare(a.date)) // Newest first
                          .slice(0, 30) // Show last 30 entries
                          .map(att => {
                            const relatedStudent = students.find(s => s.id === att.studentId);
                            return (
                              <tr key={att.id} className="hover:bg-slate-50/40 text-xs text-slate-600">
                                <td className="px-6 py-3 whitespace-nowrap font-mono font-medium text-slate-700">{att.date}</td>
                                <td className="px-6 py-3 whitespace-nowrap font-bold text-slate-900">{relatedStudent?.name || `ID: ${att.studentId}`}</td>
                                <td className="px-6 py-3 whitespace-nowrap">
                                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                                    att.status === 'present' ? 'bg-emerald-50 text-emerald-805 border-emerald-150' :
                                    att.status === 'absent' ? 'bg-rose-50 text-rose-800 border-rose-150' :
                                    att.status === 'holiday' ? 'bg-indigo-50 text-indigo-800 border-indigo-150' :
                                    att.status === 'took_off' ? 'bg-amber-50 text-amber-800 border-amber-150' :
                                    'bg-indigo-50 text-indigo-805 border-indigo-150'
                                  }`}>
                                    {att.status === 'took_off' ? 'Took Off' : att.status === 'gap_covered' ? 'Gap Covered' : att.status}
                                  </span>
                                </td>
                                <td className="px-6 py-3 whitespace-nowrap text-slate-500">
                                  {att.status === 'gap_covered' ? (
                                    <span className="text-[11px]">Covered absent day: <strong className="font-mono text-indigo-700 font-bold bg-indigo-50 px-1.5 py-0.5 rounded">{att.gapCoveredDate || 'Not specified'}</strong></span>
                                  ) : (
                                    <span>-</span>
                                  )}
                                </td>
                                <td className="px-6 py-3 whitespace-nowrap text-center">
                                  <div className="flex items-center justify-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleStartEditAttendance(att)}
                                      className="px-2.5 py-1 text-[11px] hover:bg-slate-50 text-slate-600 hover:text-indigo-650 font-bold rounded-lg border border-slate-200 cursor-pointer shadow-sm"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteAttendance(att.id)}
                                      className="px-2.5 py-1 text-[11px] hover:bg-red-50 text-red-500 hover:text-red-700 font-bold rounded-lg border border-red-100 hover:border-red-200 cursor-pointer shadow-sm"
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                )}
                {attendances.length > 30 && (
                  <p className="text-[10px] text-slate-400 text-center font-mono select-none pt-2">Showing newest 30 log records. All entries sync back live with parents instantly.</p>
                )}
              </div>
            )}

            {/* SEPARATE OPTION FOR VIEWING EACH STUDENT FULL MONTH ATTENDANCE */}
            {students.length > 0 && (
              <div className="mt-8 pt-6 border-t border-slate-100 space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Student Monthly Attendance Analyzer</h3>
                  <p className="text-xs text-gray-400 mt-1 font-sans">Select any student and month to calculate exact attendance percentages and view full daily sheets.</p>
                </div>

                <div className="bg-slate-50 border border-slate-205 rounded-xl p-4 space-y-4">
                  <div className="flex flex-wrap gap-3 items-center">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Select Student</span>
                      <select
                        value={focusStudentId || (students[0]?.id || '')}
                        onChange={(e) => setFocusStudentId(e.target.value)}
                        className="px-3 py-1.5 bg-white border border-gray-250 rounded-lg text-xs font-semibold outline-none focus:border-indigo-500"
                      >
                        <option value="">-- Choose Student --</option>
                        {students.map(std => (
                          <option key={std.id} value={std.id}>{std.name} ({std.grade})</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Select Month</span>
                      <input
                        type="month"
                        value={focusMonth}
                        onChange={(e) => setFocusMonth(e.target.value)}
                        className="px-3 py-1.5 bg-white border border-gray-255 rounded-lg text-xs font-semibold outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  {(() => {
                    const activeStdId = focusStudentId || students[0]?.id;
                    if (!activeStdId) return null;

                    const activeStudentObj = students.find(s => s.id === activeStdId);

                    // Filter logs for this student and this month
                    const monthLogs = attendances.filter(a => {
                      return a.studentId === activeStdId && a.date.startsWith(focusMonth);
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
                      : 100; // Default to 100% or show '-' if no core days were scheduled

                    return (
                      <div className="bg-white border border-slate-150/80 rounded-xl p-4 mt-2 space-y-4">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-3">
                          <div>
                            <h4 className="text-sm font-bold text-slate-800">{activeStudentObj?.name}'s Full Month Statistics</h4>
                            <p className="text-[11px] text-slate-400 mt-0.5 font-sans">Summary data computed for {formatMonthName(focusMonth)}.</p>
                          </div>
                          <div className="bg-indigo-50 border border-indigo-150/60 rounded-xl px-4 py-2 text-center">
                            <span className="block text-[9px] uppercase font-bold tracking-wider text-indigo-505">Attendance Percentage</span>
                            <span className="text-xl font-black text-indigo-750 font-mono">
                              {monthLogs.length === 0 ? '—' : `${attendancePercentage}%`}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
                          <div className="p-2 bg-emerald-50 rounded-lg border border-emerald-100/60">
                            <span className="block text-[8px] uppercase tracking-wider font-extrabold text-emerald-555">Presences (Taken)</span>
                            <span className="text-xs font-mono font-extrabold text-emerald-800">{presents}</span>
                          </div>
                          <div className="p-2 bg-indigo-50 rounded-lg border border-indigo-100/60">
                            <span className="block text-[8px] uppercase tracking-wider font-extrabold text-indigo-555">Gaps Covered</span>
                            <span className="text-xs font-mono font-extrabold text-indigo-800">{gapCovereds}</span>
                          </div>
                          <div className="p-2 bg-rose-50 rounded-lg border border-rose-100/60">
                            <span className="block text-[8px] uppercase tracking-wider font-extrabold text-rose-555">Absents (Gaps)</span>
                            <span className="text-xs font-mono font-extrabold text-rose-800">{gaps}</span>
                          </div>
                          <div className="p-2 bg-amber-50 rounded-lg border border-amber-100/60">
                            <span className="block text-[8px] uppercase tracking-wider font-extrabold text-amber-555">Took Off</span>
                            <span className="text-xs font-mono font-extrabold text-amber-800">{tookOffs}</span>
                          </div>
                          <div className="p-2 bg-sky-50 rounded-lg border border-sky-100/60">
                            <span className="block text-[8px] uppercase tracking-wider font-extrabold text-sky-555">Holidays</span>
                            <span className="text-xs font-mono font-extrabold text-sky-800">{holidays}</span>
                          </div>
                        </div>

                        {monthLogs.length === 0 ? (
                          <div className="bg-slate-50 text-slate-450 text-xs italic p-6 rounded-lg text-center border border-dashed border-slate-20s">
                            No attendance logs are registered for this student in {formatMonthName(focusMonth)}. Take attendance above first.
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
                                      <td className="px-4 py-2 font-mono font-medium text-slate-705">{log.date}</td>
                                      <td className="px-4 py-2">
                                        <span className={`inline-flex px-2 py-0.5 rounded text-[9px] uppercase font-bold tracking-wider border ${
                                          log.status === 'present' ? 'bg-emerald-50 text-emerald-800 border-emerald-100' :
                                          log.status === 'absent' ? 'bg-rose-50 text-rose-800 border-rose-105' :
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

        {/* SALARIES TAB */}
        {activeTab === 'salaries' && (
          <div className="bg-white rounded-2xl p-6 border border-gray-150 shadow-sm space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-md font-bold text-gray-900">Manage Tuition salaries & Billing Logs</h2>
                <p className="text-xs text-gray-500 mt-0.5">Click "Generate Invoices" to instantiate due salary items for the selected month.</p>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="month"
                  value={salaryMonth}
                  onChange={(e) => setSalaryMonth(e.target.value)}
                  className="px-3 py-1.5 bg-gray-50 border border-gray-250 rounded-lg text-xs font-bold outline-none"
                />
                <button
                  type="button"
                  onClick={handleGenerateInvoice}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                  id="btn-generate-invoices"
                >
                  Generate Invoices
                </button>
              </div>
            </div>

            {salaryActionSuccess && (
              <div className="p-3 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-xl border border-indigo-100 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-500" />
                <span>{salaryActionSuccess}</span>
              </div>
            )}

            {salaries.filter(s => s.month === salaryMonth).length === 0 ? (
              <div className="text-center p-12 text-gray-400 font-medium border border-dashed border-gray-200 rounded-xl">
                No invoices logged for {formatMonthName(salaryMonth)}. Click "Generate Invoices" above to instantiate them based on your students rates.
              </div>
            ) : (
              <div className="border border-gray-150 rounded-xl overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50/50">
                    <tr>
                      <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Student</th>
                      <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider font-sans">Month</th>
                      <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Amount</th>
                      <th className="px-6 py-3.5 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Paid Status</th>
                      <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Received On</th>
                      <th className="px-6 py-3.5 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Mark Payment</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-150">
                    {salaries.filter(s => s.month === salaryMonth).map(sal => {
                      const associatedStudent = students.find(st => st.id === sal.studentId);
                      return (
                        <tr key={sal.id} className="hover:bg-slate-50/40">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="font-bold text-slate-800 block">{associatedStudent?.name || 'Deleted Student'}</span>
                            <span className="text-[10px] text-gray-400 font-mono italic block leading-none mt-1">{sal.parentEmail}</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap font-sans text-xs">{formatMonthName(sal.month)}</td>
                          <td className="px-6 py-4 whitespace-nowrap font-bold text-slate-900">৳{sal.amount}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider ${
                              sal.status === 'paid'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                : 'bg-rose-50 text-rose-750 border border-rose-100'
                            }`}>
                              {sal.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-left text-xs">
                            {sal.status === 'paid' ? (
                              <input
                                type="date"
                                value={sal.receivedDate || ''}
                                onChange={(e) => updateSalaryReceivedDate(sal, e.target.value)}
                                className="px-2 py-1 bg-gray-55 border border-gray-200 rounded text-xs outline-none focus:border-indigo-500 focus:bg-white text-slate-800 font-medium"
                                title="Define exactly when salary was received"
                              />
                            ) : (
                              <span className="text-gray-400 italic">—</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <button
                              type="button"
                              onClick={() => toggleSalaryStatus(sal)}
                              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap hover:bg-opacity-90 ${
                                sal.status === 'paid'
                                  ? 'bg-rose-500 text-white'
                                  : 'bg-emerald-600 text-white'
                              }`}
                            >
                              {sal.status === 'paid' ? 'Mark Pending' : 'Mark Paid'}
                            </button>
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

        {/* REPORTS & MONTHLY AUDITING TAB */}
        {activeTab === 'reports' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="bg-gradient-to-r from-indigo-700 to-violet-800 rounded-2xl p-6 text-white shadow-lg space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1">
                  <h2 className="text-lg font-bold">Monthly Report Generation Portal</h2>
                  <p className="text-xs text-indigo-100">Select a month to preview overall tutor class attendance averages, billing tallies, and performance insights.</p>
                </div>
                <input
                  type="month"
                  value={salaryMonth}
                  onChange={(e) => setSalaryMonth(e.target.value)}
                  className="px-3 py-1.5 bg-indigo-800 text-white border border-indigo-500 rounded-lg text-xs font-bold outline-none cursor-pointer focus:ring-1 focus:ring-indigo-300"
                />
              </div>

              {/* STATS DECK */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
                <div className="bg-white/10 rounded-xl p-4 border border-white/5">
                  <span className="block text-[10px] text-indigo-200 uppercase font-mono tracking-wider font-bold">Scheduled Month</span>
                  <span className="block text-[15px] sm:text-[17px] font-bold mt-1 text-slate-100 font-sans">{formatMonthName(salaryMonth)}</span>
                </div>
                <div className="bg-white/10 rounded-xl p-4 border border-white/5">
                  <span className="block text-[10px] text-indigo-200 uppercase font-mono tracking-wider font-bold">Averaged Attendance</span>
                  <span className="block text-xl font-bold font-mono mt-1">{reportsData.attendanceRate}%</span>
                </div>
                <div className="bg-white/10 rounded-xl p-4 border border-white/5">
                  <span className="block text-[10px] text-indigo-200 uppercase font-mono tracking-wider font-bold">fees Received</span>
                  <span className="block text-xl font-bold font-mono mt-1 text-emerald-200">৳{reportsData.earnedIncome}</span>
                </div>
                <div className="bg-white/10 rounded-xl p-4 border border-white/5">
                  <span className="block text-[10px] text-indigo-200 uppercase font-mono tracking-wider font-bold">outstanding fees</span>
                  <span className="block text-xl font-bold font-mono mt-1 text-red-100">৳{reportsData.pendingIncome}</span>
                </div>
              </div>
            </div>

            {/* MONTHLY WRITTEN REPORT CARD FORMAT */}
            <div className="bg-white rounded-2xl p-8 border border-gray-150 shadow-sm space-y-8" id="printable-monthly-report">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-gray-150 pb-5 gap-4">
                <div>
                  <h3 className="text-lg font-bold font-sans text-gray-950">Home Tutoring Monthly Audit Report</h3>
                  <p className="text-xs font-mono text-gray-400 mt-1 uppercase tracking-widest">SYSTEM VERIFICATION ID: REP-{user.uid.slice(0, 5).toUpperCase()}-{salaryMonth}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleExportReport}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-md hover:shadow-emerald-200 flex items-center gap-1.5"
                    title="Download offline report file as text representation"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export Report (.TXT)</span>
                  </button>
                  <FileSpreadsheet className="w-8 h-8 text-indigo-400/70 hidden sm:block" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
                <div>
                  <h4 className="font-bold text-gray-800 uppercase text-xs tracking-wider mb-2 font-mono">Tutor Profile Information</h4>
                  <p className="text-gray-950 font-bold">{user.displayName}</p>
                  <p className="text-gray-500 text-xs mt-1">{user.email}</p>
                  {tutorProfile && (
                    <div className="text-xs text-slate-500 mt-2 space-y-1">
                      <p>Phone: {tutorProfile.phone}</p>
                      <p>Qualification: {tutorProfile.qualification}</p>
                    </div>
                  )}
                </div>
                <div>
                  <h4 className="font-bold text-gray-800 uppercase text-xs tracking-wider mb-2 font-mono">Report Highlights</h4>
                  <ul className="space-y-1.5 text-xs text-slate-500 font-sans">
                    <li>Total Logged Sessions (marked): <strong className="text-slate-805 font-mono">{reportsData.totalAttendSessions}</strong></li>
                    <li>Total Taken Classes: <strong className="text-emerald-600 font-mono">{reportsData.totalTaken}</strong></li>
                    <li>Total Gap Days (Absent/Took Off): <strong className="text-rose-500 font-mono">{reportsData.gapClasses}</strong></li>
                    <li>Total Covered Gap Classes: <strong className="text-indigo-650 font-mono">{reportsData.coveredClasses}</strong></li>
                    <li>Earning Completion Status: <strong className="text-indigo-600 font-mono">{Math.round((reportsData.earnedIncome / (reportsData.earnedIncome + reportsData.pendingIncome || 1)) * 105 || 0) > 100 ? 100 : Math.round((reportsData.earnedIncome / (reportsData.earnedIncome + reportsData.pendingIncome || 1)) * 100)}%</strong></li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-bold text-gray-800 uppercase text-xs tracking-wider mb-2 font-mono">Active Subjects Covered</h4>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {(() => {
                      const activeSubjects = Array.from(new Set(students.flatMap(s => s.subjects || [])));
                      if (activeSubjects.length === 0) {
                        return <span className="text-xs text-gray-400 italic">No subjects listed yet</span>;
                      }
                      return activeSubjects.map((sub, idx) => (
                        <span key={idx} className="text-[9px] uppercase tracking-wider font-extrabold px-2 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-750 rounded">
                          {sub}
                        </span>
                      ));
                    })()}
                  </div>
                </div>
              </div>

              {/* INDIVIDUAL STUDENTS STATEMENT */}
              <div className="space-y-3">
                <h4 className="font-extrabold text-gray-800 text-xs tracking-wider font-mono uppercase">Student Billing & Attendance Breakdown</h4>
                
                {students.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">No assigned students logged.</p>
                ) : (
                  <div className="border border-gray-150 rounded-xl overflow-hidden divide-y divide-gray-150 shadow-sm bg-white">
                    {students.map(std => {
                      const studentAttendances = attendances.filter(a => a.studentId === std.id && a.date.startsWith(salaryMonth));
                      const totalC = studentAttendances.length;
                      const presentC = studentAttendances.filter(a => a.status === 'present').length;
                      const absentC = studentAttendances.filter(a => a.status === 'absent').length;
                      const holidayC = studentAttendances.filter(a => a.status === 'holiday').length;
                      const tookOffC = studentAttendances.filter(a => a.status === 'took_off').length;
                      const gapCoveredC = studentAttendances.filter(a => a.status === 'gap_covered').length;

                      const takenC = presentC + gapCoveredC;
                      const gapsC = absentC + tookOffC;
                      const coveredC = gapCoveredC;
                      
                      const invoice = salaries.find(sal => sal.studentId === std.id && sal.month === salaryMonth);

                      return (
                        <div key={std.id} className="p-5 hover:bg-slate-50/50 transition-colors flex flex-col gap-3.5 text-xs">
                          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-2.5">
                            <div>
                              <span className="font-bold text-slate-950 text-sm block">{std.name}</span>
                              <span className="text-gray-400 font-mono text-[10px] mt-0.5 block">PARENT: {std.parentEmail}</span>
                            </div>
                            
                            <div className="flex gap-4 items-center flex-wrap">
                              <div className="text-center md:text-right">
                                <span className="block text-[10px] text-gray-400 leading-none mb-1">Class Tally Breakdown</span>
                                <span className="font-mono font-bold text-slate-700">Taken:{takenC} | Gaps:{gapsC} | Covered:{coveredC}</span>
                              </div>
                              <div className="text-center md:text-right border-l pl-4 border-gray-200">
                                <span className="block text-[10px] text-gray-400 leading-none mb-1">Class Rate</span>
                                <span className="font-mono font-bold text-indigo-650">৳{std.salaryAmount}</span>
                              </div>
                              <div className="text-right border-l pl-4 border-gray-200">
                                <span className="block text-[10px] text-gray-400 leading-none mb-1">Invoice Status</span>
                                <span className={`font-mono font-bold uppercase tracking-wider text-[10px] px-2 py-0.5 rounded-full ${
                                  invoice?.status === 'paid' 
                                    ? 'bg-emerald-50 text-emerald-850 border border-emerald-150' 
                                    : 'bg-rose-50 text-rose-750 border border-rose-150'
                                }`}>
                                  {invoice?.status || 'No invoice'}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Classroom feedback notes & Active Taught Subjects */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-slate-650">
                            <div className="bg-slate-50/60 rounded-xl p-3 border border-slate-100 select-text">
                              <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400 block mb-1">Academic Progress Observations</span>
                              {std.progressNotes ? (
                                <p className="text-[11px] leading-relaxed text-slate-700 font-medium">
                                  {std.progressNotes}
                                </p>
                              ) : (
                                <p className="text-[11px] text-slate-400 italic">No feedback remarks saved for this pupil. Tutors can save feedback anytime under the Students Tab.</p>
                              )}
                            </div>
                            <div className="space-y-1 text-[11px]">
                              <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400 block pb-0.5">Contact Details & Subjects</span>
                              <p><span className="font-bold text-slate-500">Subject List:</span> {std.subjects.join(', ') || 'Not Configured'}</p>
                              <p><span className="font-bold text-slate-500">Contact Number:</span> {std.contactInfo || 'Not Set'}</p>
                              <p><span className="font-bold text-slate-500">Home Address:</span> <span className="truncate max-w-xs inline-block align-bottom">{std.address}</span></p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              
              <div className="border-t border-gray-150 pt-5 flex justify-between items-center text-[10px] font-mono text-gray-400 select-none">
                <span>GENERATED BY TUTORCONNECT SECURE DATABASE PORTAL</span>
                <span>SYSTEM DATE: {new Date().toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        )}

        {/* PROFILE SETTINGS TAB */}
        {activeTab === 'profile' && (
          <div className="bg-white rounded-2xl p-6 border border-gray-150 shadow-sm max-w-2xl mx-auto space-y-6">
            <div>
              <h2 className="text-md font-bold text-gray-900">Configure Tutor Profile Details</h2>
              <p className="text-xs text-gray-500 mt-0.5">Linked parents can immediately view your qualifications, contact rates, subjects, and phone number.</p>
            </div>

            <form onSubmit={handleProfileSave} className="space-y-4" id="tutor-profile-form">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="tutor-prof-name" className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Tutor Name</label>
                  <input
                    id="tutor-prof-name"
                    type="text"
                    disabled
                    value={user.displayName}
                    className="w-full px-3 py-2 bg-gray-100 border border-gray-200 text-gray-500 text-sm rounded-lg"
                  />
                </div>
                <div>
                  <label htmlFor="tutor-prof-email" className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Primary Email</label>
                  <input
                    id="tutor-prof-email"
                    type="text"
                    disabled
                    value={user.email}
                    className="w-full px-3 py-2 bg-gray-100 border border-gray-200 text-gray-500 text-sm rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="tutor-phone" className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Contact Phone Number *</label>
                  <input
                    id="tutor-phone"
                    type="text"
                    required
                    placeholder="e.g. +8801700000000"
                    value={profPhone}
                    onChange={(e) => setProfPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-gray-200 focus:border-indigo-500 focus:bg-white text-sm rounded-lg outline-none transition-all"
                  />
                </div>
                <div>
                  <label htmlFor="tutor-experience" className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Years of Experience</label>
                  <input
                    id="tutor-experience"
                    type="text"
                    placeholder="e.g. 5 Years"
                    value={profExp}
                    onChange={(e) => setProfExp(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-gray-200 focus:border-indigo-500 focus:bg-white text-sm rounded-lg outline-none transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="tutor-qualifications" className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Academic Qualifications</label>
                  <input
                    id="tutor-qualifications"
                    type="text"
                    placeholder="e.g. B.Sc. in Computer Science"
                    value={profQual}
                    onChange={(e) => setProfQual(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-gray-200 focus:border-indigo-500 focus:bg-white text-sm rounded-lg outline-none transition-all"
                  />
                </div>
                <div>
                  <label htmlFor="tutor-subjects-taught" className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Expertise Subjects (comma-separated)</label>
                  <input
                    id="tutor-subjects-taught"
                    type="text"
                    placeholder="e.g. Physics, Chemistry, Calculus"
                    value={profSubjects}
                    onChange={(e) => setProfSubjects(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-gray-200 focus:border-indigo-500 focus:bg-white text-sm rounded-lg outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="tutor-bio" className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Short Professional Bio / Guidelines</label>
                <textarea
                  id="tutor-bio"
                  rows={3}
                  placeholder="Share details about your general home teaching schedule, guidelines, expectations, or background."
                  value={profBio}
                  onChange={(e) => setProfBio(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-gray-200 focus:border-indigo-500 focus:bg-white text-sm rounded-lg outline-none transition-all resize-none"
                ></textarea>
              </div>

              {profileSuccess && (
                <div className="p-3 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-xl border border-emerald-100 flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-500" />
                  <span>{profileSuccess}</span>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer text-center font-sans tracking-wide"
              >
                Save Profile Parameters
              </button>
            </form>
          </div>
        )}

      </div>
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
            <h3 className="text-lg font-bold text-slate-900 leading-snug">Delete your Tutor Profile?</h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              This action is absolutely permanent and cannot be undone. We will destroy your database linkages, erase your registered students list, and completely delete your authentication profile.
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

  {/* Student Detail & Edit Modal */}
  {selectedStudent && (() => {
    const studentSessHistory = attendances.filter(a => a.studentId === selectedStudent.id);
    const studentPayments = salaries.filter(s => s.studentId === selectedStudent.id);
    
    // Calculate attendance status counters
    const totalSess = studentSessHistory.length;
    const presentCount = studentSessHistory.filter(a => a.status === 'present').length;
    const absentCount = studentSessHistory.filter(a => a.status === 'absent').length;
    const holidayCount = studentSessHistory.filter(a => a.status === 'holiday').length;
    const tookOffCount = studentSessHistory.filter(a => a.status === 'took_off').length;
    const gapCoveredCount = studentSessHistory.filter(a => a.status === 'gap_covered').length;

    const totalTaken = presentCount + gapCoveredCount;
    const gapClasses = absentCount + tookOffCount;
    const coveredClasses = gapCoveredCount;

    const attPercent = totalSess > 0 ? Math.round(((presentCount + gapCoveredCount) / totalSess) * 100) : 100;

    return (
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200 flex flex-col">
          {/* Header */}
          <div className="p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10 shrink-0">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-150">
                {selectedStudent.grade}
              </span>
              <h3 className="text-xl font-extrabold text-slate-900 mt-1">{selectedStudent.name}</h3>
            </div>
            <button
              onClick={() => setSelectedStudent(null)}
              className="text-slate-400 hover:text-slate-600 transition-colors p-2 rounded-full hover:bg-slate-50 cursor-pointer text-sm font-bold font-mono"
            >
              ✕ Close
            </button>
          </div>

          <div className="p-6 overflow-y-auto flex-1 space-y-6">
            {isEditingStudent ? (
              // EDIT MODE
              <form onSubmit={handleSaveStudentChanges} className="space-y-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Modify Profile Fields</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Student name *</label>
                    <input
                      type="text"
                      required
                      value={editStudName}
                      onChange={e => setEditStudName(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-250 focus:bg-white focus:border-indigo-500 rounded-lg text-xs font-medium outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Class / Grade Level</label>
                    <input
                      type="text"
                      value={editStudGrade}
                      onChange={e => setEditStudGrade(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-255 focus:bg-white focus:border-indigo-500 rounded-lg text-xs font-medium outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Parent Registered Email *</label>
                    <input
                      type="email"
                      required
                      value={editStudParentEmail}
                      onChange={e => setEditStudParentEmail(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-255 focus:bg-white focus:border-indigo-500 rounded-lg text-xs font-medium outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Contact Phone Number</label>
                    <input
                      type="text"
                      placeholder="e.g. +1 (555) 018-4950"
                      value={editStudContactInfo}
                      onChange={e => setEditStudContactInfo(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-255 focus:bg-white focus:border-indigo-500 rounded-lg text-xs font-medium outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Subjects (comma split)</label>
                    <input
                      type="text"
                      value={editStudSubjects}
                      onChange={e => setEditStudSubjects(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-255 focus:bg-white focus:border-indigo-500 rounded-lg text-xs font-medium outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Monthly Tuition Invoice Amount *</label>
                    <input
                      type="number"
                      required
                      value={editStudSalary}
                      onChange={e => setEditStudSalary(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-255 focus:bg-white focus:border-indigo-500 rounded-lg text-xs font-medium outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Weekly Tutoring Days *</label>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map(day => {
                        const isSelected = editStudTutoringDays.includes(day);
                        return (
                          <button
                            type="button"
                            key={day}
                            onClick={() => {
                              if (isSelected) {
                                setEditStudTutoringDays(prev => prev.filter(d => d !== day));
                              } else {
                                setEditStudTutoringDays(prev => [...prev, day]);
                              }
                            }}
                            className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer border ${
                              isSelected
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {day}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Home Teaching Session Address</label>
                  <input
                    type="text"
                    value={editStudAddress}
                    onChange={e => setEditStudAddress(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-255 focus:bg-white focus:border-indigo-500 rounded-lg text-xs font-medium outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1 font-sans">Academic Progress Notes & Feedbacks</label>
                  <textarea
                    rows={3}
                    placeholder="Enter observations on student strengths, weak chapters, improvement recommendations..."
                    value={editStudProgressNotes}
                    onChange={e => setEditStudProgressNotes(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-255 focus:bg-white focus:border-indigo-500 rounded-lg text-xs font-medium outline-none resize-none"
                  ></textarea>
                </div>

                {editStudentError && (
                  <div className="p-3 bg-red-50 text-red-700 text-xs font-semibold rounded-lg">
                    {editStudentError}
                  </div>
                )}

                {editStudentSuccess && (
                  <div className="p-3 bg-emerald-50 text-emerald-800 text-xs font-semibold rounded-lg">
                    {editStudentSuccess}
                  </div>
                )}

                <div className="flex gap-3 justify-end pt-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setIsEditingStudent(false)}
                    className="px-4 py-2 bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 rounded-xl font-bold cursor-pointer"
                  >
                    Back to Profile
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-indigo-650 hover:bg-indigo-750 text-white rounded-xl font-bold font-sans cursor-pointer"
                  >
                    Save Secure Changes
                  </button>
                </div>
              </form>
            ) : (
              // VIEW MODE
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 text-left">
                {/* Left Side: Profile Specific Information */}
                <div className="space-y-5">
                  <div className="space-y-1.5 pb-3.5 border-b border-dashed border-slate-200">
                    <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest font-mono">Profile Details</h4>
                    <span className="block text-xs font-semibold text-slate-500 mt-2">Subjects Tutored:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedStudent.subjects.map((sub, idx) => (
                        <span key={idx} className="text-[9px] uppercase tracking-wider font-extrabold bg-indigo-50 border border-indigo-150 text-indigo-750 px-2 py-0.5 rounded">
                          {sub}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3.5 text-xs text-slate-500">
                    <p><strong className="text-slate-800">Primary Contact Email:</strong> <span className="select-all block font-mono text-indigo-700 mt-1">{selectedStudent.parentEmail}</span></p>
                    <p><strong className="text-slate-800">Contact Number:</strong> <span className="block mt-1 font-medium text-slate-700">{selectedStudent.contactInfo || 'Not Set'}</span></p>
                    <p><strong className="text-slate-800">Scheduled Address:</strong> <span className="block mt-1 text-slate-750 font-medium">{selectedStudent.address}</span></p>
                    <p><strong className="text-slate-800 font-sans">Tutoring Days:</strong> <span className="block mt-1 font-sans font-bold text-slate-700">{selectedStudent.tutoringDays?.join(', ') || 'None Set'}</span></p>
                    <p><strong className="text-slate-800">Contracted Rate:</strong> <span className="block mt-1 font-mono font-bold text-indigo-600 text-sm">৳{selectedStudent.salaryAmount} / month</span></p>
                  </div>

                  {/* Academic Progress observations tracker */}
                  <div className="p-4 bg-indigo-50/30 rounded-2xl border border-indigo-150/40 space-y-2">
                    <span className="block text-xs font-bold text-indigo-950">Academic Progress Feedbacks</span>
                    {selectedStudent.progressNotes ? (
                      <p className="text-xs text-indigo-900 leading-relaxed font-medium">
                        {selectedStudent.progressNotes}
                      </p>
                    ) : (
                      <p className="text-xs text-slate-400 italic">No academic progress comments submitted yet. Tutors can log chapter progression, behavior, or goals under "Edit Settings" below.</p>
                    )}
                  </div>
                </div>

                {/* Right Side: Logged Attendance, Session History, and Payments */}
                <div className="space-y-5">
                  <div className="space-y-1 pb-3 text-xs border-b border-dashed border-slate-200">
                    <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest font-mono">Attendance & Sessions</h4>
                    <div className="grid grid-cols-4 gap-2 text-center mt-3 text-slate-600">
                      <div className="p-2 bg-slate-50 border rounded-lg">
                        <span className="block text-[8px] uppercase tracking-wider font-bold text-slate-400">total</span>
                        <span className="text-sm font-bold font-mono text-slate-800">{totalSess}</span>
                      </div>
                      <div className="p-2 bg-emerald-50 border border-emerald-100 rounded-lg text-emerald-850">
                        <span className="block text-[8px] uppercase tracking-wider font-bold text-emerald-500">taken</span>
                        <span className="text-sm font-bold font-mono">{totalTaken}</span>
                      </div>
                      <div className="p-2 bg-rose-50 border border-rose-100 rounded-lg text-rose-800">
                        <span className="block text-[8px] uppercase tracking-wider font-bold text-rose-500">gaps</span>
                        <span className="text-sm font-bold font-mono">{gapClasses}</span>
                      </div>
                      <div className="p-2 bg-indigo-50 border border-indigo-150 rounded-lg text-indigo-850 font-semibold">
                        <span className="block text-[8px] uppercase tracking-wider font-bold text-indigo-500">rate</span>
                        <span className="text-sm font-bold font-mono">{attPercent}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Session History */}
                  <div className="space-y-2 text-xs">
                    <span className="font-bold text-slate-850 block">Recent Class Session History ({totalSess})</span>
                    {studentSessHistory.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">No marked attendance history registered for this class in Firestore yet.</p>
                    ) : (
                      <div className="space-y-1.5 max-h-40 overflow-y-auto border border-slate-100 rounded-xl p-2.5 bg-slate-50 shadow-inner">
                        {studentSessHistory.map(att => (
                          <div key={att.id} className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-100">
                            <span className="font-mono text-[11px] text-slate-600">{att.date}</span>
                            <div className="flex flex-col items-end gap-1">
                              <span className={`text-[8px] font-extrabold uppercase tracking-wider px-2 py-0.5 border rounded-full ${
                                att.status === 'present' ? 'bg-emerald-50 text-emerald-805 border-emerald-150' :
                                att.status === 'absent' ? 'bg-rose-50 text-rose-800 border-rose-150' :
                                att.status === 'holiday' ? 'bg-cyan-50 text-cyan-800 border-cyan-150' :
                                att.status === 'took_off' ? 'bg-amber-50 text-amber-800 border-amber-150' :
                                'bg-indigo-50 text-indigo-805 border-indigo-150'
                              }`}>
                                {att.status === 'took_off' ? 'Took Off' : att.status === 'gap_covered' ? 'Gap Covered' : att.status}
                              </span>
                              {att.status === 'gap_covered' && att.gapCoveredDate && (
                                <span className="text-[9px] text-slate-400 font-mono">Absent: {att.gapCoveredDate}</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Payment Details */}
                  <div className="space-y-2 text-xs">
                    <span className="font-bold text-slate-850 block">Salary & Tuition Payments Status</span>
                    {studentPayments.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">No generated salaries dues logged inside the system yet.</p>
                    ) : (
                      <div className="space-y-1.5 max-h-36 overflow-y-auto">
                        {studentPayments.map(sal => (
                          <div key={sal.id} className="flex justify-between items-center text-[11px] p-2 bg-slate-50 border rounded-lg">
                            <span className="font-sans text-slate-550">{formatMonthName(sal.month)}</span>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-800">৳{sal.amount}</span>
                              <span className={`text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                sal.status === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
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
              </div>
            )}
          </div>

          <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-between shrink-0 rounded-b-2xl">
            {!isEditingStudent ? (
              <button
                type="button"
                onClick={() => setIsEditingStudent(true)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
              >
                <UserPen className="w-3.5 h-3.5" />
                <span>Edit Profile Settings</span>
              </button>
            ) : (
              <div />
            )}
            <button
              type="button"
              onClick={() => setSelectedStudent(null)}
              className="px-4 py-2 border bg-white border-slate-200 text-slate-650 hover:bg-slate-50 font-bold rounded-xl text-xs transition-colors cursor-pointer"
            >
              Close Window
            </button>
          </div>
        </div>
      </div>
    );
  })()}

  {editingAttendance && (() => {
    const relatedStudent = students.find(s => s.id === editingAttendance.studentId);
    
    // Past absent candidate dates for this student
    const pastAbsentDates = Array.from(new Set(
      attendances
        .filter(a => a.studentId === editingAttendance.studentId && (a.status === 'absent' || a.status === 'took_off'))
        .map(a => a.date)
        .sort((a, b) => b.localeCompare(a))
    ));

    return (
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-150">
                Edit Log Entry
              </span>
              <h3 className="text-md font-extrabold text-slate-900 mt-1">Attendance on {editingAttendance.date}</h3>
            </div>
            <button
              onClick={() => setEditingAttendance(null)}
              className="text-slate-400 hover:text-slate-600 font-mono text-sm font-bold"
            >
              ✕ Close
            </button>
          </div>

          <form onSubmit={handleSaveEditAttendanceChanges} className="p-6 space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5">Student</label>
              <div className="p-3 bg-slate-50 border border-slate-150 rounded-lg text-xs font-bold text-slate-800">
                {relatedStudent?.name || editingAttendance.studentId} ({relatedStudent?.grade || 'N/A'})
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1.5">Status Status *</label>
              <select
                required
                value={editAttendanceStatus}
                onChange={(e) => setEditAttendanceStatus(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-250 focus:bg-white focus:border-indigo-500 rounded-lg text-xs font-medium outline-none transition-all"
              >
                <option value="present">Present (Taken)</option>
                <option value="absent">Absent (Gap)</option>
                <option value="holiday">Holiday</option>
                <option value="took_off">Student Took Off</option>
                <option value="gap_covered">Covered previous gap class</option>
              </select>
            </div>

            {/* Custom gap date selector for edit mode */}
            {editAttendanceStatus === 'gap_covered' && (
              <div className="space-y-2 animate-in slide-in-from-top-1 duration-200">
                <label className="block text-[11px] font-bold text-indigo-650 uppercase">Date student was absent *</label>
                
                {pastAbsentDates.length > 0 ? (
                  <select
                    value={editAttendanceGapDate}
                    onChange={(e) => setEditAttendanceGapDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-255 focus:bg-white focus:border-indigo-500 rounded-lg text-xs font-medium outline-none transition-all"
                  >
                    <option value="">-- Choose past absent date --</option>
                    {pastAbsentDates.map(dStr => (
                      <option key={dStr} value={dStr}>{dStr}</option>
                    ))}
                    <option value="custom">-- Custom Other Date --</option>
                  </select>
                ) : null}

                {(pastAbsentDates.length === 0 || editAttendanceGapDate === 'custom' || !pastAbsentDates.includes(editAttendanceGapDate)) && (
                  <input
                    type="date"
                    required
                    value={editAttendanceGapDate === 'custom' ? '' : editAttendanceGapDate}
                    onChange={(e) => setEditAttendanceGapDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-255 focus:bg-white focus:border-indigo-500 rounded-lg text-xs font-medium outline-none transition-all"
                  />
                )}
              </div>
            )}

            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditingAttendance(null)}
                className="px-4 py-2 border bg-white border-slate-200 text-slate-650 hover:bg-slate-50 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingEditAttendance}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md"
              >
                {isSavingEditAttendance ? 'Saving...' : 'Save Log Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  })()}

</div>
);
}
