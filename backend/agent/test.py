import yfinance as yf
msft = yf.Ticker("MSFT")
hist = msft.history(period="1y")
print(hist['Close'].rolling(window=200).mean().iloc[-1])