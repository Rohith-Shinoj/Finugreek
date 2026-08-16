// treemapWorker.ts — runs D3 treemap layout in a background thread
// Receives stock data + config, returns pre-computed leaf positions

import { treemap, hierarchy } from 'd3-hierarchy';

const parseDayChange = (changeStr: string): number => {
  if (!changeStr) return 0;
  const isNegative = changeStr.trim().startsWith('-');
  const match = changeStr.match(/\(([-+]?[\d.]+)%\)/);
  if (match) {
    let val = parseFloat(match[1]);
    if (isNegative && val > 0) val = -val;
    return val;
  }
  const justNum = parseFloat(changeStr);
  return isNaN(justNum) ? 0 : justNum;
};

const getPerformanceColor = (value: number, colorBy: string): string => {
  let scaleMultiplier = 1;
  if (colorBy === 'Performance 1W, %') scaleMultiplier = 3.33;
  if (colorBy === 'Performance 1M, %') scaleMultiplier = 6.66;
  if (colorBy === 'Performance 3M, %') scaleMultiplier = 10.0;
  if (colorBy === 'Performance 6M, %') scaleMultiplier = 13.33;
  if (colorBy === 'Performance YTD, %') scaleMultiplier = 15.0;
  if (colorBy === 'Performance 1Y, %') scaleMultiplier = 20.0;
  const v = value / scaleMultiplier;
  if (v <= -3) return '#f23645';
  if (v <= -2) return '#f7525f';
  if (v < -0.25) return '#f77c80';
  if (v >= -0.25 && v <= 0.25) return '#787b86';
  if (v > 0.25 && v <= 2) return '#42bd7f';
  if (v > 2 && v < 3) return '#089950';
  return '#056636';
};

self.onmessage = (e: MessageEvent) => {
  const { stocks, dimensions, sizeBy, colorBy, groupBy, indexFilter, selectedSector, hiddenColorSteps } = e.data;

  if (!stocks || dimensions.width === 0 || dimensions.height === 0) {
    self.postMessage(null);
    return;
  }

  const getSizeValue = (s: any): number => {
    if (sizeBy === 'Market Cap') return s.marketCap || 0;
    if (sizeBy === 'Volume 1D') return s.volume || 0;
    if (sizeBy === 'Volume 1W') return s.vol_1w || 0;
    if (sizeBy === 'Volume 1M') return s.vol_1m || 0;
    if (sizeBy === 'Price * Volume (Turnover) 1D') return s.turnover_1d || 0;
    if (sizeBy === 'Price * Volume (Turnover) 1W') return s.turnover_1w || 0;
    if (sizeBy === 'Price * Volume (Turnover) 1M') return s.turnover_1m || 0;
    if (sizeBy === 'Mono size') return 1;
    return 0;
  };

  const getColorValue = (s: any): number => {
    if (colorBy === 'Change 1D, %') return parseDayChange(s.day_change);
    if (colorBy === 'Performance 1W, %') return s.perf_1w || 0;
    if (colorBy === 'Performance 1M, %') return s.perf_1m || 0;
    if (colorBy === 'Performance 3M, %') return s.perf_3m || 0;
    if (colorBy === 'Performance 6M, %') return s.perf_6m || 0;
    if (colorBy === 'Performance YTD, %') return s.perf_ytd || 0;
    if (colorBy === 'Performance 1Y, %') return s.perf_1y || 0;
    return 0;
  };

  const sortedByCap = [...stocks].sort((a: any, b: any) => (b.marketCap || 0) - (a.marketCap || 0));
  let baseStocks = sortedByCap;
  if (indexFilter === 'Nifty 50 Index') baseStocks = sortedByCap.slice(0, 50);
  else if (indexFilter === 'Nifty Next 50 Index') baseStocks = sortedByCap.slice(50, 100);
  else if (indexFilter === 'BSE Sensex') baseStocks = sortedByCap.slice(0, 30);
  else if (indexFilter === 'Nifty 500 Index') baseStocks = sortedByCap.slice(0, 500);

  if (selectedSector) {
    baseStocks = baseStocks.filter((s: any) => (s.industry || 'Other') === selectedSector);
  }

  const filteredStocks = baseStocks
    .filter((s: any) => getSizeValue(s) > 0)
    .filter((s: any) => {
      const color = getPerformanceColor(getColorValue(s), colorBy);
      return !hiddenColorSteps.includes(color);
    })
    .sort((a: any, b: any) => getSizeValue(b) - getSizeValue(a));

  const groups: Record<string, any> = {};
  if (groupBy === 'No group' || selectedSector) {
    const gName = selectedSector || 'All';
    groups[gName] = { name: gName, children: [] };
  }

  filteredStocks.forEach((stock: any) => {
    const groupName = (groupBy === 'No group' || selectedSector)
      ? (selectedSector || 'All')
      : (stock.industry || 'Other');
    if (!groups[groupName]) {
      groups[groupName] = { name: groupName, children: [] };
    }
    groups[groupName].children.push({
      name: stock.ticker,
      slug: stock.slug,
      fullName: stock.name,
      size: getSizeValue(stock),
      colorValue: getColorValue(stock),
      peRatio: stock.peRatio,
      marketCap: stock.marketCap,
      volume: stock.volume,
      dayChange: parseDayChange(stock.day_change),
      inst_accum: stock.inst_accum,
      perf_1w: stock.perf_1w,
      perf_1m: stock.perf_1m,
      perf_3m: stock.perf_3m,
      perf_6m: stock.perf_6m,
      perf_1y: stock.perf_1y,
      perf_ytd: stock.perf_ytd,
    });
  });

  const hierarchyData = { name: 'root', children: Object.values(groups) };

  const root = hierarchy(hierarchyData)
    .sum((d: any) => d.size)
    .sort((a: any, b: any) => ((b.value as number) || 0) - ((a.value as number) || 0));

  const tree = treemap()
    .size([dimensions.width, dimensions.height])
    .paddingInner(1)
    .paddingOuter(1)
    .paddingTop(groupBy === 'No group' ? 1 : 22)
    .round(true);

  const result = tree(root as any);
  self.postMessage(result);
};
