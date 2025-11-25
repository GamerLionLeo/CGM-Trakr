"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { showSuccess, showError } from '@/utils/toast';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from './SessionContext'; // Import useSession to get current user ID
import { useNavigate } from 'react-router-dom'; // Import useNavigate

interface GlucoseReading {
  timestamp: Date;
  value: number;
}

interface GlucoseSettings {
  targetLow: number;
  targetHigh: number;
  alertLow: number;
  alertHigh: number;
  dexcomConnected: boolean;
}

interface GlucoseContextType {
  currentGlucose: number | null;
  glucoseHistory: GlucoseReading[];
  settings: GlucoseSettings;
  connectDexcom: () => void;
  updateSettings: (newSettings: Partial<GlucoseSettings>) => void;
  fetchLatestGlucose: () => Promise<void>;
  disconnectDexcom: () => Promise<void>; // Add disconnectDexcom to context type
}

const GlucoseContext = createContext<GlucoseContextType | undefined>(undefined);

export const GlucoseProvider = ({ children }: { children: ReactNode }) => {
  const { session } = useSession(); // Get session from context
  const navigate = useNavigate(); // Initialize useNavigate
  const [currentGlucose, setCurrentGlucose] = useState<number | null>(null);
  const [glucoseHistory, setGlucoseHistory] = useState<GlucoseReading[]>([]);
  const [settings, setSettings] = useState<GlucoseSettings>(() => {
    if (typeof window !== 'undefined') {
      const savedSettings = localStorage.getItem('glucoseSettings');
      return savedSettings ? JSON.parse(savedSettings) : {
        targetLow: 80,
        targetHigh: 180,
        alertLow: 70,
        alertHigh: 200,
        dexcomConnected: false,
      };
    }
    return {
      targetLow: 80,
      targetHigh: 180,
      alertLow: 70,
      alertHigh: 200,
      dexcomConnected: false,
    };
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('glucoseSettings', JSON.stringify(settings));
    }
  }, [settings]);

  // Fetch Dexcom connection status from DB on session change
  useEffect(() => {
    const checkDexcomConnection = async () => {
      if (session?.user) {
        const { data, error } = await supabase
          .from('dexcom_tokens')
          .select('id')
          .eq('user_id', session.user.id)
          .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 means no rows found
          console.error('Error checking Dexcom connection:', error);
          updateSettings({ dexcomConnected: false });
        } else if (data) {
          updateSettings({ dexcomConnected: true });
        } else {
          updateSettings({ dexcomConnected: false });
        }
      } else {
        updateSettings({ dexcomConnected: false });
      }
    };
    checkDexcomConnection();
  }, [session?.user]);


  const fetchLatestGlucose = async () => {
    if (!session?.user || !settings.dexcomConnected) {
      console.log("Not connected to Dexcom or no user session, skipping glucose fetch.");
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('dexcom-fetch-glucose', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) {
        showError(`Failed to fetch glucose data: ${error.message}`);
        // If token refresh failed, prompt user to re-connect
        if (error.message.includes('re-connect Dexcom')) {
          updateSettings({ dexcomConnected: false });
          navigate('/connect-dexcom');
        }
        return;
      }

      if (data.success && data.data && data.data.egvs && data.data.egvs.length > 0) {
        const latestReading = data.data.egvs[data.data.egvs.length - 1];
        const newValue = latestReading.value;
        const newReading: GlucoseReading = { timestamp: new Date(latestReading.displayTime), value: newValue };

        setCurrentGlucose(newValue);
        setGlucoseHistory((prevHistory) => {
          const updatedHistory = [...prevHistory, newReading];
          // Keep history for the last 24 hours
          const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
          return updatedHistory.filter(reading => reading.timestamp > twentyFourHoursAgo);
        });

        // Check for alerts
        if (newValue < settings.alertLow) {
          showError(`Glucose is low: ${newValue} mg/dL!`);
        } else if (newValue > settings.alertHigh) {
          showError(`Glucose is high: ${newValue} mg/dL!`);
        }
      } else {
        console.log("No glucose data received or data format unexpected.");
        showError("No glucose data available from Dexcom.");
      }
    } catch (error: any) {
      showError(`An unexpected error occurred while fetching glucose: ${error.message}`);
    }
  };

  // Poll for glucose readings if connected
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (settings.dexcomConnected && session?.user) {
      fetchLatestGlucose(); // Fetch immediately on connect
      interval = setInterval(() => {
        fetchLatestGlucose();
      }, 60000 * 5); // Fetch every 5 minutes (Dexcom API typically updates every 5 minutes)
    }
    return () => clearInterval(interval);
  }, [settings.dexcomConnected, session?.user, settings.alertLow, settings.alertHigh, navigate]); // Added navigate to dependencies

  const connectDexcom = () => {
    console.log("Initiating Dexcom connection via OAuth flow.");
  };

  const disconnectDexcom = async () => {
    if (!session?.user) {
      showError("No user session found to disconnect Dexcom.");
      return;
    }

    try {
      const { error } = await supabase
        .from('dexcom_tokens')
        .delete()
        .eq('user_id', session.user.id);

      if (error) {
        showError(`Failed to disconnect Dexcom: ${error.message}`);
        return;
      }

      updateSettings({ dexcomConnected: false });
      setCurrentGlucose(null);
      setGlucoseHistory([]);
      showSuccess("Dexcom successfully disconnected!");
      navigate('/connect-dexcom');
    } catch (e: any) {
      showError(`An unexpected error occurred during Dexcom disconnection: ${e.message}`);
    }
  };

  const updateSettings = (newSettings: Partial<GlucoseSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
    showSuccess("Settings updated!");
  };

  return (
    <GlucoseContext.Provider
      value={{
        currentGlucose,
        glucoseHistory,
        settings,
        connectDexcom,
        updateSettings,
        fetchLatestGlucose,
        disconnectDexcom, // Provide disconnectDexcom
      }}
    >
      {children}
    </GlucoseContext.Provider>
  );
};

export const useGlucose = () => {
  const context = useContext(GlucoseContext);
  if (context === undefined) {
    throw new Error('useGlucose must be used within a GlucoseProvider');
  }
  return context;
};