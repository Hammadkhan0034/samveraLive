# Type Safety Fix Plan

## Overview
This document outlines all locations where `any` types are used and need to be replaced with proper TypeScript types. The fixes are organized by category and priority.

**Total Files with `any` Types:** 74  
**Total Instances:** ~600+

---

## Priority Levels

- **P0 (Critical)**: Error handling, API responses, data transformations
- **P1 (High)**: Component props, state management, data mapping
- **P2 (Medium)**: Type assertions, metadata access
- **P3 (Low)**: Utility functions, helper types

---

## 1. Error Handling (`catch (err: any)`)

### Priority: P0 - Critical

All error handling blocks should use proper error types. Create a centralized error type definition.

**Files to Fix:**

#### 1.1 API Routes - Error Handling

**File:** `app/api/stories/route.ts`
- Line 254: `catch (e: any)` - GET handler
- Line 383: `catch (e: any)` - POST handler  
- Line 456: `catch (e: any)` - PUT handler
- Line 512: `catch (e: any)` - DELETE handler

**File:** `app/api/students/route.ts`
- Line 119: `catch (err: any)` - GET handler
- Line 273: `catch (networkError: any)` - POST handler (network error)
- Line 357: `catch (err: any)` - PUT handler
- Line 532: `catch (err: any)` - DELETE handler
- Line 571: `catch (err: any)` - Additional error handler

**File:** `app/api/orgs/route.ts`
- Line 18: `catch (err: any)` - GET handler
- Line 32: `catch (err: any)` - PUT handler
- Line 50: `catch (err: any)` - PATCH handler
- Line 64: `catch (err: any)` - DELETE handler

**File:** `app/api/guardians/route.ts`
- Line 45: `catch (err: any)` - GET handler
- Line 228: `catch (err: any)` - POST handler
- Line 304: `catch (err: any)` - PUT handler
- Line 339: `catch (err: any)` - DELETE handler

**File:** `app/api/classes/route.ts`
- Line 95: `catch (err: any)` - GET handler
- Line 261: `catch (err: any)` - POST handler
- Line 354: `catch (err: any)` - PUT handler
- Line 396: `catch (err: any)` - DELETE handler

**File:** `app/api/attendance/route.ts`
- Line 85: `catch (err: any)` - GET handler
- Line 170: `catch (err: any)` - POST handler
- Line 246: `catch (err: any)` - PUT handler
- Line 284: `catch (err: any)` - DELETE handler

**File:** `app/api/message-items/route.ts`
- Line 81: `catch (err: any)` - GET handler
- Line 152: `catch (err: any)` - POST handler
- Line 218: `catch (err: any)` - PUT handler
- Line 273: `catch (err: any)` - DELETE handler

**File:** `app/api/messages/route.ts`
- Line 182: `catch (err: any)` - GET handler
- Line 317: `catch (err: any)` - POST handler
- Line 400: `catch (err: any)` - PUT handler
- Line 478: `catch (err: any)` - DELETE handler

**File:** `app/api/admin-dashboard/route.ts`
- Line 275: `catch (err: any)` - GET handler

**File:** `app/api/staff-management/route.ts`
- Line 294: `catch (err: any)` - GET handler
- Line 500: `catch (err: any)` - POST handler
- Line 643: `catch (err: any)` - PUT handler
- Line 700: `catch (err: any)` - DELETE handler

**File:** `app/api/announcements/route.ts`
- Line 398: `catch (err: any)` - GET handler

**File:** `app/api/menus/route.ts`
- Line 61: `catch (err: any)` - GET handler
- Line 170: `catch (err: any)` - POST handler
- Line 226: `catch (err: any)` - PUT handler
- Line 267: `catch (err: any)` - DELETE handler

#### 1.2 Component Error Handling

**File:** `app/components/AdminDashboard.tsx`
- Line 116: `catch (e: any)` - fetchOrgs
- Line 161: `catch (e: any)` - handleOrgUpdate
- Line 206: `catch (e: any)` - fetchStaff
- Line 256: `catch (e: any)` - fetchGuardians
- Line 305: `catch (e: any)` - fetchStudents
- Line 372: `catch (e: any)` - handleCreateGuardian
- Line 444: `catch (e: any)` - handleUpdateGuardian
- Line 508: `catch (e: any)` - handleCreateStudent
- Line 576: `catch (e: any)` - handleUpdateStudent
- Line 630: `catch (e: any)` - handleDeleteStudent
- Line 679: `catch (e: any)` - handleDeleteGuardian
- Line 759: `catch (e: any)` - handleLinkGuardianStudent
- Line 783: `catch (e: any)` - handleUnlinkGuardianStudent
- Line 873: `catch (e: any)` - handleDeleteOrg

**File:** `app/components/shared/StoryColumn.tsx`
- Line 205: `catch (e: any)` - Error handler

**File:** `app/(app)/dashboard/edit-story/[storyId]/page.tsx`
- Line 117: `catch (e: any)` - Load story handler
- Line 144: `catch (e: any)` - Fetch classes handler
- Line 262: `catch (uploadError: any)` - Upload error handler
- Line 315: `catch (e: any)` - Submit handler

**File:** `app/(app)/dashboard/add-story/page.tsx`
- Line 82: `catch (e: any)` - Fetch classes handler
- Line 199: `catch (uploadError: any)` - Upload error handler
- Line 251: `catch (e: any)` - Submit handler

**File:** `app/components/TeacherDashboard.tsx`
- Line 229: `catch (error: any)` - fetchAttendance
- Line 277: `catch (error: any)` - fetchStudents

**Recommended Fix:**
Create `lib/types/errors.ts`:
```typescript
export interface ApiError {
  message: string;
  code?: string;
  statusCode?: number;
  details?: unknown;
}

export type ErrorHandler = (error: unknown) => ApiError;
```

Replace all `catch (err: any)` with:
```typescript
catch (err: unknown) {
  const error = err instanceof Error ? err : new Error(String(err));
  console.error('❌ Error:', error);
  return NextResponse.json({ error: error.message }, { status: 500 });
}
```

---

## 2. Data Mapping and Transformations

### Priority: P1 - High

Data mapping operations should use proper types from database queries.

**Files to Fix:**

#### 2.1 Stories API

**File:** `app/api/stories/route.ts`
- Line 171: `data.map((s: any) => ({` - Story mapping
- Line 181: `data.filter((story: any) => {` - Story filtering
- Line 206: `filteredStories.map((s: any) => ({` - Filtered story mapping
- Line 214: `filteredStories.filter((story: any) => {` - Story validation
- Line 242: `data.filter((story: any) => {` - Org-wide story filtering
- Line 292: `let insertedItems = [] as any[]` - Story items array
- Line 296: `.map((it: any, idx: number) => {` - Story item mapping
- Line 319: `.filter((it: any) => {` - Story item filtering
- Line 368: `insertedItems = itemsRes.map((item: any) => ({` - Inserted items mapping
- Line 429: `const updateData: any = {` - Update payload

**Recommended Types:**
Create `lib/types/stories.ts`:
```typescript
export interface Story {
  id: string;
  org_id: string;
  class_id: string | null;
  author_id: string | null;
  title: string | null;
  caption: string | null;
  is_public: boolean;
  expires_at: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface StoryItem {
  id: string;
  story_id: string;
  org_id: string;
  type: 'image' | 'video' | 'text';
  url: string | null;
  text: string | null;
  order: number;
  created_at: string;
}

export interface StoryUpdatePayload {
  title?: string;
  caption?: string;
  is_public?: boolean;
  expires_at?: string;
  class_id?: string | null;
}
```

#### 2.2 Students API

**File:** `app/api/students/route.ts`
- Line 264: `role: 'student' as any,` - Role type assertion

**Recommended Types:**
Create `lib/types/students.ts`:
```typescript
export interface Student {
  id: string;
  org_id: string;
  first_name: string;
  last_name: string | null;
  dob: string | null;
  gender: string;
  class_id: string | null;
  phone?: string | null;
  address?: string | null;
  registration_number?: string | null;
  start_date?: string | null;
  child_value?: string | null;
  language?: string | null;
  social_security_number?: string | null;
  created_at: string;
  updated_at?: string;
  deleted_at?: string | null;
  classes?: {
    id: string;
    name: string;
  };
  guardians?: Array<{
    id: string;
    relation: string;
    users?: {
      id: string;
      first_name: string;
      last_name: string | null;
      email: string;
    };
  }>;
}

export type StudentRole = 'student';
```

#### 2.3 Guardians API

**File:** `app/api/guardians/route.ts`
- Line 152: `role: 'guardian' as any,` - Role type assertion
- Line 170: `let createdRelationship: any = null` - Relationship variable
- Line 285: `role: 'guardian' as any,` - Role type assertion

**Recommended Types:**
Create `lib/types/guardians.ts`:
```typescript
export interface Guardian {
  id: string;
  org_id: string;
  email: string;
  full_name: string;
  phone?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
  deleted_at?: string | null;
  metadata?: Record<string, unknown>;
}

export interface GuardianStudentRelationship {
  id: string;
  guardian_id: string;
  student_id: string;
  relation: string;
  created_at: string;
}

export type GuardianRole = 'guardian';
```

#### 2.4 Classes API

**File:** `app/api/classes/route.ts`
- Line 68: `memberships?.map((m: any) => {` - Membership mapping
- Line 282: `const updateData: any = {` - Update payload

**Recommended Types:**
Create `lib/types/classes.ts`:
```typescript
export interface Class {
  id: string;
  org_id: string;
  name: string;
  description?: string | null;
  created_at: string;
  updated_at?: string;
  deleted_at?: string | null;
}

export interface ClassMembership {
  id: string;
  class_id: string;
  user_id: string;
  role: 'teacher' | 'student';
  created_at: string;
}

export interface ClassUpdatePayload {
  name?: string;
  description?: string | null;
  updated_at: string;
}
```

#### 2.5 Attendance API

**File:** `app/api/attendance/route.ts`
- Line 211: `const updateData: any = {` - Update payload

**Recommended Types:**
Create `lib/types/attendance.ts`:
```typescript
export interface Attendance {
  id: string;
  org_id: string;
  student_id: string;
  class_id: string;
  date: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  notes?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface AttendanceUpdatePayload {
  status?: 'present' | 'absent' | 'late' | 'excused';
  notes?: string | null;
  updated_at: string;
}
```

#### 2.6 Messages API

**File:** `app/api/messages/route.ts`
- Line 85: `participants.map((p: any) => p.message_id)` - Participant mapping
- Line 143: `(p: any) => p.user_id !== userId` - Participant filtering
- Line 250: `existingParticipants.forEach((p: any) => {` - Participant iteration
- Line 383: `const updateData: any = {};` - Update payload

**Recommended Types:**
Already exists in `lib/types/messages.ts`, but needs updates:
- Line 32: `edit_history: any[]` - Should be `EditHistory[]`
- Line 33: `attachments: any[]` - Should be `Attachment[]`

Add to `lib/types/messages.ts`:
```typescript
export interface EditHistory {
  edited_at: string;
  edited_by: string;
  previous_body: string;
}

export interface Attachment {
  id: string;
  url: string;
  filename: string;
  mime_type: string;
  size: number;
}

// Update MessageItem interface:
export interface MessageItem {
  // ... existing fields
  edit_history: EditHistory[];
  attachments: Attachment[];
}
```

#### 2.7 Admin Dashboard API

**File:** `app/api/admin-dashboard/route.ts`
- Line 140: `principalsData || []).map((p: any) => ({` - Principal mapping
- Line 166: `teachersData || []).map((t: any) => ({` - Teacher mapping
- Line 190: `guardiansData || []).map((g: any) => ({` - Guardian mapping
- Line 235: `studentsData || []).map((s: any) => ({` - Student mapping

**Recommended Types:**
Create `lib/types/dashboard.ts`:
```typescript
export interface DashboardPrincipal {
  id: string;
  email: string;
  full_name: string;
  org_id: string;
  is_active: boolean;
}

export interface DashboardTeacher {
  id: string;
  email: string;
  full_name: string;
  org_id: string;
  is_active: boolean;
  classes_count?: number;
}

export interface DashboardGuardian {
  id: string;
  email: string;
  full_name: string;
  org_id: string;
  is_active: boolean;
  students_count?: number;
}

export interface DashboardStudent {
  id: string;
  first_name: string;
  last_name: string | null;
  class_name?: string;
  org_id: string;
}
```

#### 2.8 Staff Management API

**File:** `app/api/staff-management/route.ts`
- Line 63: `staffData?.map((s: any) => {` - Staff mapping
- Line 64: `const baseData: any = {` - Base data object
- Line 84: `}).filter((s: any) => {` - Staff filtering
- Line 95: `let usersWithTeacherRole: any[] = []` - Users array
- Line 96: `let usersError: any = null` - Error variable
- Line 122: `staff.map((s: any) => s.id)` - Staff ID mapping
- Line 123: `allUsersResult.data.filter((u: any) => {` - User filtering
- Line 139: `staff.map((s: any) => s.id)` - Staff ID mapping
- Line 141: `usersWithTeacherRole.forEach((user: any) => {` - User iteration
- Line 143: `const baseData: any = {` - Base data object
- Line 178: `staff.map((s: any) => s.id)` - Staff ID mapping
- Line 191: `.filter((m: any) => {` - Membership filtering
- Line 192: `.map((m: any) => {` - Membership mapping
- Line 193: `const baseData: any = {` - Base data object
- Line 238: `.filter((m: any) => {` - Membership filtering
- Line 239: `.reduce((acc: any[], m: any) => {` - Membership reduction
- Line 241: `const baseData: any = {` - Base data object
- Line 276: `staff.filter((s: any) => {` - Staff filtering
- Line 280: `.filter((s: any) => {` - Staff filtering
- Line 281: `.map((s: any) => ({` - Staff mapping
- Line 309: `requireServerRoles(['principal', 'admin'] as any)` - Role type assertion
- Line 318: `const normalizeToUuidOrNull = (v: any) => {` - Utility function
- Line 419: `const userUpsertData: any = {` - Upsert payload
- Line 434: `userUpsertData.role = userRole as any` - Role type assertion
- Line 467: `const isValidUuid = (v: any) => {` - Utility function
- Line 536: `requireServerRoles(['principal', 'admin'] as any)` - Role type assertion
- Line 554: `const userUpdateData: any = {` - Update payload
- Line 569: `userUpdateData.role = userRole as any` - Role type assertion
- Line 590: `const staffUpdateData: any = {` - Update payload
- Line 640: `role: (updatedUser as any).role || 'teacher'` - Role type assertion
- Line 665: `requireServerRoles(['principal', 'admin'] as any)` - Role type assertion
- Line 683: `const updates: any = {` - Update payload

**Recommended Types:**
Create `lib/types/staff.ts`:
```typescript
export interface Staff {
  id: string;
  org_id: string;
  email: string;
  full_name: string;
  first_name?: string;
  last_name?: string;
  phone?: string | null;
  role: 'teacher' | 'principal' | 'admin';
  role_id: number;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
  deleted_at?: string | null;
  metadata?: Record<string, unknown>;
  classes_count?: number;
}

export interface StaffUpsertPayload {
  email: string;
  full_name: string;
  first_name?: string;
  last_name?: string;
  phone?: string | null;
  role: 'teacher' | 'principal' | 'admin';
  org_id: string;
  metadata?: Record<string, unknown>;
}

export interface StaffUpdatePayload {
  email?: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  phone?: string | null;
  role?: 'teacher' | 'principal' | 'admin';
  is_active?: boolean;
  metadata?: Record<string, unknown>;
  updated_at: string;
}
```

#### 2.9 Announcements API

**File:** `app/api/announcements/route.ts`
- Line 162: `const roles = (u.metadata as any)?.roles` - Metadata access
- Line 203: `const metadata = u.metadata as any` - Metadata access
- Line 282: `data.filter((ann: any) => {` - Announcement filtering
- Line 309: `data.filter((ann: any) => {` - Announcement filtering
- Line 316: `data.filter((a: any) => !a.class_id).length` - Announcement filtering
- Line 317: `data.filter((a: any) => a.class_id).length` - Announcement filtering
- Line 360: `data.filter((ann: any) => {` - Announcement filtering
- Line 378: `(data || []).map((ann: any) => {` - Announcement mapping

**Recommended Types:**
Create `lib/types/announcements.ts`:
```typescript
export interface Announcement {
  id: string;
  org_id: string;
  class_id: string | null;
  author_id: string | null;
  title: string;
  body: string;
  is_public: boolean;
  expires_at: string | null;
  created_at: string;
  updated_at?: string;
  deleted_at?: string | null;
}

export interface UserMetadata {
  roles?: string[];
  org_id?: string;
  organization_id?: string;
  [key: string]: unknown;
}
```

#### 2.10 Menus API

**File:** `app/api/menus/route.ts`
- Line 116: `const updatePayload: any = {` - Update payload

**Recommended Types:**
Create `lib/types/menus.ts`:
```typescript
export interface Menu {
  id: string;
  org_id: string;
  date: string;
  items: MenuItem[];
  created_at: string;
  updated_at?: string;
  deleted_at?: string | null;
}

export interface MenuItem {
  name: string;
  description?: string;
  allergens?: string[];
}

export interface MenuUpdatePayload {
  date?: string;
  items?: MenuItem[];
  deleted_at?: string | null;
  updated_at?: string;
}
```

---

## 3. Component Props and State

### Priority: P1 - High

Component props and state should use proper interfaces.

**Files to Fix:**

#### 3.1 Admin Dashboard Component

**File:** `app/components/AdminDashboard.tsx`
- Line 59: `metadata?: any;` - Guardian state type
- Line 70: `classes?: any;` - Student state type
- Line 150: `(json as any).org` - JSON type assertion
- Line 152: `(json as any).org.id` - JSON type assertion
- Line 153: `(json as any).org` - JSON type assertion
- Line 155: `copy[idx] = (json as any).org;` - JSON type assertion
- Line 477: `json.staff.map((teacher: any) => ({` - Teacher mapping
- Line 550: `json.guardians.map((guardian: any) => ({` - Guardian mapping
- Line 711: `json.students.map((student: any) => ({` - Student mapping
- Line 747: `allStudents.filter((s: any) => {` - Student filtering
- Line 647: `function openEditGuardianModal(guardian: any) {` - Function parameter
- Line 890: `function openEditStudentModal(student: any) {` - Function parameter
- Line 1024: `const ActivityItem = ({ activity }: { activity: any }) => {` - Component prop
- Line 1244: `(p as any).name` - Participant type assertion

**Recommended Fix:**
Use proper types from `lib/types/guardians.ts`, `lib/types/students.ts`, `lib/types/staff.ts`

#### 3.2 Story Column Component

**File:** `app/components/shared/StoryColumn.tsx`
- Line 76: `(session?.user?.user_metadata as any)?.org_id` - Metadata access
- Line 82: `const userMetadata = session?.user?.user_metadata as any;` - Metadata access
- Line 177: `items.find((item: any) => {` - Item finding

**Recommended Fix:**
Use `UserMetadata` type from `lib/types/announcements.ts` or create `lib/types/user.ts`

#### 3.3 Edit Story Page

**File:** `app/(app)/dashboard/edit-story/[storyId]/page.tsx`
- Line 104: `storyItems.map((item: any) => {` - Story item mapping
- Line 133: `json.classes.map((c: any) => ({` - Class mapping
- Line 140: `json.classes.map((c: any) => ({` - Class mapping
- Line 427: `type: e.target.value as any` - Type assertion

**Recommended Fix:**
Use `StoryItem` and `Class` types

#### 3.4 Add Story Page

**File:** `app/(app)/dashboard/add-story/page.tsx`
- Line 71: `json.classes.map((c: any) => ({` - Class mapping
- Line 78: `json.classes.map((c: any) => ({` - Class mapping
- Line 112: `(uploadError as any).statusCode` - Error type assertion
- Line 353: `type: e.target.value as any` - Type assertion

**Recommended Fix:**
Use `Class` type and proper error types

#### 3.5 Teacher Dashboard Component

**File:** `app/components/TeacherDashboard.tsx`
- Line 85: `useState<any[]>([])` - Student requests state
- Line 88: `useState<any[]>([])` - Teacher classes state
- Line 92: `classes?: any;` - Student state type
- Line 184: `data.attendance.forEach((record: any) => {` - Attendance iteration
- Line 261: `(student as any)?.classes?.id` - Student type assertion
- Line 293: `(s as any).classes?.id` - Student type assertion
- Line 389: `(data.student_requests || []).map((request: any) => {` - Request mapping
- Line 440: `(data.students || []).map((student: any) => {` - Student mapping

**Recommended Fix:**
Create `lib/types/student-requests.ts` and use existing types

#### 3.6 Student Table Component

**File:** `app/components/shared/StudentTable.tsx`
- Line 38: `onEdit: (student: any) => void;` - Callback parameter

**Recommended Fix:**
Use `Student` type from `lib/types/students.ts`

---

## 4. Type Assertions (`as any`)

### Priority: P2 - Medium

Type assertions should be replaced with proper type guards or correct types.

**Files to Fix:**

#### 4.1 Role Type Assertions

**File:** `app/api/students/route.ts`
- Line 264: `role: 'student' as any`

**File:** `app/api/guardians/route.ts`
- Line 152: `role: 'guardian' as any`
- Line 285: `role: 'guardian' as any`

**File:** `app/api/staff-management/route.ts`
- Line 309: `requireServerRoles(['principal', 'admin'] as any)`
- Line 434: `userUpsertData.role = userRole as any`
- Line 536: `requireServerRoles(['principal', 'admin'] as any)`
- Line 569: `userUpdateData.role = userRole as any`
- Line 640: `role: (updatedUser as any).role || 'teacher'`

**Recommended Fix:**
Update `requireServerRoles` function signature to accept proper role types:
```typescript
type ServerRole = 'admin' | 'principal' | 'teacher' | 'parent';
export async function requireServerRoles(roles: ServerRole[]): Promise<...>
```

#### 4.2 Metadata Type Assertions

**File:** `app/api/announcements/route.ts`
- Line 162: `(u.metadata as any)?.roles`
- Line 203: `u.metadata as any`

**File:** `app/components/shared/StoryColumn.tsx`
- Line 76: `(session?.user?.user_metadata as any)?.org_id`
- Line 82: `session?.user?.user_metadata as any`

**Recommended Fix:**
Use `UserMetadata` type consistently

#### 4.3 JSON Type Assertions

**File:** `app/components/AdminDashboard.tsx`
- Line 150: `(json as any).org`
- Line 152: `(json as any).org.id`
- Line 153: `(json as any).org`
- Line 155: `copy[idx] = (json as any).org;`

**Recommended Fix:**
Type API responses properly:
```typescript
interface OrgResponse {
  org: {
    id: string;
    name: string;
    // ... other fields
  };
}
```

#### 4.4 Event Handler Type Assertions

**File:** `app/(app)/dashboard/edit-story/[storyId]/page.tsx`
- Line 427: `type: e.target.value as any`

**File:** `app/(app)/dashboard/add-story/page.tsx`
- Line 353: `type: e.target.value as any`

**Recommended Fix:**
Use proper type narrowing:
```typescript
type StoryItemType = 'image' | 'video' | 'text';
onChange={(e) => {
  const value = e.target.value as StoryItemType;
  setItems(prev => prev.map((x, idx) => 
    idx === i ? { ...x, type: value } : x
  ));
}}
```

---

## 5. Dynamic Objects (`const x: any = {}`)

### Priority: P1 - High

Dynamic objects should use proper interfaces or `Record<string, unknown>`.

**Files to Fix:**

#### 5.1 Update Payloads

**File:** `app/api/stories/route.ts`
- Line 429: `const updateData: any = {`

**File:** `app/api/classes/route.ts`
- Line 282: `const updateData: any = {`

**File:** `app/api/attendance/route.ts`
- Line 211: `const updateData: any = {`

**File:** `app/api/messages/route.ts`
- Line 383: `const updateData: any = {};`

**File:** `app/api/menus/route.ts`
- Line 116: `const updatePayload: any = {`

**File:** `app/api/orgs/route.ts`
- Line 43: `const patch: any = {}`

**File:** `app/api/staff-management/route.ts`
- Line 419: `const userUpsertData: any = {`
- Line 554: `const userUpdateData: any = {`
- Line 590: `const staffUpdateData: any = {`
- Line 683: `const updates: any = {`

**Recommended Fix:**
Use proper update payload types for each entity (see type definitions above)

---

## 6. Utility Functions

### Priority: P2 - Medium

Utility functions should have proper parameter and return types.

**Files to Fix:**

#### 6.1 Staff Management Utilities

**File:** `app/api/staff-management/route.ts`
- Line 318: `const normalizeToUuidOrNull = (v: any) => {`
- Line 467: `const isValidUuid = (v: any) => {`

**Recommended Fix:**
```typescript
const normalizeToUuidOrNull = (v: unknown): string | null => {
  if (typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v.trim?.() || v)) {
    return v;
  }
  return null;
};

const isValidUuid = (v: unknown): boolean => {
  return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
};
```

---

## 7. Implementation Plan

### Phase 1: Create Type Definitions (P0)
1. Create `lib/types/errors.ts` - Error types
2. Create `lib/types/stories.ts` - Story types
3. Create `lib/types/students.ts` - Student types
4. Create `lib/types/guardians.ts` - Guardian types
5. Create `lib/types/classes.ts` - Class types
6. Create `lib/types/attendance.ts` - Attendance types
7. Create `lib/types/announcements.ts` - Announcement types
8. Create `lib/types/menus.ts` - Menu types
9. Create `lib/types/staff.ts` - Staff types
10. Create `lib/types/dashboard.ts` - Dashboard types
11. Create `lib/types/user.ts` - User metadata types
12. Update `lib/types/messages.ts` - Fix `any[]` in MessageItem

### Phase 2: Fix Error Handling (P0)
1. Replace all `catch (err: any)` with `catch (err: unknown)`
2. Implement proper error handling using `ApiError` type
3. Update all API routes (30+ files)

### Phase 3: Fix Data Mapping (P1)
1. Replace all `map((x: any) => ...)` with proper types
2. Replace all `filter((x: any) => ...)` with proper types
3. Replace all `forEach((x: any) => ...)` with proper types
4. Update all API routes and components

### Phase 4: Fix Component Props (P1)
1. Update component prop interfaces
2. Fix state type definitions
3. Update callback function signatures

### Phase 5: Fix Type Assertions (P2)
1. Replace `as any` with proper types
2. Add type guards where needed
3. Fix metadata access patterns

### Phase 6: Fix Dynamic Objects (P1)
1. Replace `const x: any = {}` with proper interfaces
2. Use `Record<string, unknown>` where appropriate
3. Create update payload types

### Phase 7: Fix Utility Functions (P2)
1. Add proper parameter types
2. Add proper return types
3. Add JSDoc comments

---

## 8. Files Summary

### Total Files to Fix: 74

**API Routes (30 files):**
- `app/api/stories/route.ts`
- `app/api/students/route.ts`
- `app/api/orgs/route.ts`
- `app/api/guardians/route.ts`
- `app/api/classes/route.ts`
- `app/api/attendance/route.ts`
- `app/api/message-items/route.ts`
- `app/api/messages/route.ts`
- `app/api/admin-dashboard/route.ts`
- `app/api/staff-management/route.ts`
- `app/api/announcements/route.ts`
- `app/api/menus/route.ts`
- Plus 18 more API route files

**Components (20 files):**
- `app/components/AdminDashboard.tsx`
- `app/components/shared/StoryColumn.tsx`
- `app/components/TeacherDashboard.tsx`
- `app/components/shared/StudentTable.tsx`
- Plus 16 more component files

**Pages (15 files):**
- `app/(app)/dashboard/edit-story/[storyId]/page.tsx`
- `app/(app)/dashboard/add-story/page.tsx`
- Plus 13 more page files

**Other Files (9 files):**
- Various utility files, hooks, and other modules

---

## 9. Estimated Effort

- **Phase 1 (Type Definitions):** 4-6 hours
- **Phase 2 (Error Handling):** 3-4 hours
- **Phase 3 (Data Mapping):** 6-8 hours
- **Phase 4 (Component Props):** 4-5 hours
- **Phase 5 (Type Assertions):** 2-3 hours
- **Phase 6 (Dynamic Objects):** 2-3 hours
- **Phase 7 (Utility Functions):** 1-2 hours

**Total Estimated Time:** 22-31 hours

---

## 10. Testing Checklist

After implementing fixes, verify:
- [ ] TypeScript compilation succeeds without errors
- [ ] No `any` types remain (run `grep -r ":\s*any\b\|as\s+any"`)
- [ ] All API routes work correctly
- [ ] All components render without errors
- [ ] No runtime type errors
- [ ] ESLint passes (if configured)
- [ ] Build succeeds

---

## Notes

- Some `any` types may be acceptable in specific contexts (e.g., third-party library integrations)
- Prioritize fixing P0 and P1 issues first
- Test thoroughly after each phase
- Consider using `unknown` instead of `any` where types cannot be determined
- Use type guards for runtime type checking when needed

