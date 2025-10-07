# 🛡️ LLMShield Frontend

**LLMShield** is a comprehensive AI security platform that protects your AI applications from various threats including prompt injection attacks, model poisoning, and code vulnerabilities.

## 🚀 Features

### 🔐 Authentication & Security
- **User Registration & Login** - Secure account creation and authentication
- **Multi-Factor Authentication (MFA)** - Enhanced security with 2FA support
- **Remember Me** - Convenient login with secure session management
- **Password Security** - Strong password requirements and validation

### 🛡️ Security Scanning Services
- **Prompt Injection Scanner** - Detect malicious prompt injection attempts
- **C/C++ Code Scanner** - Identify vulnerabilities in source code
- **Model Poisoning Detection** - Analyze AI models for poisoning attacks
- **Vector Embedding Security** - Check embedding vulnerabilities


### 📊 Dashboard & Analytics
- **Security Dashboard** - Overview of scans and threat statistics
- **Detailed Reports** - Comprehensive security analysis results
- **Risk Assessment** - High, medium, and low risk categorization
- **Scan History** - Track all security scans and results

### ⚙️ User Management
- **Profile Settings** - Manage user information and preferences
- **Plan Management** - Free, Regular, and Premium subscription plans
- **Notification Settings** - Customize alerts and reports
- **API Access** - Integration capabilities for developers

## 🛠️ Technology Stack

- **Frontend Framework**: React 19.1.1 with TypeScript
- **Styling**: Tailwind CSS with custom animations
- **UI Components**: Radix UI components for accessibility
- **Routing**: React Router DOM for navigation
- **Animations**: Framer Motion for smooth transitions
- **Forms**: React Hook Form with Zod validation
- **Icons**: Lucide React and Heroicons
- **Charts**: Recharts for data visualization

## 📋 Prerequisites

Before running this project, make sure you have:

- **Node.js** (version 16 or higher)
- **npm** (comes with Node.js)


## 🚀 Getting Started

### 1. Clone the Repository
```bash
git clone <repository-url>
cd LLMShield-Frontend
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Start the Development Server
```bash
npm start
```

The application will open at [http://localhost:3000](http://localhost:3000)

## 📁 Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── dashboard/      # Dashboard-specific components
│   ├── pages/          # Page components
│   └── Chatbot.tsx     # AI assistant chatbot
├── contexts/           # React context providers
│   └── AuthContext.jsx # Authentication state management
├── hooks/              # Custom React hooks
├── lib/                # Utility libraries and configurations
├── pages/              # Main page components
│   ├── AuthPage.tsx    # Login/Signup page
│   ├── DashboardPage.tsx # Main dashboard
│   └── ServicesPage.tsx # Services overview
└── App.tsx             # Main application component
```

## 🔧 Available Scripts

### Development
```bash
npm start          # Start development server
npm test           # Run test suite
npm run build      # Build for production
```

### Production Build
```bash
npm run build
```
Creates an optimized production build in the `build` folder.

## 🌐 How to Use

### 1. **Registration**
- Visit [http://localhost:3000](http://localhost:3000)
- Click "Sign Up" to create a new account
- Fill in your name, username, email, and password
- Complete the registration process

### 2. **Login**
- Enter your email and password
- Optionally check "Remember Me" for convenience
- Complete MFA verification if enabled

### 3. **Dashboard**
- View your security statistics and recent scans
- Access quick actions for different security services
- Monitor threat levels and risk assessments

### 4. **Security Scanning**
- **Prompt Injection**: Upload text or enter prompts to scan
- **Code Scanner**: Upload C/C++ files for vulnerability analysis
- **Model Poisoning**: Analyze AI models for security threats
- **Vector Analysis**: Check embedding security

### 5. **Settings**
- Manage your profile and account settings
- Adjust notification settings
- Upgrade your subscription plan

## 🔒 Security Features

- **Secure Authentication** - JWT-based authentication with refresh tokens
- **Session Management** - Secure session handling and timeout
- **Data Protection** - Client-side encryption and secure data transmission
- **CSRF Protection** - Cross-site request forgery prevention

## 🎨 UI/UX Features

- **Responsive Design** - Works on desktop, tablet, and mobile
- **Dark Theme** - Modern dark interface with teal accents
- **Smooth Animations** - Framer Motion powered transitions
- **Accessibility** - WCAG compliant with Radix UI components
- **Interactive Elements** - Hover effects and loading states


## 🤝 Support

For support and questions:
- Check the built-in chatbot for common questions
- Review the FAQ section in the application
- Contact support through the settings page


---

**Made with ❤️ for AI Security**
