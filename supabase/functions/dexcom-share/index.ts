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
    const { username, password } = await req.json();

    if (!username || !password) {
      return new Response(JSON.stringify({ error: 'Username and password are required.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // IMPORTANT: The 'ApplicationNotAuthenticated' error indicates that the applicationId below is invalid.
    // You need to replace 'YOUR_DEXCOM_APPLICATION_ID_HERE' with a valid Dexcom Share API Application ID.
    // This ID is typically obtained by registering your application with Dexcom or by inspecting
    // requests from an official Dexcom Share client.
    const DEXCOM_APPLICATION_ID = 'YOUR_DEXCOM_APPLICATION_ID_HERE'; 
    if (DEXCOM_APPLICATION_ID === 'YOUR_DEXCOM_APPLICATION_ID_HERE') {
      return new Response(JSON.stringify({ success: false, error: 'Dexcom Application ID is not configured. Please update the Edge Function with a valid ID.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step 1: Authenticate with Dexcom Share
    const loginResponse = await fetch('https://shareous1.dexcom.com/ShareWebServices/Services/General/LoginPublisherAccountByName', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Dexcom Share/3.0.2.11 CFNetwork/711.2.23 Darwin/14.0.0',
      },
      body: JSON.stringify({
        accountName: username,
        password: password,
        applicationId: DEXCOM_APPLICATION_ID, // Use the configured application ID
      }),
    });

    if (!loginResponse.ok) {
      const errorBody = await loginResponse.text(); // Get full response body for debugging
      console.error('Dexcom login failed:', loginResponse.status, errorBody);
      return new Response(JSON.stringify({ success: false, error: 'Dexcom login failed', details: errorBody }), {
        status: loginResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const sessionID = await loginResponse.text();

    // Step 2: Fetch latest glucose values using the session ID
    const glucoseDataResponse = await fetch(`https://shareous1.dexcom.com/ShareWebServices/Services/Publisher/ReadPublisherLatestGlucoseValues?sessionID=${sessionID}&minutes=1440&maxCount=1`, {
      headers: {
        'User-Agent': 'Dexcom Share/3.0.2.11 CFNetwork/711.2.23 Darwin/14.0.0',
      },
    });

    if (!glucoseDataResponse.ok) {
      const errorBody = await glucoseDataResponse.text(); // Get full response body for debugging
      console.error('Failed to fetch glucose data:', glucoseDataResponse.status, errorBody);
      return new Response(JSON.stringify({ success: false, error: 'Failed to fetch glucose data', details: errorBody }), {
        status: glucoseDataResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const glucoseData = await glucoseDataResponse.json();

    return new Response(JSON.stringify({ success: true, data: glucoseData }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in Dexcom Share Edge Function:', error);
    return new Response(JSON.stringify({ error: error.message || 'An unexpected error occurred.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});