import React from 'react';
import { getEvents } from '@/lib/server-actions';
import { getAuthUserWithOrg } from '@/lib/server-helpers';
import { supabaseAdmin } from '@/lib/supabaseClient';
import PrincipalPageLayout from '@/app/components/shared/PrincipalPageLayout';
import { PrincipalCalendarClient } from './PrincipalCalendarClient';

async function fetchCalendarData() {
  try {
    // Get auth context for orgId
    const { orgId } = await getAuthUserWithOrg();
    
    if (!supabaseAdmin) {
      console.error('❌ Supabase admin client not configured');
      return {
        events: [],
        classes: [],
        orgId,
      };
    }
    
    // Fetch events and classes in parallel for better performance
    const [events, classesResponse] = await Promise.all([
      getEvents(),
      supabaseAdmin
        .from('classes')
        .select('id, name')
        .eq('org_id', orgId)
        .is('deleted_at', null)
        .order('name', { ascending: true })
    ]);

    if (classesResponse.error) {
      console.error('❌ Error fetching classes:', classesResponse.error);
    }

    const classes = classesResponse.data?.map(c => ({ id: c.id, name: c.name })) || [];

    return {
      events: (events || []) as any[],
      classes,
      orgId,
    };
  } catch (error) {
    console.error('❌ Error fetching calendar data:', error);
    return {
      events: [],
      classes: [],
      orgId: '',
    };
  }
}

export default async function PrincipalCalendarPage() {
  const { events, classes, orgId } = await fetchCalendarData();

  return (
    <PrincipalPageLayout>
      <PrincipalCalendarClient
        initialEvents={events}
        initialClasses={classes}
        orgId={orgId}
      />
    </PrincipalPageLayout>
  );
}
