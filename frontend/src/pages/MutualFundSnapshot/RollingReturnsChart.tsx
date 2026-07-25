import React, { useMemo } from 'react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, ReferenceLine } from 'recharts';

export const RollingReturnsChart = ({ fund, niftyData }: { fund: any, niftyData?: any[] }) => {
  const data = useMemo(() => {
    if (!fund?.historical_navs || !niftyData || niftyData.length === 0) return [];
    
    try {
      const navs = (typeof fund.historical_navs === 'string' ? JSON.parse(fund.historical_navs) : fund.historical_navs)
        .map((d: any) => ({ time: new Date(d[0]).getTime(), value: d[1] }))
        .sort((a: any, b: any) => a.time - b.time);
        
      const benchMap = new Map(niftyData.map((d: any) => [new Date(d.time).getTime(), d.value]));
      const benchTimes = Array.from(benchMap.keys()).sort((a, b) => a - b);
      
      const getClosestValue = (arr: {time: number, value: number}[], t: number) => {
        let left = 0, right = arr.length - 1;
        if (t <= arr[left].time) return arr[left].value;
        if (t >= arr[right].time) return arr[right].value;
        while (left <= right) {
          const mid = Math.floor((left + right) / 2);
          if (arr[mid].time === t) return arr[mid].value;
          if (arr[mid].time < t) left = mid + 1;
          else right = mid - 1;
        }
        return arr[right].value; // closest earlier
      };

      const getClosestBench = (t: number) => {
        let left = 0, right = benchTimes.length - 1;
        if (t <= benchTimes[left]) return benchMap.get(benchTimes[left])!;
        if (t >= benchTimes[right]) return benchMap.get(benchTimes[right])!;
        while (left <= right) {
          const mid = Math.floor((left + right) / 2);
          if (benchTimes[mid] === t) return benchMap.get(benchTimes[mid])!;
          if (benchTimes[mid] < t) left = mid + 1;
          else right = mid - 1;
        }
        return benchMap.get(benchTimes[right])!; // closest earlier
      };

      const points = [];
      const THREE_YEARS_MS = 3 * 365 * 24 * 60 * 60 * 1000;
      const now = new Date();
      
      for (let i = 60; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const t = d.getTime();
        const t_minus_3y = t - THREE_YEARS_MS;
        
        const fundNow = getClosestValue(navs, t);
        const fundPast = getClosestValue(navs, t_minus_3y);
        
        const benchNow = getClosestBench(t);
        const benchPast = getClosestBench(t_minus_3y);
        
        const fRet = (Math.pow(fundNow / fundPast, 1/3) - 1) * 100;
        const bRet = (Math.pow(benchNow / benchPast, 1/3) - 1) * 100;
        
        points.push({
          date: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
          value: Number(fRet.toFixed(2)),
          benchmark: Number(bRet.toFixed(2))
        });
      }
      return points;
    } catch(e) { return []; }
  }, [fund, niftyData]);

  const winRate = useMemo(() => {
    if (data.length === 0) return 0;
    const wins = data.filter(d => d.value > d.benchmark).length;
    return Math.round((wins / data.length) * 100);
  }, [data]);

  const min = Math.min(...data.map(d => Math.min(d.value, d.benchmark)));
  const max = Math.max(...data.map(d => Math.max(d.value, d.benchmark)));

  return (
    <div className="w-full h-full flex flex-col">
      <div className="text-[10px] text-text-secondary mb-2 flex justify-between">
        <span>Evaluates 3-year holding periods over the last 5 years.</span>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500"></div> Fund Return</div>
          <div className="flex items-center gap-1"><div className="w-2 h-0.5 bg-red-500 border-t border-dashed border-red-500"></div> Benchmark (Nifty 50)</div>
        </div>
      </div>
      
      {/* Win Rate Badge */}
      <div className="absolute top-10 right-4 z-10 flex flex-col items-end pointer-events-none">
         <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1">Win Rate</span>
         <div className={`px-2 py-1 rounded text-xs font-bold font-mono ${winRate > 50 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
           {winRate}%
         </div>
      </div>
      <div className="flex-1 min-h-0 relative">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="rollGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <XAxis 
              dataKey="date" 
              stroke="#ffffff20" 
              fontSize={10} 
              tick={{fill: '#888'}} 
              tickMargin={8} 
              minTickGap={30}
            />
            <YAxis 
              stroke="#ffffff20" 
              fontSize={10} 
              tick={{fill: '#888'}} 
              tickFormatter={(v) => `${v}%`}
              domain={[Math.floor(min - 2), Math.ceil(max + 2)]}
            />
            <Tooltip 
              contentStyle={{ backgroundColor: '#111114', borderColor: '#ffffff10', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold' }}
              itemStyle={{ color: '#3b82f6' }}
              formatter={(value: any, name: any) => [`${value}%`, name === 'value' ? 'Fund (3Y)' : 'Benchmark (3Y)']}
            />
            <Area 
              type="monotone" 
              dataKey="value" 
              stroke="#3b82f6" 
              strokeWidth={2}
              fillOpacity={1} 
              fill="url(#rollGradient)" 
            />
            <Area 
              type="monotone" 
              dataKey="benchmark" 
              stroke="#ef4444" 
              strokeWidth={1.5}
              strokeDasharray="4 4"
              fill="none" 
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
