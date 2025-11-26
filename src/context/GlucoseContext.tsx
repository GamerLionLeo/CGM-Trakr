"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { showSuccess, showError } from '@/utils/toast';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from './SessionContext';
import { useNavigate } from 'react-router-dom';

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
  disconnectDexcom: () => Promise<void>;
}

const GlucoseContext = createContext<GlucoseContextType | undefined>(undefined);

export const GlucoseProvider = ({ children }: { children: ReactNode }) => {
  const { session } = useSession();
  const navigate = useNavigate();
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

  // Fetch Dexcom connection status from DB or set for demo user on session change
  useEffect(() => {
    const checkDexcomConnection = async () => {
      if (session?.user) {
        // --- DEMO USER LOGIC ---
        if (session.user.email === 'demo@example.org') {
          updateSettings({ dexcomConnected: true });
          return; // Exit early for demo user
        }
        // --- END DEMO USER LOGIC ---

        const { data, error } = await supabase
          .from('dexcom_tokens')
          .select('id')
          .eq('user_id', session.user.id); // Removed .single()

        if (error && error.code !== 'PGRST116') { // PGRST116 means no rows found
          console.error('Error checking Dexcom connection:', error);
          updateSettings({ dexcomConnected: false });
        } else if (data && data.length > 0) { // Check if data is an array and has elements
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
    if (!session?.user) {
      console.log("No user session, skipping glucose fetch.");
      return;
    }

    // --- DEMO USER MOCK DATA LOGIC ---
    if (session.user.email === 'demo@example.org') {
      const mockGlucoseValue = Math.floor(Math.random() * (200 - 70 + 1)) + 70; // Random value between 70 and 200
      const mockReading: GlucoseReading = { timestamp: new Date(), value: mockGlucoseValue };

      setCurrentGlucose(mockGlucoseValue);
      setGlucoseHistory((prevHistory) => {
        const updatedHistory = [...prevHistory, mockReading];
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        return updatedHistory.filter(reading => reading.timestamp > twentyFourHoursAgo);
      });

      if (mockGlucoseValue < settings.alertLow) {
        showError(`(Demo) Glucose is low: ${mockGlucoseValue} mg/dL!`);
      } else if (mockGlucoseValue > settings.alertHigh) {
        showError(`(Demo) Glucose is high: ${mockGlucoseValue} mg/dL!`);
      }
      showSuccess("(Demo) Mock glucose data fetched.");
      return; // Exit after providing mock data
    }
    // --- END DEMO USER MOCK DATA LOGIC ---

    if (!settings.dexcomConnected) {
      console.log("Not connected to Dexcom, skipping glucose fetch.");
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
          const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
          return updatedHistory.filter(reading => reading.timestamp > twentyFourHoursAgo);
        });

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
  }, [settings.dexcomConnected, session?.user, settings.alertLow, settings.alertHigh, navigate]);

  const connectDexcom = () => {
    // --- DEMO USER LOGIC ---
    if (session?.user?.email === 'demo@example.org') {
      showSuccess("(Demo) Dexcom is already simulated as connected for this account.");
      return;
    }
    // --- END DEMO USER LOGIC ---
    console.log("Initiating Dexcom connection via OAuth flow.");
  };

  const disconnectDexcom = async () => {
    if (!session?.user) {
      showError("No user session found to disconnect Dexcom.");
      return;
    }

    // --- DEMO USER LOGIC ---
    if (session.user.email === 'demo@example.org') {
      updateSettings({ dexcomConnected: false });
      setCurrentGlucose(null);
      setGlucoseHistory([]);
      showSuccess("(Demo) Dexcom simulation disconnected for this account.");
      navigate('/connect-dexcom');
      return;
    }
    // --- END DEMO USER LOGIC ---

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
        disconnectDexcom,
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