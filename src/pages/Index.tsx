"use client";

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useGlucose } from "@/context/GlucoseContext";

const Index = () => {
  const navigate = useNavigate();
  const { settings } = useGlucose();

  useEffect(() => {
    if (settings.dexcomConnected) {
      navigate("/dashboard");
    } else {
      navigate("/connect-dexcom");
    }
  }, [settings.dexcomConnected, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4 text-gray-800 dark:text-gray-200">Loading...</h1>
        <p className="text-xl text-gray-600 dark:text-gray-400">Redirecting you to the app.</p>
      </div>
    </div>
  );
};

export default Index;