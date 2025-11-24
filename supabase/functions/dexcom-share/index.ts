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

  // Initialize Supabase client for the Edge Function
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    {
      auth: {
        persistSession: false,
      },
    }
  );

  // Manual authentication handling (since verify_jwt is false by default for Edge Functions)
  // For this specific function, we're expecting username/password in the body,
  // not a JWT from the client, so we'll skip JWT verification here.
  // If you were protecting this function with Supabase Auth, you'd verify the JWT.

  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return new Response(JSON.stringify({ error: 'Username and password are required.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // --- IMPORTANT ---
    // This is where you would integrate with the actual Dexcom Share API.
    // You would typically make an HTTP POST request to Dexcom's login endpoint
    // with the provided username and password, then handle the response.
    // For demonstration, we'll simulate a successful login.
    //
    // Example (conceptual, replace with actual Dexcom API calls):
    // const dexcomLoginResponse = await fetch('https://shareous1.dexcom.com/ShareWebServices/Services/General/LoginPublisherAccountByName', {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //     'User-Agent': 'Dexcom Share/3.0.2.11 CFNetwork/711.2.23 Darwin/14.0.0',
    //   },
    //   body: JSON.stringify({
    //     accountName: username,
    //     password: password,
    //     applicationId: 'd8665ade-9673-4e27-9782-5034c17b576d', // This is a known Dexcom application ID
    //   }),
    // });
    //
    // if (!dexcomLoginResponse.ok) {
    //   const errorData = await dexcomLoginResponse.json();
    //   return new Response(JSON.stringify({ error: 'Dexcom login failed', details: errorData }), {
    //     status: dexcomLoginResponse.status,
    //     headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    //   });
    // }
    //
    // const sessionID = await dexcomLoginResponse.text(); // Or parse JSON if it returns JSON
    //
    // Then use the sessionID to fetch glucose data:
    // const glucoseDataResponse = await fetch(`https://shareous1.dexcom.com/ShareWebServices/Services/Publisher/ReadPublisherLatestGlucoseValues?sessionID=${sessionID}&minutes=1440&maxCount=1`, {
    //   headers: {
    //     'User-Agent': 'Dexcom Share/3.0.2.11 CFNetwork/711.2.23 Darwin/14.0.0',
    //   },
    // });
    //
    // const glucoseData = await glucoseDataResponse.json();
    // return new Response(JSON.stringify({ success: true, data: glucoseData }), {
    //   status: 200,
    //   headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    // });
    // --- END IMPORTANT ---

    // Simulated successful response for now
    if (username === "test" && password === "password") {
      return new Response(JSON.stringify({ success: true, message: "Successfully connected to Dexcom (via Edge Function simulation)." }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } else {
      return new Response(JSON.stringify({ success: false, error: "Invalid Dexcom credentials (via Edge Function simulation)." }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (error) {
    console.error('Error in Dexcom Share Edge Function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});