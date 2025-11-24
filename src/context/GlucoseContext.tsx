"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { showSuccess, showError } from '@/utils/toast';

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
  connectDexcom: (username: string, password: string) => Promise<boolean>;
  updateSettings: (newSettings: Partial<GlucoseSettings>) => void;
  simulateGlucoseReading: () => void;
}

const GlucoseContext = createContext<GlucoseContextType | undefined>(undefined);

export const GlucoseProvider = ({ children }: { children: ReactNode }) => {
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

  // Simulate glucose readings
  useEffect(() => {
    if (settings.dexcomConnected) {
      const interval = setInterval(() => {
        simulateGlucoseReading();
      }, 10000); // Update every 10 seconds for demonstration
      return () => clearInterval(interval);
    }
  }, [settings.dexcomConnected, settings.alertLow, settings.alertHigh]);

  const simulateGlucoseReading = () => {
    const newValue = Math.floor(Math.random() * (250 - 60 + 1)) + 60; // Random value between 60 and 250
    const newReading: GlucoseReading = { timestamp: new Date(), value: newValue };
    setCurrentGlucose(newValue);
    setGlucoseHistory((prevHistory) => {
      const updatedHistory = [...prevHistory, newReading];
      // Keep history for the last 24 hours (approx 8640 readings if updated every 10s)
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      return updatedHistory.filter(reading => reading.timestamp > twentyFourHoursAgo);
    });

    // Check for alerts
    if (newValue < settings.alertLow) {
      showError(`Glucose is low: ${newValue} mg/dL!`);
    } else if (newValue > settings.alertHigh) {
      showError(`Glucose is high: ${newValue} mg/dL!`);
    }
  };

  const connectDexcom = async (username: string, password: string) => {
    // Simulate API call
    return new Promise((resolve) => {
      setTimeout(() => {
        if (username === "test" && password === "password") {
          setSettings(prev => ({ ...prev, dexcomConnected: true }));
          simulateGlucoseReading(); // Get initial reading
          showSuccess("Successfully connected to Dexcom (simulated)!");
          resolve(true);
        } else {
          showError("Failed to connect to Dexcom. Invalid credentials (simulated).");
          resolve(false);
        }
      }, 1500);
    });
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
        simulateGlucoseReading,
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