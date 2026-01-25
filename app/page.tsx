"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  ArrowRight, Shield, Eye, AlertTriangle, 
  Camera, Activity, Lock, Bell, BarChart3,
  Users, Zap, CheckCircle
} from 'lucide-react';
import Navbar from '@/components/Navbar';

// Particle positions generated on client only to avoid hydration mismatch
interface Particle {
  left: number;
  top: number;
  delay: number;
  duration: number;
  opacity: number;
}

export default function Home() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [particles, setParticles] = useState<Particle[]>([]);

  // Generate particles on client side only
  useEffect(() => {
    setIsLoaded(true);
    
    // Generate random particles after mount
    const newParticles: Particle[] = Array.from({ length: 20 }, () => ({
      left: Math.random() * 100,
      top: Math.random() * 100,
      delay: Math.random() * 5,
      duration: 3 + Math.random() * 4,
      opacity: 0.1 + Math.random() * 0.3,
    }));
    setParticles(newParticles);
  }, []);

  return (
    <div className="min-h-screen w-full bg-zinc-950 text-white overflow-hidden font-mono">
      {/* Navbar */}
      <Navbar />

      {/* Background */}
      <div className="absolute inset-0 top-16 pointer-events-none overflow-hidden">
        {/* Background Image */}
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: 'url(/background.png)',
            filter: 'brightness(0.3)'
          }}
        />
        
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-black/60 via-transparent to-black/80" />
        
        {/* Gradient orbs */}
        <div className="absolute top-20 right-20 w-[500px] h-[500px] bg-cyan-500/15 rounded-full blur-[120px]" />
        <div className="absolute bottom-20 left-20 w-[400px] h-[400px] bg-blue-500/15 rounded-full blur-[100px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-[150px]" />
        
        {/* Scanline effect */}
        <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.1)_50%)] bg-[length:100%_4px] opacity-20" />
      </div>

      {/* Floating particles - only rendered after client mount */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {particles.map((p, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-emerald-400 rounded-full animate-pulse"
            style={{
              left: `${p.left}%`,
              top: `${p.top}%`,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
              opacity: p.opacity,
            }}
          />
        ))}
      </div>

      {/* Content */}
      <div className={`relative z-10 min-h-screen flex flex-col transition-all duration-1000 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}>
        
        {/* Hero Section */}
        <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
          <div className="max-w-5xl mx-auto text-center space-y-8">
            
            {/* Status Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-full">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-sm text-emerald-400 font-semibold">SYSTEM ACTIVE</span>
            </div>

            {/* Main Title */}
            <div className="space-y-4">
              <h1 className="text-6xl md:text-8xl font-black tracking-tighter">
                <span className="text-white">MY</span>
                <span className="text-cyan-500"> HERO</span>
              </h1>
              <p className="text-xl md:text-2xl text-zinc-400 font-light max-w-2xl mx-auto">
                AI-Powered Surveillance & Threat Detection Platform
              </p>
            </div>

            {/* Description */}
            <p className="text-zinc-400 max-w-2xl mx-auto leading-relaxed">
              Real-time threat detection using advanced computer vision and AI. 
              Monitor multiple feeds, detect suspicious activity, and respond to emergencies 
              with intelligent gesture-based controls.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-8">
              <Link
                href="/realtime"
                className="group relative px-8 py-4 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg transition-all duration-300 flex items-center justify-center gap-3 overflow-hidden"
              >
                <Eye size={20} />
                <span>Launch Monitoring</span>
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                href="/library"
                className="group px-8 py-4 bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-lg transition-all duration-300 flex items-center justify-center gap-3 border border-zinc-700"
              >
                <Camera size={20} />
                <span>View Library</span>
              </Link>
            </div>
          </div>
        </main>

        {/* Features Section */}
        <section className="px-4 py-16 border-t border-zinc-800">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">Advanced Security Features</h2>
              <p className="text-zinc-500 max-w-xl mx-auto">
                Enterprise-grade surveillance powered by cutting-edge AI technology
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Feature Cards */}
              <FeatureCard 
                icon={Eye}
                title="Real-Time Detection"
                description="AI-powered analysis of live video feeds detecting threats in milliseconds"
                color="cyan"
              />
              <FeatureCard 
                icon={AlertTriangle}
                title="Threat Alerts"
                description="Instant notifications for suspicious activity, falls, and medical emergencies"
                color="red"
              />
              <FeatureCard 
                icon={Activity}
                title="Behavior Analysis"
                description="Advanced pattern recognition for drowsiness, distress, and anomalies"
                color="amber"
              />
              <FeatureCard 
                icon={Lock}
                title="Emergency Response"
                description="Gesture-activated emergency protocols with door locks and alarms"
                color="emerald"
              />
              <FeatureCard 
                icon={BarChart3}
                title="Analytics Dashboard"
                description="Comprehensive statistics and AI-generated security reports"
                color="purple"
              />
              <FeatureCard 
                icon={Users}
                title="Community Library"
                description="Shared incident footage with real-time analysis overlays"
                color="blue"
              />
            </div>
          </div>
        </section>

        {/* Trust Section */}
        <section className="px-4 py-12 bg-zinc-900/50 border-t border-zinc-800">
          <div className="max-w-4xl mx-auto text-center">
            <div className="flex flex-wrap justify-center gap-8 items-center">
              <div className="flex items-center gap-2 text-zinc-400">
                <CheckCircle size={20} className="text-emerald-500" />
                <span>24/7 Monitoring</span>
              </div>
              <div className="flex items-center gap-2 text-zinc-400">
                <CheckCircle size={20} className="text-emerald-500" />
                <span>AI-Powered</span>
              </div>
              <div className="flex items-center gap-2 text-zinc-400">
                <CheckCircle size={20} className="text-emerald-500" />
                <span>Instant Alerts</span>
              </div>
              <div className="flex items-center gap-2 text-zinc-400">
                <CheckCircle size={20} className="text-emerald-500" />
                <span>Privacy-First</span>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="px-4 py-8 border-t border-zinc-800">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <Shield className="text-cyan-500" size={24} />
              <span className="font-bold text-lg">MY HERO</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-zinc-500">
              <Link href="/realtime" className="hover:text-white transition-colors">Live Monitor</Link>
              <Link href="/library" className="hover:text-white transition-colors">Library</Link>
              <Link href="/stats" className="hover:text-white transition-colors">Analytics</Link>
              <Link href="/settings" className="hover:text-white transition-colors">Settings</Link>
            </div>
            <div className="text-xs text-zinc-600">
              ConuHacks 2026
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

// Feature Card Component
function FeatureCard({ 
  icon: Icon, 
  title, 
  description, 
  color 
}: { 
  icon: React.ElementType; 
  title: string; 
  description: string; 
  color: string;
}) {
  const colorClasses: Record<string, string> = {
    cyan: 'from-cyan-500 to-cyan-600 group-hover:shadow-cyan-500/20',
    red: 'from-red-500 to-red-600 group-hover:shadow-red-500/20',
    amber: 'from-amber-500 to-amber-600 group-hover:shadow-amber-500/20',
    emerald: 'from-emerald-500 to-emerald-600 group-hover:shadow-emerald-500/20',
    purple: 'from-purple-500 to-purple-600 group-hover:shadow-purple-500/20',
    blue: 'from-blue-500 to-blue-600 group-hover:shadow-blue-500/20',
  };

  return (
    <div className="group p-6 bg-zinc-900/50 border border-zinc-800 rounded-xl hover:border-zinc-700 transition-all duration-300 hover:shadow-lg">
      <div className={`w-12 h-12 bg-gradient-to-br ${colorClasses[color]} rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
        <Icon size={24} className="text-white" />
      </div>
      <h3 className="font-bold text-lg mb-2">{title}</h3>
      <p className="text-sm text-zinc-400 leading-relaxed">{description}</p>
    </div>
  );
}
