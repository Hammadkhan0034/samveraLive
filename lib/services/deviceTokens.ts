import { supabaseAdmin } from '@/lib/supabaseClient';
import { createSupabaseServer } from '@/lib/supabaseServer';

export interface DeviceToken {
  id: string;
  user_id: string;
  provider: string;
  token: string;
  created_at: string;
  deleted_at: string | null;
}

export type DeviceTokenProvider = 'fcm' | 'firebase' | 'apns' | 'web-push';

/**
 * Register a device token for push notifications
 */
export async function registerDeviceToken(
  userId: string,
  token: string,
  provider: DeviceTokenProvider = 'fcm'
): Promise<DeviceToken> {
  const supabase = supabaseAdmin ?? await createSupabaseServer();

  // Check if token already exists for this user and provider
  const { data: existing } = await supabase
    .from('device_tokens')
    .select('id')
    .eq('user_id', userId)
    .eq('provider', provider)
    .eq('token', token)
    .is('deleted_at', null)
    .maybeSingle();

  if (existing) {
    // Token already exists, return it
    const { data: tokenData } = await supabase
      .from('device_tokens')
      .select('*')
      .eq('id', existing.id)
      .single();

    if (tokenData) {
      return tokenData as DeviceToken;
    }
  }

  // Insert new token (unique constraint will handle duplicates)
  const { data: deviceToken, error } = await supabase
    .from('device_tokens')
    .insert({
      user_id: userId,
      provider,
      token,
    })
    .select()
    .single();

  if (error) {
    // If it's a unique constraint violation, try to fetch the existing token
    if (error.code === '23505') {
      const { data: existingToken } = await supabase
        .from('device_tokens')
        .select('*')
        .eq('user_id', userId)
        .eq('provider', provider)
        .eq('token', token)
        .is('deleted_at', null)
        .single();

      if (existingToken) {
        return existingToken as DeviceToken;
      }
    }
    throw new Error(`Failed to register device token: ${error.message}`);
  }

  return deviceToken as DeviceToken;
}

/**
 * Get all active device tokens for a user
 */
export async function getUserDeviceTokens(
  userId: string,
  provider?: DeviceTokenProvider
): Promise<DeviceToken[]> {
  const supabase = supabaseAdmin ?? await createSupabaseServer();

  let query = supabase
    .from('device_tokens')
    .select('*')
    .eq('user_id', userId)
    .is('deleted_at', null);

  if (provider) {
    query = query.eq('provider', provider);
  }

  const { data: tokens, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch device tokens: ${error.message}`);
  }

  return (tokens || []) as DeviceToken[];
}

/**
 * Remove a device token (soft delete)
 */
export async function removeDeviceToken(
  userId: string,
  token: string,
  provider?: DeviceTokenProvider
): Promise<void> {
  const supabase = supabaseAdmin ?? await createSupabaseServer();

  let query = supabase
    .from('device_tokens')
    .update({ deleted_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('token', token)
    .is('deleted_at', null);

  if (provider) {
    query = query.eq('provider', provider);
  }

  const { error } = await query;

  if (error) {
    throw new Error(`Failed to remove device token: ${error.message}`);
  }
}

/**
 * Remove all device tokens for a user
 */
export async function removeAllUserDeviceTokens(
  userId: string,
  provider?: DeviceTokenProvider
): Promise<void> {
  const supabase = supabaseAdmin ?? await createSupabaseServer();

  let query = supabase
    .from('device_tokens')
    .update({ deleted_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('deleted_at', null);

  if (provider) {
    query = query.eq('provider', provider);
  }

  const { error } = await query;

  if (error) {
    throw new Error(`Failed to remove device tokens: ${error.message}`);
  }
}

/**
 * Update device token (handle token refresh)
 * If old token exists, mark it as deleted and create new one
 */
export async function updateDeviceToken(
  userId: string,
  oldToken: string,
  newToken: string,
  provider: DeviceTokenProvider = 'fcm'
): Promise<DeviceToken> {
  // Remove old token
  try {
    await removeDeviceToken(userId, oldToken, provider);
  } catch (error) {
    // Ignore if old token doesn't exist
    console.warn('Old token not found during update:', error);
  }

  // Register new token
  return registerDeviceToken(userId, newToken, provider);
}

