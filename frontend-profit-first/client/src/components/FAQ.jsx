import React, { useState } from 'react';
import { FiChevronDown, FiChevronUp } from 'react-icons/fi';

const FAQ = () => {
  const faqs = [
    {
      question: 'How secure is my data on your platform?',
      answer:
        'Your data is fully protected with us. We implement the latest security updates, and our databases are completely isolated from the internet. All connections, including backups, are restricted to our internal network only.',
    },
    {
      question: 'Is it possible to cancel my subscription anytime?',
      answer:
        'Yes! You’re in full control—modify or cancel your subscription whenever you need. We know business needs evolve, so we make it easy and stress-free.',
    },
    {
      question: 'How much time it will take to onboard with Profit First?',
      answer:
        'It will take only 5 to 10 minutes to onboard with us. Just make sure to provide accurate data when entering your Product Manufacturing Cost (COGS).',
    },
  ];

  const [openIndex, setOpenIndex] = useState(null);

  const toggleFAQ = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section id="FAQ" className="py-12 text-white">
      <div className="container mx-auto px-4">
        {/* Heading */}
        <div className="text-center max-w-xl mx-auto mb-10">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold leading-snug px-4">
            Some of the things you may want <span className="my-gradient-text">to know</span>
          </h2>
          <p className="text-gray-300 mt-3">We answered questions so you don't have to ask them.</p>
        </div>

        {/* FAQ List */}
        <div className="max-w-2xl mx-auto space-y-4">
          {faqs.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <div key={index} className="bg-[#161616] rounded-xl p-4 shadow-md transition-all">
                <button
                  onClick={() => toggleFAQ(index)}
                  className="w-full flex items-center justify-between text-left font-medium text-white focus:outline-none"
                  aria-expanded={isOpen}
                >
                  <span>{faq.question}</span>
                  {isOpen ? <FiChevronUp className="text-green-400" /> : <FiChevronDown className="text-gray-400" />}
                </button>

                <div
                  className={`transition-all duration-300 ease-in-out overflow-hidden ${
                    isOpen ? 'max-h-[500px] mt-3 opacity-100' : 'max-h-0 opacity-0'
                  }`}
                >
                  <p className="text-gray-400 text-sm">{faq.answer}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default FAQ;
