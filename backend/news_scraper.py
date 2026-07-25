import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET
import re
import time
import numpy as np
from cachetools import cached, TTLCache

news_cache = TTLCache(maxsize=500, ttl=4 * 60 * 60)

@cached(cache=news_cache)
def fetch_live_news_from_trendlyne(slug: str, ticker: str):
    """
    Fetches live news from Google News RSS. (Kept function name for compatibility)
    """
    search_query = ticker.split('-')[0].split('_')[0]
    encoded_query = urllib.parse.quote_plus(f"{search_query} stock NSE")
    url = f"https://news.google.com/rss/search?q={encoded_query}&hl=en-IN&gl=IN&ceid=IN:en"
    
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=10) as response:
            xml_data = response.read()
            
        root = ET.fromstring(xml_data)
        news = []
        
        for item in root.findall('.//item'):
            title = item.find('title').text if item.find('title') is not None else ""
            link = item.find('link').text if item.find('link') is not None else ""
            pubDate = item.find('pubDate').text if item.find('pubDate') is not None else ""
            
            # Filter generic algorithmic and technical analysis sources
            title_lower = title.lower()
            if any(x in title_lower for x in ['simplywall.st', 'tradingview', 'tipranks', 'marketsmojo', 'forecast', 'prediction']):
                continue
                
            news.append({
                "title": title,
                "summary": "",
                "date": pubDate,
                "url": link,
                "tag": "General",
                "score": 0.0
            })
            
            if len(news) >= 10:
                break
                
        for n in news:
            title_lower = n["title"].lower()
            if "profit" in title_lower or "revenue" in title_lower or "q1" in title_lower or "q2" in title_lower or "q3" in title_lower or "q4" in title_lower:
                n["tag"] = "Earnings"
                n["score"] = 0.6
            elif "sebi" in title_lower or "probe" in title_lower:
                n["tag"] = "Regulatory"
                n["score"] = -0.5
            elif "order" in title_lower or "contract" in title_lower:
                n["tag"] = "Order Win"
                n["score"] = 0.5
            elif "debt" in title_lower or "default" in title_lower:
                n["tag"] = "Credit Risk"
                n["score"] = -0.8
            elif "target" in title_lower or "buy" in title_lower or "outperform" in title_lower:
                n["tag"] = "Broker Upgrade"
                n["score"] = 0.7
            elif "downgrade" in title_lower or "sell" in title_lower or "underperform" in title_lower:
                n["tag"] = "Broker Downgrade"
                n["score"] = -0.6
            elif "dividend" in title_lower or "bonus" in title_lower:
                n["tag"] = "Corporate Action"
                n["score"] = 0.4
            else:
                n["score"] = 0.1
                
        return news
    except Exception as e:
        print(f"Failed to fetch Google News RSS for {slug}: {e}")
        return []
