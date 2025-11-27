import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Verify JWT token to get the user ID
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    console.error('dexcom-fetch-glucose: Unauthorized: No Authorization header');
    return new Response(JSON.stringify({ error: 'Unauthorized: No Authorization header' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const token = authHeader.replace('Bearer ', '');

  // Initialize Supabase client with the SERVICE_ROLE_KEY
  // This client will be used to bypass RLS initially and then set the RLS context
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', // Use service role key
    {
      auth: {
        persistSession: false,
      },
    }
  );

  try {
    // Get user from the provided JWT token
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      console.error('dexcom-fetch-glucose: Error getting user from token:', userError?.message);
      return new Response(JSON.stringify({ error: 'Unauthorized: Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    console.log('dexcom-fetch-glucose: User authenticated:', user.id);

    // Set the RLS context for the database session using the custom function
    const { error: rpcError } = await supabase.rpc('set_auth_uid', { uid: user.id });
    if (rpcError) {
      console.error('dexcom-fetch-glucose: Error setting auth.uid for RLS:', rpcError);
      return new Response(JSON.stringify({ success: false, error: 'Failed to set RLS context.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    console.log('dexcom-fetch-glucose: RLS context set for user:', user.id);

    const CLIENT_ID = Deno.env.get('DEXCOM_CLIENT_ID');
    const CLIENT_SECRET = Deno.env.get('DEXCOM_CLIENT_SECRET');
    const REDIRECT_URI = Deno.env.get('DEXCOM_REDIRECT_URI');

    if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
      console.error('dexcom-fetch-glucose: Dexcom API credentials (CLIENT_ID, CLIENT_SECRET, REDIRECT_URI) are not configured as Supabase secrets.');
      return new Response(JSON.stringify({ success: false, error: 'Dexcom API credentials (CLIENT_ID, CLIENT_SECRET, REDIRECT_URI) are not configured as Supabase secrets.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Retrieve tokens from the database (now RLS should work correctly)
    let { data: dexcomTokens, error: fetchTokensError } = await supabase
      .from('dexcom_tokens')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    console.log('dexcom-fetch-glucose: Result of token query - data:', dexcomTokens ? 'Found' : 'Not Found', 'error:', fetchTokensError);

    if (fetchTokensError) { // Check for actual database errors
      console.error('dexcom-fetch-glucose: Database error while fetching Dexcom tokens for user:', fetchTokensError?.message);
      return new Response(JSON.stringify({ success: false, error: 'Database error while fetching Dexcom tokens.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    if (!dexcomTokens) {
      console.error('dexcom-fetch-glucose: Dexcom tokens not found for user. Please connect Dexcom first.');
      return new Response(JSON.stringify({ success: false, error: 'Dexcom tokens not found for user. Please connect Dexcom first.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    console.log('dexcom-fetch-glucose: Dexcom tokens retrieved from DB.');

    let currentAccessToken = dexcomTokens.access_token;
    let currentRefreshToken = dexcomTokens.refresh_token;
    let expiresAt = new Date(dexcomTokens.expires_at);

    // Check if access token is expired or about to expire (e.g., within 5 minutes)
    if (expiresAt.getTime() < Date.now() + 5 * 60 * 1000) {
      console.log('dexcom-fetch-glucose: Access token expired or near expiration, attempting to refresh...');
      // Step 6: Refresh Tokens
      const refreshResponse = await fetch('https://api.dexcom.com/v2/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          refresh_token: currentRefreshToken,
          grant_type: 'refresh_token',
        }).toString(),
      });

      if (!refreshResponse.ok) {
        const errorBody = await refreshResponse.json();
        console.error('dexcom-fetch-glucose: Dexcom token refresh failed:', refreshResponse.status, errorBody);
        // Invalidate tokens and prompt user to re-authorize
        await supabase.from('dexcom_tokens').delete().eq('user_id', user.id);
        return new Response(JSON.stringify({ success: false, error: 'Failed to refresh Dexcom token. Please re-connect Dexcom.', details: errorBody }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const refreshedTokens = await refreshResponse.json();
      currentAccessToken = refreshedTokens.access_token;
      currentRefreshToken = refreshedTokens.refresh_token; // New refresh token is issued
      expiresAt = new Date(Date.now() + refreshedTokens.expires_in * 1000);

      // Update tokens in the database
      const { error: updateError } = await supabase
        .from('dexcom_tokens')
        .update({ access_token: currentAccessToken, refresh_token: currentRefreshToken, expires_at: expiresAt })
        .eq('user_id', user.id);

      if (updateError) {
        console.error('dexcom-fetch-glucose: Error updating refreshed Dexcom tokens:', updateError);
        return new Response(JSON.stringify({ success: false, error: 'Failed to update refreshed Dexcom tokens in database.' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      console.log('dexcom-fetch-glucose: Tokens refreshed and updated successfully.');
    } else {
      console.log('dexcom-fetch-glucose: Access token is valid, no refresh needed.');
    }

    // Step 5: Make Requests Using Bearer Token
    // Fetch latest EGVs (Estimated Glucose Values)
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000); 
    const startDate = twentyFourHoursAgo.toISOString().split('.')[0]; // Format to YYYY-MM-DDTHH:mm:ss
    const endDate = now.toISOString().split('.')[0]; // Format to YYYY-MM-DDTHH:mm:ss

    // *** CORRECTED API VERSION TO V3 HERE ***
    const dexcomApiUrl = `https://api.dexcom.com/v3/users/self/egvs?startDate=${startDate}&endDate=${endDate}`;
    console.log(`dexcom-fetch-glucose: Fetching glucose data from URL: ${dexcomApiUrl}`); // New log
    console.log(`dexcom-fetch-glucose: Using access token (first 10 chars): ${currentAccessToken.substring(0, 10)}...`); // Log masked token

    const glucoseDataResponse = await fetch(dexcomApiUrl, {
      headers: {
        'Authorization': `Bearer ${currentAccessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!glucoseDataResponse.ok) {
      const errorBody = await glucoseDataResponse.json();
      console.error('dexcom-fetch-glucose: Failed to fetch glucose data from Dexcom API:', glucoseDataResponse.status, errorBody);
      return new Response(JSON.stringify({ success: false, error: 'Failed to fetch glucose data from Dexcom.', details: errorBody }), {
        status: glucoseDataResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const glucoseData = await glucoseDataResponse.json();
    console.log('dexcom-fetch-glucose: Raw glucose data response (v3):', JSON.stringify(glucoseData, null, 2)); // Log raw response
    console.log('dexcom-fetch-glucose: Successfully fetched glucose data from Dexcom.');

    return new Response(JSON.stringify({ success: true, data: glucoseData }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('dexcom-fetch-glucose: Error in dexcom-fetch-glucose Edge Function:', error);
    return new Response(JSON.stringify({ error: error.message || 'An unexpected error occurred.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});