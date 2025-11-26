"use client";

import React, { useEffect, useState } from 'react'; // Import useState
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { useGlucose } from '@/context/GlucoseContext';

const DexcomCallback = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { updateSettings } = useGlucose();
  const [isProcessing, setIsProcessing] = useState(false); // New state to prevent duplicate calls

  useEffect(() => {
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    const handleCallback = async () => {
      if (isProcessing) {
        return; // Already processing, prevent duplicate calls
      }

      if (error) {
        console.error("Dexcom authorization error:", error);
        showError(`Dexcom authorization denied: ${error}`);
        navigate('/connect-dexcom');
        return;
      }

      if (code) {
        setIsProcessing(true); // Set processing state

        // Clear the code and error from the URL immediately
        const newSearchParams = new URLSearchParams(searchParams);
        newSearchParams.delete('code');
        newSearchParams.delete('error');
        setSearchParams(newSearchParams, { replace: true });

        console.log("Authorization code received:", code);
        try {
          const sessionResponse = await supabase.auth.getSession();
          const accessToken = sessionResponse.data.session?.access_token;

          if (!accessToken) {
            console.error("User not authenticated when trying to exchange Dexcom code.");
            showError("User not authenticated. Please log in again.");
            navigate('/login');
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
            navigate('/connect-dexcom');
            return;
          }

          if (data.success) {
            updateSettings({ dexcomConnected: true });
            showSuccess("Successfully connected to Dexcom!");
            navigate('/dashboard');
          } else {
            console.error("Edge function returned failure:", data.error);
            showError(data.error || "Failed to connect to Dexcom. Please try again.");
            navigate('/connect-dexcom');
          }
        } catch (e: any) {
          console.error("Unexpected error during Dexcom token exchange:", e);
          showError(`An unexpected error occurred during Dexcom token exchange: ${e.message}`);
          navigate('/connect-dexcom');
        } finally {
          setIsProcessing(false); // Reset processing state
        }
      } else {
        // Only show this warning if not currently processing and no code was found
        if (!isProcessing) {
          console.warn("No authorization code received from Dexcom in URL.");
          showError("No authorization code received from Dexcom.");
          navigate('/connect-dexcom');
        }
      }
    };

    // Only run handleCallback if a code or error is present and not already processing
    if ((code || error) && !isProcessing) {
      handleCallback();
    }
  }, [searchParams, navigate, updateSettings, setSearchParams, isProcessing]); // Add isProcessing to dependencies

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