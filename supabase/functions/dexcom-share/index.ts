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

    // --- START REAL DEXCOM API INTEGRATION ---
    // You will need to uncomment and fill in the actual Dexcom API endpoints and logic here.
    // This is a conceptual example and might require adjustments based on Dexcom's current API.

    // Step 1: Authenticate with Dexcom Share
    const loginResponse = await fetch('https://shareous1.dexcom.com/ShareWebServices/Services/General/LoginPublisherAccountByName', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Dexcom Share/3.0.2.11 CFNetwork/711.2.23 Darwin/14.0.0', // Common User-Agent for Dexcom
      },
      body: JSON.stringify({
        accountName: username,
        password: password,
        applicationId: 'd8665ade-9673-4e27-9782-5034c17b576d', // This is a known Dexcom application ID
      }),
    });

    if (!loginResponse.ok) {
      const errorText = await loginResponse.text();
      console.error('Dexcom login failed:', loginResponse.status, errorText);
      return new Response(JSON.stringify({ success: false, error: 'Dexcom login failed', details: errorText }), {
        status: loginResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const sessionID = await loginResponse.text(); // Dexcom login often returns a plain text session ID

    // Step 2: Fetch latest glucose values using the session ID
    const glucoseDataResponse = await fetch(`https://shareous1.dexcom.com/ShareWebServices/Services/Publisher/ReadPublisherLatestGlucoseValues?sessionID=${sessionID}&minutes=1440&maxCount=1`, {
      headers: {
        'User-Agent': 'Dexcom Share/3.0.2.11 CFNetwork/711.2.23 Darwin/14.0.0',
      },
    });

    if (!glucoseDataResponse.ok) {
      const errorText = await glucoseDataResponse.text();
      console.error('Failed to fetch glucose data:', glucoseDataResponse.status, errorText);
      return new Response(JSON.stringify({ success: false, error: 'Failed to fetch glucose data', details: errorText }), {
        status: glucoseDataResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const glucoseData = await glucoseDataResponse.json();

    // Return the actual glucose data
    return new Response(JSON.stringify({ success: true, data: glucoseData }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

    // --- END REAL DEXCOM API INTEGRATION ---

  } catch (error) {
    console.error('Error in Dexcom Share Edge Function:', error);
    return new Response(JSON.stringify({ error: error.message || 'An unexpected error occurred.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});