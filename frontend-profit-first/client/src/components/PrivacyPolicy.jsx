import React from 'react';
import { Link } from 'react-router-dom';
const PrivacyPolicy = () => {
  return (

    <div className="w-full mx-auto p-6 text-white bg-[#101218]">
      <div className="flex items-center justify-between mb-6">
        <img src="https://res.cloudinary.com/dqdvr35aj/image/upload/v1748330108/Logo1_zbbbz4.png" alt="Profit First Logo" className="h-12" />
        <Link to="/" className="text-lg font-bold text-white hover:text-gray-300 transition duration-200">
          X
        </Link>
      </div>
      <h1 className="text-3xl font-bold mb-4">Privacy Policy</h1>
      <p className="text-sm text-white mb-8">Version 1.0 — Effective Date: April 28, 2025</p>

      <section className="space-y-6">
        <p>
          Profit First (“we”, “us”, or “our”) respects your privacy and is committed to protecting the personal and business data you share with us.
          Your trust is our highest priority, and we are dedicated to using your data responsibly, securely, and only with your consent.
          This Privacy Policy explains how we collect, use, disclose, and protect your information through your use of the Profit First app ("the App").
          It also outlines your rights and choices regarding your personal information.
        </p>

        <p>
          By using the App, you agree to the practices outlined in this Privacy Policy.
          Capitalized terms not defined here have the meanings given in our <span className="text-blue-600 underline cursor-pointer">Terms and Conditions</span> (“Terms”).
        </p>

        <h2 className="text-2xl font-semibold mt-8">1. Information We Collect</h2>
        <p>
          When you install and use the App, we connect to third-party platforms (such as Shopify, Meta/Facebook Ads, and Shiprocket) 
          to analyze your business data and provide you with advanced analytics designed to help you grow your sales and profitability. 
          All data collection is done only with your explicit permission.
        </p>
        <p>The types of information we may access and collect include:</p>
        <ul className="list-disc list-inside space-y-2">
          <li>Store Properties: Store settings, information, and metadata configured by you on your platform.</li>
          <li>Products: Information about all products and variants, including inventory details.</li>
          <li>Orders: Data about all orders placed through your store.</li>
          <li>Transactions: Records of financial transactions between your store and your customers.</li>
          <li>
            Customers: Customer information 
            (<span className="text-blue-600 underline cursor-pointer">you may request at any time to limit or remove customer data collection by contacting us at support@profitfirst.io</span>).
          </li>
          <li>Marketing Data: Statistics and campaign performance data from Meta (Facebook/Instagram Ads) and Google Ads accounts.</li>
          <li>Shipping Data: Shipping-related information accessed from Shiprocket.</li>
        </ul>

        <p>We may also collect the following personal information directly from you:</p>
        <ul className="list-disc list-inside space-y-2">
          <li>Full name</li>
          <li>Email address</li>
          <li>Phone number</li>
          <li>Account login credentials (where applicable)</li>
          <li>Profile photo (when signing in through Google or Facebook)</li>
        </ul>

        <p>
          Additionally, when you interact with our App, we automatically gather technical information such as your IP address, 
          device information, operating system, browser type, and usage data.
        </p>

        <h2 className="text-2xl font-semibold mt-8">2. How We Use Your Information</h2>
        <ul className="list-disc list-inside space-y-2">
          <li>Provide and operate the App and its services.</li>
          <li>Analyze your business data across platforms to deliver highly customized analytics and insights.</li>
          <li>Help identify actionable opportunities to improve your sales and business operations.</li>
          <li>Communicate with you regarding account updates, customer support, promotions, and other service-related notices.</li>
          <li>Verify your identity and authenticate your use of the App.</li>
          <li>Conduct internal analytics to improve our services.</li>
          <li>Comply with applicable legal obligations.</li>
        </ul>

        <p className="font-semibold">Important:</p>
        <p>
          We will never sell, rent, or share your personal or business data with third parties without your explicit permission.
          We may generate and use aggregated, anonymized statistical information (not linked to you personally) to help improve our services and conduct industry research.
        </p>

        <h2 className="text-2xl font-semibold mt-8">3. Sharing of Information</h2>
        <p>We will only share your information:</p>
        <ul className="list-disc list-inside space-y-2">
          <li>With your consent.</li>
          <li>With trusted service providers and partners who assist us in delivering the services (under strict confidentiality agreements).</li>
          <li>When legally required (for example, under a court order or to comply with laws).</li>
        </ul>
        <p>
          We may also share anonymized statistical information that does not identify you or your customers.
          We are fully committed to maintaining the confidentiality of your data and will not disclose your business or personal information 
          to any third party for marketing or other purposes without your clear authorization.
        </p>

        <h2 className="text-2xl font-semibold mt-8">4. Data Protection and Security</h2>
        <p>We implement strong technical and organizational measures to protect your personal and business data, including:</p>
        <ul className="list-disc list-inside space-y-2">
          <li>Secure data storage.</li>
          <li>Encrypted data transmission.</li>
          <li>Strict access controls to authorized personnel only.</li>
        </ul>
        <p>
          While we strive to protect your data, no system can be 100% secure. In the event of a data breach, we will notify you as required by law.
        </p>

        <h2 className="text-2xl font-semibold mt-8">5. Your Rights</h2>
        <p>You have the right to:</p>
        <ul className="list-disc list-inside space-y-2">
          <li>Access the personal data we hold about you.</li>
          <li>Correct or update your information.</li>
          <li>Request deletion of your personal data.</li>
          <li>Withdraw your consent at any time.</li>
        </ul>
        <p>To exercise these rights, please contact us at <a href="mailto:support@profitfirst.io" className="text-blue-600 underline">support@profitfirst.io</a>.</p>

        <h2 className="text-2xl font-semibold mt-8">6. Data Retention</h2>
        <p>
          We retain your information for as long as necessary to provide the services and comply with our legal obligations. 
          You can request data deletion at any time.
        </p>

        <h2 className="text-2xl font-semibold mt-8">7. Use of the App by Minors</h2>
        <p>
          The App is intended for use only by individuals aged 18 years or older. 
          We do not knowingly collect personal data from anyone under 13. 
          If you are aware of a minor using the App, please contact us immediately.
        </p>

        <h2 className="text-2xl font-semibold mt-8">8. International Data Transfers</h2>
        <p>
          By using the App, you acknowledge and consent that your information may be transferred and processed outside your country of residence, 
          including in the United States, Canada, or other countries where we operate, under appropriate legal safeguards.
        </p>

        <h2 className="text-2xl font-semibold mt-8">9. Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy periodically. When we make changes, we will notify you by updating the policy date and posting it on the App.
          We encourage you to review it regularly.
        </p>

        <h2 className="text-2xl font-semibold mt-8">10. Contact Us</h2>
        <p>
          If you have any questions, concerns, or complaints about this Privacy Policy or our practices, you can contact us at:<br />
          📧 Email: <a href="mailto:support@profitfirst.io" className="text-blue-600 underline">support@profitfirst.io</a>
        </p>
      </section>
    </div>
  );
};

export default PrivacyPolicy;
