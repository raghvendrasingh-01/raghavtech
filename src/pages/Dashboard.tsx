import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { 
  getUserStudyPlans, 
  deleteStudyPlan, 
  setActivePlan,
  type StudyPlanDB 
} from '../lib/supabase';

// ============ DASHBOARD PAGE ============
// Shows user's private dashboard with their study plans

const Dashboard = () => {
  const { user, profile, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [plans, setPlans] = useState<StudyPlanDB[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Fetch user's plans on mount
  useEffect(() => {
    const fetchPlans = async () => {
      if (!user) return;
      
      try {
        const userPlans = await getUserStudyPlans();
        setPlans(userPlans);
      } catch (error) {
        console.error('Failed to fetch plans:', error);
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading) {
      fetchPlans();
    }
  }, [user, authLoading]);

  // Handle opening a plan
  const handleOpenPlan = async (planId: string) => {
    await setActivePlan(planId);
    navigate(`/study-planner?plan=${planId}`);
  };

  // Handle creating a new plan
  const handleCreatePlan = () => {
    navigate('/study-planner?new=true');
  };

  // Handle deleting a plan
  const handleDeletePlan = async (planId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!confirm('Are you sure you want to delete this study plan?')) {
      return;
    }

    setDeletingId(planId);
    const success = await deleteStudyPlan(planId);
    
    if (success) {
      setPlans(prev => prev.filter(p => p.id !== planId));
    }
    
    setDeletingId(null);
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Get plan stats
  const getPlanStats = (plan: StudyPlanDB) => {
    const data = plan.plan_data;
    const totalTasks = data.tasks?.length || 0;
    const completedTasks = data.tasks?.filter((t: { completed: boolean }) => t.completed).length || 0;
    const subjects = data.subjects?.length || 0;
    
    return { totalTasks, completedTasks, subjects };
  };

  // Loading state
  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Background decorations */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 py-8">
        {/* Header with User Profile */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12"
        >
          <div className="flex items-center justify-between">
            {/* Back to home */}
            <a
              href="/"
              className="flex items-center gap-2 text-white/60 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Home
            </a>

            {/* User Profile Card */}
            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <p className="text-white font-medium">
                  {profile?.full_name || user?.user_metadata?.full_name || 'User'}
                </p>
                <p className="text-white/50 text-sm">
                  {profile?.email || user?.email}
                </p>
              </div>
              
              {/* Avatar */}
              <div className="relative">
                {(profile?.avatar_url || user?.user_metadata?.avatar_url) ? (
                  <img
                    src={profile?.avatar_url || user?.user_metadata?.avatar_url}
                    alt="Profile"
                    className="w-12 h-12 rounded-full border-2 border-purple-500/50"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                    <span className="text-white font-bold text-lg">
                      {(profile?.full_name || user?.email || 'U')[0].toUpperCase()}
                    </span>
                  </div>
                )}
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-slate-900" />
              </div>

              {/* Logout Button */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={signOut}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all"
                title="Sign Out"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </motion.button>
            </div>
          </div>

          {/* Dashboard Title */}
          <div className="mt-8 text-center">
            <motion.h1
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-4xl md:text-5xl font-bold text-white mb-3"
            >
              📚 Your Study Dashboard
            </motion.h1>
            <p className="text-white/60 text-lg">
              Manage your personalized study plans
            </p>
          </div>
        </motion.header>

        {/* Stats Overview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
        >
          {[
            { label: 'Total Plans', value: plans.length, icon: '📋' },
            { label: 'Active Plans', value: plans.filter(p => p.is_active).length, icon: '🎯' },
            { 
              label: 'Total Subjects', 
              value: plans.reduce((acc, p) => acc + (p.plan_data.subjects?.length || 0), 0),
              icon: '📖'
            },
            { 
              label: 'Tasks Completed', 
              value: plans.reduce((acc, p) => acc + (p.plan_data.tasks?.filter((t: { completed: boolean }) => t.completed).length || 0), 0),
              icon: '✅'
            },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.05 }}
              className="bg-white/5 backdrop-blur-xl rounded-xl p-4 border border-white/10"
            >
              <div className="text-2xl mb-2">{stat.icon}</div>
              <div className="text-2xl font-bold text-white">{stat.value}</div>
              <div className="text-white/50 text-sm">{stat.label}</div>
            </motion.div>
          ))}
        </motion.div>

        {/* Create New Plan Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-8"
        >
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleCreatePlan}
            className="w-full py-4 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-semibold text-lg shadow-lg shadow-purple-500/25 transition-all flex items-center justify-center gap-3"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create New Study Plan
          </motion.button>
        </motion.div>

        {/* Plans Grid */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <span>📋</span> Your Study Plans
          </h2>

          {plans.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/5 backdrop-blur-xl rounded-2xl p-12 border border-white/10 text-center"
            >
              <div className="text-6xl mb-4">📚</div>
              <h3 className="text-xl font-semibold text-white mb-2">No Study Plans Yet</h3>
              <p className="text-white/60 mb-6">
                Create your first AI-powered study plan to get started!
              </p>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleCreatePlan}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-medium"
              >
                Create Your First Plan
              </motion.button>
            </motion.div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              <AnimatePresence>
                {plans.map((plan, index) => {
                  const stats = getPlanStats(plan);
                  const progress = stats.totalTasks > 0 
                    ? Math.round((stats.completedTasks / stats.totalTasks) * 100) 
                    : 0;

                  return (
                    <motion.div
                      key={plan.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() => handleOpenPlan(plan.id)}
                      className={`
                        relative group cursor-pointer
                        bg-gradient-to-br from-white/10 to-white/5 
                        backdrop-blur-xl rounded-2xl p-6 
                        border border-white/10 hover:border-purple-500/50
                        transition-all duration-300
                        ${plan.is_active ? 'ring-2 ring-purple-500/50' : ''}
                      `}
                    >
                      {/* Active Badge */}
                      {plan.is_active && (
                        <div className="absolute -top-2 -right-2 px-2 py-1 bg-purple-500 rounded-full text-xs font-medium text-white">
                          Active
                        </div>
                      )}

                      {/* Plan Header */}
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-lg font-semibold text-white group-hover:text-purple-300 transition-colors">
                            {plan.name}
                          </h3>
                          <p className="text-white/50 text-sm">
                            Created {formatDate(plan.created_at)}
                          </p>
                        </div>
                        
                        {/* Delete Button */}
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={(e) => handleDeletePlan(plan.id, e)}
                          disabled={deletingId === plan.id}
                          className="p-2 rounded-lg bg-white/5 hover:bg-red-500/20 text-white/40 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          {deletingId === plan.id ? (
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{ duration: 1, repeat: Infinity }}
                              className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full"
                            />
                          ) : (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          )}
                        </motion.button>
                      </div>

                      {/* Progress Bar */}
                      <div className="mb-4">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-white/60">Progress</span>
                          <span className="text-white font-medium">{progress}%</span>
                        </div>
                        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 0.5, delay: 0.2 + index * 0.05 }}
                            className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"
                          />
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="grid grid-cols-3 gap-2">
                        <div className="text-center p-2 bg-white/5 rounded-lg">
                          <div className="text-white font-semibold">{stats.subjects}</div>
                          <div className="text-white/40 text-xs">Subjects</div>
                        </div>
                        <div className="text-center p-2 bg-white/5 rounded-lg">
                          <div className="text-white font-semibold">{stats.completedTasks}</div>
                          <div className="text-white/40 text-xs">Done</div>
                        </div>
                        <div className="text-center p-2 bg-white/5 rounded-lg">
                          <div className="text-white font-semibold">{stats.totalTasks - stats.completedTasks}</div>
                          <div className="text-white/40 text-xs">Remaining</div>
                        </div>
                      </div>

                      {/* Exam Date */}
                      {plan.exam_date && (
                        <div className="mt-4 flex items-center gap-2 text-sm text-white/50">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          Exam: {formatDate(plan.exam_date)}
                        </div>
                      )}

                      {/* Hover Arrow */}
                      <div className="absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                        <svg className="w-6 h-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </motion.div>

        {/* Footer */}
        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-12 text-center text-white/40 text-sm"
        >
          <p>Your data is private and secure. Only you can see your study plans.</p>
        </motion.footer>
      </div>
    </div>
  );
};

export default Dashboard;
