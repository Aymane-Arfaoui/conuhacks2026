"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Menu, X, Settings } from 'lucide-react';
import { navigationConfig } from '@/config/navigation';

interface NavbarProps {
  showSettings?: boolean;
}

const Navbar = ({ showSettings = false }: NavbarProps) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="relative w-full z-50 bg-black/40 backdrop-blur-md border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link
            href={navigationConfig.brand.href}
            className="flex items-center space-x-2 group"
          >
            <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-cyan-400 to-indigo-600 p-1 group-hover:shadow-lg group-hover:shadow-cyan-500/50 transition-all duration-300 flex items-center justify-center">
              <Image
                src="/logo.png"
                alt="My Hero Logo"
                width={40}
                height={40}
                className="w-full h-full object-cover rounded-full"
              />
            </div>
            <span className="text-xl font-black text-white">{navigationConfig.brand.name}</span>
          </Link>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center space-x-1">
            {navigationConfig.menuItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                target={item.external ? "_blank" : undefined}
                rel={item.external ? "noopener noreferrer" : undefined}
                className="px-3 py-2 text-sm font-medium text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-all duration-300"
              >
                {item.label}
              </a>
            ))}
          </div>

          {/* CTA Button & Mobile Menu Toggle */}
          <div className="flex items-center space-x-4">
            {showSettings && (
              <Link
                href="/settings"
                className="hidden sm:inline-block p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors"
                title="Emergency Settings"
              >
                <Settings size={20} />
              </Link>
            )}
            
            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-white/10 transition-colors duration-300"
              aria-label="Toggle menu"
            >
              {isOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isOpen && (
          <div className="md:hidden bg-black/80 backdrop-blur-sm border-t border-white/10 py-4 space-y-2">
            {navigationConfig.menuItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                target={item.external ? "_blank" : undefined}
                rel={item.external ? "noopener noreferrer" : undefined}
                className="block px-4 py-2 text-sm font-medium text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-all duration-300"
                onClick={() => setIsOpen(false)}
              >
                {item.label}
              </a>
            ))}
            {navigationConfig.cta && (
              <Link
                href={navigationConfig.cta.href}
                className="block px-4 py-2 bg-gradient-to-r from-cyan-500 to-indigo-600 text-white font-semibold rounded-lg transition-all duration-300 text-center"
                onClick={() => setIsOpen(false)}
              >
                {navigationConfig.cta.label}
              </Link>
            )}
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
