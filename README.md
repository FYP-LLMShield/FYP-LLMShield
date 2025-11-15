# FYP-LLMShield
A Unified Threat Detection Framework for Mitigating Prompt Injection, Model Poisoning, and RAG Embedding Risks.

<div align="center">
  <img src="LLMShield-Frontend/public/images/logo.svg" alt="LLMShield Logo" width="200"/>
  
  **A Comprehensive AI Security Testing Platform**
  
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
  [![React](https://img.shields.io/badge/React-18.x-blue.svg)](https://reactjs.org/)
  [![FastAPI](https://img.shields.io/badge/FastAPI-0.104.1-green.svg)](https://fastapi.tiangolo.com/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
  [![Python](https://img.shields.io/badge/Python-3.8+-blue.svg)](https://www.python.org/)
</div>

## 🛡️ Overview

LLMShield is a comprehensive security testing platform designed to identify and mitigate vulnerabilities in Large Language Models (LLMs) and AI systems. The platform provides specialized tools for detecting prompt injection attacks, model poisoning, vector embedding vulnerabilities, and code security issues.

### Key Features

- **🎯 Prompt Injection Testing**: Advanced detection of prompt injection attacks, jailbreaks, and system prompt leaks
- **🧪 Model Poisoning Detection**: Comprehensive analysis for backdoor triggers and behavioral anomalies
- **📊 Vector Embedding Analysis**: Similarity collision detection and suspicious pattern identification
- **🔍 Code Security Scanning**: C/C++ vulnerability detection with CWE mapping and secret detection
- **📈 Real-time Dashboard**: Interactive security metrics and threat monitoring
- **🔗 Multi-Provider Support**: Integration with OpenAI, Anthropic, Google, Ollama, and custom APIs
- **📱 Responsive Design**: Optimized for desktop and mobile security workflows
- **🔐 Enterprise Security**: Comprehensive authentication, authorization, and audit logging

## 🏗️ Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Styling**: Tailwind CSS with custom design system
- **UI Components**: Radix UI primitives for accessibility
- **State Management**: React Context API
- **Routing**: React Router DOM
- **Animations**: Framer Motion
- **Data Visualization**: Recharts
- **Form Handling**: React Hook Form with Zod validation

### Backend Architecture
- **Framework**: FastAPI with Python 3.8+
- **Database**: MongoDB with Motor async driver
- **Authentication**: JWT with bcrypt password hashing
- **API Integration**: Multi-provider LLM support
- **File Processing**: PDF, DOCX, and text document analysis
- **Security**: Rate limiting, CORS, and input validation

## 🚀 Quick Start

### Prerequisites

- **Node.js** 16.x or higher
- **Python** 3.8 or higher
- **MongoDB** (local or cloud instance)
- **Git**

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/llmshield.git
   cd llmshield
   ```

2. **Backend Setup**
   ```bash
   cd LLMShield-Backend
   
   # Create virtual environment
   python -m venv venv
   
   # Activate virtual environment
   # Windows
   venv\Scripts\activate
   # macOS/Linux
   source venv/bin/activate
   
   # Install dependencies
   pip install -r requirements.txt
   
   # Configure environment variables
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Frontend Setup**
   ```bash
   cd ../LLMShield-Frontend
   
   # Install dependencies
   npm install
   
   # Configure environment variables
   cp .env.example .env
   # Edit .env with your configuration
   ```

### Environment Configuration

#### Backend (.env)
```env
# Database
MONGODB_URL=mongodb://localhost:27017/llmshield

# JWT Configuration
SECRET_KEY=your-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# API Keys (optional - configure as needed)
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key
GOOGLE_API_KEY=your-google-key

# Server Configuration
HOST=0.0.0.0
PORT=8000
```

#### Frontend (.env)
```env
REACT_APP_API_URL=http://localhost:8000
REACT_APP_ENVIRONMENT=development
```

### Running the Application

1. **Start the Backend**
   ```bash
   cd LLMShield-Backend
   python run.py
   ```
   The API will be available at `http://localhost:8000`

2. **Start the Frontend**
   ```bash
   cd LLMShield-Frontend
   npm start
   ```
   The application will be available at `http://localhost:3000`

## 📖 Usage

### Dashboard Overview

The main dashboard provides:
- **Security Metrics**: Real-time vulnerability counts and severity distribution
- **Threat Timeline**: Historical security events and trends
- **Quick Actions**: Direct access to all security scanners
- **Recent Alerts**: Latest security findings and recommendations

### Security Scanners

#### Prompt Injection Testing
1. Navigate to **Prompt Injection** scanner
2. Configure your LLM provider and model
3. Enter test prompts or upload documents
4. Select probe categories (Injection, Jailbreak, System Leak, etc.)
5. Run tests and review detailed results

#### Model Poisoning Detection
1. Access **Model Poisoning** scanner
2. Configure model version and test parameters
3. Upload trigger test cases
4. Analyze behavioral anomalies and backdoor detection results

#### Vector Embedding Analysis
1. Open **Vector Embeddings** scanner
2. Upload documents for embedding analysis
3. Configure similarity thresholds
4. Review collision detection and suspicious patterns

#### Code Security Scanning
1. Use **Code Scanner** for vulnerability detection
2. Upload files or connect GitHub repositories
3. Scan for C/C++ vulnerabilities and secrets
4. Review CWE-mapped findings with remediation guidance

### API Documentation

Interactive API documentation is available at:
- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`

## 🧪 Testing

### Frontend Testing
```bash
cd LLMShield-Frontend
npm test
```

### Backend Testing
```bash
cd LLMShield-Backend
pytest
```

### Integration Testing
The platform includes comprehensive integration tests for:
- API endpoint validation
- Multi-provider LLM integration
- Security scanner functionality
- Authentication and authorization
- File upload and processing

## 🔧 Development

### Project Structure
```
llmshield/
├── LLMShield-Backend/          # FastAPI backend
│   ├── app/
│   │   ├── core/              # Core configuration
│   │   ├── models/            # Database models
│   │   ├── routes/            # API endpoints
│   │   ├── services/          # Business logic
│   │   └── utils/             # Utility functions
│   ├── requirements.txt       # Python dependencies
│   └── run.py                # Application entry point
├── LLMShield-Frontend/        # React frontend
│   ├── src/
│   │   ├── components/        # React components
│   │   ├── pages/            # Page components
│   │   ├── contexts/         # React contexts
│   │   ├── hooks/            # Custom hooks
│   │   └── lib/              # Utility libraries
│   ├── package.json          # Node.js dependencies
│   └── tailwind.config.js    # Tailwind configuration
└── README.md                 # This file
```

### Contributing Guidelines

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Make your changes** following the coding standards
4. **Add tests** for new functionality
5. **Commit your changes**: `git commit -m 'Add amazing feature'`
6. **Push to the branch**: `git push origin feature/amazing-feature`
7. **Open a Pull Request**

### Code Style

- **Frontend**: ESLint + Prettier configuration
- **Backend**: Black formatter + isort for imports
- **TypeScript**: Strict type checking enabled
- **Python**: PEP 8 compliance with type hints

## 🔒 Security Considerations

- **Authentication**: JWT-based authentication with secure token handling
- **Input Validation**: Comprehensive validation using Pydantic and Zod
- **Rate Limiting**: API rate limiting to prevent abuse
- **CORS**: Properly configured cross-origin resource sharing
- **Encryption**: HTTPS enforcement and secure credential storage
- **Audit Logging**: Comprehensive security event logging

## 📊 Performance

- **Response Times**: Sub-second response for dashboard metrics
- **Concurrent Users**: Tested for multi-user scenarios
- **Scalability**: Designed for horizontal scaling
- **Resource Management**: Optimized memory and CPU usage

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### Development Setup

1. Follow the installation instructions above
2. Install development dependencies:
   ```bash
   # Frontend
   cd LLMShield-Frontend
   npm install --include=dev
   
   # Backend
   cd LLMShield-Backend
   pip install -r requirements-dev.txt
   ```

3. Set up pre-commit hooks:
   ```bash
   pre-commit install
   ```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Security Research Community** for vulnerability disclosure and testing
- **Open Source Contributors** for the amazing libraries and frameworks
- **AI Safety Researchers** for guidance on LLM security best practices

## 📞 Support

- **Documentation**: [Wiki](https://github.com/yourusername/llmshield/wiki)
- **Issues**: [GitHub Issues](https://github.com/yourusername/llmshield/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/llmshield/discussions)
- **Email**: support@llmshield.com

---

<div align="center">
  <strong>Built with ❤️ for AI Security</strong>
</div>
