import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchAllStocks } from '../api';
import { Maximize, Grid, PieChart, ChevronDown, Flag } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { StockLogo } from '../components/StockLogo';
// Vite native worker import — compiled separately and loaded on demand
const createTreemapWorker = () => new Worker(
  new URL('../workers/treemapWorker.ts', import.meta.url),
  { type: 'module' }
);

const parseDayChange = (changeStr: string) => {
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

// Strict TradingView Colors Steps
const getPerformanceColor = (value: number, timeframe: string) => {
  let scaleMultiplier = 1;
  if (timeframe === 'Performance 1W, %') scaleMultiplier = 3.33;
  if (timeframe === 'Performance 1M, %') scaleMultiplier = 6.66;
  if (timeframe === 'Performance 3M, %') scaleMultiplier = 10.0; // +/- 30%
  if (timeframe === 'Performance 6M, %') scaleMultiplier = 13.33; // +/- 40%
  if (timeframe === 'Performance YTD, %') scaleMultiplier = 15.0; // +/- 45%
  if (timeframe === 'Performance 1Y, %') scaleMultiplier = 20.0; // +/- 60% 

  const v = value / scaleMultiplier;

  if (v <= -3) return '#f23645';
  if (v <= -2) return '#f7525f';
  if (v < -0.25) return '#f77c80';
  if (v >= -0.25 && v <= 0.25) return '#787b86';
  if (v > 0.25 && v <= 2) return '#42bd7f';
  if (v > 2 && v < 3) return '#089950';
  return '#056636';
};

const formatNumber = (num: number) => {
  if (num >= 1e5) return (num / 1e5).toFixed(2) + 'L';
  if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
  return num.toFixed(2);
};

export const MarketHeatmap = () => {
  const navigate = useNavigate();
  const [indexFilter, setIndexFilter] = useState('Nifty 50 Index');
  const [sizeBy, setSizeBy] = useState('Market Cap');
  const [colorBy, setColorBy] = useState('Change 1D, %');
  const [groupBy, setGroupBy] = useState('Sector');
  const [selectedSector, setSelectedSector] = useState<string | null>(null);
  const [hiddenColorSteps, setHiddenColorSteps] = useState<string[]>([]);

  const scaleMultiplier = useMemo(() => {
    if (colorBy === 'Performance 1W, %') return 3.33;
    if (colorBy === 'Performance 1M, %') return 6.66;
    if (colorBy === 'Performance 3M, %') return 10.0;
    if (colorBy === 'Performance 6M, %') return 13.33;
    if (colorBy === 'Performance YTD, %') return 15.0;
    if (colorBy === 'Performance 1Y, %') return 20.0;
    return 1.0;
  }, [colorBy]);

  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredNode, setHoveredNode] = useState<any>(null);

  const indexLimit = useMemo(() => {
    if (indexFilter === 'Nifty 50 Index') return 50;
    if (indexFilter === 'Nifty Next 50 Index') return 100;
    if (indexFilter === 'BSE Sensex') return 30;
    if (indexFilter === 'Nifty 500 Index') return 500;
    return 2000; // Entire Market — cap at 2000 for performance
  }, [indexFilter]);

  const { data: stocks, isLoading } = useQuery({
    queryKey: ['allStocks', indexFilter],
    queryFn: () => fetchAllStocks({ limit: indexLimit }),
    staleTime: 5 * 60 * 1000, // 5 min — avoid re-fetch on filter toggle
  });

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height
        });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [isLoading]);

  // ── Web Worker for off-main-thread treemap layout ──────────────────────────
  const workerRef = useRef<Worker | null>(null);
  const [rootNode, setRootNode] = useState<any>(null);
  const [isComputing, setIsComputing] = useState(false);

  // Create worker once on mount
  useEffect(() => {
    const worker = createTreemapWorker();
    workerRef.current = worker;
    worker.onmessage = (e: MessageEvent) => {
      setRootNode(e.data);
      setIsComputing(false);
    };
    return () => worker.terminate();
  }, []);

  // Send work to worker whenever inputs change
  useEffect(() => {
    if (!stocks || dimensions.width === 0 || dimensions.height === 0) return;
    setIsComputing(true);
    workerRef.current?.postMessage({
      stocks,
      dimensions,
      sizeBy,
      colorBy,
      groupBy,
      indexFilter,
      selectedSector,
      hiddenColorSteps,
    });
  }, [stocks, dimensions, sizeBy, colorBy, groupBy, indexFilter, selectedSector, hiddenColorSteps]);

  if (isLoading || !stocks) {
    return (
      <div className="flex flex-col h-full bg-canvas p-4">
        <div className="animate-pulse bg-surface-hover h-[90%] w-full rounded-xl border border-border" />
      </div>
    );
  }

  return (
    <div className="flex-1 w-full flex flex-col min-h-full bg-canvas text-text-primary">
      {/* Top Navigation Bar */}
      <header className="flex-none px-4 py-2 flex flex-col gap-3 border-b border-border bg-canvas z-10 shrink-0">
        <h1 className="text-xl font-bold tracking-tight text-text-primary">Stock Heatmap</h1>

        <div className="flex items-center gap-4 overflow-x-auto text-sm">
          {/* Index / Context */}
          <div className="flex items-center gap-1.5 bg-surface-hover px-2 py-1 rounded border border-border text-text-primary group cursor-pointer">
            <Flag size={14} className="text-[#089950]" />
            <select
              value={indexFilter}
              onChange={e => { setIndexFilter(e.target.value); setSelectedSector(null); }}
              className="bg-transparent focus:outline-none text-text-primary font-semibold cursor-pointer appearance-none outline-none pr-1"
            >
              <option>Nifty 50 Index</option>
              <option>Nifty Next 50 Index</option>
              <option>BSE Sensex</option>
              <option>Nifty 500 Index</option>
              <option>Entire Market</option>
            </select>
            <ChevronDown size={14} className="text-gray-600 group-hover:text-text-secondary" />
          </div>

          <div className="w-px h-4 bg-border" />

          {/* Size By */}
          <div className="flex items-center gap-1.5 group cursor-pointer">
            <Maximize size={14} className="text-text-secondary" />
            <select
              value={sizeBy}
              onChange={e => setSizeBy(e.target.value)}
              className="bg-transparent focus:outline-none text-text-primary hover:text-text-primary font-semibold cursor-pointer appearance-none outline-none pr-1"
            >
              <option>Market Cap</option>
              <option>Volume 1D</option>
              <option>Volume 1W</option>
              <option>Volume 1M</option>
              <option>Price * Volume (Turnover) 1D</option>
              <option>Price * Volume (Turnover) 1W</option>
              <option>Price * Volume (Turnover) 1M</option>
              <option>Mono size</option>
            </select>
            <ChevronDown size={14} className="text-gray-600 group-hover:text-text-secondary" />
          </div>

          <div className="w-px h-4 bg-border" />

          {/* Color By */}
          <div className="flex items-center gap-1.5 group cursor-pointer">
            <Grid size={14} className="text-text-secondary" />
            <select
              value={colorBy}
              onChange={e => setColorBy(e.target.value)}
              className="bg-transparent focus:outline-none text-text-primary hover:text-text-primary font-semibold cursor-pointer appearance-none outline-none pr-1"
            >
              <option>Change 1D, %</option>
              <option>Performance 1W, %</option>
              <option>Performance 1M, %</option>
              <option>Performance 3M, %</option>
              <option>Performance 6M, %</option>
              <option>Performance YTD, %</option>
              <option>Performance 1Y, %</option>
            </select>
            <ChevronDown size={14} className="text-gray-600 group-hover:text-text-secondary" />
          </div>

          <div className="w-px h-4 bg-border" />

          {/* Group By */}
          <div className="flex items-center gap-1.5 group cursor-pointer">
            <PieChart size={14} className="text-text-secondary" />
            <select
              value={groupBy}
              onChange={e => setGroupBy(e.target.value)}
              className="bg-transparent focus:outline-none text-text-primary hover:text-text-primary font-semibold cursor-pointer appearance-none outline-none pr-1"
            >
              <option>Sector</option>
              <option>No group</option>
            </select>
            <ChevronDown size={14} className="text-gray-600 group-hover:text-text-secondary" />
          </div>

          <div className="w-px h-4 bg-border" />

          {/* Legend Inline */}
          <div className="flex items-center gap-1">
            {[
              { c: '#f23645', v: -3, p: '< ' },
              { c: '#f7525f', v: -2, p: '' },
              { c: '#f77c80', v: -0.25, p: '' },
              { c: '#787b86', v: 0, p: '' },
              { c: '#42bd7f', v: 0.25, p: '' },
              { c: '#089950', v: 2, p: '' },
              { c: '#056636', v: 3, p: '> ' }
            ].map(({ c, v, p }) => {
              const val = v * scaleMultiplier;
              const formatted = v === 0 ? '0' : (Math.abs(val) < 10 ? val.toFixed(1).replace('.0', '') : Math.round(val).toString());
              return (
                <div
                  key={c}
                  onClick={() => setHiddenColorSteps(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])}
                  style={{ backgroundColor: c }}
                  className={`flex items-center justify-center px-2 h-5 rounded cursor-pointer hover:scale-110 transition-transform shadow-sm text-[10px] font-bold text-text-primary ${hiddenColorSteps.includes(c) ? 'opacity-30 scale-90' : 'opacity-100'}`}
                  title={`Toggle scale`}
                >
                  {p}{formatted}%
                </div>
              );
            })}
          </div>
        </div>
      </header>

      {/* Heatmap Container */}
      <div className="flex-1 relative w-full h-full min-h-0 bg-canvas overflow-hidden" ref={containerRef}>
        {/* {!rootNode && (
          <div className="text-text-primary p-4 font-mono text-sm">
            DEBUG INFO: <br/>
            dimensions: {dimensions.width}x{dimensions.height} <br/>
            stocks loaded: {stocks ? stocks.length : 'loading...'} <br/>
            filtered: {stocks ? stocks.filter((s: any) => (s.marketCap || 0) > 0).length : 0} <br/>
          </div>
        )} */}
        {rootNode && (!rootNode.children || rootNode.children.length === 0) && (
          <div className="text-text-primary p-4 font-mono text-sm">
            DEBUG: rootNode has 0 leaves!
          </div>
        )}
        {rootNode && rootNode.children && rootNode.children.map((sectorNode: any, i: number) => {
          return (
            <div key={`sector-${i}`} style={{ position: 'absolute', left: sectorNode.x0, top: sectorNode.y0, width: sectorNode.x1 - sectorNode.x0, height: sectorNode.y1 - sectorNode.y0, pointerEvents: 'none' }}>
              {/* Sector Header */}
              {((groupBy !== 'No group' || selectedSector) && !selectedSector && sectorNode.x1 - sectorNode.x0 > 50 && sectorNode.y1 - sectorNode.y0 > 25) && (
                <div
                  onClick={() => setSelectedSector((sectorNode.data as any).name)}
                  className="absolute top-0 left-0 h-[22px] flex items-center px-1 text-text-primary/80 hover:text-text-primary font-medium text-[11px] bg-transparent truncate pointer-events-auto cursor-pointer transition-colors"
                >
                  {(sectorNode.data as any).name} <span className="ml-0.5 opacity-50">&gt;</span>
                </div>
              )}
              {/* Selected Sector Back Button */}
              {selectedSector && (
                <div
                  onClick={() => setSelectedSector(null)}
                  className="absolute top-0 left-0 h-[22px] flex items-center px-1 text-text-primary hover:text-alpha font-bold text-[11px] bg-transparent truncate pointer-events-auto cursor-pointer transition-colors z-20"
                >
                  &lt; Back to All Sectors
                </div>
              )}

              {/* Leaves */}
              {sectorNode.children && sectorNode.children.map((leafNode: any, j: number) => {
                const data = leafNode.data as any;
                const width = leafNode.x1 - leafNode.x0;
                const height = leafNode.y1 - leafNode.y0;
                // Since this div is inside the sectorNode (which is absolute positioned at sectorNode.x0),
                // the leafNode position needs to be relative to the sectorNode!
                const relX = leafNode.x0 - sectorNode.x0;
                const relY = leafNode.y0 - sectorNode.y0;

                const color = getPerformanceColor(data.colorValue, colorBy);

                const isTiny = width < 38 || height < 28;
                const isLarge = width >= 54 && height >= 48;

                const showLogo = isLarge || (isTiny && width >= 18 && height >= 18);
                const showText = !isTiny;

                // Dynamic font size proportional to cell dimensions
                const fontSizeName = Math.max(8, Math.min(width * 0.16, height * 0.16, 13));
                const fontSizeVal = Math.max(8, Math.min(width * 0.14, height * 0.14, 11));

                return (
                  <div
                    key={`leaf-${j}`}
                    onClick={() => navigate(`/stocks/${data.slug}`)}
                    onMouseEnter={() => setHoveredNode(data)}
                    onMouseLeave={() => setHoveredNode(null)}
                    style={{
                      position: 'absolute',
                      left: relX,
                      top: relY,
                      width: width,
                      height: height,
                      backgroundColor: color,
                      pointerEvents: 'auto',
                      cursor: 'pointer'
                    }}
                    className="flex flex-col items-center justify-center overflow-hidden hover:brightness-110 transition-all border border-[#131722]/20 p-0.5"
                  >
                    <div className="flex flex-col items-center justify-center w-full h-full gap-0.5 leading-none">
                      {showLogo && (
                        <div
                          style={{
                            width: isLarge ? Math.min(width * 0.28, height * 0.28, 28) : Math.min(width * 0.5, height * 0.5, 18),
                            height: isLarge ? Math.min(width * 0.28, height * 0.28, 28) : Math.min(width * 0.5, height * 0.5, 18)
                          }}
                          className="rounded-full overflow-hidden bg-white shrink-0 flex items-center justify-center shadow-sm"
                        >
                          <StockLogo ticker={data.name} name={data.fullName} className="w-full h-full object-cover" />
                        </div>
                      )}
                      {showText && (
                        <div className="flex flex-col items-center justify-center w-full min-w-0 leading-none">
                          <span
                            className="text-text-primary font-semibold truncate w-full text-center leading-tight"
                            style={{ fontSize: fontSizeName }}
                          >
                            {data.name}
                          </span>
                          {height >= 40 && (
                            <span
                              className="text-text-primary font-medium truncate w-full text-center leading-tight"
                              style={{ fontSize: fontSizeVal }}
                            >
                              {data.colorValue > 0 ? '+' : ''}{data.colorValue.toFixed(2)}%
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}

        {/* Floating Command Bar Tooltip */}
        {hoveredNode && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 bg-canvas border border-border shadow-2xl rounded-lg px-4 py-3 text-sm pointer-events-none transition-all duration-150 animate-in fade-in slide-in-from-bottom-4">
            <div className="flex items-center gap-3 pr-4 border-r border-border">
              <div className="w-8 h-8 rounded-full bg-white overflow-hidden shrink-0">
                <StockLogo ticker={hoveredNode.name} name={hoveredNode.fullName} className="w-full h-full" />
              </div>
              <div>
                <div className="text-text-primary font-bold leading-tight">{hoveredNode.name}</div>
                <div className="text-text-secondary text-xs truncate max-w-[150px] leading-tight">{hoveredNode.fullName}</div>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="flex flex-col">
                <span className="text-text-primary font-mono font-medium">{formatNumber(hoveredNode.size)}</span>
                <span className="text-[10px] text-text-secondary font-medium uppercase tracking-wider">{sizeBy}</span>
              </div>
              <div className="flex flex-col">
                <span className={`font-mono font-bold ${hoveredNode.colorValue >= 0 ? 'text-[#42bd7f]' : 'text-[#f23645]'}`}>
                  {hoveredNode.colorValue > 0 ? '+' : ''}{hoveredNode.colorValue.toFixed(2)}{colorBy === 'P/E Ratio' ? '' : '%'}
                </span>
                <span className="text-[10px] text-text-secondary font-medium uppercase tracking-wider">{colorBy}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Hidden Scale Labels for bottom since it moved to header (could remove this entirely) */}
      <div className="hidden">
      </div>
    </div>
  );
};
