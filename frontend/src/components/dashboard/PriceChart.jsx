import { BarChart, Bar, ResponsiveContainer, YAxis, Cell } from 'recharts';

export default function PriceChart({ toolResults }) {
  let data;
  const priceData = toolResults?.fetch_price_data?.data;
  
  if (!priceData) {
    return (
      <div style={{ marginTop: '32px', opacity: 0.3 }}>
        <div style={{ color: 'var(--text-muted)', letterSpacing: '1px', fontSize: '12px', textTransform: 'uppercase', marginBottom: '16px' }}>
          30D PRICE VELOCITY (LOADING...)
        </div>
        <div style={{ height: '200px', width: '100%', backgroundColor: 'rgba(255,255,255,0.02)', border: '1px dashed var(--border)' }}></div>
      </div>
    );
  }

  if (priceData.length > 0) {
    // Take last 30 days
    const last30 = priceData.slice(-30);
    data = last30.map((d, i) => ({
      index: i,
      close: d.close,
      color: 'var(--accent-blue)'
    }));
  } else {
    return <div style={{ color: 'var(--text-muted)', fontSize: '10px', marginTop: '32px' }}>PRICE HISTORY DATA UNAVAILABLE</div>;
  }

  const min = Math.min(...data.map(d => d.close));
  const max = Math.max(...data.map(d => d.close));
  
  // Padding for chart
  const domainMin = Math.floor(min * 0.95);
  const domainMax = Math.ceil(max * 1.05);

  return (
    <div style={{ marginTop: '32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '16px' }}>
        <div style={{ color: 'var(--text-primary)', letterSpacing: '1px', fontSize: '12px', textTransform: 'uppercase' }}>
          30D PRICE VELOCITY
        </div>
        <div style={{ color: 'var(--text-muted)', fontSize: '9px', letterSpacing: '1px' }}>
          H: {max.toFixed(1)} / L: {min.toFixed(1)}
        </div>
      </div>
      
      <div style={{ height: '200px', width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <YAxis 
              domain={[domainMin, domainMax]} 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: 'var(--text-muted)', fontSize: 9 }}
              tickFormatter={(val) => `$${val}`}
            />
            <Bar dataKey="close">
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '9px', marginTop: '8px', paddingLeft: '40px' }}>
        <span>T-30D</span>
        <span>T-15D</span>
        <span>CURRENT</span>
      </div>
    </div>
  );
}
