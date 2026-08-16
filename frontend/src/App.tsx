import { BrowserRouter as Router, Routes, Route, Outlet } from 'react-router-dom';
import React, { lazy, Suspense } from 'react';

import { TopNavigation } from './components/TopNavigation';
import { Footer } from './components/Footer';

// ── Lazy-loaded pages — each becomes its own JS chunk downloaded on demand ──
const LandingPage       = lazy(() => import('./pages/LandingPage').then(m => ({ default: m.LandingPage })));
const AIResearchDesk    = lazy(() => import('./pages/AIResearchDesk').then(m => ({ default: m.AIResearchDesk })));
const MarketHeatmap     = lazy(() => import('./pages/MarketHeatmap').then(m => ({ default: m.MarketHeatmap })));
const Stocks            = lazy(() => import('./pages/Stocks').then(m => ({ default: m.Stocks })));
const Screener          = lazy(() => import('./pages/Screener').then(m => ({ default: m.Screener })));
const PairTrading       = lazy(() => import('./pages/PairTrading').then(m => ({ default: m.PairTrading })));
const PortfolioTracker  = lazy(() => import('./pages/PortfolioTracker').then(m => ({ default: m.PortfolioTracker })));
const MutualFunds       = lazy(() => import('./pages/MutualFunds').then(m => ({ default: m.MutualFunds })));
const Watchlists        = lazy(() => import('./pages/Watchlists').then(m => ({ default: m.Watchlists })));
const CryptoLive        = lazy(() => import('./pages/CryptoLive').then(m => ({ default: m.CryptoLive })));
const TerminalLayout    = lazy(() => import('./layouts/TerminalLayout').then(m => ({ default: m.TerminalLayout })));
const ETFs              = lazy(() => import('./pages/ETFs').then(m => ({ default: m.ETFs })));
const ETFSnapshot       = lazy(() => import('./pages/ETFSnapshot').then(m => ({ default: m.ETFSnapshot })));
const MutualFundSnapshot = lazy(() => import('./pages/MutualFundSnapshot').then(m => ({ default: m.MutualFundSnapshot })));
const Terms             = lazy(() => import('./pages/Terms').then(m => ({ default: m.Terms })));
const Privacy           = lazy(() => import('./pages/Privacy').then(m => ({ default: m.Privacy })));
const Disclaimer        = lazy(() => import('./pages/Disclaimer').then(m => ({ default: m.Disclaimer })));
const NotFound          = lazy(() => import('./pages/NotFound').then(m => ({ default: m.NotFound })));

// Minimal page-transition skeleton shown while a chunk is loading
const PageLoader = () => (
  <div className="flex-1 flex items-center justify-center bg-canvas min-h-[60vh]">
    <div className="flex flex-col items-center gap-3">
      <div className="w-8 h-8 border-2 border-alpha/30 border-t-alpha rounded-full animate-spin" />
      <span className="text-xs text-text-secondary font-medium tracking-wider uppercase">Loading</span>
    </div>
  </div>
);

// Layout Component
const Layout = () => {
  return (
    <div className="flex flex-col h-screen bg-canvas text-text-primary overflow-hidden">
      <TopNavigation />
      <main className="flex-1 overflow-y-auto flex flex-col min-h-0 relative custom-scrollbar">
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
        <Footer />
      </main>
    </div>
  );
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<LandingPage />} />
          <Route path="ai-research" element={<AIResearchDesk />} />
          <Route path="heatmap" element={<MarketHeatmap />} />
          <Route path="stocks" element={<Stocks />} />
          <Route path="screener" element={<Screener />} />
          <Route path="pairs" element={<PairTrading />} />
          <Route path="portfolio" element={<PortfolioTracker />} />
          <Route path="mutual-funds" element={<MutualFunds />} />
          <Route path="watchlists" element={<Watchlists />} />
          <Route path="crypto" element={<CryptoLive />} />
          <Route path="/stocks/:slug" element={<TerminalLayout />} />
          <Route path="/etf" element={<ETFs />} />
          <Route path="/etf/:slug" element={<ETFSnapshot />} />
          <Route path="/mutual-funds/:slug" element={<MutualFundSnapshot />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/disclaimer" element={<Disclaimer />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
