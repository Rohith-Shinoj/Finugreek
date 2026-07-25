import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET
import re
import datetime
from cachetools import cached, TTLCache

broker_cache = TTLCache(maxsize=500, ttl=4 * 60 * 60)

@cached(cache=broker_cache)
def fetch_broker_targets_from_mc(slug: str, ticker: str):
    """
    Fetches real broker targets dynamically using yfinance.
    """
    result = []
    try:
        import requests
        from bs4 import BeautifulSoup
        
        # Build the exact Trendlyne URL using the ticker and the slug
        # Format: https://trendlyne.com/research-reports/stock/RELIANCE/reliance-industries-ltd/
        search_query = ticker.split('-')[0].split('_')[0]
        mc_link = f"https://trendlyne.com/research-reports/stock/{search_query}/{slug}/"
        
        headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9'
        }
        
        page_res = requests.get(mc_link, headers=headers, timeout=8)
        
        if page_res.status_code == 200:
            soup = BeautifulSoup(page_res.text, 'html.parser')
            table = soup.find('table', {'class': 'tl-dataTable'})
            
            if table and table.find('tbody'):
                rows = table.find('tbody').find_all('tr')
                for row in rows:
                    cols = row.find_all('td')
                    if len(cols) > 8:
                        date_str = cols[1].text.strip()
                        broker = cols[3].text.strip().replace('\n', ' ').replace('Target', '').strip()
                        if 'Consensus' in broker:
                            continue
                            
                        target_price_str = cols[5].text.strip()
                        action = cols[8].text.strip().upper()
                        
                        try:
                            target_price = float(target_price_str.replace(',', ''))
                            result.append({
                                'date': date_str,
                                'broker': broker,
                                'action': action if action else 'HOLD',
                                'target_price': target_price,
                                'price_at_reco': None,
                                'is_target_met': False
                            })
                        except ValueError:
                            continue
                            
        # Deduplicate based on broker
        unique_targets = {}
        for r in result:
            b = r['broker'].lower()
            if b not in unique_targets:
                unique_targets[b] = r
                
        final_targets = list(unique_targets.values())
        return final_targets[:5]
        
    except Exception as e:
        print(f"Failed to fetch Trendlyne targets for {slug}: {e}")
        return []
