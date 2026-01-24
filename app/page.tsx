/* eslint-disable react-hooks/purity */
"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowRight, Zap, Shield, Sparkles } from 'lucide-react';
import Navbar from '@/components/Navbar';

const TypingText = ({ text, speed = 50 }: { text: string; speed?: number }) => {
  const [displayedText, setDisplayedText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (currentIndex < text.length) {
      const timer = setTimeout(() => {
        setDisplayedText(prev => prev + text[currentIndex]);
        setCurrentIndex(prev => prev + 1);
      }, speed);
      return () => clearTimeout(timer);
    }
  }, [currentIndex, text, speed]);

  return <span>{displayedText}</span>;
};

export default function Home() {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  return (
    <div className="min-h-screen w-full bg-black text-white overflow-hidden">
      {/* Navbar */}
      <Navbar />

      {/* Background Container */}
      <div className="absolute inset-0 top-16 pointer-events-none">
        {/* Background Image with Overlay */}
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: 'url(/background.png)',
            filter: 'brightness(0.4)'
          }}
        />

        {/* Gradient Overlay - creates depth */}
        <div className="absolute inset-0 bg-gradient-to-br from-black/50 via-transparent to-black/70" />
        
        {/* Animated gradient blur elements */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl opacity-0 animate-pulse" style={{ animation: 'pulse 4s ease-in-out infinite' }} />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl opt-16 pacity-0 animate-pulse" style={{ animation: 'pulse 5s ease-in-out infinite 1s' }} />
      </div>

      {/* Content */}
      <div className={`relative z-10 h-screen flex flex-col items-center pt-4 px-4 overflow-y-auto transition-all duration-1000 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}>
        <div className="max-w-4xl mx-auto text-center space-y-4">
          
          {/* Logo/Badge */}
          {/* <div className="inline-flex items-center space-x-2 px-4 py-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-full mb-2 hover:bg-white/20 transition-all duration-300">
            <Shield size={16} className="text-cyan-400" />
            <span className="text-sm font-semibold text-cyan-300">Your Personal Gesture AI</span>
          </div> */}

          {/* Hero Title with Typing Animation */}
          <div className="space-y-2">
            <h1 className="text-5xl md:text-6xl font-black tracking-tighter">
              <span className="bg-gradient-to-r from-cyan-300 via-white to-indigo-500 bg-clip-text text-transparent inline-block">
                <TypingText text="My Hero" speed={10} />
              </span>
            </h1>
            
            {/* <p className="text-lg md:text-xl text-slate-200 font-light">
              Real-time Gesture Recognition Powered by AI
            </p> */}
          </div>

          {/* Description */}
          <p className="text-base text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Transform your movements into intelligent interactions. Detect hand gestures in real-time and unlock a world of possibilities with cutting-edge AI insights.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Link
              href="/realtime"
              className="group relative px-8 py-3 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold rounded-lg transition-all duration-300 shadow-lg hover:shadow-cyan-500/50 flex items-center justify-center space-x-2 overflow-hidden text-sm"
            >
              <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <Zap size={18} />
              <span>Get Started</span>
              <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform duration-300" />
            </Link>
          </div>

          {/* Features Section */}
          <div className="w-full pt-6">
            <div className="grid md:grid-cols-3 gap-4 max-w-5xl mx-auto">
              {/* Feature 1 */}
              <div className="group relative p-4 rounded-xl bg-white/10 border border-white/20 hover:border-cyan-400/50 backdrop-blur-md transition-all duration-300 hover:bg-white/15 h-full flex flex-col">
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-transparent opacity-0 group-hover:opacity-100 rounded-xl transition-opacity duration-300" />
                <div className="relative z-10 flex flex-col h-full">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                      <Sparkles size={20} className="text-white" />
                    </div>
                    <h3 className="text-sm font-bold">Live Detection</h3>
                  </div>
                  <p className="text-xs text-slate-300 flex-1">Real-time gesture recognition using advanced MediaPipe models</p>
                </div>
              </div>

              {/* Feature 2 */}
              <div className="group relative p-4 rounded-xl bg-white/10 border border-white/20 hover:border-indigo-400/50 backdrop-blur-md transition-all duration-300 hover:bg-white/15 h-full flex flex-col">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-transparent opacity-0 group-hover:opacity-100 rounded-xl transition-opacity duration-300" />
                <div className="relative z-10 flex flex-col h-full">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-gradient-to-br from-indigo-400 to-purple-500 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                      <Zap size={20} className="text-white" />
                    </div>
                    <h3 className="text-sm font-bold">AI Insights</h3>
                  </div>
                  <p className="text-xs text-slate-300 flex-1">Gemini-powered descriptions explaining each gesture</p>
                </div>
              </div>

              {/* Feature 3 */}
              <div className="group relative p-4 rounded-xl bg-white/10 border border-white/20 hover:border-emerald-400/50 backdrop-blur-md transition-all duration-300 hover:bg-white/15 h-full flex flex-col">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 rounded-xl transition-opacity duration-300" />
                <div className="relative z-10 flex flex-col h-full">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                      <Shield size={20} className="text-white" />
                    </div>
                    <h3 className="text-sm font-bold">Activity Chat</h3>
                  </div>
                  <p className="text-xs text-slate-300 flex-1">Interactive chat showing real-time gesture analysis</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating particles effect */}
      <div className="fixed inset-0 pointer-events-none">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-cyan-400 rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animation: `float ${3 + i}s ease-in-out infinite`,
              opacity: Math.random() * 0.5,
            }}
          />
        ))}
      </div>

      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) translateX(0); }
          25% { transform: translateY(-20px) translateX(10px); }
          50% { transform: translateY(-40px) translateX(-10px); }
          75% { transform: translateY(-20px) translateX(10px); }
        }
      `}</style>
    </div>
  );
}
