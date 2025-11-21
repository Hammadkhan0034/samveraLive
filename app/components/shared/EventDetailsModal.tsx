'use client';

import React from 'react';
import { X, Edit, Trash2, Calendar, MapPin, Users } from 'lucide-react';
import type { CalendarEvent } from './Calendar';

export interface EventDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: CalendarEvent | null;
  canEdit: boolean;
  canDelete: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  classes?: Array<{ id: string; name: string }>;
}

export function EventDetailsModal({
  isOpen,
  onClose,
  event,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
  classes = [],
}: EventDetailsModalProps) {
  if (!isOpen || !event) return null;

  const startDate = new Date(event.start_at);
  const endDate = event.end_at ? new Date(event.end_at) : null;
  
  const formatDateTime = (date: Date): string => {
    return date.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const classInfo = event.class_id 
    ? classes.find(c => c.id === event.class_id) || event.classes
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Event Details
          </h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Title */}
          <div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {event.title}
            </h2>
          </div>

          {/* Date/Time */}
          <div className="flex items-start gap-3">
            <Calendar className="h-5 w-5 text-slate-500 dark:text-slate-400 mt-0.5" />
            <div>
              <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {formatDate(startDate)}
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-400">
                {formatTime(startDate)}
                {endDate && ` - ${formatTime(endDate)}`}
              </div>
            </div>
          </div>

          {/* Location */}
          {event.location && (
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-slate-500 dark:text-slate-400 mt-0.5" />
              <div className="text-sm text-slate-700 dark:text-slate-300">
                {event.location}
              </div>
            </div>
          )}

          {/* Class/Scope */}
          <div className="flex items-start gap-3">
            <Users className="h-5 w-5 text-slate-500 dark:text-slate-400 mt-0.5" />
            <div>
              <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
                {classInfo ? `Class: ${classInfo.name}` : 'Organization-wide'}
              </div>
            </div>
          </div>

          {/* Description */}
          {event.description && (
            <div>
              <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Description
              </h4>
              <p className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap">
                {event.description}
              </p>
            </div>
          )}

          {/* Actions */}
          {(canEdit || canDelete) && (
            <div className="flex gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
              {canEdit && onEdit && (
                <button
                  onClick={onEdit}
                  className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                >
                  <Edit className="h-4 w-4" />
                  Edit
                </button>
              )}
              {canDelete && onDelete && (
                <button
                  onClick={onDelete}
                  className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

