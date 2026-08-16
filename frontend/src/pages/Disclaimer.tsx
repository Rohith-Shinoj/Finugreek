import React from 'react';

export const Disclaimer = () => {
  return (
    <div className="max-w-4xl mx-auto px-6 py-12 text-text-primary">
      <h1 className="text-3xl font-bold mb-8">Data & Legal Disclaimer</h1>
      
      <div className="prose prose-invert max-w-none space-y-6">
        <section>
          <h2 className="text-xl font-semibold mt-8 mb-4">1. No Financial Advice</h2>
          <p className="text-text-secondary leading-relaxed mb-4">
            The information, data, quantitative models, and AI-generated insights provided on the Finugreek platform are for educational, informational, and research purposes only. 
          </p>
          <p className="text-text-secondary leading-relaxed font-semibold">
            We do not provide investment, financial, legal, or tax advice. You should consult with a licensed professional before making any financial decisions. 
            Any trades or investments made based on information from this platform are done entirely at your own risk.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-4">2. Data Sources and Non-Affiliation</h2>
          <p className="text-text-secondary leading-relaxed mb-4">
            Finugreek aggregates and processes quantitative financial data sourced from publicly available APIs, websites, and third-party endpoints, including but not limited to Groww, Trendlyne, and Binance.
          Finugreek is an independent research and analytics tool. We are strictly NOT affiliated with, endorsed by, sponsored by, or in any partnership with Groww, Trendlyne, Binance, or any other financial institution or brokerage mentioned on the platform.
        </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-4">3. Accuracy of Information</h2>
          <p className="text-text-secondary leading-relaxed mb-4">
            While we strive to ensure that the data and calculations presented on Finugreek are as accurate as possible, the financial markets are highly volatile, and data delays or transmission errors can occur. 
          </p>
          <p className="text-text-secondary leading-relaxed">
            We make no warranties or representations regarding the accuracy, completeness, timeliness, or reliability of any data, charts, or quantitative scores on the platform. Prices and metrics may not accurately reflect real-time market conditions.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-4">4. Investment Risks</h2>
          <p className="text-text-secondary leading-relaxed mb-4">
            Trading in equities, mutual funds, ETFs, and cryptocurrencies involves substantial risk of loss and is not suitable for every investor. The valuation of financial instruments may fluctuate, and you may lose more than your original investment. 
            Past performance of any security, trading strategy, or quantitative model is no guarantee of future results.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-4">5. Takedown Requests and Unauthorized Data</h2>
          <p className="text-text-secondary leading-relaxed">
            We respect the intellectual property and data rights of others. Our aggregation scripts are designed to interact only with publicly available endpoints. 
            If you represent a data provider and believe that any data hosted or processed by this platform violates your terms of service or intellectual property rights, please contact us immediately. 
            Any unauthorized or contested data will be reviewed and removed on demand in a timely manner.
          </p>
        </section>
      </div>
    </div>
  );
};
