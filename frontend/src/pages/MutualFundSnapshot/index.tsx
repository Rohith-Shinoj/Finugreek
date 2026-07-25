import React, { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchMutualFundByCode, fetchStockData } from '../../api';
import { ChevronLeft, HelpCircle, TrendingDown, Target, Shield, Activity, BarChart2, Briefcase, BrainCircuit } from 'lucide-react';
import { MutualFundPriceChart } from './MutualFundPriceChart';
import { RollingReturnsChart } from './RollingReturnsChart';
import { AIAssistantOverlay } from '../../components/AIAssistantOverlay';

import { SipSimulatorCard } from './SipSimulatorCard';
import { AlphaDeviationCard } from './AlphaDeviationCard';
import { OperationalProfileCard } from './OperationalProfileCard';
import { AssetAllocationCard } from './AssetAllocationCard';
import { RiskReturnRadarCard } from './RiskReturnRadarCard';
import { HoldingsConcentrationCard } from './HoldingsConcentrationCard';
import { DrawdownProfileCard } from './DrawdownProfileCard';
import { MarketCaptureAlphaCard } from './MarketCaptureAlphaCard';
import { PeerCoMovementCard } from './PeerCoMovementCard';

const MetricBox = ({ label, value, subtext, color = 'text-text-primary', tooltipDesc }: any) => (
  <div className="flex flex-col">
    <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1 flex items-center gap-1 group relative w-fit cursor-help">
      {label}
      {tooltipDesc && (
        <>
          <HelpCircle size={14} className="text-text-secondary hover:text-text-primary transition-colors" />
          <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block w-48 bg-surface-hover text-text-primary text-[10px] p-2 rounded shadow-xl z-50 normal-case tracking-normal border border-border font-normal leading-relaxed">
            {tooltipDesc}
          </div>
        </>
      )}
    </span>
    <div className="flex items-end gap-2">
      <span className={`text-xl font-bold ${color}`}>{value}</span>
      {subtext && <span className="text-xs font-semibold text-text-secondary mb-1">{subtext}</span>}
    </div>
  </div>
);

import { Skeleton } from '../../components/Skeleton';

export const MutualFundSnapshot = () => {
  const { slug: code } = useParams();
  const [isAIOverlayOpen, setIsAIOverlayOpen] = useState(false);
  
  const { data: fund, isLoading } = useQuery({
    queryKey: ['mutualFund', code],
    queryFn: () => fetchMutualFundByCode(code!),
    enabled: !!code
  });

  const parsedHoldings = useMemo(() => {
    if (!fund?.detailed_holdings) return [];
    try {
      const raw = typeof fund.detailed_holdings === 'string' ? JSON.parse(fund.detailed_holdings) : fund.detailed_holdings;
      return raw.map((h: any) => ({
        name: h.company_name,
        size: parseFloat(h.corpus_per) || 0,
        sector: h.sector_name || 'Other'
      })).filter((h: any) => h.size > 0).sort((a: any, b: any) => b.size - a.size);
    } catch { return []; }
  }, [fund?.detailed_holdings]);

  const parsedStats = useMemo(() => {
    if (!fund?.advanced_stats) return [];
    try {
      return typeof fund.advanced_stats === 'string' ? JSON.parse(fund.advanced_stats) : fund.advanced_stats;
    } catch { return []; }
  }, [fund?.advanced_stats]);

  const { data: niftyDataRaw } = useQuery({
    queryKey: ['stockData', 'nifty'],
    queryFn: () => fetchStockData('nifty'),
    staleTime: 5 * 60 * 1000,
  });

  const niftyData = useMemo(() => {
    const ohlcv = niftyDataRaw?.absolute?.OHLCV;
    if (!ohlcv || !Array.isArray(ohlcv)) return [];
    return [...ohlcv].map((d: any) => {
      if (!d || !d.Date) return null;
      let timeStr = d.Date;
      const parts = d.Date.split('-');
      if (parts.length === 3 && parts[2].length === 4) {
        timeStr = `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
      return { time: timeStr, value: d.Close };
    }).filter(Boolean).sort((a: any, b: any) => {
      if (!a?.time || !b?.time) return 0;
      return new Date(a.time).getTime() - new Date(b.time).getTime();
    });
  }, [niftyDataRaw]);

  // Actual Rigorous Financial Calculations
  const { sharpe, sortino, infoRatio, upCapture, downCapture, alpha, trackingError } = useMemo(() => {
    if (!fund?.historical_navs || !niftyData || niftyData.length === 0) {
      return { sharpe: "0.00", sortino: "0.00", infoRatio: "0.00", upCapture: 0, downCapture: 0, alpha: "0.00", trackingError: "0.00" };
    }
    
    try {
      // Parse NAVs
      const navs = (typeof fund.historical_navs === 'string' ? JSON.parse(fund.historical_navs) : fund.historical_navs)
        .map((d: any) => {
          if (!d || !d[0]) return null;
          try {
            return { time: new Date(d[0]).toISOString().split('T')[0], value: d[1] };
          } catch(e) { return null; }
        })
        .filter(Boolean)
        .sort((a: any, b: any) => {
          if (!a?.time || !b?.time) return 0;
          return new Date(a.time).getTime() - new Date(b.time).getTime();
        });

      if (navs.length < 30) return { sharpe: "0.00", sortino: "0.00", infoRatio: "0.00", upCapture: 0, downCapture: 0 };

      // Align dates
      const benchMap = new Map(niftyData.map((d: any) => [d.time.split('T')[0], d.value]));
      
      const fundReturns: number[] = [];
      const benchReturns: number[] = [];
      const activeReturns: number[] = [];
      
      let upFund = 0, upBench = 0;
      let downFund = 0, downBench = 0;

      for (let i = 1; i < navs.length; i++) {
        const t = navs[i].time;
        if (!benchMap.has(t)) continue; // Only compare on shared trading days
        
        const prevT = navs[i-1].time;
        if (!benchMap.has(prevT)) continue;

        const fRet = (navs[i].value / navs[i-1].value) - 1;
        const bRet = (benchMap.get(t)! / benchMap.get(prevT)!) - 1;
        
        fundReturns.push(fRet);
        benchReturns.push(bRet);
        activeReturns.push(fRet - bRet);

        if (bRet > 0) {
           upFund += fRet;
           upBench += bRet;
        } else if (bRet < 0) {
           downFund += fRet;
           downBench += bRet;
        }
      }

      if (fundReturns.length === 0) return { sharpe: "0.00", sortino: "0.00", infoRatio: "0.00", upCapture: 0, downCapture: 0 };

      const meanF = fundReturns.reduce((a, b) => a + b, 0) / fundReturns.length;
      const stdF = Math.sqrt(fundReturns.reduce((a, b) => a + Math.pow(b - meanF, 2), 0) / fundReturns.length);
      
      const downsideReturns = fundReturns.filter(r => r < 0);
      const downsideStdF = Math.sqrt(downsideReturns.reduce((a, b) => a + Math.pow(b, 2), 0) / (downsideReturns.length || 1));

      const meanA = activeReturns.reduce((a, b) => a + b, 0) / activeReturns.length;
      const trackingErrorVal = Math.sqrt(activeReturns.reduce((a, b) => a + Math.pow(b - meanA, 2), 0) / activeReturns.length);

      const sharpeVal = stdF > 0 ? (meanF / stdF) * Math.sqrt(252) : 0;
      const sortinoVal = downsideStdF > 0 ? (meanF / downsideStdF) * Math.sqrt(252) : 0;
      const infoVal = trackingErrorVal > 0 ? (meanA / trackingErrorVal) * Math.sqrt(252) : 0;
      
      const upCap = upBench > 0 ? (upFund / upBench) * 100 : 0;
      const downCap = downBench < 0 ? (downFund / downBench) * 100 : 0;
      const alphaVal = (meanA * 252 * 100); // annualized alpha

      return {
        sharpe: sharpeVal.toFixed(2),
        sortino: sortinoVal.toFixed(2),
        infoRatio: infoVal.toFixed(2),
        upCapture: Math.round(upCap),
        downCapture: Math.round(downCap),
        alpha: alphaVal.toFixed(2),
        trackingError: (trackingErrorVal * Math.sqrt(252) * 100).toFixed(2)
      };
    } catch (e) {
      return { sharpe: "0.00", sortino: "0.00", infoRatio: "0.00", upCapture: 0, downCapture: 0, alpha: "0.00", trackingError: "0.00" };
    }
  }, [fund, niftyData]);

  // Sector Allocation Map
  const sectorAllocations = useMemo(() => {
    const map = new Map<string, number>();
    parsedHoldings.forEach((h: any) => {
      map.set(h.sector, (map.get(h.sector) || 0) + h.size);
    });
    return Array.from(map.entries())
      .map(([name, size]) => ({ name, size }))
      .sort((a, b) => b.size - a.size)
      .slice(0, 5); // Top 5
  }, [parsedHoldings]);

  if (isLoading) {
    return (
      <div className="flex flex-col h-full bg-canvas overflow-auto">
        <div className="p-6 md:p-8 max-w-[1600px] mx-auto w-full flex-1">
          <Skeleton className="h-4 w-24 mb-6" />
          <div className="bg-surface border border-border rounded-lg p-6 mb-6">
            <Skeleton className="h-8 w-2/3 mb-4" />
            <div className="flex gap-4">
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-6 w-20" />
            </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 flex flex-col gap-6">
              <Skeleton className="h-[450px] w-full rounded-lg" />
              <div className="grid grid-cols-2 gap-4">
                <Skeleton className="h-40 w-full rounded-lg" />
                <Skeleton className="h-40 w-full rounded-lg" />
              </div>
            </div>
            <div className="lg:col-span-4 flex flex-col gap-6">
              <Skeleton className="h-64 w-full rounded-lg" />
              <Skeleton className="h-[400px] w-full rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    );
  }
  if (!fund) return <div className="p-8 text-text-secondary text-center">Fund not found.</div>;

  const currentNav = fund.nav || 0;
  const return1d = parseFloat(fund.return1d || '0');
  const navChange = (currentNav * return1d) / 100;
  const isNavPos = return1d >= 0;

  const getStat = (type: string, period: string) => {
    const stat = parsedStats.find((s: any) => s.type === type);
    return stat ? stat[`stat_${period}`] : null;
  };

  return (
    <div className="flex flex-col w-full bg-canvas text-text-primary text-sm">

      <div className="p-6 flex flex-col gap-6 w-full pb-24 overflow-y-auto custom-scrollbar">

        {/* Hero Chart */}
        <div className="h-[600px] w-full bg-surface border border-border rounded-xl overflow-hidden shrink-0">
          <MutualFundPriceChart fund={fund} setIsAIOverlayOpen={setIsAIOverlayOpen} />
        </div>

        {/* Analytics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-[480px] [&>*]:min-h-0">
          

          {/* Row 1: The Core Identity & Intrinsic Structure */}
          <OperationalProfileCard fund={fund} />
          <AssetAllocationCard fund={fund} />
          <RiskReturnRadarCard fund={fund} metrics={{sharpe, sortino, infoRatio}} />

          {/* Row 2: Deep Dive into Portfolio & Consistency */}
          <HoldingsConcentrationCard fund={fund} />
          
          {/* Rolling Returns (Card 5) */}
          <div className="bg-surface border border-border p-5 rounded-xl flex flex-col h-full min-h-0 relative overflow-hidden">
             <h3 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-1.5 shrink-0 group relative w-fit cursor-help">
              3-Year Rolling Returns <HelpCircle size={14} className="text-text-secondary hover:text-text-primary transition-colors" />
              <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block w-64 bg-surface-hover text-text-primary text-[10px] p-2 rounded shadow-xl z-50 normal-case tracking-normal border border-border font-normal leading-relaxed">
                Measures consistency. Instead of a single 3-year return from today, this calculates the 3-year return for every single day over the past 5 years.
              </div>
            </h3>
            <div className="flex-1 relative min-h-0">
               <RollingReturnsChart fund={fund} niftyData={niftyData} />
            </div>
          </div>

          <DrawdownProfileCard fund={fund} />

          {/* Row 3: Evaluation & Simulation */}
          <MarketCaptureAlphaCard fund={fund} metrics={{upCapture, downCapture, alpha, trackingError}} />
          <SipSimulatorCard fund={fund} />
          <PeerCoMovementCard fund={fund} />

        </div>
      </div>
      <AIAssistantOverlay 
        ticker={fund.scheme_code || code} 
        isOpen={isAIOverlayOpen} 
        onClose={() => setIsAIOverlayOpen(false)}
        displayName={fund.fund_name || fund.scheme_name}
        internalPrompt={`Provide a verified expert investment breakdown for ${fund.fund_name || fund.scheme_name} focusing on Portfolio Strategy, Fund Manager Alpha, Asset Allocation, and Long-term Compounding.`}
      />
    </div>
  );
};
