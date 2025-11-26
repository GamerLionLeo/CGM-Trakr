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

  // Verify JWT token to get the user ID and pass it to the Supabase client
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    console.error('Unauthorized: No Authorization header');
    return new Response(JSON.stringify({ error: 'Unauthorized: No Authorization header' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const token = authHeader.replace('Bearer ', '');

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    {
      global: {
        headers: {
          Authorization: `Bearer ${token}`, // Pass the user's JWT to the Supabase client
        },
      },
      auth: {
        persistSession: false,
      },
    }
  );

  try {
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
      console.error('Authorization code is required.');
      return new Response(JSON.stringify({ error: 'Authorization code is required.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const CLIENT_ID = Deno.env.get('DEXCOM_CLIENT_ID');
    const CLIENT_SECRET = Deno.env.get('DEXCOM_CLIENT_SECRET');
    const REDIRECT_URI = Deno.env.get('DEXCOM_REDIRECT_URI');
    console.log('Edge Function using REDIRECT_URI:', REDIRECT_URI);

    if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
      console.error('Dexcom API credentials (CLIENT_ID, CLIENT_SECRET, REDIRECT_URI) are not configured as Supabase secrets.');
      return new Response(JSON.stringify({ success: false, error: 'Dexcom API credentials (CLIENT_ID, CLIENT_SECRET, REDIRECT_URI) are not configured as Supabase secrets.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Dexcom Token Exchange Request Details:');
    console.log('  CLIENT_ID:', CLIENT_ID);
    console.log('  CLIENT_SECRET:', CLIENT_SECRET ? '********' : 'NOT SET'); // Mask secret for security
    console.log('  REDIRECT_URI:', REDIRECT_URI);
    console.log('  Authorization Code:', authorizationCode);

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
    const expiresAt = new Date(Date.now() + expires_in * 1000);

    const { data: existingTokens, error: fetchError } = await supabase
      .from('dexcom_tokens')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle(); // Changed from .single() to .maybeSingle()

    if (fetchError) { // Check for actual database errors
      console.error('Error fetching existing Dexcom tokens:', fetchError);
      return new Response(JSON.stringify({ success: false, error: 'Database error while checking existing tokens.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (existingTokens) {
      const { error: updateError } = await supabase
        .from('dexcom_tokens')
        .update({ access_token, refresh_token, expires_at: expiresAt })
        .eq('user_id', user.id);

      if (updateError) {
        console.error('Error updating Dexcom tokens:', updateError);
        return new Response(JSON.stringify({ success: false, error: 'Failed to update Dexcom tokens in database.' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      console.log('Dexcom tokens updated successfully for user:', user.id);
    } else {
      const { error: insertError } = await supabase
        .from('dexcom_tokens')
        .insert({ user_id: user.id, access_token, refresh_token, expires_at: expiresAt });

      if (insertError) {
        console.error('Error inserting Dexcom tokens:', insertError);
        return new Response(JSON.stringify({ success: false, error: 'Failed to insert Dexcom tokens into database.' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      console.log('Dexcom tokens inserted successfully for user:', user.id);
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