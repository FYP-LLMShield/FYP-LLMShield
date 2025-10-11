/**
 * Chat client service for LLMShield Assistant
 * Handles sending messages to the backend API and provides mock responses when needed
 */

// Mock responses for demonstration purposes
const mockResponses = [
  "I can help you understand how LLMShield protects against prompt injection attacks.",
  "Our model poisoning detection can identify compromised training data with 98% accuracy.",
  "The RAG Embedding Guard ensures vector integrity in your retrieval systems.",
  "You can upload C/C++ code directly to our scanner to identify potential vulnerabilities.",
  "LLMShield offers three pricing tiers: Free, Regular ($29/mo), and Premium ($99/mo).",
  "Yes, we offer enterprise solutions with custom SLAs and dedicated support.",
  "The dashboard provides real-time monitoring of all security scans and potential threats.",
  "You can integrate LLMShield with your existing AI infrastructure using our API.",
  "Our documentation includes comprehensive guides for all our security features.",
  "I'd be happy to connect you with our sales team for a personalized demo."
];

/**
 * Sends a message to the chat API
 * Falls back to mock responses if API call fails or no API key is configured
 * 
 * @param text - The message text to send
 * @returns Promise<string> - The response message
 */
export const sendMessage = async (text: string): Promise<string> => {
  try {
    // Check if we have an API key configured
    const apiKey = localStorage.getItem('llmshield_api_key');
    
    // If we have an API key, try to call the real API
    if (apiKey) {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({ message: text })
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      return data.response;
    }
    
    // If no API key or for demo purposes, return a mock response
    return getMockResponse(text);
  } catch (error) {
    console.error('Error in chat service:', error);
    // Fall back to mock response
    return getMockResponse(text);
  }
};

/**
 * Generates a contextually relevant mock response
 * 
 * @param text - The user's message
 * @returns string - A mock response
 */
const getMockResponse = (text: string): string => {
  // Simple keyword matching for more contextual responses
  const lowerText = text.toLowerCase();
  
  if (lowerText.includes('pricing') || lowerText.includes('cost') || lowerText.includes('price')) {
    return "LLMShield offers three pricing tiers: Free (with limited scans), Regular ($29/mo with 100 scans), and Premium ($99/mo with unlimited scans and advanced features). You can view detailed pricing on our pricing page.";
  }
  
  if (lowerText.includes('prompt injection') || lowerText.includes('injection')) {
    return "Our Prompt Injection Scanner detects malicious inputs designed to manipulate AI systems. It works by analyzing patterns, detecting anomalies, and identifying potential exploits in user inputs before they reach your language model.";
  }
  
  if (lowerText.includes('model poisoning') || lowerText.includes('poisoning')) {
    return "The Model Poisoning Analyzer examines your training data for signs of manipulation or corruption. It identifies outliers, inconsistencies, and potentially harmful examples that could compromise your model's integrity and behavior.";
  }
  
  if (lowerText.includes('embedding') || lowerText.includes('rag') || lowerText.includes('vector')) {
    return "Our RAG Embedding Guard ensures the integrity of your vector embeddings by detecting similarity spikes, identifying anomalous vectors, and validating embedding quality. This protects retrieval-augmented generation systems from manipulation.";
  }
  
  if (lowerText.includes('c++') || lowerText.includes('code') || lowerText.includes('scanner')) {
    return "The C/C++ Vulnerability Scanner identifies common security flaws in your code, including memory leaks, buffer overflows, and other CWE-mapped vulnerabilities. It provides remediation suggestions and secure coding practices.";
  }
  
  if (lowerText.includes('hello') || lowerText.includes('hi') || lowerText.includes('hey')) {
    return "Hello! I'm the LLMShield Assistant. How can I help you today with AI security?";
  }
  
  if (lowerText.includes('thank')) {
    return "You're welcome! If you have any other questions about LLMShield's security features, feel free to ask.";
  }
  
  if (lowerText.includes('contact') || lowerText.includes('support') || lowerText.includes('help')) {
    return "For personalized assistance, you can reach our support team through the Contact page or email support@llmshield.ai. Our team typically responds within 24 hours.";
  }
  
  // Default to a random response if no keywords match
  return mockResponses[Math.floor(Math.random() * mockResponses.length)];
};