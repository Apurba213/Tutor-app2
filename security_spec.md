# Security Specification: Home Tutoring Tracker

This document defines the strict security architecture, invariants, and threat models for the Home Tutoring Tracker Firestore database.

## 1. Data Invariants

- **User Accounts (`/users/{userId}`)**: 
  - A user profile can only be created by the authenticated user themselves where the document ID matches `request.auth.uid`.
  - The `email` and `uid` fields must match the authenticating token exactly.
  - The `role` must be either `'tutor'` or `'parent'`. Handled by string enum validation.
  - A user cannot change their own `role` once set to prevent privilege escalation (Privilege Escalation Guard).
  
- **Students (`/students/{studentId}`)**:
  - A student document can only be created or modified by an authenticated tutor who is the verified creator of the record (`tutorUid == request.auth.uid`).
  - The tutor must specify a `parentEmail` which allows the parent account (with matching email) to view the student record.
  - The `salaryAmount` must be a positive integer.
  - The `salaryDueDate` must be between `1` and `31` (valid date-of-month).
  - The tutor cannot modify `tutorUid` after creation (Immortal Field Rule).

- **Attendance Logs (`/attendance/{attendanceId}`)**:
  - Attendance logs can only be created, modified, or deleted by the tutor who manages the student.
  - The tutor must verify that the student exists and is assigned to them.
  - The `status` must be either `'present'`, `'absent'`, or `'late'`.
  - The parent can view attendance logs for their child if they are authenticated with an email matching the student's associated `parentEmail`.

- **Salary Payments (`/salaries/{salaryId}`)**:
  - Salaries can only be created or updated by the tutor.
  - The `status` must be `'paid'` or `'pending'`.
  - The parent can view salary payment histories linked to their child's `parentEmail`.

- **Tutor Profiles (`/tutorProfiles/{tutorId}`)**:
  - Only the tutor who owns the profile can write to `/tutorProfiles/{tutorId}` (where `tutorId == request.auth.uid`).
  - Parents can read tutor profiles.

---

## 2. The "Dirty Dozen" Adversarial Payloads

The following represent 12 specific exploits that the `firestore.rules` must block with a `PERMISSION_DENIED`:

1. **Identity Spoofing on Create**: Authenticated User A tries to create a User profile at `/users/UserB` with User A's email.
2. **Privilege Escalation on User Update**: A Parent user attempts to update their `/users/ParentA` profile to change their role to `'tutor'`.
3. **Orphaned Student Creation**: An unauthenticated attacker attempts to write to `/students/student123`.
4. **Tutor Hijacking on Student Update**: Tutor B attempts to edit or change the `tutorUid` owner field of Tutor A's student at `/students/studentA`.
5. **Malicious Salary Amount**: A tutor attempts to create a student with a negative salary amount (e.g., `-5000` dollars).
6. **Out-of-Bound Salary Due Day**: A tutor attempts to create a student with a `salaryDueDate` of `99`.
7. **Junk String ID Poisoning**: An attacker tries to inject a 50KB junk-character string as a Student doc ID or Attendance ID.
8. **Malicious Empty Attendance Status**: A tutor tries to log an attendance record with an invalid status (e.g., `"vacation"` or `""`).
9. **Parent Salary Write Exploitation**: An authenticated Parent user tries to mark a salary transaction as `'paid'` directly without tutor action.
10. **Tutor Profile Tampering**: An authenticated Tutor A tries to modify the tutor profile of Tutor B at `/tutorProfiles/TutorB`.
11. **Client-Side Query Unrestricted Scraping**: An authenticated Parent attempts an unrestricted query to list all students in the database (`allow list: if isSignedIn()`).
12. **Double-Write Time Injection**: A tutor tries to submit a student payload with a custom client-side spoofed timestamp for `createdAt` instead of the required `request.time`.

---

## 3. Firestore Rules Structure

The database is built on a "Fortress Rules" style utilizing exact key-count matches, rigorous data types, temporal synchronization, and identity guards.
The final rules will be tested and deployed to enforce these boundary parameters securely.
