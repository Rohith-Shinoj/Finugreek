import React from 'react';
import { Link } from 'react-router-dom';

export const Footer = () => {
  return (
    <footer className="bg-surface border-t border-border mt-12 shrink-0">
      <div className="max-w-[1600px] mx-auto px-4 py-12 w-full">
        <div className="grid grid-cols-1 md:grid-cols-7 gap-8">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <img src="/favicon.webp" alt="Finugreek Logo" className="w-8 h-8 object-contain" />
              <span className="text-lg font-bold text-text-primary">Finugreek</span>
            </div>
            <p className="text-text-secondary text-sm">
              Advanced quantitative analysis and portfolio management platform.
            </p>
          </div>
          
          <div>
            <h3 className="text-text-primary font-semibold text-sm mb-4">Platform</h3>
            <ul className="space-y-3">
              <li><Link to="/" className="text-text-secondary text-sm hover:text-white transition-colors">Home</Link></li>
              <li><Link to="/screener" className="text-text-secondary text-sm hover:text-white transition-colors">Screener</Link></li>
              <li><Link to="/portfolio" className="text-text-secondary text-sm hover:text-white transition-colors">Portfolio</Link></li>
            </ul>
          </div>

          <div className="md:col-span-2">
            <h3 className="text-text-primary font-semibold text-sm mb-4">Explore</h3>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-3">
              <li><Link to="/stocks" className="text-text-secondary text-sm hover:text-white transition-colors">Stocks</Link></li>
              <li><Link to="/mutual-funds" className="text-text-secondary text-sm hover:text-white transition-colors">Mutual Funds</Link></li>
              <li><Link to="/etf" className="text-text-secondary text-sm hover:text-white transition-colors">ETFs</Link></li>
              <li><Link to="/crypto" className="text-text-secondary text-sm hover:text-white transition-colors">Crypto</Link></li>
              <li><Link to="/heatmap" className="text-text-secondary text-sm hover:text-white transition-colors">Market Heatmap</Link></li>
              <li><Link to="/pairs" className="text-text-secondary text-sm hover:text-white transition-colors">Pair Trading</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-text-primary font-semibold text-sm mb-4">Contact</h3>
            <ul className="space-y-3">
              <li><a href="https://www.portfolio.rohithshinoj.com" target="_blank" rel="noopener noreferrer" className="text-text-secondary text-sm hover:text-white transition-colors">Portfolio</a></li>
            </ul>
          </div>

          <div>
            <h3 className="text-text-primary font-semibold text-sm mb-4">Legal</h3>
            <ul className="space-y-3">
              <li><Link to="/terms" className="text-text-secondary text-sm hover:text-white transition-colors">Terms of Use</Link></li>
              <li><Link to="/privacy" className="text-text-secondary text-sm hover:text-white transition-colors">Privacy Policy</Link></li>
              <li><Link to="/disclaimer" className="text-text-secondary text-sm hover:text-white transition-colors">Data Disclaimer</Link></li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
};
