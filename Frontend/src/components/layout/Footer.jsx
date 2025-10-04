import { Link } from "react-router-dom"
import { Shield, Github, Linkedin, Mail } from "lucide-react"

const Footer = () => {
  return (
    <footer className="bg-cyber-gray-800/50 border-t border-cyber-gray-600 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center space-x-2 mb-4">
              <Shield className="h-8 w-8 text-cyber-green" />
              <span className="font-cyber text-xl font-bold text-white">LLMShield</span>
            </div>
            <p className="text-gray-400 mb-4 max-w-md">
              A Unified Threat Detection Framework for Mitigating Prompt Injection, Model Poisoning, and RAG Embedding
              Risks.
            </p>
            <div className="flex space-x-4">
              <a
                href="https://github.com/llmshield"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-cyber-green transition-colors duration-300 hover:scale-110"
              >
                <Github className="h-5 w-5" />
              </a>
              <a
                href="https://linkedin.com/company/llmshield"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-cyber-blue transition-colors duration-300 hover:scale-110"
              >
                <Linkedin className="h-5 w-5" />
              </a>
              <a
                href="mailto:contact@llmshield.com"
                className="text-gray-400 hover:text-cyber-green transition-colors duration-300 hover:scale-110"
              >
                <Mail className="h-5 w-5" />
              </a>
            </div>
          </div>
