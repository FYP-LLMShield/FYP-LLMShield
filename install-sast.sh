#!/bin/bash

# SAST-MCP Installation Script
# Installs Semgrep and TruffleHog for professional C/C++ code analysis

set -e

echo "🛡️  LLMShield SAST Installation Script"
echo "======================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check Python installation
echo -e "${YELLOW}[1/5]${NC} Checking Python installation..."
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python 3 not found. Please install Python 3.8 or higher.${NC}"
    exit 1
fi
python_version=$(python3 --version 2>&1 | awk '{print $2}')
echo -e "${GREEN}✅ Python $python_version found${NC}"
echo ""

# Check pip installation
echo -e "${YELLOW}[2/5]${NC} Checking pip installation..."
if ! command -v pip3 &> /dev/null; then
    echo -e "${RED}❌ pip3 not found. Please install pip.${NC}"
    exit 1
fi
echo -e "${GREEN}✅ pip3 found${NC}"
echo ""

# Install Semgrep
echo -e "${YELLOW}[3/5]${NC} Installing Semgrep..."
if pip install semgrep; then
    echo -e "${GREEN}✅ Semgrep installed successfully${NC}"
    semgrep --version
else
    echo -e "${RED}❌ Failed to install Semgrep${NC}"
    exit 1
fi
echo ""

# Install TruffleHog
echo -e "${YELLOW}[4/5]${NC} Installing TruffleHog..."
if pip install truffleHog; then
    echo -e "${GREEN}✅ TruffleHog installed successfully${NC}"
    trufflehog --version
else
    echo -e "${RED}❌ Failed to install TruffleHog${NC}"
    exit 1
fi
echo ""

# Update backend requirements
echo -e "${YELLOW}[5/5]${NC} Updating backend requirements..."
cd backend
if pip install -r requirements.txt; then
    echo -e "${GREEN}✅ Backend requirements updated${NC}"
else
    echo -e "${YELLOW}⚠️  Some packages may not have installed. Please check manually.${NC}"
fi
cd ..
echo ""

echo -e "${GREEN}======================================"
echo "✅ SAST Installation Complete!"
echo "======================================"
echo ""
echo "Next steps:"
echo "1. Start backend: cd backend && python run.py"
echo "2. Start frontend: cd frontend && npm start"
echo "3. Open http://localhost:3000"
echo "4. Test the SAST scanner with sample code"
echo ""
echo "For more information, see SAST_SETUP.md"
