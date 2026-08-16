import React from 'react';

export const Terms = () => {
  return (
    <div className="max-w-4xl mx-auto px-6 py-12 text-text-primary">
      <h1 className="text-3xl font-bold mb-8">Terms of Use</h1>
      
      <div className="prose prose-invert max-w-none space-y-6">
        <p className="text-text-secondary"><strong>Last Updated: August 2026</strong></p>
        
        <p className="leading-relaxed">
          Welcome to the Finugreek Quantitative Platform ("Finugreek", "we", "us", or "our"). 
          By accessing or using our cloud-hosted platform or any of our services, you agree to be bound by these Terms of Use ("Terms"). 
          If you do not agree to these Terms, please do not use our services.
        </p>
        
        <section>
          <h2 className="text-xl font-semibold mt-8 mb-4">1. Platform Purpose and Operation</h2>
          <p className="text-text-secondary leading-relaxed mb-4">
            Finugreek is a cloud-hosted quantitative analysis platform designed to aggregate, analyze, and visualize financial market data. 
            <strong>We are not a registered broker, dealer, investment advisor, or financial planner.</strong>
          </p>
          <p className="text-text-secondary leading-relaxed">
            All data, models, metrics, and analysis provided by the software are strictly for informational, educational, and research purposes only. 
            Nothing on this platform constitutes a recommendation or solicitation to buy or sell any security.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-4">2. User Data, Privacy, and Self-Hosting</h2>
          <p className="text-text-secondary leading-relaxed mb-4">
            We deeply respect your choice to not share personal financial data. You have the freedom to self-host Finugreek by cloning our public GitHub repository and running it entirely on your own local machine. 
            When self-hosting, your data never leaves your device.
          </p>
          <p className="text-text-secondary leading-relaxed">
            For users on our cloud-hosted platform, portfolio data and preferences you enter are managed securely in accordance with our Privacy Policy. You remain the sole owner of any data you input into the platform.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-4">3. Third-Party AI Integrations</h2>
          <p className="text-text-secondary leading-relaxed">
            Finugreek utilizes advanced third-party Large Language Models (such as Google Generative AI) to power conversational analytics and research features. 
            By utilizing these AI chat features, you agree that your queries, prompts, and relevant contextual data may be transmitted to these third-party API providers. 
            Your use of these AI features is also subject to the terms of service and privacy policies of the respective AI providers.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-4">4. Acceptable Use</h2>
          <p className="text-text-secondary leading-relaxed mb-4">
            You agree not to use the platform in any way that:
          </p>
          <ul className="list-disc pl-6 text-text-secondary space-y-2">
            <li>Violates any applicable national or international law or regulation.</li>
            <li>Attempts to interfere with, disrupt, or bypass the security measures of the platform.</li>
            <li>Involves automated scraping, data extraction, or brute-force requests against our cloud infrastructure without prior authorization.</li>
            <li>Overloads our servers or third-party API integrations intentionally.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-4">5. Intellectual Property</h2>
          <p className="text-text-secondary leading-relaxed">
            The design, layout, proprietary algorithms, and branding of the Finugreek platform are the intellectual property of Finugreek. 
            However, the underlying data is aggregated from public sources, and we claim no ownership over raw market data, ticker names, or external news articles. 
            The source code available on our GitHub is subject to its respective open-source license.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-4">6. Limitation of Liability and Disclaimers</h2>
          <p className="text-text-secondary leading-relaxed mb-4 uppercase text-sm font-bold tracking-wider">
            The software and services are provided on an "as is" and "as available" basis, without warranty of any kind.
          </p>
          <p className="text-text-secondary leading-relaxed">
            To the maximum extent permitted by law, Finugreek, its developers, affiliates, and maintainers shall not be liable for any direct, indirect, incidental, consequential, or special damages arising out of or in any way connected with your use of the platform. 
            This includes, but is not limited to, financial trading losses, data inaccuracies, delayed data, or service interruptions. 
            <strong>You alone assume the sole responsibility of evaluating the merits and risks associated with the use of any information provided by Finugreek.</strong>
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mt-8 mb-4">7. Changes to Terms</h2>
          <p className="text-text-secondary leading-relaxed">
            We reserve the right to modify or replace these Terms at any time. If a revision is material, we will provide reasonable notice prior to any new terms taking effect. 
            What constitutes a material change will be determined at our sole discretion. Your continued use of the platform following the posting of any changes constitutes acceptance of those changes.
          </p>
        </section>
      </div>
    </div>
  );
};
