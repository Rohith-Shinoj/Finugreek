import React from 'react';

export const Privacy = () => {
  return (
    <div className="max-w-4xl mx-auto px-6 py-12 text-text-primary">
      <h1 className="text-3xl font-bold mb-8">Privacy Policy</h1>
      
      <div className="prose prose-invert max-w-none space-y-6">
        <p className="text-text-secondary"><strong>Last Updated: August 2026</strong></p>
        
        <p className="leading-relaxed">
          At Finugreek, we take your privacy and the security of your data seriously. 
          This Privacy Policy outlines how we collect, use, and protect your information when you use our platform.
        </p>
        
        <section>
          <h2 className="text-xl font-semibold mt-8 mb-4">1. Data Collection, Storage, and Self-Hosting</h2>
          <p className="text-text-secondary leading-relaxed mb-4">
            Finugreek is a cloud-hosted platform, but we deeply respect your privacy and your right to control your financial data. 
            We provide the choice to self-host. If you clone our open-source GitHub repository and run the application locally, your data remains entirely on your own device and is never transmitted to us.
          </p>
          <p className="text-text-secondary leading-relaxed mb-4">
            For users utilizing our cloud-hosted platform:
          </p>
          <ul className="list-disc pl-6 text-text-secondary space-y-2">
            <li><strong>Portfolio Data:</strong> Portfolio holdings, transactions, and custom watchlists entered on the cloud platform are stored securely on our servers to provide you with seamless access across devices. We do not sell or share this data with third-party marketers.</li>
            <li><strong>Account Information:</strong> If applicable, basic authentication data is stored securely using industry-standard encryption.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-4">2. Analytics and Usage Data</h2>
          <p className="text-text-secondary leading-relaxed">
            We use Google Analytics and similar telemetry tools to monitor platform usage, analyze traffic patterns, and improve the user experience. 
            This data is aggregated and anonymized where possible. It helps us understand which features are most valuable and where we need to improve performance.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-4">3. External APIs and AI Services</h2>
          <p className="text-text-secondary leading-relaxed mb-4">
            Finugreek integrates with external services to provide advanced quantitative insights. 
            When you utilize the AI Assistant or natural language search features, the text of your prompt and necessary market context are securely transmitted to Google Generative AI (or other configured LLM providers) to generate a response.
          </p>
          <p className="text-text-secondary leading-relaxed">
            We only send the context strictly necessary to fulfill your query. We recommend reviewing the privacy policies of our AI partners regarding their data retention and usage policies.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-4">4. Data Security</h2>
          <p className="text-text-secondary leading-relaxed">
            We implement reasonable security measures, including encryption in transit (HTTPS) and secure database architectures, to protect your personal information from unauthorized access, alteration, disclosure, or destruction. 
            However, no method of transmission over the internet or method of electronic storage is 100% secure.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-4">5. Cookies and Tracking Technologies</h2>
          <p className="text-text-secondary leading-relaxed">
            We use cookies and similar tracking technologies to track activity on our platform and store certain information. 
            Cookies are files with a small amount of data which may include an anonymous unique identifier. 
            You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent, though some features of the platform may not function properly without them.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-4">6. Your Rights</h2>
          <p className="text-text-secondary leading-relaxed">
            You have the right to request access to the personal data we hold about you, request corrections, or request deletion of your account and associated portfolio data. 
            To exercise these rights, please contact us using the information provided on our platform.
          </p>
        </section>
      </div>
    </div>
  );
};
