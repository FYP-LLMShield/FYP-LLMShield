import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XMarkIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  relatedQuestions?: string[];
}

interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: string;
  relatedQuestions?: string[];
}

const faqs: FAQ[] = [
  {
    id: '1',
    question: 'What are your pricing plans?',
    answer: 'We offer three pricing plans: Free (8 scans/month), Regular ($29/month with 100 scans), and Premium ($99/month with unlimited scans and advanced features).',
    category: 'pricing',
    relatedQuestions: ['Is there a free trial?', 'Can I upgrade my plan?']
  },
  {
    id: '2',
    question: 'What services do you provide?',
    answer: 'LLMShield provides comprehensive AI security services including Prompt Injection Scanner, C/C++ Code Scanner, Model Poisoning Detection, Vector Embedding Security, and Real-time Threat Monitoring.',
    category: 'services',
    relatedQuestions: ['How does scanning work?', 'What makes you different?']
  },
  {
    id: '3',
    question: 'How does scanning work?',
    answer: 'Our AI security scanner uses advanced algorithms to detect malicious prompts, code vulnerabilities, and model poisoning attempts. It analyzes patterns and identifies potential security threats in real-time.',
    category: 'features',
    relatedQuestions: ['How fast is the analysis?', 'What languages do you support?']
  },
  {
    id: '4',
    question: 'Is there a free trial?',
    answer: 'Yes! Our Free plan allows you to try LLMShield with 8 scans per month. You can also start a free trial of our Regular plan to test advanced features.',
    category: 'pricing',
    relatedQuestions: ['What are your pricing plans?', 'Can I upgrade my plan?']
  },
  {
    id: '5',
    question: 'How do I get started?',
    answer: 'Getting started is easy! Sign up for a free account, upload your first scan, and see LLMShield in action. Our dashboard guides you through the process step by step.',
    category: 'getting-started',
    relatedQuestions: ['Is there a free trial?', 'Do you provide support?']
  },
  {
    id: '6',
    question: 'Do you provide support?',
    answer: 'Yes! Free plan includes email support, Regular plan has priority email support, and Premium plan includes dedicated support with faster response times.',
    category: 'support',
    relatedQuestions: ['What are your pricing plans?', 'How do I contact you?']
  },
  {
    id: '7',
    question: 'How fast is the analysis?',
    answer: 'Our security analysis provides results in seconds, not hours. Our optimized algorithms are designed for rapid development cycles with instant feedback.',
    category: 'performance',
    relatedQuestions: ['How does scanning work?', 'What makes you different?']
  },
  {
    id: '8',
    question: 'What makes you different?',
    answer: 'LLMShield offers comprehensive AI security with real-time detection, lightning-fast analysis, and specialized protection for prompt injections, model poisoning, and vector embeddings - all in one platform.',
    category: 'general',
    relatedQuestions: ['What services do you provide?', 'How fast is the analysis?']
  },
  {
    id: '9',
    question: 'What languages do you support?',
    answer: 'We support multiple programming languages including C, C++, Python, JavaScript, Java, and more. Our AI models are trained to detect vulnerabilities across various coding languages.',
    category: 'technical',
    relatedQuestions: ['How does scanning work?', 'What services do you provide?']
  },
  {
    id: '10',
    question: 'Can I upgrade my plan?',
    answer: 'Absolutely! You can upgrade from Free to Regular or Premium at any time. Changes take effect immediately and you only pay the prorated difference.',
    category: 'pricing',
    relatedQuestions: ['What are your pricing plans?', 'Is there a free trial?']
  },
  {
    id: '11',
    question: 'How secure is my data?',
    answer: 'Your data security is our top priority. We use enterprise-grade encryption, secure cloud infrastructure, and never store your sensitive code or prompts after analysis.',
    category: 'security',
    relatedQuestions: ['Do you provide support?', 'What makes you different?']
  },
  {
    id: '12',
    question: 'What is prompt injection?',
    answer: 'Prompt injection is a security vulnerability where malicious inputs manipulate AI models to produce unintended outputs. Our scanner detects and blocks these attacks in real-time.',
    category: 'security',
    relatedQuestions: ['How does scanning work?', 'What services do you provide?']
  },
  {
    id: '13',
    question: 'What file formats do you support?',
    answer: 'We support various file formats including .txt, .py, .js, .cpp, .c, .java, and more. Our platform can analyze both individual files and entire codebases.',
    category: 'features',
    relatedQuestions: ['How does scanning work?', 'How fast is the analysis?']
  },
  {
    id: '19',
    question: 'How does your website work?',
    answer: 'Our website provides an intuitive dashboard where you can upload files, run security scans, view detailed reports, and manage your account. Everything is designed for ease of use.',
    category: 'general',
    relatedQuestions: ['How do I get started?', 'What file formats do you support?']
  },
  {
    id: '20',
    question: 'What features are available on your platform?',
    answer: 'Our platform offers real-time scanning, detailed security reports, threat analytics, API integration, team collaboration tools, and comprehensive documentation.',
    category: 'features',
    relatedQuestions: ['What services do you provide?', 'Do you offer API access?']
  },
  {
    id: '21',
    question: 'Can I try your website before purchasing?',
    answer: 'Yes! You can explore our website, try the free plan with 8 scans per month, and access our demo environment to see how LLMShield works.',
    category: 'pricing',
    relatedQuestions: ['Is there a free trial?', 'How do I get started?']
  },
  {
    id: '22',
    question: 'How user-friendly is your interface?',
    answer: 'Our interface is designed with simplicity in mind. Clean layouts, intuitive navigation, and step-by-step guides make it easy for both beginners and experts to use.',
    category: 'general',
    relatedQuestions: ['How do I get started?', 'Do you provide training?']
  },
  {
    id: '23',
    question: 'What browsers does your website support?',
    answer: 'Our website works perfectly on all modern browsers including Chrome, Firefox, Safari, and Edge. We ensure cross-browser compatibility for the best user experience.',
    category: 'technical',
    relatedQuestions: ['How does your website work?', 'What file formats do you support?']
  },
  {
    id: '13',
    question: 'What is prompt injection?',
    answer: 'Prompt injection is a security vulnerability where malicious inputs manipulate AI models to produce unintended outputs. Our scanner detects and prevents these attacks.',
    category: 'security',
    relatedQuestions: ['How does scanning work?', 'What services do you provide?']
  },
  {
    id: '14',
    question: 'Do you offer API access?',
    answer: 'Yes! Our Regular and Premium plans include API access so you can integrate LLMShield directly into your development workflow and CI/CD pipelines.',
    category: 'features',
    relatedQuestions: ['What are your pricing plans?', 'How do I get started?']
  },
  {
    id: '15',
    question: 'What is model poisoning?',
    answer: 'Model poisoning is when malicious data is injected into AI training sets to compromise model behavior. Our detection system identifies these threats before they affect your models.',
    category: 'security',
    relatedQuestions: ['What is prompt injection?', 'How does scanning work?']
  },
  {
    id: '16',
    question: 'Can I cancel anytime?',
    answer: 'Yes, you can cancel your subscription anytime from your account settings. There are no cancellation fees and you will retain access until the end of your billing period.',
    category: 'pricing',
    relatedQuestions: ['What are your pricing plans?', 'Can I upgrade my plan?']
  },
  {
    id: '17',
    question: 'Do you provide training?',
    answer: 'We offer comprehensive documentation, video tutorials, and webinars. Premium users get access to personalized training sessions and dedicated onboarding support.',
    category: 'support',
    relatedQuestions: ['How do I get started?', 'Do you provide support?']
  },
  {
    id: '18',
    question: 'What file formats do you support?',
    answer: 'We support various file formats including .c, .cpp, .py, .js, .java, .txt, and more. You can upload individual files or entire project folders for comprehensive scanning.',
    category: 'features',
    relatedQuestions: ['What languages do you support?', 'How do I get started?']
  },
  {
    id: '19',
    question: 'How accurate is your threat detection?',
    answer: 'Our AI-powered threat detection system achieves 99.2% accuracy with minimal false positives. We continuously update our models with the latest threat intelligence.',
    category: 'features',
    relatedQuestions: ['How does scanning work?', 'What makes you different?']
  },
  {
    id: '20',
    question: 'Do you offer enterprise solutions?',
    answer: 'Yes! We provide custom enterprise solutions with dedicated support, on-premise deployment options, and tailored security features for large organizations.',
    category: 'enterprise',
    relatedQuestions: ['What are your pricing plans?', 'Do you provide support?']
  },
  {
    id: '21',
    question: 'What is your response time for support?',
    answer: 'Free users get community support within 48 hours. Regular plan users receive email support within 24 hours, and Premium users get priority support within 4 hours.',
    category: 'support',
    relatedQuestions: ['Do you provide support?', 'What are your pricing plans?']
  }
];

const Chatbot: React.FC = React.memo(() => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showProcessingPopup, setShowProcessingPopup] = useState(false);


  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Clear messages on page refresh/reload
  useEffect(() => {
    const handleBeforeUnload = () => {
      localStorage.removeItem('chatMessages');
      setMessages([]);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    // Clear messages on component mount (page refresh)
    localStorage.removeItem('chatMessages');
    setMessages([]);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // Load messages from localStorage on component mount (disabled for refresh clearing)
  // useEffect(() => {
  //   const savedMessages = localStorage.getItem('chatMessages');
  //   if (savedMessages) {
  //     try {
  //       const parsedMessages = JSON.parse(savedMessages);
  //       // Convert string timestamps back to Date objects
  //       const formattedMessages = parsedMessages.map((msg: any) => ({
  //         ...msg,
  //         timestamp: new Date(msg.timestamp)
  //       }));
  //       setMessages(formattedMessages);
  //     } catch (error) {
  //       console.error('Failed to parse saved messages:', error);
  //     }
  //   }
  // }, []);

  // Save messages to localStorage whenever they change
  useEffect(() => {
    if (messages.length > 0) {
      // Keep only the last 10 messages
      const recentMessages = messages.slice(-10);
      localStorage.setItem('chatMessages', JSON.stringify(recentMessages));
    }
  }, [messages]);

  // Scroll to bottom of messages when new ones are added
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when chat is opened
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  const toggleChat = useCallback(() => {
    setIsOpen(!isOpen);
  }, [isOpen]);

  const typeMessage = useCallback(async (text: string, faq?: FAQ) => {
    // Create initial empty bot message
    const botMessageId = (Date.now() + 1).toString();
    const botMessage: Message = {
      id: botMessageId,
      text: '',
      sender: 'bot',
      timestamp: new Date(),
      relatedQuestions: faq?.relatedQuestions
    };

    setMessages(prev => [...prev, botMessage]);
    
    // Type character by character with faster speed
    for (let i = 0; i <= text.length; i++) {
      const partialText = text.substring(0, i);
      
      setMessages(prev => 
        prev.map(msg => 
          msg.id === botMessageId 
            ? { ...msg, text: partialText }
            : msg
        )
      );
      
      // Faster typing speed - 8ms for very fast response
      if (i < text.length) {
        await new Promise(resolve => setTimeout(resolve, 8));
      }
    }
  }, []);

  const handleFAQClick = useCallback(async (faq: FAQ) => {
    if (isProcessing) {
      setShowProcessingPopup(true);
      setTimeout(() => setShowProcessingPopup(false), 2000);
      return;
    }

    setIsProcessing(true);
    
    const userMessage: Message = {
      id: Date.now().toString(),
      text: faq.question,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    
    // Add a small delay before typing starts
    await new Promise(resolve => setTimeout(resolve, 500));
    await typeMessage(faq.answer, faq);
    
    setIsProcessing(false);
  }, [isProcessing, typeMessage]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading || isProcessing) return;

    // Check if already processing a question
    if (isProcessing) {
      setShowProcessingPopup(true);
      setTimeout(() => setShowProcessingPopup(false), 2000);
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputValue,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    const userInput = inputValue;
    setInputValue('');
    setIsLoading(true);
    setIsProcessing(true);

    // Check if the question matches any FAQ
    const matchedFAQ = faqs.find(faq => 
      faq.question.toLowerCase().includes(userInput.toLowerCase()) ||
      userInput.toLowerCase().includes(faq.question.toLowerCase()) ||
      faq.answer.toLowerCase().includes(userInput.toLowerCase())
    );

    try {
      if (matchedFAQ) {
        // If it's an FAQ, provide the answer with typing animation
        await new Promise(resolve => setTimeout(resolve, 500));
        await typeMessage(matchedFAQ.answer, matchedFAQ);
      } else {
        // If it's not an FAQ, ask user to login
        await new Promise(resolve => setTimeout(resolve, 500));
        await typeMessage('I can only answer frequently asked questions. For other queries, please log in to get personalized assistance.');
      }
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: 'Sorry, I encountered an error. Please try again.',
        sender: 'bot',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setIsProcessing(false);
    }
  }, [inputValue, isLoading, isProcessing, typeMessage]);

  return (
    <div className="fixed bottom-1 right-6 z-40">
      {/* Chat bubble button */}
      <motion.button
        className="w-14 h-14 rounded-full bg-gradient-to-r from-accent-teal to-accent-darkTeal hover:from-accent-darkTeal hover:to-accent-teal text-white flex items-center justify-center shadow-2xl transition-all duration-300 border-2 border-white/20"
        onClick={toggleChat}
        whileHover={{ scale: 1.1, rotate: 5 }}
        whileTap={{ scale: 0.9 }}
        animate={{
          boxShadow: [
            "0 0 20px rgba(20, 184, 166, 0.3)",
            "0 0 30px rgba(20, 184, 166, 0.5)",
            "0 0 20px rgba(20, 184, 166, 0.3)"
          ]
        }}
        transition={{
          boxShadow: {
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          }
        }}
        aria-label="Open chat assistant"
      >
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.3 }}
        >
          {isOpen ? (
            <XMarkIcon className="h-6 w-6" />
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          )}
        </motion.div>
      </motion.button>

      {/* Chat panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="absolute bottom-8 right-4 w-72 sm:w-80 bg-white dark:bg-dark-secondary rounded-2xl shadow-2xl overflow-hidden flex flex-col border-2 border-accent-teal/20 dark:border-accent-teal/30 backdrop-blur-sm max-h-[calc(100vh-8rem)]"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.95) 100%)',
              backdropFilter: 'blur(10px)'
            }}
          >
            {/* Chat header */}
            <div className="bg-gradient-to-r from-accent-teal via-accent-darkTeal to-accent-teal text-white p-4 flex items-center justify-between relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-accent-teal/90 to-accent-darkTeal/90 backdrop-blur-sm"></div>
              <div className="flex items-center space-x-3 relative z-10">
                <motion.div 
                  className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center border border-white/30"
                  animate={{ rotate: [0, 360] }}
                  transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                >
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
                  </svg>
                </motion.div>
                <div>
                  <h3 className="font-bold text-base">LLMShield Assistant</h3>
                  <div className="flex items-center space-x-1">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <p className="text-xs opacity-90 font-medium">Online & Ready</p>
                  </div>
                </div>
              </div>
              <motion.button
                onClick={toggleChat}
                className="text-white/80 hover:text-white transition-colors p-3 rounded-full hover:bg-white/20 relative z-50 min-w-[44px] min-h-[44px] flex items-center justify-center cursor-pointer touch-manipulation"
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                <XMarkIcon className="h-6 w-6" />
              </motion.button>
            </div>

            {/* Messages container */}
            <div className="flex-grow flex flex-col bg-gray-50 dark:bg-dark-primary max-h-72">
              {/* Messages Section - Scrollable */}
              <div className="flex-grow overflow-y-auto p-4 space-y-4">
                {/* FAQ Section - Always at top of messages */}
                <div className="flex-shrink-0 mb-4">
                  <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600">
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Frequently Asked Questions:</p>
                    <div className="grid grid-cols-1 gap-2 max-h-24 overflow-y-auto">
                      {faqs.slice(0, 12).map((faq, index) => (
                        <motion.button
                          key={faq.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05 }}
                          onClick={() => handleFAQClick(faq)}
                          className="text-left p-2 rounded-lg bg-gray-50 dark:bg-gray-700 hover:bg-gradient-to-r hover:from-blue-600 hover:to-purple-600 hover:text-white transition-all duration-200 text-xs text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 shadow-sm hover:shadow-md"
                        >
                          {faq.question}
                        </motion.button>
                      ))}
                    </div>
                  </div>
                </div>

                {messages.length === 0 && (
                  <div className="text-center">
                    <p className="text-gray-500 dark:text-gray-400 text-sm">Start a conversation or click on a FAQ above!</p>
                  </div>
                )}
                
                {messages.map((message, index) => (
                  <div key={message.id} className="mb-4">
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'} mb-3 items-start gap-2`}
                    >
                      {/* Bot Icon */}
                      {message.sender === 'bot' && (
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                      
                      <div
                        className={`max-w-xs rounded-lg px-3 py-2 shadow-sm ${
                          message.sender === 'user' 
                            ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white' 
                            : 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-600'
                        }`}
                      >
                        <p className="text-sm leading-relaxed">{message.text}</p>
                        <div className="text-xs opacity-70 mt-1">
                          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      
                      {/* User Icon */}
                      {message.sender === 'user' && (
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-r from-green-500 to-teal-600 flex items-center justify-center shadow-lg">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                      )}
                    </motion.div>
                    
                    {/* Related Questions - Show only for bot messages after typing is complete */}
                    {message.sender === 'bot' && message.relatedQuestions && message.relatedQuestions.length > 0 && !isProcessing && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        className="mt-3 ml-10"
                      >
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 font-medium">Related Questions:</p>
                        <div className="flex flex-col gap-2">
                          {message.relatedQuestions.map((relatedQ, idx) => {
                            const relatedFAQ = faqs.find(faq => faq.question === relatedQ);
                            return relatedFAQ ? (
                              <motion.button
                                key={idx}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.6 + idx * 0.1 }}
                                onClick={() => handleFAQClick(relatedFAQ)}
                                className="text-left p-2 rounded-lg bg-teal-50 dark:bg-teal-900/30 hover:bg-teal-100 dark:hover:bg-teal-800/40 transition-all duration-200 text-xs text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-600 shadow-sm hover:shadow-md"
                              >
                                {relatedQ}
                              </motion.button>
                            ) : null;
                          })}
                        </div>
                      </motion.div>
                    )}
                  </div>
                ))}
                
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Custom Processing Popup */}
            <AnimatePresence>
              {showProcessingPopup && (
                <motion.div
                  className="absolute inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <motion.div
                    className="bg-white dark:bg-gray-800 rounded-lg p-4 mx-4 shadow-xl border border-accent-teal/30"
                    initial={{ scale: 0.8, y: 20 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0.8, y: 20 }}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-6 h-6 border-2 border-accent-teal border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-gray-700 dark:text-gray-300 font-medium">
                        Please wait! I am already processing your previous question.
                      </p>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Input form */}
            <form onSubmit={handleSubmit} className="border-t border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-dark-secondary">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Type your message..."
                  className="flex-grow px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-400 dark:bg-dark-primary dark:text-white"
                  ref={inputRef}
                />
                <button
                  type="submit"
                  disabled={isLoading || !inputValue.trim()}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white p-2 rounded-md transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <PaperAirplaneIcon className="h-5 w-5" />
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

export default memo(Chatbot);
