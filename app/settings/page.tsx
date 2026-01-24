"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  GestureType, 
  EmergencyResponse, 
  EmergencySettings, 
  GESTURE_INFO,
  DEFAULT_EMERGENCY_SETTINGS 
} from "@/types";
import { 
  ArrowLeft, 
  Shield, 
  Bell, 
  Lock, 
  Volume2, 
  Check,
  AlertTriangle,
  Settings,
  Hand,
  Save
} from "lucide-react";

const AVAILABLE_GESTURES = [
  GestureType.OPEN_PALM,
  GestureType.FIST,
  GestureType.THUMBS_UP,
  GestureType.PEACE,
  GestureType.TOUCHING_HEAD,
  GestureType.ARMS_UP,
];

const RESPONSE_OPTIONS = [
  { 
    value: EmergencyResponse.LOCK_DOORS, 
    label: "Lock Doors", 
    description: "Automatically lock all connected doors",
    icon: Lock,
    color: "text-blue-400"
  },
  { 
    value: EmergencyResponse.SOUND_ALARM, 
    label: "Sound Alarm", 
    description: "Trigger audible alarm system",
    icon: Volume2,
    color: "text-amber-400"
  },
  { 
    value: EmergencyResponse.BOTH, 
    label: "Both Actions", 
    description: "Lock doors AND sound alarm",
    icon: Shield,
    color: "text-red-400"
  },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<EmergencySettings>(DEFAULT_EMERGENCY_SETTINGS);
  const [saved, setSaved] = useState(false);
  const [testMode, setTestMode] = useState(false);

  // Load settings from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("eyewatch-emergency-settings");
    if (stored) {
      try {
        setSettings(JSON.parse(stored));
      } catch {
        setSettings(DEFAULT_EMERGENCY_SETTINGS);
      }
    }
  }, []);

  // Save settings
  const saveSettings = () => {
    localStorage.setItem("eyewatch-emergency-settings", JSON.stringify(settings));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // Test emergency response
  const testResponse = () => {
    setTestMode(true);
    
    if (settings.emergencyResponse === EmergencyResponse.SOUND_ALARM || 
        settings.emergencyResponse === EmergencyResponse.BOTH) {
      // Play alarm sound
      const audio = new Audio("/alarm.mp3");
      audio.volume = 0.3;
      audio.play().catch(() => {
        // Fallback: use Web Audio API for a beep
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 800;
        gain.gain.value = 0.1;
        osc.start();
        setTimeout(() => osc.stop(), 500);
      });
    }
    
    setTimeout(() => setTestMode(false), 2000);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-mono">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-zinc-800/50 bg-zinc-950/95 backdrop-blur">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link 
              href="/realtime" 
              className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors"
            >
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="text-lg font-bold flex items-center gap-2">
                <Settings className="text-emerald-400" size={20} />
                Emergency Settings
              </h1>
              <p className="text-xs text-zinc-500">Configure gesture-based emergency responses</p>
            </div>
          </div>
          <button
            onClick={saveSettings}
            className={`px-4 py-2 rounded-lg font-bold text-sm uppercase flex items-center gap-2 transition-all ${
              saved 
                ? "bg-emerald-500 text-black" 
                : "bg-zinc-800 hover:bg-zinc-700 text-white"
            }`}
          >
            {saved ? <Check size={16} /> : <Save size={16} />}
            {saved ? "Saved!" : "Save"}
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Enable/Disable */}
        <section className="bg-zinc-900/50 rounded-xl border border-zinc-800 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-xl ${settings.enabled ? 'bg-emerald-500/20' : 'bg-zinc-800'}`}>
                <Shield className={settings.enabled ? 'text-emerald-400' : 'text-zinc-500'} size={24} />
              </div>
              <div>
                <h2 className="font-bold text-lg">Emergency Response System</h2>
                <p className="text-sm text-zinc-500">
                  {settings.enabled ? 'Active - monitoring for emergency gestures' : 'Disabled - no emergency responses'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setSettings(s => ({ ...s, enabled: !s.enabled }))}
              className={`relative w-14 h-8 rounded-full transition-colors ${
                settings.enabled ? 'bg-emerald-500' : 'bg-zinc-700'
              }`}
            >
              <div className={`absolute top-1 w-6 h-6 rounded-full bg-white transition-all ${
                settings.enabled ? 'left-7' : 'left-1'
              }`} />
            </button>
          </div>
        </section>

        {/* Emergency Gesture Selection */}
        <section className="bg-zinc-900/50 rounded-xl border border-zinc-800 p-6 space-y-4">
          <div className="flex items-center gap-3 mb-4">
            <Hand className="text-orange-400" size={20} />
            <h2 className="font-bold text-lg">Emergency Gesture</h2>
          </div>
          <p className="text-sm text-zinc-400 mb-4">
            Select which gesture will trigger the emergency response:
          </p>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {AVAILABLE_GESTURES.map((gesture) => {
              const info = GESTURE_INFO[gesture];
              const isSelected = settings.emergencyGesture === gesture;
              
              return (
                <button
                  key={gesture}
                  onClick={() => setSettings(s => ({ ...s, emergencyGesture: gesture }))}
                  className={`p-4 rounded-xl border-2 transition-all text-left ${
                    isSelected 
                      ? 'border-orange-500 bg-orange-500/10' 
                      : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">{info.icon}</span>
                    {isSelected && <Check className="text-orange-400 ml-auto" size={18} />}
                  </div>
                  <h3 className={`font-bold ${isSelected ? 'text-orange-400' : 'text-white'}`}>
                    {info.label}
                  </h3>
                  <p className="text-xs text-zinc-500 mt-1">{info.description}</p>
                </button>
              );
            })}
          </div>
        </section>

        {/* Emergency Response Selection */}
        <section className="bg-zinc-900/50 rounded-xl border border-zinc-800 p-6 space-y-4">
          <div className="flex items-center gap-3 mb-4">
            <Bell className="text-red-400" size={20} />
            <h2 className="font-bold text-lg">Emergency Response</h2>
          </div>
          <p className="text-sm text-zinc-400 mb-4">
            Choose what happens when the emergency gesture is detected:
          </p>
          
          <div className="space-y-3">
            {RESPONSE_OPTIONS.map((option) => {
              const Icon = option.icon;
              const isSelected = settings.emergencyResponse === option.value;
              
              return (
                <button
                  key={option.value}
                  onClick={() => setSettings(s => ({ ...s, emergencyResponse: option.value }))}
                  className={`w-full p-4 rounded-xl border-2 transition-all text-left flex items-center gap-4 ${
                    isSelected 
                      ? 'border-red-500 bg-red-500/10' 
                      : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'
                  }`}
                >
                  <div className={`p-3 rounded-lg ${isSelected ? 'bg-red-500/20' : 'bg-zinc-700'}`}>
                    <Icon className={isSelected ? option.color : 'text-zinc-400'} size={24} />
                  </div>
                  <div className="flex-1">
                    <h3 className={`font-bold ${isSelected ? 'text-red-400' : 'text-white'}`}>
                      {option.label}
                    </h3>
                    <p className="text-sm text-zinc-500">{option.description}</p>
                  </div>
                  {isSelected && <Check className="text-red-400" size={20} />}
                </button>
              );
            })}
          </div>
        </section>

        {/* Test Section */}
        <section className={`rounded-xl border-2 p-6 transition-all ${
          testMode 
            ? 'bg-red-500/20 border-red-500 animate-pulse' 
            : 'bg-zinc-900/50 border-zinc-800'
        }`}>
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className={testMode ? 'text-red-400' : 'text-amber-400'} size={20} />
            <h2 className="font-bold text-lg">Test Emergency Response</h2>
          </div>
          <p className="text-sm text-zinc-400 mb-4">
            Test your configured emergency response to make sure it works correctly.
          </p>
          
          <div className="flex items-center gap-4">
            <button
              onClick={testResponse}
              disabled={testMode}
              className={`px-6 py-3 rounded-lg font-bold uppercase text-sm transition-all ${
                testMode 
                  ? 'bg-red-500 text-white cursor-not-allowed' 
                  : 'bg-amber-500 hover:bg-amber-400 text-black'
              }`}
            >
              {testMode ? 'Testing...' : 'Test Now'}
            </button>
            
            <div className="text-sm text-zinc-500">
              <p>Current config:</p>
              <p className="text-zinc-300">
                {GESTURE_INFO[settings.emergencyGesture].icon} {GESTURE_INFO[settings.emergencyGesture].label} → {
                  RESPONSE_OPTIONS.find(r => r.value === settings.emergencyResponse)?.label
                }
              </p>
            </div>
          </div>
        </section>

        {/* Preview Card */}
        <section className="bg-gradient-to-br from-zinc-900 to-zinc-800 rounded-xl border border-zinc-700 p-6">
          <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
            <Shield className="text-emerald-400" size={20} />
            Configuration Summary
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-zinc-800/50 rounded-lg p-4">
              <p className="text-xs text-zinc-500 uppercase mb-1">Status</p>
              <p className={`font-bold ${settings.enabled ? 'text-emerald-400' : 'text-zinc-500'}`}>
                {settings.enabled ? 'ACTIVE' : 'DISABLED'}
              </p>
            </div>
            <div className="bg-zinc-800/50 rounded-lg p-4">
              <p className="text-xs text-zinc-500 uppercase mb-1">Trigger Gesture</p>
              <p className="font-bold text-orange-400 flex items-center gap-2">
                <span>{GESTURE_INFO[settings.emergencyGesture].icon}</span>
                {GESTURE_INFO[settings.emergencyGesture].label}
              </p>
            </div>
            <div className="bg-zinc-800/50 rounded-lg p-4">
              <p className="text-xs text-zinc-500 uppercase mb-1">Response</p>
              <p className="font-bold text-red-400">
                {RESPONSE_OPTIONS.find(r => r.value === settings.emergencyResponse)?.label}
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

