"use client";

import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useGlucose } from '@/context/GlucoseContext';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import { Settings as SettingsIcon } from 'lucide-react';

const GlucoseChart = ({ data, timeframe }: { data: any[]; timeframe: string }) => {
  const formatXAxis = (tickItem: number) => {
    if (timeframe === '24h') {
      return format(new Date(tickItem), 'HH:mm');
    }
    return format(new Date(tickItem), 'MMM dd');
  };

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart
        data={data.map(d => ({ ...d, timestamp: d.timestamp.getTime() }))}
        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="timestamp"
          tickFormatter={formatXAxis}
          type="number"
          domain={['dataMin', 'dataMax']}
          minTickGap={30}
        />
        <YAxis />
        <Tooltip labelFormatter={(label) => format(new Date(label), 'MMM dd, HH:mm')} />
        <Line type="monotone" dataKey="value" stroke="#8884d8" activeDot={{ r: 8 }} />
      </LineChart>
    </ResponsiveContainer>
  );
};

const Dashboard = () => {
  const { currentGlucose, glucoseHistory, settings } = useGlucose();

  const getGlucoseColor = (glucose: number | null) => {
    if (glucose === null) return 'text-gray-500';
    if (glucose < settings.targetLow) return 'text-blue-500';
    if (glucose > settings.targetHigh) return 'text-red-500';
    return 'text-green-500';
  };

  // Filter history for last 24 hours
  const last24HoursHistory = glucoseHistory.filter(
    (reading) => reading.timestamp.getTime() > Date.now() - 24 * 60 * 60 * 1000
  );

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-4 md:p-8">
      <div className="max-w-4xl mx-auto grid gap-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-3xl font-bold">Glucose Dashboard</h1>
          <Button variant="outline" size="icon" asChild>
            <Link to="/settings">
              <SettingsIcon className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Current Glucose</CardTitle>
            <CardDescription>Last updated: {currentGlucose ? format(new Date(), 'HH:mm:ss') : 'N/A'}</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className={`text-6xl font-extrabold ${getGlucoseColor(currentGlucose)}`}>
              {currentGlucose !== null ? currentGlucose : '--'}
              <span className="text-2xl ml-2 text-gray-600 dark:text-gray-400">mg/dL</span>
            </p>
            <p className="text-lg text-muted-foreground mt-2">
              Target: {settings.targetLow} - {settings.targetHigh} mg/dL
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Glucose History (Last 24 Hours)</CardTitle>
            <CardDescription>Trends over time</CardDescription>
          </CardHeader>
          <CardContent>
            {last24HoursHistory.length > 1 ? (
              <GlucoseChart data={last24HoursHistory} timeframe="24h" />
            ) : (
              <p className="text-center text-muted-foreground">No sufficient data to display chart yet. Please wait for more readings.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Alert Status</CardTitle>
            <CardDescription>Current alert thresholds</CardDescription>
          </CardHeader>
          <CardContent>
            <p>Low Alert: <span className="font-semibold">{settings.alertLow} mg/dL</span></p>
            <p>High Alert: <span className="font-semibold">{settings.alertHigh} mg/dL</span></p>
            <p className="text-sm text-muted-foreground mt-2">
              You will receive a toast notification if your glucose goes outside these ranges.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;