import { useState } from 'react';
import { useRouter } from 'next/router';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import Link from 'next/link';

export default function Layout({ children }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();

  const navItems = [
    { href: '/active', label: 'Active Strategy', icon: '📈', desc: 'Taker + RSI AI Trading' },
    { href: '/dca', label: 'DCA Strategy', icon: '😱', desc: 'Fear & Greed DCA' },
    { href: '/perp', label: 'Perp Trading', icon: '🔮', desc: 'Coming Soon' },
    { href: '/dashboard', label: 'Dashboard', icon: '📊', desc: 'Your Portfolio' },
  ];

  const bottomNav = [
    { href: '/active', icon: '📈', label: 'Active' },
    { href: '/dca', icon: '😱', label: 'DCA' },
    { href: '/perp', icon: '🔮', label: 'Perp' },
    { href: '/dashboard', icon: '📊', label: 'Dashboard' },
  ];

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">

      {/* Header */}
      <div className="sticky top-0 z-20 bg-gray-900 border-b border-gray-800 px-4 py-3">
        <div className="flex justify-between items-center max-w-lg mx-auto">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMenuOpen(true)}
              className="flex flex-col gap-1.5 p-1"
            >
              <span className="block w-6 h-0.5 bg-white"></span>
              <span className="block w-6 h-0.5 bg-white"></span>
              <span className="block w-6 h-0.5 bg-white"></span>
            </button>
            <div>
              <h1 className="text-lg font-bold">🤖 Arc Agent Vault</h1>
            </div>
          </div>
          <ConnectButton />
        </div>
      </div>

      {/* Slide-in Menu */}
      {menuOpen && (
        <div className="fixed inset-0 z-30 flex">
          {/* Overlay */}
          <div
            className="absolute inset-0 bg-black bg-opacity-60"
            onClick={() => setMenuOpen(false)}
          />
          {/* Menu Panel */}
          <div className="relative w-72 bg-gray-900 h-full flex flex-col z-40 shadow-2xl">
            <div className="flex justify-between items-center p-5 border-b border-gray-800">
              <h2 className="text-lg font-bold">🤖 Arc Agent Vault</h2>
              <button onClick={() => setMenuOpen(false)} className="text-gray-400 text-2xl">✕</button>
            </div>

            <nav className="flex-1 p-4 space-y-1">
              {navItems.map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-4 p-4 rounded-xl transition ${
                    router.pathname === item.href
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:bg-gray-800'
                  }`}
                >
                  <span className="text-2xl">{item.icon}</span>
                  <div>
                    <p className="font-semibold">{item.label}</p>
                    <p className="text-xs text-gray-400">{item.desc}</p>
                  </div>
                </Link>
              ))}
            </nav>

            <div className="p-4 border-t border-gray-800 space-y-3">
              <a href="https://testnet.arcscan.app/address/0x07AD7bDE86371B5c28e0f0532fF52097d0D14162" target="_blank" rel="noreferrer"
                className="flex items-center gap-3 p-3 rounded-xl text-gray-400 hover:bg-gray-800 transition text-sm">
                <span>🔍</span> View Contract
              </a>
              <a href="https://github.com/ryo7400s-del/arc-vault-frontend" target="_blank" rel="noreferrer"
                className="flex items-center gap-3 p-3 rounded-xl text-gray-400 hover:bg-gray-800 transition text-sm">
                <span>📦</span> GitHub
              </a>
              <p className="text-xs text-gray-600 text-center pt-2">Powered by x402 · Coinbase AgentKit · Curve</p>
            </div>
          </div>
        </div>
      )}

      {/* Page Content */}
      <div className="flex-1 px-4 py-4 max-w-lg mx-auto w-full pb-24">
        {children}
      </div>

      {/* Bottom Nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 px-4 py-2 z-10">
        <div className="flex max-w-lg mx-auto">
          {bottomNav.map(tab => (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex-1 flex flex-col items-center py-2 transition ${
                router.pathname === tab.href ? 'text-blue-400' : 'text-gray-500'
              }`}
            >
              <span className="text-xl">{tab.icon}</span>
              <span className="text-xs mt-1">{tab.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
