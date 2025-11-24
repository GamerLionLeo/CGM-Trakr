"use client";

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useGlucose } from '@/context/GlucoseContext';
import { ArrowLeft } from 'lucide-react';

const Settings = () => {
  const navigate = useNavigate();
  const { settings, updateSettings } = useGlucose();

  const [targetLow, setTargetLow] = useState(settings.targetLow.toString());
  const [targetHigh, setTargetHigh] = useState(settings.targetHigh.toString());
  const [alertLow, setAlertLow] = useState(settings.alertLow.toString());
  const [alertHigh, setAlertHigh] = useState(settings.alertHigh.toString());

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({
      targetLow: parseInt(targetLow),
      targetHigh: parseInt(targetHigh),
      alertLow: parseInt(alertLow),
      alertHigh: parseInt(alertHigh),
    });
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-4 md:p-8">
      <div className="max-w-md mx-auto">
        <div className="flex items-center mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')} className="mr-2">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-3xl font-bold">Settings</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Glucose Targets</CardTitle>
            <CardDescription>Set your personal ideal glucose range.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="targetLow">Target Low (mg/dL)</Label>
              <Input
                id="targetLow"
                type="number"
                value={targetLow}
                onChange={(e) => setTargetLow(e.target.value)}
                min="1"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="targetHigh">Target High (mg/dL)</Label>
              <Input
                id="targetHigh"
                type="number"
                value={targetHigh}
                onChange={(e) => setTargetHigh(e.target.value)}
                min="1"
                required
              />
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Alert Thresholds</CardTitle>
            <CardDescription>Receive notifications when glucose levels are outside these ranges.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="alertLow">Alert Low (mg/dL)</Label>
              <Input
                id="alertLow"
                type="number"
                value={alertLow}
                onChange={(e) => setAlertLow(e.target.value)}
                min="1"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="alertHigh">Alert High (mg/dL)</Label>
              <Input
                id="alertHigh"
                type="number"
                value={alertHigh}
                onChange={(e) => setAlertHigh(e.target.value)}
                min="1"
                required
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={handleSave} className="w-full">Save Settings</Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default Settings;