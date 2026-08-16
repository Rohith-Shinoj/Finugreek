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
    Fetches real broker targets dynamically from Trendlyne.
    """
    result = []
    try:
        import requests
        from bs4 import BeautifulSoup
        
        search_query = ticker.split('-')[0].split('_')[0]
        mc_link = f"https://trendlyne.com/research-reports/stock/{search_query}/{slug}/"
        
        headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Referer': 'https://trendlyne.com/'
        }
        
        page_res = requests.get(mc_link, headers=headers, timeout=8, allow_redirects=True)
        
        if page_res.status_code == 200:
            soup = BeautifulSoup(page_res.text, 'html.parser')
            table = soup.find('table', {'class': 'tl-dataTable'})
            
            if table and table.find('tbody'):
                rows = table.find('tbody').find_all('tr')
                for row in rows:
                    cols = row.find_all('td')
                    if len(cols) > 8:
                        date_str = cols[1].text.strip()
                        
                        # Parse broker name and signals from Col 3
                        broker_col = cols[3]
                        broker_link = broker_col.find('a')
                        if not broker_link:
                            continue
                        broker = broker_link.text.strip().replace('\n', ' ').strip()
                        if 'Consensus' in broker:
                            continue
                            
                        signals = []
                        label = broker_col.find('label')
                        if label:
                            label_text = label.text.strip() # "Target" or "Reco"
                            icon = label.find('i')
                            direction = 'up' if icon and 'arrow-up' in icon.get('class', []) else 'down'
                            
                            # Construct the signal string
                            if label_text.lower() == 'target':
                                sig_type = 'Increased target price' if direction == 'up' else 'Reduced target price'
                            elif label_text.lower() == 'reco':
                                sig_type = 'Upgraded rating' if direction == 'up' else 'Downgraded rating'
                            else:
                                sig_type = label_text
                                
                            signals.append({
                                'type': sig_type,
                                'direction': direction
                            })
                            
                        target_price_str = cols[5].text.strip()
                        action = cols[8].text.strip().upper()
                        
                        # Parse price_at_reco from Col 6
                        price_at_reco = None
                        price_at_reco_change = None
                        reco_str = cols[6].text.strip()
                        if reco_str and reco_str != '-':
                            parts = reco_str.split()
                            try:
                                price_at_reco = float(parts[0].replace(',', ''))
                                if len(parts) > 1:
                                    price_at_reco_change = parts[1].strip()
                            except ValueError:
                                pass
                        
                        try:
                            target_price = float(target_price_str.replace(',', ''))
                            result.append({
                                'date': date_str,
                                'broker': broker,
                                'action': action if action else 'HOLD',
                                'target_price': target_price,
                                'price_at_reco': price_at_reco,
                                'price_at_reco_change': price_at_reco_change,
                                'signals': signals,
                                'is_target_met': False
                            })
                        except ValueError:
                            continue

            # Fallback: Extract Trendlyne Consensus Target from page metadata if table rows are missing
            if not result:
                meta_desc = soup.find('meta', {'name': 'description'}) or soup.find('meta', {'property': 'og:description'})
                if meta_desc and meta_desc.get('content'):
                    desc_content = meta_desc['content']
                    # Example: "See 15 recent research reports for RELIANCE... from 5 source(s) with an average share price target of 1667."
                    target_match = re.search(r'average share price target of\s+([\d,.]+)', desc_content, re.IGNORECASE)
                    reports_match = re.search(r'See\s+(\d+)\s+recent research reports', desc_content, re.IGNORECASE)
                    sources_match = re.search(r'from\s+(\d+)\s+source\(s\)', desc_content, re.IGNORECASE)
                    
                    if target_match:
                        try:
                            target_val = float(target_match.group(1).replace(',', ''))
                            num_reports = reports_match.group(1) if reports_match else None
                            num_sources = sources_match.group(1) if sources_match else None
                            
                            broker_label = "Trendlyne Institutional Consensus"
                            if num_sources and num_reports:
                                broker_label += f" ({num_sources} Brokers / {num_reports} Reports)"
                            elif num_sources:
                                broker_label += f" ({num_sources} Brokers)"

                            result.append({
                                'date': datetime.datetime.now().strftime('%b %Y'),
                                'broker': broker_label,
                                'action': 'BUY',
                                'target_price': target_val,
                                'signals': [{'type': 'Average Target Price', 'direction': 'up'}],
                                'is_target_met': False
                            })
                        except ValueError:
                            pass

        # Deduplicate based on broker
        unique_targets = {}
        for r in result:
            b = r['broker'].lower()
            if b not in unique_targets:
                unique_targets[b] = r
                
        final_targets = list(unique_targets.values())
        return final_targets
        
    except Exception as e:
        print(f"Failed to fetch Trendlyne targets for {slug}: {e}")
        return []

