"use client";

import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';
import { useGlucose } from '@/context/GlucoseContext';

const DexcomCallback = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams(); // Use setSearchParams
  const { updateSettings } = useGlucose();

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code');
      const error = searchParams.get('error');

      if (error) {
        showError(`Dexcom authorization denied: ${error}`);
        navigate('/connect-dexcom');
        return;
      }

      if (code) {
        try {
          // Call the Edge Function to exchange the authorization code for tokens
          const { data, error: edgeFunctionError } = await supabase.functions.invoke('dexcom-oauth-token', {
            body: { authorizationCode: code },
            headers: {
              Authorization: `Bearer ${await supabase.auth.getSession().then(s => s.data.session?.access_token)}`,
            },
          });

          if (edgeFunctionError) {
            showError(`Failed to exchange Dexcom code: ${edgeFunctionError.message}`);
            navigate('/connect-dexcom');
            return;
          }

          if (data.success) {
            updateSettings({ dexcomConnected: true });
            showSuccess("Successfully connected to Dexcom!");
            navigate('/dashboard');
          } else {
            showError(data.error || "Failed to connect to Dexcom. Please try again.");
            navigate('/connect-dexcom');
          }
        } catch (e: any) {
          showError(`An unexpected error occurred during Dexcom token exchange: ${e.message}`);
          navigate('/connect-dexcom');
        } finally {
          // Clear the code from the URL to prevent re-use on refresh
          searchParams.delete('code');
          setSearchParams(searchParams, { replace: true });
        }
      } else {
        showError("No authorization code received from Dexcom.");
        navigate('/connect-dexcom');
      }
    };

    handleCallback();
  }, [searchParams, navigate, updateSettings, setSearchParams]); // Add setSearchParams to dependency array

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