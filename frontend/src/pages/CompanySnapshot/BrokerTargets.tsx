import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchBrokerTargets, fetchStockData } from '../../api';
import { Target, TrendingUp, TrendingDown, Minus, Info } from 'lucide-react';
import { ResponsiveContainer, ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

interface BrokerTargetsProps {
  slug: string;
}

interface TargetData {
  date: string;
  broker: string;
  action: string;
  target_price: number;
  price_at_reco?: number;
  price_at_reco_change?: string;
  signals?: { type: string; direction: 'up' | 'down' }[];
  is_target_met: boolean;
}

export const BrokerTargets: React.FC<BrokerTargetsProps> = ({ slug }) => {
  const { data: targetsData, isLoading: isLoadingTargets, error: targetsError } = useQuery({
    queryKey: ['brokerTargets', slug],
    queryFn: () => fetchBrokerTargets(slug),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  const { data: stockData, isLoading: isLoadingStock } = useQuery({
    queryKey: ['stock', slug],
    queryFn: () => fetchStockData(slug),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  if (isLoadingTargets || isLoadingStock) {
    return (
      <div className="lg:col-span-3 h-[180px] bg-surface border border-border rounded-xl p-5 flex items-center justify-center">
        <div className="animate-pulse flex items-center gap-2 text-text-secondary">
          <Target size={16} className="animate-spin" />
          <span className="text-[10px] font-bold uppercase tracking-wider">FETCHING INSTITUTIONAL TARGETS...</span>
        </div>
      </div>
    );
  }

  if (targetsError || !targetsData || !targetsData.targets || targetsData.targets.length === 0) {
    return (
      <div className="lg:col-span-3 h-[180px] bg-surface border border-border rounded-xl p-5 flex flex-col items-center justify-center">
        <Target size={24} className="text-text-secondary mb-2 opacity-50" />
        <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">NO INSTITUTIONAL COVERAGE FOUND</span>
      </div>
    );
  }

  const targets: TargetData[] = targetsData.targets;
  
  const ohlcv = stockData?.absolute?.OHLCV || [];
  // Deduplicate ohlcv by Date (keep the latest entry for each date if there are duplicates)
  const uniqueOhlcvMap = new Map();
  ohlcv.forEach((d: any) => {
    uniqueOhlcvMap.set(d.Date, d);
  });
  const uniqueOhlcv = Array.from(uniqueOhlcvMap.values()).sort((a: any, b: any) => a.Date.localeCompare(b.Date));

  const historical = uniqueOhlcv.slice(-252);
  const chartData: any[] = [];
  
  const isUp = historical.length > 0 && historical[historical.length - 1].Close >= historical[0].Close;
  const priceColor = isUp ? '#10b981' : '#ef4444'; // emerald-500 or red-500
  
  let currentPrice = 0;

  if (historical.length > 0) {
    historical.forEach((day: any, index: number) => {
      const isLast = index === historical.length - 1;
      if (isLast) currentPrice = day.Close;
      chartData.push({
        date: day.Date,
        Price: day.Close,
        High: isLast ? day.Close : null,
        Mean: isLast ? day.Close : null,
        Low: isLast ? day.Close : null,
      });
    });
  }

  if (targets.length > 0 && currentPrice > 0) {
    const targetPrices = targets.map(t => t.target_price);
    const maxTarget = Math.max(...targetPrices);
    const minTarget = Math.min(...targetPrices);
    const meanTarget = targetPrices.reduce((a, b) => a + b, 0) / targetPrices.length;

    // Pad with empty points to make the future take up exactly half the chart
    const futurePointsCount = Math.max(historical.length, 1);

    for (let i = 1; i < futurePointsCount; i++) {
      chartData.push({
        date: `Forecast Day ${i}`,
        Price: null,
        High: null,
        Mean: null,
        Low: null,
      });
    }

    // Final forecast point
    chartData.push({
      date: '+1Y Forecast',
      Price: null,
      High: parseFloat(maxTarget.toFixed(2)),
      Mean: parseFloat(meanTarget.toFixed(2)),
      Low: parseFloat(minTarget.toFixed(2)),
    });
  }

  // Find min/max for y-axis domain to ensure comfortable fit
  const allPrices = [
    ...historical.map((d: any) => d.Close),
    ...targets.map(t => t.target_price)
  ].filter(p => p !== null && p !== undefined && p > 0);
  const globalMin = allPrices.length > 0 ? Math.min(...allPrices) : 0;
  const globalMax = allPrices.length > 0 ? Math.max(...allPrices) : 100;
  const padding = (globalMax - globalMin) * 0.1;

  // Custom Tooltip for the chart
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const isForecast = label.includes('Forecast');
      
      return (
        <div className="bg-surface-hover border border-border p-3 rounded-lg shadow-xl text-[11px]">
          <p className="font-bold text-text-primary mb-2 border-b border-border pb-1">{isForecast ? '+1Y Institutional Target' : label}</p>
          {payload.map((entry: any, index: number) => {
            if (entry.value === null || (isForecast && entry.dataKey === 'Price')) return null;
            if (!isForecast && entry.dataKey !== 'Price') return null; // Don't show target dots on 'Today'
            return (
              <div key={index} className="flex items-center justify-between gap-4 py-0.5">
                <span style={{ color: entry.color }} className="font-semibold uppercase tracking-wider text-[10px]">{entry.dataKey}</span>
                <span className="font-mono text-text-primary">₹{entry.value.toLocaleString()}</span>
              </div>
            );
          })}
        </div>
      );
    }
    return null;
  };

  let highBrokerName = 'High Target';
  let lowBrokerName = 'Low Target';
  let meanBrokerName = `Consensus (${targets.length} Brokers)`;

  if (targets.length > 0) {
    const maxItem = targets.reduce((prev, curr) => (curr.target_price > prev.target_price ? curr : prev), targets[0]);
    const minItem = targets.reduce((prev, curr) => (curr.target_price < prev.target_price ? curr : prev), targets[0]);
    if (maxItem) highBrokerName = maxItem.broker;
    if (minItem) lowBrokerName = minItem.broker;
  }

  // 52-Week High & Low calculation from historical data or stockData.absolute
  const fiftyTwoWeekHigh = stockData?.absolute?.['52w high'] ? parseFloat(String(stockData.absolute['52w high']).replace(/[^\d.]/g, '')) : (historical.length > 0 ? Math.max(...historical.map((d: any) => d.High || d.Close)) : 0);
  const fiftyTwoWeekLow = stockData?.absolute?.['52w low'] ? parseFloat(String(stockData.absolute['52w low']).replace(/[^\d.]/g, '')) : (historical.length > 0 ? Math.min(...historical.map((d: any) => d.Low || d.Close)) : 0);

  // Custom price dot rendering for forecast endpoints (+1Y Forecast ONLY) with Broker Name
  const RenderPriceDot = (color: string, brokerName: string) => (props: any) => {
    const { cx, cy, value, payload } = props;
    if (value === null || value === undefined || payload?.date !== '+1Y Forecast') return null;

    const pct = currentPrice > 0 ? ((value - currentPrice) / currentPrice) * 100 : 0;
    const pctStr = `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
    const priceText = `₹${Math.round(value).toLocaleString()} (${pctStr})`;
    const truncatedBroker = brokerName.length > 18 ? `${brokerName.slice(0, 16)}...` : brokerName;

    return (
      <g>
        <circle cx={cx} cy={cy} r={4} fill={color} stroke="#18181b" strokeWidth={2} />
        <g transform={`translate(${cx + 6}, ${cy - 16})`}>
          <rect x="0" y="0" width="138" height="32" rx="4" fill="#09090b" stroke={color} strokeWidth="1.5" />
          <text x="69" y="11" fill="#94a3b8" fontSize="8" fontWeight="bold" textAnchor="middle">
            {truncatedBroker.toUpperCase()}
          </text>
          <text x="69" y="25" fill={color} fontSize="9.5" fontWeight="bold" textAnchor="middle">
            {priceText}
          </text>
        </g>
      </g>
    );
  };

  // Custom dot rendering for Current Price (at historical endpoint)
  const RenderCurrentPriceDot = (props: any) => {
    const { cx, cy, value, index } = props;
    if (value === null || value === undefined || index !== historical.length - 1) return null;
    const labelText = `CMP ₹${Math.round(value).toLocaleString()}`;
    return (
      <g>
        <circle cx={cx} cy={cy} r={4} fill="#38bdf8" stroke="#18181b" strokeWidth={2} />
        <g transform={`translate(${cx - 84}, ${cy - 9})`}>
          <rect x="0" y="0" width="76" height="18" rx="4" fill="#09090b" stroke="#38bdf8" strokeWidth="1.5" />
          <text x="38" y="12" fill="#38bdf8" fontSize="9" fontWeight="bold" textAnchor="middle">
            {labelText}
          </text>
        </g>
      </g>
    );
  };

  return (
    <div className="lg:col-span-3 bg-surface border border-border rounded-xl p-5 flex flex-col relative overflow-hidden">
      <div className="flex justify-between items-start mb-6 shrink-0">
        <h3 className="text-sm font-semibold text-text-primary flex items-center gap-1.5">
          <Target size={14} className="text-text-secondary" />
          Institutional Targets & 1-Year Forecast
        </h3>
      </div>
      
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-5 gap-6 min-h-[350px]">
        
        {/* Left Pane: Forecast Graph (40%) */}
        <div className="lg:col-span-2 flex flex-col border-r border-border pr-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[10px] text-text-secondary uppercase font-bold tracking-wider mb-1">Target Trajectory</p>
              <p className="text-xs text-text-primary font-medium">Historical vs Analyst Projections</p>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-mono">
              <span className="text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded font-semibold" title="52-Week High">
                52W H: ₹{Math.round(fiftyTwoWeekHigh).toLocaleString()}
              </span>
              <span className="text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded font-semibold" title="52-Week Low">
                52W L: ₹{Math.round(fiftyTwoWeekLow).toLocaleString()}
              </span>
            </div>
          </div>
          
          <div className="flex-1 w-full relative min-h-[280px]">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 15, right: 155, left: -15, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    stroke="#94a3b8" 
                    fontSize={9} 
                    tickFormatter={(val) => {
                      if (val === '+1Y Forecast') return '+1 Year';
                      if (val.includes('Forecast')) return '';
                      return val.split('-').slice(1).join('/'); // Show MM/DD
                    }}
                    minTickGap={30}
                  />
                  <YAxis 
                    domain={[globalMin - padding, globalMax + padding]} 
                    stroke="#94a3b8" 
                    fontSize={9}
                    tickFormatter={(val) => `₹${Math.round(val)}`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                  
                  <Line type="monotone" dataKey="Price" stroke={priceColor} strokeWidth={2} dot={RenderCurrentPriceDot} isAnimationActive={false} />
                  <Line type="monotone" dataKey="High" stroke="#10b981" strokeWidth={2} strokeDasharray="5 5" dot={RenderPriceDot('#10b981', highBrokerName)} connectNulls={true} isAnimationActive={false} />
                  <Line type="monotone" dataKey="Mean" stroke="#eab308" strokeWidth={2} strokeDasharray="5 5" dot={RenderPriceDot('#eab308', meanBrokerName)} connectNulls={true} isAnimationActive={false} />
                  <Line type="monotone" dataKey="Low" stroke="#ef4444" strokeWidth={2} strokeDasharray="5 5" dot={RenderPriceDot('#ef4444', lowBrokerName)} connectNulls={true} isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-[10px] text-text-secondary uppercase tracking-wider font-bold">
                Insufficient Historical Data
              </div>
            )}
          </div>
        </div>

        {/* Right Pane: Broker Cards (60%) */}
        <div className="lg:col-span-3 flex flex-col h-full">
          <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 h-full">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {targets.map((target, idx) => {
                const isBuy = target.action === 'BUY' || target.action === 'ACCUMULATE' || target.action === 'OUTPERFORM';
                const isSell = target.action === 'SELL' || target.action === 'REDUCE' || target.action === 'UNDERPERFORM';
                
                return (
                  <div key={idx} className={`bg-white/5 border border-border rounded-lg p-4 flex flex-col justify-between hover:bg-white/10 transition-colors group`}>
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="font-bold text-text-primary text-sm truncate max-w-[150px]" title={target.broker}>
                          {target.broker}
                        </h4>
                        <p className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider mt-1">
                          {target.date}
                        </p>
                        {target.signals && target.signals.length > 0 && (
                          <div className="flex flex-col gap-1 mt-1.5">
                            {target.signals.map((sig, sidx) => (
                              <div key={sidx} className="flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wider">
                                {sig.direction === 'up' ? <TrendingUp size={10} className="text-emerald-500" /> : <TrendingDown size={10} className="text-red-500" />}
                                <span className={sig.direction === 'up' ? "text-emerald-500" : "text-red-500"}>{sig.type}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex flex-col items-end gap-2">
                        <span className={`px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1 uppercase tracking-wider ${isBuy ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : isSell ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-gray-500/10 text-text-secondary border border-gray-500/20'}`}>
                          {isBuy ? <TrendingUp size={10} /> : isSell ? <TrendingDown size={10} /> : <Minus size={10} />}
                          {target.action}
                        </span>
                        {target.is_target_met && (
                          <span className="px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1 uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            <Target size={10} />
                            MET
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-end justify-between mt-2 pt-2 border-t border-border">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-text-secondary font-semibold uppercase tracking-wider mb-0.5">Target</span>
                        <span className="text-lg font-black tracking-tight text-text-primary group-hover:text-blue-400 transition-colors">
                          ₹{target.target_price.toLocaleString()}
                        </span>
                      </div>
                      
                      {target.price_at_reco && (
                        <div className="flex flex-col text-right">
                          <span className="text-[9px] text-text-secondary font-semibold uppercase tracking-wider mb-0.5">Price at Reco</span>
                          <span className="text-[13px] font-bold text-text-primary">
                            ₹{target.price_at_reco.toLocaleString()}
                          </span>
                          {target.price_at_reco_change && (
                            <span className={`text-[10px] font-mono ${target.price_at_reco_change.includes('-') ? 'text-red-500' : 'text-emerald-500'}`}>
                              {target.price_at_reco_change}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-border flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] text-text-secondary uppercase tracking-wider font-semibold shrink-0">
            <span className="flex items-center gap-1"><TrendingUp size={10} className="text-emerald-500" /> Target: Increased target price</span>
            <span className="flex items-center gap-1"><TrendingDown size={10} className="text-red-500" /> Target: Reduced target price</span>
            <span className="flex items-center gap-1"><TrendingUp size={10} className="text-emerald-500" /> Reco: Upgraded rating</span>
            <span className="flex items-center gap-1"><TrendingDown size={10} className="text-red-500" /> Reco: Downgraded rating</span>
          </div>
        </div>
      </div>
    </div>
  );
};
