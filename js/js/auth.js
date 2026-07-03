import { supabase } from './supabaseClient.js';

let currentProfile = null;

export function getProfile() {
  return currentProfile;
}

export async function loadProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) {
    console.error('Could not load profile', error);
    return null;
  }
  currentProfile = data;
  return data;
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;

  const profile = await loadProfile(data.user.id);
  if (!profile || profile.is_active === false) {
    await supabase.auth.signOut();
    throw new Error('Your account has been deactivated. Contact your admin.');
  }
  return profile;
}

export async function signOut() {
  await supabase.auth.signOut();
  currentProfile = null;
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

// Role helpers used across views to show/hide write controls
export function hasRole(minRole) {
  if (!currentProfile) return false;
  const role = currentProfile.role;
  if (role === 'admin') return true;
  if (minRole === 'senior') return role === 'senior';
  if (minRole === 'learner') return role === 'senior' || role === 'learner';
  if (minRole === 'viewer') return true;
  return false;
}

export function isAdmin() {
  return currentProfile?.role === 'admin';
}
