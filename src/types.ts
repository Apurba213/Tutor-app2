export type UserRole = 'tutor' | 'parent';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  createdAt: Date;
}

export interface Student {
  id: string;
  name: string;
  grade: string;
  subjects: string[];
  address: string;
  parentEmail: string;
  tutorUid: string;
  salaryAmount: number;
  tutoringDays: string[]; // e.g. ['Sun', 'Tue', 'Thu']
  createdAt: Date;
  contactInfo?: string;
  progressNotes?: string;
}

export interface Attendance {
  id: string;
  studentId: string;
  date: string; // YYYY-MM-DD
  status: 'present' | 'absent' | 'holiday' | 'took_off' | 'gap_covered';
  gapCoveredDate?: string; // YYYY-MM-DD
  tutorUid: string;
  createdAt: Date;
}

export interface Salary {
  id: string;
  studentId: string;
  month: string; // YYYY-MM
  amount: number;
  status: 'paid' | 'pending';
  paidAt: Date | null;
  receivedDate?: string; // YYYY-MM-DD or custom payment date
  tutorUid: string;
  parentEmail: string;
}

export interface TutorProfile {
  tutorUid: string;
  name: string;
  phone: string;
  email: string;
  qualification: string;
  experience: string;
  subjects: string[];
  bio: string;
  updatedAt: Date;
}
