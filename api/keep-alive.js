// Vercel Serverless Function - Keep Supabase Alive
// Path: /api/keep-alive
// This prevents Supabase free tier from auto-pausing due to inactivity

import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Optional: Add a simple auth token for extra security
  const authToken = req.headers['x-cron-secret'];
  const expectedToken = process.env.CRON_SECRET;
  
  // If CRON_SECRET is set, validate it
  if (expectedToken && authToken !== expectedToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Validate environment variables
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase environment variables');
    return res.status(500).json({ 
      status: 'error', 
      message: 'Server configuration error' 
    });
  }

  try {
    // Create Supabase client with service role key
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Run a minimal query to keep the database active
    // This query checks if the connection is alive
    const { data, error } = await supabase
      .from('study_plans') // Your AI Study Planner table
      .select('id')
      .limit(1);

    if (error) {
      // If table doesn't exist, try a raw SQL query instead
      const { error: rpcError } = await supabase.rpc('version');
      
      if (rpcError) {
        console.error('Supabase query error:', rpcError);
        return res.status(500).json({ 
          status: 'error', 
          message: 'Database query failed',
          error: rpcError.message 
        });
      }
    }

    // Success response
    return res.status(200).json({
      status: 'alive',
      message: 'Supabase connection successful',
      time: new Date().toISOString(),
      project: 'AI Study Planner'
    });

  } catch (error) {
    console.error('Keep-alive error:', error);
    return res.status(500).json({ 
      status: 'error', 
      message: 'Failed to ping Supabase',
      error: error.message 
    });
  }
}
