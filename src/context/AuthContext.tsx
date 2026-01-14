import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { User, Session, AuthChangeEvent } from '@supabase/supabase-js';
import { supabase, getUserProfile, upsertUserProfile, type UserProfile } from '../lib/supabase';

// ============================================================
// PRODUCTION-GRADE AUTH CONTEXT FOR SUPABASE + REACT
// ============================================================
// This implementation correctly handles:
// 1. OAuth redirect token detection
// 2. Race conditions between getSession and onAuthStateChange
// 3. Profile sync without blocking auth flow
// 4. Guaranteed loading state resolution (no infinite loading)
// ============================================================

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  initialized: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);

  // ============================================================
  // PROFILE SYNC - Non-blocking, with error handling
  // ============================================================
  const syncUserProfile = useCallback(async (authUser: User) => {
    try {
      console.log('[Auth] Syncing profile for user:', authUser.id);
      
      // Try to get existing profile
      let userProfile = await getUserProfile();
      
      // If no profile exists, create one from auth data
      if (!userProfile) {
        console.log('[Auth] No profile found, creating new one');
        const metadata = authUser.user_metadata;
        userProfile = await upsertUserProfile({
          id: authUser.id,
          email: authUser.email || '',
          full_name: metadata?.full_name || metadata?.name || '',
          avatar_url: metadata?.avatar_url || metadata?.picture || '',
        });
      }
      
      setProfile(userProfile);
      console.log('[Auth] Profile synced successfully');
    } catch (error) {
      // Profile sync failure should NOT block the app
      console.error('[Auth] Profile sync failed (non-fatal):', error);
      // Set a minimal profile from auth data so the app can still work
      setProfile({
        id: authUser.id,
        email: authUser.email || '',
        full_name: authUser.user_metadata?.full_name || authUser.user_metadata?.name || null,
        avatar_url: authUser.user_metadata?.avatar_url || authUser.user_metadata?.picture || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
  }, []);

  // Refresh profile function (can be called externally)
  const refreshProfile = useCallback(async () => {
    if (user) {
      await syncUserProfile(user);
    }
  }, [user, syncUserProfile]);

  // ============================================================
  // MAIN AUTH INITIALIZATION
  // ============================================================
  useEffect(() => {
    if (!supabase) {
      console.warn('[Auth] Supabase is not configured. Auth will not work.');
      setLoading(false);
      setInitialized(true);
      return;
    }

    const client = supabase;
    let mounted = true;
    let authSubscription: { unsubscribe: () => void } | null = null;

    // Track if we've already handled the initial state
    let initialStateHandled = false;

    const initializeAuth = async () => {
      console.log('[Auth] Initializing auth...');
      
      try {
        // CRITICAL: Set up the auth state change listener FIRST
        // This ensures we catch the SIGNED_IN event from OAuth redirect
        const { data: { subscription } } = client.auth.onAuthStateChange(
          async (event: AuthChangeEvent, currentSession: Session | null) => {
            console.log('[Auth] Auth state changed:', event, currentSession?.user?.id);
            
            if (!mounted) return;

            // Update state immediately
            setSession(currentSession);
            setUser(currentSession?.user ?? null);
            
            // Handle specific events
            if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
              if (currentSession?.user) {
                // Sync profile in background - don't await to avoid blocking
                syncUserProfile(currentSession.user).catch(console.error);
              }
            } else if (event === 'SIGNED_OUT') {
              setProfile(null);
            }
            
            // Always ensure loading is false after any auth event
            setLoading(false);
            setInitialized(true);
            initialStateHandled = true;
          }
        );
        
        authSubscription = subscription;

        // Now get the initial session
        // This will return the session if already logged in OR
        // trigger the onAuthStateChange if OAuth tokens are in URL
        const { data: { session: initialSession }, error } = await client.auth.getSession();
        
        if (error) {
          console.error('[Auth] Error getting initial session:', error);
        }

        // Only set state if onAuthStateChange hasn't already handled it
        // (This handles the case where there's no OAuth redirect)
        if (!initialStateHandled && mounted) {
          console.log('[Auth] Setting initial session:', initialSession?.user?.id || 'none');
          setSession(initialSession);
          setUser(initialSession?.user ?? null);
          
          if (initialSession?.user) {
            // Sync profile in background
            syncUserProfile(initialSession.user).catch(console.error);
          }
          
          setLoading(false);
          setInitialized(true);
        }

      } catch (error) {
        console.error('[Auth] Initialization error:', error);
        // CRITICAL: Always set loading to false, even on error
        if (mounted) {
          setLoading(false);
          setInitialized(true);
        }
      }
    };

    initializeAuth();

    // Cleanup
    return () => {
      mounted = false;
      if (authSubscription) {
        authSubscription.unsubscribe();
      }
    };
  }, [syncUserProfile]);

  // ============================================================
  // SAFETY TIMEOUT - Guarantee no infinite loading
  // ============================================================
  useEffect(() => {
    // If still loading after 10 seconds, force complete
    const timeout = setTimeout(() => {
      if (loading) {
        console.warn('[Auth] Loading timeout - forcing completion');
        setLoading(false);
        setInitialized(true);
      }
    }, 10000);

    return () => clearTimeout(timeout);
  }, [loading]);

  // ============================================================
  // SIGN IN WITH GOOGLE
  // ============================================================
  const signInWithGoogle = useCallback(async () => {
    if (!supabase) {
      console.error('[Auth] Supabase is not configured');
      throw new Error('Supabase is not configured');
    }

    try {
      console.log('[Auth] Initiating Google sign in...');
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          // Redirect back to dashboard after OAuth
          redirectTo: `${window.location.origin}/dashboard`,
          // Don't skip browser redirect (needed for OAuth)
          skipBrowserRedirect: false,
        },
      });

      if (error) {
        console.error('[Auth] Google sign in error:', error);
        throw error;
      }
    } catch (error) {
      console.error('[Auth] Sign in error:', error);
      throw error;
    }
  }, []);

  // ============================================================
  // SIGN OUT
  // ============================================================
  const signOut = useCallback(async () => {
    if (!supabase) {
      console.error('[Auth] Supabase is not configured');
      return;
    }

    try {
      console.log('[Auth] Signing out...');
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('[Auth] Sign out error:', error);
        throw error;
      }
      setProfile(null);
      setUser(null);
      setSession(null);
    } catch (error) {
      console.error('[Auth] Sign out error:', error);
      throw error;
    }
  }, []);

  // ============================================================
  // CONTEXT VALUE
  // ============================================================
  const value: AuthContextType = {
    user,
    session,
    profile,
    loading,
    initialized,
    signInWithGoogle,
    signOut,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
