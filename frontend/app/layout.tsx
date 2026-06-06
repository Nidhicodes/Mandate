import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Mandate — AI-Managed Equity on Robinhood Chain',
  description: 'The first ERC-8226 implementation. AI allocates; the chain enforces the mandate.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen">
        <Nav />
        {children}
      </body>
    </html>
  );
}

function Nav() {
  return (
    <nav className="fixed top-0 w-full z-50 border-b border-border" style={{ background: 'rgba(5,5,7,0.85)', backdropFilter: 'blur(16px) saturate(180%)' }}>
      <div className="max-w-7xl mx-auto px-6 h-[64px] flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <svg width="32" height="32" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M18 2L4 8v10c0 9.5 6 16.5 14 18 8-1.5 14-8.5 14-18V8L18 2z" fill="url(#nav-shield-g)" stroke="url(#nav-shield-s)" strokeWidth="1.5"/>
            <path d="M12 14h4v4h4v4" stroke="#F0B35B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.9"/>
            <path d="M24 14h-4" stroke="#A78BFA" strokeWidth="1.5" strokeLinecap="round" opacity="0.7"/>
            <circle cx="12" cy="14" r="1.5" fill="#F0B35B"/><circle cx="20" cy="22" r="1.5" fill="#F0B35B"/><circle cx="24" cy="14" r="1.5" fill="#A78BFA"/>
            <rect x="15" y="15" width="6" height="5" rx="1" stroke="#34D399" strokeWidth="1.2" fill="none" opacity="0.8"/>
            <path d="M16.5 15v-1.5a1.5 1.5 0 013 0V15" stroke="#34D399" strokeWidth="1.2" strokeLinecap="round" opacity="0.8"/>
            <defs>
              <linearGradient id="nav-shield-g" x1="4" y1="2" x2="32" y2="30"><stop offset="0%" stopColor="rgba(167,139,250,0.15)"/><stop offset="100%" stopColor="rgba(240,179,91,0.08)"/></linearGradient>
              <linearGradient id="nav-shield-s" x1="4" y1="2" x2="32" y2="30"><stop offset="0%" stopColor="#A78BFA" stopOpacity="0.6"/><stop offset="100%" stopColor="#F0B35B" stopOpacity="0.4"/></linearGradient>
            </defs>
          </svg>
          <span className="font-display text-[20px] text-white italic">Mandate</span>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-5">
          <div className="hidden md:flex items-center gap-2 text-xs text-zinc-500">
            <div className="w-2 h-2 rounded-full bg-teal pulse-soft" />
            <span>Robinhood Chain</span>
          </div>
          <div className="px-3 py-1.5 rounded-xl text-xs font-mono text-zinc-400" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            0xd96e...2Bfd
          </div>
        </div>
      </div>
    </nav>
  );
}
