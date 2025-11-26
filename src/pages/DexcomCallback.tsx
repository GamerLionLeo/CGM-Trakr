"use client";

import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { useGlucose } from '@/context/GlucoseContext';

const DexcomCallback = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { updateSettings } = useGlucose();

  useEffect(() => {
    console.log("DexcomCallback component mounted.");
    console.log("Full URL:", window.location.href);

    const code = searchParams.get('code');
    const error = searchParams.get('error');

    console.log('Code from URL:', code);
    console.log('Error from URL:', error);

    const handleCallback = async () => {
      if (error) {
        console.error("Dexcom authorization error:", error);
        showError(`Dexcom authorization denied: ${error}`);
        // navigate('/connect-dexcom'); // Temporarily disabled for debugging
        return;
      }

      if (code) {
        console.log("Authorization code received:", code);
        try {
          const sessionResponse = await supabase.auth.getSession();
          const accessToken = sessionResponse.data.session?.access_token;

          if (!accessToken) {
            console.error("User not authenticated when trying to exchange Dexcom code.");
            showError("User not authenticated. Please log in again.");
            // navigate('/login'); // Temporarily disabled for debugging
            return;
          }

          // Call the Edge Function to exchange the authorization code for tokens
          const { data, error: edgeFunctionError } = await supabase.functions.invoke('dexcom-oauth-token', {
            body: { authorizationCode: code },
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          });

          if (edgeFunctionError) {
            console.error("Edge function invocation error:", edgeFunctionError);
            showError(`Failed to exchange Dexcom code: ${edgeFunctionError.message}`);
            // navigate('/connect-dexcom'); // Temporarily disabled for debugging
            return;
          }

          if (data.success) {
            updateSettings({ dexcomConnected: true });
            showSuccess("Successfully connected to Dexcom!");
            // navigate('/dashboard'); // Temporarily disabled for debugging
          } else {
            console.error("Edge function returned failure:", data.error);
            showError(data.error || "Failed to connect to Dexcom. Please try again.");
            // navigate('/connect-dexcom'); // Temporarily disabled for debugging
          }
        } catch (e: any) {
          console.error("Unexpected error during Dexcom token exchange:", e);
          showError(`An unexpected error occurred during Dexcom token exchange: ${e.message}`);
          // navigate('/connect-dexcom'); // Temporarily disabled for debugging
        } finally {
          // Temporarily commented out to keep params in URL for inspection
          // const newSearchParams = new URLSearchParams(searchParams);
          // newSearchParams.delete('code');
          // newSearchParams.delete('error');
          // setSearchParams(newSearchParams, { replace: true });
        }
      } else {
        console.warn("No authorization code received from Dexcom in URL.");
        showError("No authorization code received from Dexcom.");
        // navigate('/connect-dexcom'); // Temporarily disabled for debugging
      }
    };

    handleCallback();
  }, [searchParams, navigate, updateSettings, setSearchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4 text-gray-800 dark:text-gray-200">Connecting to Dexcom...</h1>
        <p className="text-xl text-gray-600 dark:text-gray-400">Please wait while we secure your connection.</p>
      </div>
    </div>
  );
};

export default DexcomCallback;