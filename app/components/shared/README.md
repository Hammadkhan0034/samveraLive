# Shared Components for Guardian and Student Management

This directory contains reusable components for managing guardians and students that can be used in both AdminDashboard and PrincipalDashboard.

## Components

### 1. GuardianForm
A modal form for creating and editing guardians.

**Usage:**
```tsx
import { GuardianForm, type GuardianFormData } from './shared/GuardianForm';

<GuardianForm
  isOpen={isGuardianModalOpen}
  onClose={() => setIsGuardianModalOpen(false)}
  onSubmit={async (data: GuardianFormData) => {
    // Handle form submission
    const res = await fetch('/api/guardians', {
      method: data.id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    // Handle response...
  }}
  initialData={guardianForm}
  loading={loadingGuardians}
  error={guardianError}
  orgs={orgs}
  translations={{
    create_guardian: 'Create Guardian',
    edit_guardian: 'Edit Guardian',
    // ... other translations
  }}
/>
```

### 2. GuardianTable
A table component for displaying guardians with edit/delete actions.

**Usage:**
```tsx
import { GuardianTable } from './shared/GuardianTable';

<GuardianTable
  guardians={guardians}
  loading={loadingGuardians}
  error={guardianError}
  onEdit={openEditGuardianModal}
  onDelete={openDeleteGuardianModal}
  onCreate={openCreateGuardianModal}
  translations={{
    guardians: 'Guardians',
    full_name: 'Full Name',
    // ... other translations
  }}
/>
```

### 3. StudentForm
A modal form for creating and editing students.

**Usage:**
```tsx
import { StudentForm, type StudentFormData } from './shared/StudentForm';

<StudentForm
  isOpen={isStudentModalOpen}
  onClose={() => setIsStudentModalOpen(false)}
  onSubmit={async (data: StudentFormData) => {
    // Handle form submission
    const res = await fetch('/api/students', {
      method: data.id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    // Handle response...
  }}
  initialData={studentForm}
  loading={loadingStudents}
  error={studentError}
  guardians={guardians}
  classes={classes}
  translations={{
    create_student: 'Create Student',
    edit_student: 'Edit Student',
    // ... other translations
  }}
/>
```

### 4. StudentTable
A table component for displaying students with edit/delete actions.

**Usage:**
```tsx
import { StudentTable } from './shared/StudentTable';

<StudentTable
  students={students}
  loading={loadingStudents}
  error={studentError}
  onEdit={openEditStudentModal}
  onDelete={openDeleteStudentModal}
  onCreate={openCreateStudentModal}
  translations={{
    students: 'Students',
    student_name: 'Name',
    // ... other translations
  }}
/>
```

### 5. DeleteConfirmationModal
A reusable modal for confirming deletions.

**Usage:**
```tsx
import { DeleteConfirmationModal } from './shared/DeleteConfirmationModal';

<DeleteConfirmationModal
  isOpen={isDeleteModalOpen}
  onClose={() => setIsDeleteModalOpen(false)}
  onConfirm={confirmDelete}
  title="Delete Guardian"
  message="Are you sure you want to delete this guardian?"
  error={error}
  translations={{
    confirm_delete: 'Delete',
    cancel: 'Cancel'
  }}
/>
```

## Benefits

1. **Code Reusability**: Same components can be used in AdminDashboard and PrincipalDashboard
2. **Consistency**: All forms and tables look and behave the same way
3. **Maintainability**: Changes to forms/tables only need to be made in one place
4. **Type Safety**: TypeScript interfaces ensure proper data handling
5. **Translation Support**: All components support internationalization

## Integration Steps

1. Import the shared components in your dashboard
2. Replace existing form/table code with shared components
3. Pass the required props (data, handlers, translations)
4. Remove old form/table code
5. Test the functionality

## Example Integration in PrincipalDashboard

```tsx
// In PrincipalDashboard.tsx
import { GuardianForm, GuardianTable } from './shared/GuardianForm';
import { StudentForm, StudentTable } from './shared/StudentForm';

// Replace existing guardian/student sections with:
<GuardianTable
  guardians={guardians}
  loading={loadingGuardians}
  error={guardianError}
  onEdit={openEditGuardianModal}
  onDelete={openDeleteGuardianModal}
  onCreate={openCreateGuardianModal}
  translations={guardianTranslations}
/>

<StudentTable
  students={students}
  loading={loadingStudents}
  error={studentError}
  onEdit={openEditStudentModal}
  onDelete={openDeleteStudentModal}
  onCreate={openCreateStudentModal}
  translations={studentTranslations}
/>
```
