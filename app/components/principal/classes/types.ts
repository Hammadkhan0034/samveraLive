import type { ComponentProps } from 'react';

export interface AssignedTeacher {
  id: string;
  full_name: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
}

export interface ClassSummary {
  id: string;
  name: string;
  code: string | null;
  assigned_teachers: AssignedTeacher[];
}

export interface AvailableStudent {
  id: string;
  first_name: string;
  last_name: string | null;
  full_name: string;
  current_class_id: string | null;
  current_class_name: string | null;
  email: string | null;
  phone: string | null;
}

export interface AvailableTeacher {
  id: string;
  first_name: string;
  last_name: string | null;
  full_name: string;
  email: string;
  is_assigned: boolean;
}

export type TranslationStrings = Record<string, string>;

export type ModalContainerProps = ComponentProps<'div'>;


