"use client";

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Shield, AlertTriangle, Activity, Clock,
  TrendingUp, TrendingDown, Eye, Users, Zap, Brain,
  RefreshCw, Download, Calendar, MapPin, ChevronRight
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart,
  Line, Area, AreaChart, Legend, RadarChart, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts';
import { summarizeLogs, SummaryResult, LogData } from '../actions/summarize';

// Generate realistic mock data
function generateMockData() {
  const now = new Date();
  const logs: LogData[] = [];
  const locations = ['Entrance A', 'Parking B1', 'Lobby', 'Hallway 2', 'Server Room', 'Exit C'];
  const safeDescriptions = [
    'Person detected - normal activity',
    'Movement tracked - authorized personnel',
    'Face recognized - employee',
    'Activity scan - all clear',
    'Posture normal - monitoring continues',
    'Eyes open, alert state confirmed',
    'Routine patrol detected'
  ];
  const dangerDescriptions = [
    'ALERT: Eyes closed - possible drowsiness',
    'WARNING: Head drooping detected',
    'ALERT: Person stumbling',
    'CRITICAL: Fall detected',
    'WARNING: Aggressive posture',
    'ALERT: Distress signal',
    'WARNING: Unauthorized entry attempt',
    'ALERT: Loitering detected'
  ];

  // Generate 200 events over the past 24 hours
  for (let i = 0; i < 200; i++) {
    const minutesAgo = Math.floor(Math.random() * 1440);
    const timestamp = new Date(now.getTime() - minutesAgo * 60000);
    const isDangerous = Math.random() < 0.25; // 25% danger rate

    logs.push({
      timestamp: timestamp.toLocaleTimeString('en-US', { hour12: false }),
      description: isDangerous
        ? dangerDescriptions[Math.floor(Math.random() * dangerDescriptions.length)]
        : safeDescriptions[Math.floor(Math.random() * safeDescriptions.length)],
      isDangerous,
      severity: isDangerous ? Math.floor(Math.random() * 3) + 2 : 1,
      location: locations[Math.floor(Math.random() * locations.length)]
    });
  }

  return logs.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

// Process data for charts
function processChartData(logs: LogData[]) {
  // Hourly breakdown
  const hourlyData: { [key: string]: { safe: number; danger: number } } = {};
  for (let i = 0; i < 24; i++) {
    const hour = i.toString().padStart(2, '0');
    hourlyData[hour] = { safe: 0, danger: 0 };
  }

  logs.forEach(log => {
    const hour = log.timestamp.split(':')[0];
    if (hourlyData[hour]) {
      if (log.isDangerous) {
        hourlyData[hour].danger++;
      } else {
        hourlyData[hour].safe++;
      }
    }
  });

  const timelineData = Object.entries(hourlyData).map(([hour, data]) => ({
    time: `${hour}:00`,
    safe: data.safe,
    danger: data.danger,
    total: data.safe + data.danger
  }));

  // Location breakdown
  const locationData: { [key: string]: { total: number; danger: number } } = {};
  logs.forEach(log => {
    if (log.location) {
      if (!locationData[log.location]) {
        locationData[log.location] = { total: 0, danger: 0 };
      }
      locationData[log.location].total++;
      if (log.isDangerous) locationData[log.location].danger++;
    }
  });

  const locationChartData = Object.entries(locationData).map(([name, data]) => ({
    name,
    incidents: data.total,
    alerts: data.danger,
    rate: Math.round((data.danger / data.total) * 100)
  }));

  // Severity distribution
  const severityData = [
    { name: 'Low (1)', value: logs.filter(l => l.severity === 1).length, color: '#22c55e' },
    { name: 'Medium (2)', value: logs.filter(l => l.severity === 2).length, color: '#f59e0b' },
    { name: 'High (3)', value: logs.filter(l => l.severity === 3).length, color: '#ef4444' },
    { name: 'Critical (4+)', value: logs.filter(l => l.severity >= 4).length, color: '#dc2626' },
  ];

  // Overall pie chart
  const dangerCount = logs.filter(l => l.isDangerous).length;
  const pieData = [
    { name: 'Safe', value: logs.length - dangerCount, color: '#22c55e' },
    { name: 'Dangerous', value: dangerCount, color: '#ef4444' },
  ];

  // Radar data (threat categories)
  const radarData = [
    { category: 'Drowsiness', value: Math.floor(Math.random() * 40) + 10, fullMark: 100 },
    { category: 'Physical Threat', value: Math.floor(Math.random() * 30) + 5, fullMark: 100 },
    { category: 'Unauthorized', value: Math.floor(Math.random() * 25) + 5, fullMark: 100 },
    { category: 'Medical', value: Math.floor(Math.random() * 20) + 5, fullMark: 100 },
    { category: 'Loitering', value: Math.floor(Math.random() * 35) + 10, fullMark: 100 },
    { category: 'Distress', value: Math.floor(Math.random() * 25) + 5, fullMark: 100 },
  ];

  return { timelineData, locationChartData, severityData, pieData, radarData };
}

// Stat Card Component
function StatCard({ 
  title, 
  value, 
  change, 
  icon: Icon, 
  color 
}: { 
  title: string; 
  value: string | number; 
  change?: number;
  icon: React.ElementType; 
  color: string;
}) {
  return (
    <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-zinc-500 text-xs uppercase tracking-wide">{title}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
          {change !== undefined && (
            <div className={`flex items-center gap-1 mt-1 text-xs ${change >= 0 ? 'text-red-400' : 'text-emerald-400'}`}>
              {change >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              <span>{Math.abs(change)}% vs yesterday</span>
            </div>
          )}
        </div>
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}

// Custom tooltip for charts
function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string }[]; label?: string }) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 shadow-xl">
        <p className="text-xs text-zinc-400 mb-1">{label}</p>
        {payload.map((p, i) => (
          <p key={i} className="text-sm font-semibold" style={{ color: p.name === 'danger' || p.name === 'alerts' ? '#ef4444' : '#22c55e' }}>
            {p.name}: {p.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
}

export default function StatsPage() {
  const [logs, setLogs] = useState<LogData[]>([]);
  const [summary, setSummary] = useState<SummaryResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [chartData, setChartData] = useState<ReturnType<typeof processChartData> | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Load initial data
  useEffect(() => {
    const mockLogs = generateMockData();
    setLogs(mockLogs);
    setChartData(processChartData(mockLogs));
    setLastUpdated(new Date());
  }, []);

  // Generate AI summary
  const generateSummary = useCallback(async () => {
    if (logs.length === 0) return;
    
    setIsLoading(true);
    try {
      const result = await summarizeLogs(logs);
      setSummary(result);
    } catch (error) {
      console.error('Failed to generate summary:', error);
    }
    setIsLoading(false);
  }, [logs]);

  // Auto-generate summary on load
  useEffect(() => {
    if (logs.length > 0 && !summary) {
      generateSummary();
    }
  }, [logs, summary, generateSummary]);

  // Refresh data
  const refreshData = () => {
    const newLogs = generateMockData();
    setLogs(newLogs);
    setChartData(processChartData(newLogs));
    setLastUpdated(new Date());
    setSummary(null);
  };

  // Calculate stats
  const totalEvents = logs.length;
  const dangerEvents = logs.filter(l => l.isDangerous).length;
  const dangerRate = totalEvents > 0 ? ((dangerEvents / totalEvents) * 100).toFixed(1) : '0';
  const avgSeverity = totalEvents > 0 ? (logs.reduce((a, b) => a + b.severity, 0) / totalEvents).toFixed(2) : '0';

  const getThreatLevelColor = (level?: string) => {
    switch (level) {
      case 'critical': return 'bg-red-500 text-white';
      case 'high': return 'bg-orange-500 text-white';
      case 'medium': return 'bg-yellow-500 text-black';
      default: return 'bg-green-500 text-white';
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-zinc-950/95 backdrop-blur border-b border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/realtime"
              className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors"
            >
              <ArrowLeft size={18} />
              <span className="text-xs uppercase font-bold">Live</span>
            </Link>
            <div className="h-5 w-px bg-zinc-700" />
            <div className="flex items-center gap-2">
              <Shield className="text-cyan-500" size={20} />
              <span className="text-lg font-bold">EYEWATCH</span>
              <span className="text-zinc-600 text-sm">Analytics</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {lastUpdated && (
              <span className="text-xs text-zinc-500 flex items-center gap-1">
                <Clock size={12} />
                Updated {lastUpdated.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={refreshData}
              className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors"
            >
              <RefreshCw size={14} />
              Refresh
            </button>
            <button className="flex items-center gap-2 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-sm transition-colors">
              <Download size={14} />
              Export
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            title="Total Events"
            value={totalEvents}
            change={12}
            icon={Eye}
            color="bg-cyan-500/20 text-cyan-400"
          />
          <StatCard
            title="Danger Alerts"
            value={dangerEvents}
            change={-8}
            icon={AlertTriangle}
            color="bg-red-500/20 text-red-400"
          />
          <StatCard
            title="Danger Rate"
            value={`${dangerRate}%`}
            icon={Activity}
            color="bg-orange-500/20 text-orange-400"
          />
          <StatCard
            title="Avg Severity"
            value={avgSeverity}
            icon={Zap}
            color="bg-purple-500/20 text-purple-400"
          />
        </div>

        {/* AI Summary Section */}
        <div className="bg-gradient-to-br from-zinc-900 via-zinc-900 to-cyan-950/30 rounded-xl border border-zinc-800 overflow-hidden">
          <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className="text-cyan-400" size={20} />
              <h2 className="font-bold">AI Security Analysis</h2>
              {summary && (
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ml-2 ${getThreatLevelColor(summary.overallThreatLevel)}`}>
                  {summary.overallThreatLevel} threat
                </span>
              )}
            </div>
            <button
              onClick={generateSummary}
              disabled={isLoading}
              className="flex items-center gap-2 px-3 py-1.5 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-400 rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
              {isLoading ? 'Analyzing...' : 'Regenerate'}
            </button>
          </div>

          <div className="p-4">
            {isLoading && !summary ? (
              <div className="flex items-center justify-center py-8">
                <div className="flex items-center gap-3 text-zinc-400">
                  <RefreshCw size={20} className="animate-spin" />
                  <span>AI analyzing {totalEvents} events...</span>
                </div>
              </div>
            ) : summary ? (
              <div className="space-y-4">
                {/* Executive Summary */}
                <div>
                  <h3 className="text-xs uppercase text-zinc-500 font-semibold mb-2">Executive Summary</h3>
                  <p className="text-zinc-300 leading-relaxed">{summary.summary}</p>
                </div>

                {/* Key Findings */}
                <div>
                  <h3 className="text-xs uppercase text-zinc-500 font-semibold mb-2">Key Findings</h3>
                  <ul className="space-y-1">
                    {summary.keyFindings.map((finding, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                        <ChevronRight size={14} className="text-cyan-400 mt-0.5 flex-shrink-0" />
                        {finding}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Risk Assessment */}
                <div className="bg-zinc-800/50 rounded-lg p-3">
                  <h3 className="text-xs uppercase text-zinc-500 font-semibold mb-2">Risk Assessment</h3>
                  <p className="text-zinc-300 text-sm leading-relaxed">{summary.riskAssessment}</p>
                </div>

                {/* Recommendations */}
                <div>
                  <h3 className="text-xs uppercase text-zinc-500 font-semibold mb-2">Recommendations</h3>
                  <div className="grid md:grid-cols-3 gap-2">
                    {summary.recommendations.map((rec, i) => (
                      <div key={i} className="bg-zinc-800/50 rounded-lg p-2 text-sm text-zinc-300">
                        <span className="text-cyan-400 font-bold mr-1">{i + 1}.</span> {rec}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-zinc-500 text-center py-4">Click &quot;Regenerate&quot; to generate AI analysis</p>
            )}
          </div>
        </div>

        {/* Charts Grid */}
        {chartData && (
          <div className="grid md:grid-cols-2 gap-6">
            {/* Timeline Chart */}
            <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <Calendar size={16} className="text-cyan-400" />
                24-Hour Activity Timeline
              </h3>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={chartData.timelineData}>
                  <defs>
                    <linearGradient id="safeGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="dangerGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="time" tick={{ fill: '#666', fontSize: 10 }} tickLine={{ stroke: '#444' }} />
                  <YAxis tick={{ fill: '#666', fontSize: 10 }} tickLine={{ stroke: '#444' }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="safe" stroke="#22c55e" fill="url(#safeGradient)" />
                  <Area type="monotone" dataKey="danger" stroke="#ef4444" fill="url(#dangerGradient)" />
                </AreaChart>
              </ResponsiveContainer>
              <div className="flex items-center justify-center gap-6 mt-2">
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span className="text-zinc-400">Safe Events</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <span className="text-zinc-400">Danger Alerts</span>
                </div>
              </div>
            </div>

            {/* Location Chart */}
            <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <MapPin size={16} className="text-cyan-400" />
                Incidents by Location
              </h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={chartData.locationChartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" horizontal={false} />
                  <XAxis type="number" tick={{ fill: '#666', fontSize: 10 }} />
                  <YAxis dataKey="name" type="category" tick={{ fill: '#999', fontSize: 11 }} width={80} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="incidents" fill="#3b82f6" radius={[0, 4, 4, 0]} name="Total" />
                  <Bar dataKey="alerts" fill="#ef4444" radius={[0, 4, 4, 0]} name="Alerts" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Pie Chart */}
            <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <Activity size={16} className="text-cyan-400" />
                Event Distribution
              </h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={chartData.pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {chartData.pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend
                    formatter={(value) => <span className="text-zinc-300 text-sm">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="text-center -mt-2">
                <p className="text-3xl font-bold text-white">{dangerRate}%</p>
                <p className="text-xs text-zinc-500">Danger Rate</p>
              </div>
            </div>

            {/* Radar Chart */}
            <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
              <h3 className="font-bold mb-4 flex items-center gap-2">
                <AlertTriangle size={16} className="text-cyan-400" />
                Threat Category Analysis
              </h3>
              <ResponsiveContainer width="100%" height={250}>
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={chartData.radarData}>
                  <PolarGrid stroke="#333" />
                  <PolarAngleAxis dataKey="category" tick={{ fill: '#999', fontSize: 10 }} />
                  <PolarRadiusAxis tick={{ fill: '#666', fontSize: 9 }} />
                  <Radar
                    name="Threat Level"
                    dataKey="value"
                    stroke="#ef4444"
                    fill="#ef4444"
                    fillOpacity={0.3}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Recent Alerts Table */}
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
          <div className="p-4 border-b border-zinc-800">
            <h3 className="font-bold flex items-center gap-2">
              <AlertTriangle size={16} className="text-red-400" />
              Recent Danger Alerts
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-800/50">
                <tr>
                  <th className="text-left px-4 py-2 text-zinc-500 font-medium">Time</th>
                  <th className="text-left px-4 py-2 text-zinc-500 font-medium">Location</th>
                  <th className="text-left px-4 py-2 text-zinc-500 font-medium">Description</th>
                  <th className="text-left px-4 py-2 text-zinc-500 font-medium">Severity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {logs
                  .filter(l => l.isDangerous)
                  .slice(-10)
                  .reverse()
                  .map((log, i) => (
                    <tr key={i} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="px-4 py-2 text-zinc-400 font-mono text-xs">{log.timestamp}</td>
                      <td className="px-4 py-2 text-zinc-300">{log.location || 'Unknown'}</td>
                      <td className="px-4 py-2 text-red-400">{log.description}</td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                          log.severity >= 4 ? 'bg-red-500 text-white' :
                          log.severity === 3 ? 'bg-orange-500 text-white' :
                          log.severity === 2 ? 'bg-yellow-500 text-black' :
                          'bg-green-500 text-white'
                        }`}>
                          {log.severity}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-zinc-600 pb-8">
          <p>AI-powered security analytics dashboard</p>
          <p className="mt-1">Data refreshes automatically every analysis cycle</p>
        </div>
      </main>
    </div>
  );
}

