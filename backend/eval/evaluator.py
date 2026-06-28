import logging
import time
from datetime import datetime, timedelta
from cache.store import get_pending_evals, update_brief_eval
from tools.price import fetch_price_data

logger = logging.getLogger(__name__)

def is_old_enough(created_at: float, days: int = 5) -> bool:
    """
    Check if a timestamp is at least `days` business days old.
    This is a simplified version that skips weekends.
    """
    created_date = datetime.fromtimestamp(created_at)
    current_date = datetime.now()
    
    # Calculate difference in business days
    diff = 0
    temp_date = created_date
    while temp_date < current_date:
        temp_date += timedelta(days=1)
        if temp_date.weekday() < 5: # Monday to Friday
            diff += 1
            
    return diff >= days

def evaluate_pending_briefs() -> dict:
    """
    Find all pending briefs and evaluate them against the current price
    if they are at least 5 business days old.
    """
    all_pending = get_pending_evals()
    
    # Filter for those at least 5 business days old
    pending = [b for b in all_pending if is_old_enough(b["created_at"], 5)]
    skipped_timing = len(all_pending) - len(pending)
    
    if not pending:
        logger.info(f"[eval] No briefs ready for evaluation (Waiting: {skipped_timing}).")
        return {"evaluated": 0, "skipped": 0, "errors": 0, "waiting": skipped_timing}
        
    logger.info(f"[eval] Found {len(pending)} briefs ready for evaluation. {skipped_timing} still in holding period.")
    
    stats = {"evaluated": 0, "skipped": 0, "errors": 0}
    
    for brief in pending:
        brief_id = brief["id"]
        ticker = brief["ticker"]
        net_signal = brief["net_signal"]
        price_at_brief = brief["price_at_brief"]
        
        try:
            # Fetch current price data
            price_result = fetch_price_data(ticker)
            
            if price_result.get("status") not in ("AVAILABLE", "CACHED"):
                logger.warning(f"[eval] Could not fetch price for {ticker}. Skipping brief {brief_id}.")
                stats["errors"] += 1
                continue
                
            current_price = price_result.get("current_price")
            if current_price is None or price_at_brief is None or price_at_brief == 0:
                logger.warning(f"[eval] Invalid price data for {ticker}. Skipping brief {brief_id}.")
                stats["errors"] += 1
                continue
                
            # Calculate percentage change
            pct_change = (current_price - price_at_brief) / price_at_brief
            
            # Apply PRD 1% Correctness Threshold (Section 4.6.1)
            if net_signal == "neutral":
                update_brief_eval(brief_id, current_price, -1, "skipped")
                stats["skipped"] += 1
                logger.info(f"[eval] Brief {brief_id} ({ticker}): Skipped (neutral signal).")
                
            elif abs(pct_change) < 0.01:
                update_brief_eval(brief_id, current_price, -1, "skipped")
                stats["skipped"] += 1
                logger.info(f"[eval] Brief {brief_id} ({ticker}): Skipped (<1% move: {pct_change:.2%}).")
                
            else:
                is_correct = 0
                is_bullish = "bull" in net_signal
                is_bearish = "bear" in net_signal
                if (is_bullish and pct_change > 0) or \
                   (is_bearish and pct_change < 0):
                    is_correct = 1
                    
                update_brief_eval(brief_id, current_price, is_correct, "evaluated")
                stats["evaluated"] += 1
                logger.info(f"[eval] Brief {brief_id} ({ticker}): Evaluated (Score: {is_correct}, Move: {pct_change:.2%}).")
                
        except Exception as e:
            logger.error(f"[eval] Error evaluating brief {brief_id} ({ticker}): {e}")
            stats["errors"] += 1
            
    return stats
