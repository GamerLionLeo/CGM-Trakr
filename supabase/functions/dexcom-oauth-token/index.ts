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

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    {
      auth: {
        persistSession: false,
      },
    }
  );

  try {
    // Verify JWT token to get the user ID
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized: No Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      console.error('Error getting user from token:', userError?.message);
      return new Response(JSON.stringify({ error: 'Unauthorized: Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { authorizationCode } = await req.json();

    if (!authorizationCode) {
      return new Response(JSON.stringify({ error: 'Authorization code is required.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const CLIENT_ID = Deno.env.get('DEXCOM_CLIENT_ID');
    const CLIENT_SECRET = Deno.env.get('DEXCOM_CLIENT_SECRET');
    const REDIRECT_URI = Deno.env.get('DEXCOM_REDIRECT_URI');
    console.log('Edge Function using REDIRECT_URI:', REDIRECT_URI); // Added log

    if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
      return new Response(JSON.stringify({ success: false, error: 'Dexcom API credentials (CLIENT_ID, CLIENT_SECRET, REDIRECT_URI) are not configured as Supabase secrets.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step 4: Exchange authorization_code for access_token and refresh_token
    const tokenResponse = await fetch('https://api.dexcom.com/v2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code: authorizationCode,
        grant_type: 'authorization_code',
        redirect_uri: REDIRECT_URI,
      }).toString(),
    });

    if (!tokenResponse.ok) {
      const errorBody = await tokenResponse.json();
      console.error('Dexcom token exchange failed:', tokenResponse.status, errorBody);
      return new Response(JSON.stringify({ success: false, error: 'Failed to exchange authorization code for tokens.', details: errorBody }), {
        status: tokenResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { access_token, refresh_token, expires_in } = await tokenResponse.json();
    const expiresAt = new Date(Date.now() + expires_in * 1000); // Calculate expiration time

    // Store tokens in the database
    const { data: existingTokens, error: fetchError } = await supabase
      .from('dexcom_tokens')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 means no rows found
      console.error('Error fetching existing Dexcom tokens:', fetchError);
      return new Response(JSON.stringify({ success: false, error: 'Database error while checking existing tokens.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (existingTokens) {
      // Update existing tokens
      const { error: updateError } = await supabase
        .from('dexcom_tokens')
        .update({ access_token, refresh_token, expires_at })
        .eq('user_id', user.id);

      if (updateError) {
        console.error('Error updating Dexcom tokens:', updateError);
        return new Response(JSON.stringify({ success: false, error: 'Failed to update Dexcom tokens in database.' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else {
      // Insert new tokens
      const { error: insertError } = await supabase
        .from('dexcom_tokens')
        .insert({ user_id: user.id, access_token, refresh_token, expires_at });

      if (insertError) {
        console.error('Error inserting Dexcom tokens:', insertError);
        return new Response(JSON.stringify({ success: false, error: 'Failed to insert Dexcom tokens into database.' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in dexcom-oauth-token Edge Function:', error);
    return new Response(JSON.stringify({ error: error.message || 'An unexpected error occurred.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});