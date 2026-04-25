import React, { useState } from 'react';
import { motion, Variants } from 'framer-motion';
import { Link } from 'react-router-dom';
import { 
  ShieldCheckIcon, 
  DocumentTextIcon, 
  ServerIcon, 
  CodeBracketIcon,
  CpuChipIcon,
  BugAntIcon,
  ChevronDownIcon,
  ChevronUpIcon
} from '@heroicons/react/24/outline';

const ServicesPage: React.FC = React.memo(() => {
  const [expandedService, setExpandedService] = useState<number | null>(null);

  // Animation variants with 3D effects
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.1,
      },
    },
  };

  const itemVariants: Variants = {
    hidden: { 
      opacity: 0, 
      y: 20
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.3,
        ease: "easeOut"
      },
    },
  };

  // Main service categories - aligned with project capabilities (README, PROJECT_MANUAL)
  const services = [
    {
      id: 1,
      title: 'Prompt Injection Testing',
      category: 'Multi-Provider Detection',
      description: 'Test prompts and documents for injection, jailbreak, and system leak with robust detection (Unicode normalization, leetspeak, pattern matching)',
      icon: <DocumentTextIcon className="h-8 w-8 text-teal-600" />,
      features: [
        'Multi-provider support: OpenAI, Anthropic, Google, Ollama',
        'Probe categories: prompt_injection, jailbreak',
        'Document upload (PDF, DOCX, TXT, MD) and scan',
        'PDF reports and vector store analysis'
      ],
      useCases: ['Chatbots', 'AI assistants', 'Customer service bots'],
      delivery: 'Dashboard at /dashboard/prompt-injection + API endpoints'
    },
    {
      id: 2,
      title: 'Model & Dataset Poisoning',
      category: 'Poisoning Analysis',
      description: 'Scan HuggingFace datasets for data poisoning indicators. Upload dataset links and analyze for backdoors, trigger keywords, statistical anomalies, and poisoning threats using advanced detection techniques.',
      icon: <ShieldCheckIcon className="h-8 w-8 text-purple-600" />,
      features: [
        'HuggingFace dataset integration: automatic .jsonl file detection and preview',
        'LLM Shield deep learning classification (MultiTaskBERT)',
        'Comprehensive verdicts (Safe/Suspicious/Unsafe) with risk scores and suspicious samples',
        'Detailed analysis reports with anomaly detection and trigger identification'
      ],
      useCases: ['Dataset validation', 'Data security', 'Model training safety'],
      delivery: 'Data poisoning analysis dashboard + REST API endpoints'
    },
    {
      id: 3,
      title: 'Vector Security',
      category: 'RAG & Embedding Protection',
      description: 'Single dashboard with three tabs: Document Inspection, Anomaly Detection, and Retrieval Attack Simulation',
      icon: <ServerIcon className="h-8 w-8 text-blue-600" />,
      features: [
        'Document Inspection: chunking, pattern detection, sanitization preview, export',
        'Anomaly Detection: collision, outlier, cluster analysis (DBSCAN)',
        'Attack Simulation: query perturbation, baseline vs adversarial retrieval',
        'Optional Qdrant vector store integration'
      ],
      useCases: ['Knowledge bases', 'Document search', 'RAG systems'],
      delivery: 'Vector Security dashboard at /dashboard/vector-security'
    },
    {
      id: 4,
      title: 'Code Security Scanning',
      category: 'Secrets & C/C++ Vulnerabilities',
      description: '200+ secret patterns (AWS, API keys, SSH), 200+ C/C++ dangerous functions, file upload and GitHub repo scanning with CWE mapping',
      icon: <CodeBracketIcon className="h-8 w-8 text-teal-600" />,
      features: [
        '200+ secret patterns and 200+ C/C++ vulnerability checks',
        'Input: text paste, file upload, GitHub repo (with cache)',
        'CWE mapping, severity levels, PDF reports',
        'Scan history and metrics in dashboard'
      ],
      useCases: ['AI infrastructure', 'Embedded systems', 'CI/CD pipelines'],
      delivery: 'Code scanning at /dashboard/code-scanning + /api/v1/scan'
    },
    {
      id: 5,
      title: 'RAG Chatbot',
      category: 'Conversation & Retrieval',
      description: 'RAG-based conversation with optional vector store (e.g. Qdrant) for contextual queries',
      icon: <CpuChipIcon className="h-8 w-8 text-purple-600" />,
      features: [
        'RAG conversation with optional Qdrant integration',
        'Contextual retrieval from vector store',
        'Conversation history and management',
        'Part of the unified dashboard'
      ],
      useCases: ['Internal knowledge search', 'AI assistants', 'Document Q&A'],
      delivery: 'Chatbot at /dashboard/chatbot'
    },
    {
      id: 6,
      title: 'Authentication & Security',
      category: 'Identity & Access',
      description: 'JWT auth, MFA (TOTP), recovery codes, Google OAuth, email verification, password reset',
      icon: <BugAntIcon className="h-8 w-8 text-blue-600" />,
      features: [
        'JWT access and refresh tokens',
        'MFA (TOTP), recovery codes, trusted devices',
        'Google OAuth and optional Supabase for email',
        'Password reset and email verification'
      ],
      useCases: ['Team access', 'Enterprise deployment', 'Compliance'],
      delivery: 'Auth routes + MFA at /dashboard/mfa + optional Supabase'
    }
  ];

  // Platform capabilities
  const enterpriseSolutions = [
    {
      title: 'Dashboard & Metrics',
      description: 'Security metrics, scan history, quick actions, and recent scans in one place',
      icon: '🔍'
    },
    {
      title: 'API Documentation',
      description: 'Swagger UI and ReDoc at /docs and /redoc for integration',
      icon: '💡'
    },
    {
      title: 'Model Configuration',
      description: 'CRUD for LLM provider configs (OpenAI, Anthropic, Google, Ollama)',
      icon: '🔗'
    },
    {
      title: 'Profile & Settings',
      description: 'User profile, MFA setup, and application settings',
      icon: '📋'
    },
    {
      title: 'Scan History',
      description: 'Save and list scans with filters across scanner types',
      icon: '⚡'
    },
    {
      title: 'Optional Supabase',
      description: 'Email verification and password reset via Supabase or SMTP',
      icon: '🎓'
    }
  ];

  // Service delivery models
  const deliveryModels = [
    {
      title: 'File & Document Upload',
      description: 'Upload prompts, PDFs, DOCX, code, or datasets for analysis',
      icon: '📤'
    },
    {
      title: 'REST API',
      description: 'Integrate via /api/v1 endpoints (scan, prompt-injection, etc.)',
      icon: '🔌'
    },
    {
      title: 'GitHub Repo Scanning',
      description: 'Scan repositories for secrets and C/C++ vulnerabilities',
      icon: '📊'
    },
    {
      title: 'Docker Deployment',
      description: 'Run full stack with docker compose for local or production',
      icon: '⚙️'
    }
  ];

  return (
  <>
      {/* Services Hero Section - Desktop 50/50 Split, Mobile Stacked */}
      <div className="services-hero min-h-screen w-full flex flex-col md:flex-row overflow-hidden pt-16 bg-gradient-to-b from-[#0a0a0a] via-[#0f172a] to-[#0a0a0a]">
        {/* Video Section - with dark fallback */}
        <div className="video-section w-full md:w-1/2 h-[55vh] md:h-screen relative overflow-hidden bg-gradient-to-br from-teal-900/30 via-gray-900 to-blue-900/30">
          <video
            autoPlay
            muted
            loop
            playsInline
            className="w-full h-full object-cover"
            style={{
              objectPosition: 'center',
              minWidth: '100%',
              maxWidth: '100%'
            }}
          >
            <source src="/videos/Background.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-transparent md:from-black/40" />
        </div>

        {/* Content Section - dark futuristic theme matching project design */}
        <div className="content-section w-full md:w-1/2 h-[55vh] md:h-screen flex flex-col justify-center px-6 md:px-12 py-6 md:py-12 bg-gradient-to-r from-gray-900 via-gray-900 to-gray-800">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={{
              hidden: { opacity: 0, y: 30 },
              visible: { opacity: 1, y: 0, transition: { duration: 0.8 } }
            }}
            className="max-w-xl mx-auto text-center"
          >
            <h1 className="text-[1.8rem] leading-[1.3] md:text-4xl lg:text-5xl font-bold text-white mb-4 md:mb-6">
              Unified Threat Detection Framework
            </h1>
            
            <p className="text-[0.9rem] leading-[1.5] md:text-base text-gray-400 mb-6 md:mb-8">
              LLMShield helps security teams and developers test and harden AI applications. Detect prompt injection and jailbreaks, analyze vector stores and embeddings for poisoning, scan code for secrets and C/C++ vulnerabilities, and evaluate dataset/model poisoning, all from a single dashboard.
            </p>
            
            <div className="cta-buttons flex flex-col md:flex-row gap-3 md:gap-4 w-full md:w-auto justify-center items-center">
              <Link
                to="/auth"
                className="w-full md:w-auto bg-accent-darkTeal hover:bg-teal-700 text-white px-6 py-3 md:py-4 rounded-md font-semibold text-[0.9rem] md:text-base transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl text-center min-h-[44px] flex items-center justify-center hover:shadow-teal-500/50 hover:shadow-2xl animate-pulse hover:animate-none"
              >
                Get Free Trial
              </Link>
              <Link
                to="/contact"
                className="w-full md:w-auto bg-teal-50 hover:bg-teal-100 dark:bg-teal-900/30 dark:hover:bg-teal-800/40 text-teal-700 dark:text-teal-300 px-6 py-3 md:py-4 rounded-md font-semibold text-[0.9rem] md:text-base border-2 border-teal-700 dark:border-teal-400 hover:border-teal-800 dark:hover:border-teal-300 transition-all duration-300 transform hover:scale-105 text-center min-h-[44px] flex items-center justify-center hover:shadow-teal-400/50 hover:shadow-2xl animate-pulse hover:animate-none"
              >
                Learn More
              </Link>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Main Content - dark theme to match project design */}
      <div className="relative z-10 bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 text-white dark:text-white pt-10">
        {/* Service Categories Section */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={containerVariants}
          className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto"
        >
          <motion.div
            variants={itemVariants}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
              Our Security Services
            </h2>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              Comprehensive protection across all aspects of your AI infrastructure
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6 px-4 md:px-0">
            {services.map((service, index) => (
              <motion.div
                key={service.id}
                variants={itemVariants}
                whileHover={{ 
                  scale: 1.02, 
                  boxShadow: "0 20px 40px -12px rgba(20, 184, 166, 0.3), 0 0 20px rgba(20, 184, 166, 0.2)"
                }}
                className="bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-lg border border-gray-200 dark:border-gray-700 transition-all duration-300 hover:border-accent-darkTeal dark:hover:border-accent-darkTeal relative group"
                style={{ transformStyle: 'preserve-3d' }}
              >
                {/* Glowing border effect */}
                <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-30 transition-opacity duration-300 bg-gradient-to-r from-accent-darkTeal/20 via-accent-blue/20 to-accent-darkTeal/20 pointer-events-none -z-10" />
                <div className="relative z-10">
                  <div className="flex items-start space-x-3 mb-4">
                    <div className="flex-shrink-0">
                      {service.icon}
                    </div>
                    <div className="flex-1">
                      <div className="text-xs text-teal-600 dark:text-teal-400 font-semibold mb-1 uppercase tracking-wide">
                        {service.category}
                      </div>
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                        {service.title}
                      </h3>
                      <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
                        {service.description}
                      </p>
                    </div>
                  </div>

                  {/* Expanded Content */}
                  {expandedService === service.id && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                      className="space-y-4 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700"
                    >
                      {/* Features */}
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                          Key Features
                        </h4>
                        <ul className="space-y-1">
                          {service.features.map((feature, featureIndex) => (
                            <li key={featureIndex} className="text-gray-600 dark:text-gray-300 text-sm flex items-start">
                              <span className="text-teal-600 mr-2 mt-1 text-xs">•</span>
                              {feature}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Use Cases */}
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                          Use Cases
                        </h4>
                        <div className="flex flex-wrap gap-1">
                          {service.useCases.map((useCase, useCaseIndex) => (
                            <span
                              key={useCaseIndex}
                              className="bg-teal-100 dark:bg-teal-900/30 text-teal-800 dark:text-teal-200 px-2 py-1 rounded-full text-xs font-medium"
                            >
                              {useCase}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Delivery Method */}
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                          Service Delivery
                        </h4>
                        <p className="text-gray-600 dark:text-gray-300 text-sm">
                          {service.delivery}
                        </p>
                      </div>

                      {/* Toggle Button */}
                      <button
                        onClick={() => setExpandedService(null)}
                        className="w-full mt-4 flex items-center justify-center text-teal-700 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 transition-colors duration-200 font-medium"
                      >
                        <ChevronUpIcon className="h-4 w-4 mr-1" />
                        Show Less
                      </button>
                    </motion.div>
                  )}

                  {/* Show More Button */}
                  {expandedService !== service.id && (
                    <button
                      onClick={() => setExpandedService(service.id)}
                      className="w-full mt-4 flex items-center justify-center text-teal-700 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 transition-colors duration-200 font-medium"
                    >
                      <ChevronDownIcon className="h-4 w-4 mr-1" />
                      Learn More
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Enterprise Solutions Section */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={containerVariants}
          className="py-24 bg-gradient-to-r from-gray-800 to-gray-900"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              variants={itemVariants}
              className="text-center mb-16"
            >
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
                Enterprise Solutions
              </h2>
              <p className="text-xl text-gray-300 max-w-3xl mx-auto">
                Tailored security solutions for enterprise-scale AI deployments
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8 px-4 md:px-0">
              {enterpriseSolutions.map((solution, index) => (
                <motion.div
                  key={index}
                  variants={itemVariants}
                  whileHover={{ 
                    scale: 1.05, 
                    rotateX: 5,
                    rotateY: 5,
                    boxShadow: "0 25px 50px -12px rgba(20, 184, 166, 0.4), 0 0 30px rgba(20, 184, 166, 0.3)"
                  }}
                  className="bg-white dark:bg-gray-900 rounded-xl p-6 shadow-lg border border-gray-200 dark:border-gray-700 hover:border-accent-darkTeal dark:hover:border-accent-darkTeal transition-all duration-300 text-center transform-gpu relative overflow-hidden group"
                  style={{ transformStyle: 'preserve-3d' }}
                >
                  {/* Glowing border effect */}
                  <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r from-accent-darkTeal/25 via-accent-blue/25 to-accent-darkTeal/25 blur-sm -z-10" />
                  <div className="relative z-10">
                    <div className="text-4xl mb-4">{solution.icon}</div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                      {solution.title}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-300">
                      {solution.description}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Service Delivery Models */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={containerVariants}
          className="py-20"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              variants={itemVariants}
              className="text-center mb-16"
            >
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
                Service Delivery Models
              </h2>
              <p className="text-xl text-gray-300 max-w-3xl mx-auto">
                Flexible deployment options to fit your workflow
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 px-4 md:px-0">
              {deliveryModels.map((model, index) => (
                <motion.div
                  key={index}
                  variants={itemVariants}
                  whileHover={{ 
                    scale: 1.05, 
                    rotateX: 5,
                    rotateY: 5,
                    boxShadow: "0 25px 50px -12px rgba(20, 184, 166, 0.4), 0 0 30px rgba(20, 184, 166, 0.2)"
                  }}
                  className="bg-gradient-to-r from-accent-darkBlue to-accent-darkTeal text-white rounded-2xl p-5 shadow-lg border border-gray-200 dark:border-gray-700 hover:border-accent-darkTeal dark:hover:border-accent-darkTeal transition-all duration-300 text-center transform-gpu relative overflow-hidden group"
                  style={{ transformStyle: 'preserve-3d' }}
                >
                  {/* Glowing border effect */}
                  <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r from-accent-darkTeal/25 via-accent-blue/25 to-accent-darkTeal/25 blur-sm -z-10" />
                  <div className="relative z-10">
                    <div className="text-3xl mb-3">{model.icon}</div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      {model.title}
                    </h3>
                    <p className="text-gray-700 dark:text-gray-200 text-sm font-medium">
                      {model.description}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Technology Stack Highlights */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={containerVariants}
          className="py-24 bg-gradient-to-r from-blue-50 to-teal-50 dark:from-accent-darkBlue dark:to-accent-darkTeal text-gray-900 dark:text-white"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              variants={itemVariants}
              className="text-center mb-16"
            >
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
                Technology Stack
              </h2>
              <p className="text-xl text-gray-300 max-w-3xl mx-auto">
                FastAPI backend, React + TypeScript frontend, MongoDB, optional Supabase for email/auth
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 px-4 md:px-0">
              <motion.div
                variants={itemVariants}
                whileHover={{ 
                  scale: 1.05, 
                  rotateX: 5,
                  rotateY: 5,
                  boxShadow: "0 25px 50px -12px rgba(20, 184, 166, 0.4), 0 0 30px rgba(20, 184, 166, 0.3)"
                }}
                className="bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-lg border border-gray-200 dark:border-gray-700 hover:border-accent-darkTeal dark:hover:border-accent-darkTeal text-center transform-gpu relative overflow-hidden group"
                style={{ transformStyle: 'preserve-3d' }}
              >
                {/* Glowing border effect */}
                <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r from-accent-darkTeal/25 via-accent-blue/25 to-accent-darkTeal/25 blur-sm -z-10" />
                <div className="relative z-10">
                  <div className="text-2xl mb-3">🤖</div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                    Prompt Injection
                  </h3>
                  <p className="text-gray-700 dark:text-gray-200 text-sm font-medium">
                    Robust detection with Unicode normalization and pattern matching
                  </p>
                </div>
              </motion.div>
              <motion.div
                variants={itemVariants}
                whileHover={{ 
                  scale: 1.05, 
                  rotateX: 5,
                  rotateY: 5,
                  boxShadow: "0 25px 50px -12px rgba(20, 184, 166, 0.4), 0 0 30px rgba(20, 184, 166, 0.3)"
                }}
                className="bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-lg border border-gray-200 dark:border-gray-700 hover:border-accent-darkTeal dark:hover:border-accent-darkTeal text-center transform-gpu relative overflow-hidden group"
                style={{ transformStyle: 'preserve-3d' }}
              >
                {/* Glowing border effect */}
                <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r from-accent-darkTeal/25 via-accent-blue/25 to-accent-darkTeal/25 blur-sm -z-10" />
                <div className="relative z-10">
                  <div className="text-2xl mb-3">🔍</div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                    Vector Analysis
                  </h3>
                  <p className="text-gray-700 dark:text-gray-200 text-sm font-medium">
                    Vector store anomaly detection and retrieval attack simulation
                  </p>
                </div>
              </motion.div>
              <motion.div
                variants={itemVariants}
                whileHover={{ 
                  scale: 1.05, 
                  rotateX: 5,
                  rotateY: 5,
                  boxShadow: "0 25px 50px -12px rgba(20, 184, 166, 0.4), 0 0 30px rgba(20, 184, 166, 0.3)"
                }}
                className="bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-lg border border-gray-200 dark:border-gray-700 hover:border-accent-darkTeal dark:hover:border-accent-darkTeal text-center transform-gpu relative overflow-hidden group"
                style={{ transformStyle: 'preserve-3d' }}
              >
                {/* Glowing border effect */}
                <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r from-accent-darkTeal/25 via-accent-blue/25 to-accent-darkTeal/25 blur-sm -z-10" />
                <div className="relative z-10">
                  <div className="text-2xl mb-3">📊</div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                    Reporting
                  </h3>
                  <p className="text-gray-700 dark:text-gray-200 text-sm font-medium">
                    PDF reports, CWE mapping, and scan history with filters
                  </p>
                </div>
              </motion.div>
              <motion.div
                variants={itemVariants}
                whileHover={{ 
                  scale: 1.05, 
                  rotateX: 5,
                  rotateY: 5,
                  boxShadow: "0 25px 50px -12px rgba(20, 184, 166, 0.4), 0 0 30px rgba(20, 184, 166, 0.3)"
                }}
                className="bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-lg border border-gray-200 dark:border-gray-700 hover:border-accent-darkTeal dark:hover:border-accent-darkTeal text-center transform-gpu relative overflow-hidden group"
                style={{ transformStyle: 'preserve-3d' }}
              >
                {/* Glowing border effect */}
                <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r from-accent-darkTeal/25 via-accent-blue/25 to-accent-darkTeal/25 blur-sm -z-10" />
                <div className="relative z-10">
                  <div className="text-2xl mb-3">☁️</div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                    Scalability
                  </h3>
                  <p className="text-gray-700 dark:text-gray-200 text-sm font-medium">
                    MongoDB, optional Qdrant for vectors, Docker deployment
                  </p>
                </div>
              </motion.div>
            </div>
          </div>
        </motion.div>

        {/* Final CTA Section */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={containerVariants}
          className="py-24" style={{backgroundColor: '#1f2937'}}
        >
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <motion.h2
              variants={itemVariants}
              className="text-4xl md:text-5xl font-bold text-white mb-6"
            >
              Ready to Test and Harden Your AI Applications?
            </motion.h2>
            <motion.p
              variants={itemVariants}
              className="text-xl text-gray-200 mb-12 max-w-2xl mx-auto"
            >
              Sign up for free and start detecting prompt injection, model poisoning, RAG embedding risks, and code vulnerabilities from a single dashboard.
            </motion.p>
            <motion.div
              variants={itemVariants}
              className="flex flex-col sm:flex-row gap-6 justify-center items-center"
            >
              <Link
                to="/auth"
                className="bg-accent-darkTeal hover:bg-teal-700 dark:bg-accent-darkTeal dark:hover:bg-teal-600 text-white dark:text-white px-8 py-4 rounded-lg font-semibold text-lg transition-all duration-300 transform hover:scale-105 shadow-xl hover:shadow-2xl border-2 border-accent-darkTeal dark:border-accent-darkTeal"
              >
                Start Your Free Security Scan Today
              </Link>
              <Link
                to="/contact"
                className="bg-transparent hover:bg-white/20 text-white hover:text-white px-8 py-4 rounded-lg font-semibold text-lg border-2 border-white hover:border-white transition-all duration-300 transform hover:scale-105 backdrop-blur-sm shadow-xl hover:shadow-2xl"
              >
                Get Custom Security Solutions
              </Link>
            </motion.div>
          </div>
        </motion.div>
      </div>
      </>
  );
});

export default ServicesPage;
