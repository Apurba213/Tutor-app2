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
  salaryDueDate: number; // Day of month: 1 - 31
  createdAt: Date;
  contactInfo?: string;
  progressNotes?: string;
}

export interface Attendance {
  id: string;
  studentId: string;
  date: string; // YYYY-MM-DD
  status: 'present' | 'absent' | 'late';
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
