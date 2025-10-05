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
