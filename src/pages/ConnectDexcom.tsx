"use client";

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useGlucose } from '@/context/GlucoseContext';
import { showSuccess, showError } from '@/utils/toast';
import { LogOut } from 'lucide-react'; // Import LogOut icon
import { supabase } from '@/integrations/supabase/client'; // Import supabase client

const ConnectDexcom = () => {
  const navigate = useNavigate();
  const { settings } = useGlucose();

  React.useEffect(() => {
    if (settings.dexcomConnected) {
      navigate('/dashboard');
    }
  }, [settings.dexcomConnected, navigate]);

  const handleConnectDexcom = () => {
    const CLIENT_ID = import.meta.env.VITE_DEXCOM_CLIENT_ID;
    const REDIRECT_URI = import.meta.env.VITE_DEXCOM_REDIRECT_URI;

    console.log("Attempting to connect to Dexcom...");
    console.log("VITE_DEXCOM_CLIENT_ID (from app):", CLIENT_ID); // Added log
    console.log("VITE_DEXCOM_REDIRECT_URI (from app):", REDIRECT_URI); // Added log

    if (!CLIENT_ID || !REDIRECT_URI) {
      showError("Dexcom Client ID or Redirect URI is not configured. Please set VITE_DEXCOM_CLIENT_ID and VITE_DEXCOM_REDIRECT_URI environment variables.");
      return;
    }

    const dexcomAuthUrl = `https://api.dexcom.com/v2/oauth2/login?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=code&scope=offline_access`;
    console.log("Redirecting to Dexcom Auth URL:", dexcomAuthUrl); // Added log
    window.location.href = dexcomAuthUrl;
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-2xl font-bold">Connect to Dexcom</CardTitle>
          <Button variant="outline" size="icon" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardDescription className="px-6 pb-4">
          To get started, you need to authorize this application to access your Dexcom data.
        </CardDescription>
        <CardContent>
          <Button onClick={handleConnectDexcom} className="w-full">
            Connect with Dexcom
          </Button>
        </CardContent>
        <CardFooter className="text-sm text-muted-foreground">
          You will be redirected to Dexcom's website to log in and grant permission.
        </CardFooter>
      </Card>
    </div>
  );
};

export default ConnectDexcom;