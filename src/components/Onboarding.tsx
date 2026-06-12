import React, { useState } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { UserRole, UserProfile } from '../types';
import { Sparkles, GraduationCap, ShieldCheck, User } from 'lucide-react';

interface OnboardingProps {
  uid: string;
  email: string;
  defaultName: string;
  onCompleted: (profile: UserProfile) => void;
}

export default function Onboarding({ uid, email, defaultName, onCompleted }: OnboardingProps) {
  const [role, setRole] = useState<UserRole>('tutor');
  const [displayName, setDisplayName] = useState(defaultName || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      setErrorMsg('Please enter your full name.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    const userData: UserProfile = {
      uid,
      email,
      displayName: displayName.trim(),
      role,
      createdAt: new Date(),
    };

    const userDocPath = `users/${uid}`;
    try {
      await setDoc(doc(db, 'users', uid), {
        ...userData,
        createdAt: new Date() // Firestore handles Date conversion automatically or we pass ServerTimestamp
      });
      onCompleted(userData);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, userDocPath);
      setErrorMsg('Failed to save profile. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 bg-slate-50/50">
      <div className="bg-white rounded-3xl max-w-xl w-full p-8 md:p-10 shadow-xl border border-gray-100 flex flex-col md:flex-row gap-8 items-stretch animate-in fade-in duration-300">
        
        {/* Onboarding Welcome Section */}
        <div className="md:w-5/12 bg-indigo-600 text-white rounded-2xl p-6 flex flex-col justify-between select-none">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-200" />
            <span className="font-mono text-xs font-bold uppercase tracking-widest text-indigo-200">Welcome</span>
          </div>
          <div>
            <h2 className="font-sans font-bold text-2xl tracking-tight leading-tight mb-2">Configure Your Space</h2>
            <p className="text-xs text-indigo-100/90 leading-relaxed font-sans">
              Set up your profile as a tutor or a parent to manage or view attendance, classes, and monthly status reports instantly.
            </p>
          </div>
          <span className="text-[10px] text-indigo-200/60 font-mono">STEP 1 OF 1 &bull; ACCOUNT CONFIG</span>
        </div>

        {/* Setup Form */}
        <form onSubmit={handleSubmit} className="md:w-7/12 flex flex-col justify-between gap-6" id="onboarding-form">
          <div className="space-y-5">
            <div>
              <label htmlFor="display-name" className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">What is your Name?</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400" />
                <input
                  id="display-name"
                  type="text"
                  required
                  placeholder="e.g. Apurba Barua"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 focus:border-indigo-500 focus:bg-white text-sm font-medium rounded-xl outline-none transition-all"
                />
              </div>
            </div>

            {/* Role Selection */}
            <div>
              <span className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Choose Your Account Role</span>
              <div className="grid grid-cols-2 gap-3" id="role-selector">
                
                {/* Tutor Card Option */}
                <button
                  type="button"
                  onClick={() => setRole('tutor')}
                  className={`flex flex-col items-center gap-3 p-4 border rounded-xl transition-all cursor-pointer text-center ${
                    role === 'tutor'
                      ? 'border-indigo-600 bg-indigo-50/50 text-indigo-900 shadow-md ring-2 ring-indigo-500/20'
                      : 'border-gray-200 hover:border-gray-300 text-gray-600'
                  }`}
                >
                  <div className={`p-2.5 rounded-lg ${role === 'tutor' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
                    <GraduationCap className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="block text-sm font-bold leading-none">Tutor</span>
                    <span className="block text-[10px] text-gray-400 mt-1">Manage classes & bills</span>
                  </div>
                </button>

                {/* Parent Card Option */}
                <button
                  type="button"
                  onClick={() => setRole('parent')}
                  className={`flex flex-col items-center gap-3 p-4 border rounded-xl transition-all cursor-pointer text-center ${
                    role === 'parent'
                      ? 'border-blue-600 bg-blue-50/50 text-blue-900 shadow-md ring-2 ring-blue-500/20'
                      : 'border-gray-200 hover:border-gray-300 text-gray-600'
                  }`}
                >
                  <div className={`p-2.5 rounded-lg ${role === 'parent' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="block text-sm font-bold leading-none">Parent</span>
                    <span className="block text-[10px] text-gray-400 mt-1">Track child's classes</span>
                  </div>
                </button>

              </div>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-50 text-red-600 text-xs rounded-xl font-medium border border-red-100">
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-xl transition-all shadow-lg hover:shadow-indigo-200 disabled:opacity-50 cursor-pointer text-center"
            id="btn-complete-setup"
          >
            {isSubmitting ? 'Creating Profile...' : 'Complete Account Setup'}
          </button>
        </form>

      </div>
    </div>
  );
}
