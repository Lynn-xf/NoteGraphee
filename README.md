Backend: express Node.js
Frontend: react, javascript

## 📁 Updated Project Directory Structure

```
gemma3-vision-analyzer/
│
├── backend/                          # Node.js Express API Server
│   ├── server.js                    # Main Express application
│   ├── package.json                 # Node.js dependencies
│   ├── .env                        # Environment variables
│   ├── .env.example                # Environment template
│   ├── uploads/                    # Temporary upload directory (auto-created)
│   ├── controllers/                # Route controllers
│   │   └── imageController.js      # Image analysis logic
│   ├── middleware/                 # Custom middleware
│   │   └── validation.js          # Request validation
│   ├── utils/                      # Utility functions
│   │   ├── ollama.js              # Ollama integration
│   │   └── imageUtils.js          # Image processing utilities
│   └── README.md                   # Backend documentation
│
├── frontend/                        # React Web Application
│   ├── public/
│   │   ├── index.html              # Main HTML template
│   │   ├── favicon.ico             # App icon
│   │   └── manifest.json           # PWA manifest
│   ├── src/
│   │   ├── components/
│   │   │   └── ImageAnalyzer.jsx   # Main React component
│   │   ├── App.js                  # App entry point
│   │   ├── App.css                 # App styles
│   │   └── index.js                # React DOM render
│   ├── package.json                # Node.js dependencies
│   ├── tailwind.config.js          # Tailwind CSS config
│   └── README.md                   # Frontend documentation
│
├── scripts/                        # Utility scripts
│   ├── setup.sh                   # Automated setup script
│   ├── start-backend.sh           # Start Node.js server
│   ├── start-frontend.sh          # Start React dev server
│   └── install-ollama.sh          # Ollama installation script
│
├── docker/                        # Docker configuration
│   ├── Dockerfile.backend         # Backend Docker image
│   ├── Dockerfile.frontend        # Frontend Docker image
│   └── docker-compose.yml         # Full stack Docker setup
│
├── .gitignore                      # Git ignore rules
└── README.md                      # Main project documentation
```

## 🚀 Node.js Backend Setup

### 1. Initialize Backend

```bash
cd backend

# Initialize Node.js project
npm init -y

# Install dependencies
npm install express multer cors dotenv axios sharp uuid

# Install development dependencies
npm install --save-dev nodemon concurrently

# Create necessary directories
mkdir -p controllers middleware utils uploads
```

### 2. Create `package.json`

```json
{
  "name": "gemma3-vision-backend",
  "version": "1.0.0",
  "description": "Node.js backend for Gemma3 Vision Analyzer",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "dependencies": {
    "express": "^4.18.2",
    "multer": "^1.4.5-lts.1",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "axios": "^1.6.0",
    "sharp": "^0.32.6",
    "uuid": "^9.0.1"
  },
  "devDependencies": {
    "nodemon": "^3.0.1",
    "concurrently": "^8.2.2"
  },
  "keywords": ["ai", "vision", "gemma3", "image-analysis", "ollama"],
  "author": "Your Name",
  "license": "MIT"
}
```

### 3. Create `.env` Configuration

```bash
# Create .env file
cat > .env << EOL
# Server Configuration
PORT=5000
NODE_ENV=development

# File Upload Configuration
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=16777216

# Ollama Configuration
OLLAMA_HOST=localhost
OLLAMA_PORT=11434
GEMMA_MODEL=gemma3:4b

# Security (optional)
CORS_ORIGIN=http://localhost:3000
EOL
```

### 4. Create `.env.example`

```bash
# Server Configuration
PORT=5000
NODE_ENV=development

# File Upload Configuration  
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=16777216

# Ollama Configuration
OLLAMA_HOST=localhost
OLLAMA_PORT=11434
GEMMA_MODEL=gemma3:4b

# Security
CORS_ORIGIN=http://localhost:3000
```

## 🔧 Updated Setup Scripts

### `scripts/setup.sh`

```bash
#!/bin/bash
echo "🚀 Setting up Gemma3 Vision Analyzer (Node.js)..."

# Install Ollama
echo "📦 Installing Ollama..."
curl -fsSL https://ollama.ai/install.sh | sh

# Download Gemma3 model
echo "🤖 Downloading Gemma3 model..."
ollama pull gemma3:4b

# Setup Node.js backend
echo "🟢 Setting up Node.js backend..."
cd backend
npm install
cd ..

# Setup React frontend
echo "⚛️ Setting up React frontend..."
cd frontend
npm install
cd ..

# Make scripts executable
chmod +x scripts/*.sh

echo "✅ Setup complete! Ready to start the application."
echo ""
echo "🚀 Quick Start:"
echo "  Terminal 1: ./scripts/start-backend.sh"
echo "  Terminal 2: ./scripts/start-frontend.sh"
echo "  Browser: http://localhost:3000"
```

### `scripts/start-backend.sh`

```bash
#!/bin/bash
echo "🟢 Starting Node.js backend..."
cd backend
npm run dev
```

### `scripts/install-ollama.sh`

```bash
#!/bin/bash
echo "📦 Installing Ollama and Gemma3..."

# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Start Ollama service (Linux/macOS)
if command -v systemctl &> /dev/null; then
    sudo systemctl start ollama
    sudo systemctl enable ollama
    echo "✅ Ollama service started and enabled"
fi

# Download models
echo "🤖 Downloading Gemma3 models..."
ollama pull gemma3:4b     # 4B model - fastest
ollama pull gemma3:12b    # 12B model - better quality (optional)

echo "✅ Ollama setup complete!"
echo "🔍 Test with: ollama list"
```

## 🐳 Docker Configuration

### `docker/docker-compose.yml`

```yaml
version: '3.8'

services:
  # Ollama service
  ollama:
    image: ollama/ollama:latest
    container_name: gemma3-ollama
    ports:
      - "11434:11434"
    volumes:
      - ollama_data:/root/.ollama
      - ./models:/models
    environment:
      - OLLAMA_HOST=0.0.0.0
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:11434/api/tags"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Backend service
  backend:
    build:
      context: ../backend
      dockerfile: ../docker/Dockerfile.backend
    container_name: gemma3-backend
    ports:
      - "5000:5000"
    volumes:
      - ../backend:/app
      - /app/node_modules
    environment:
      - NODE_ENV=development
      - OLLAMA_HOST=ollama
      - OLLAMA_PORT=11434
    depends_on:
      ollama:
        condition: service_healthy
    restart: unless-stopped

  # Frontend service
  frontend:
    build:
      context: ../frontend
      dockerfile: ../docker/Dockerfile.frontend
    container_name: gemma3-frontend
    ports:
      - "3000:3000"
    volumes:
      - ../frontend/src:/app/src
      - /app/node_modules
    environment:
      - REACT_APP_API_URL=http://localhost:5000
    depends_on:
      - backend
    restart: unless-stopped

volumes:
  ollama_data:
```

### `docker/Dockerfile.backend`

```dockerfile
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Create uploads directory
RUN mkdir -p uploads

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:5000/health || exit 1

# Start application
CMD ["node", "server.js"]
```

## 📊 Development Commands

### Backend Development

```bash
# Start development server with hot reload
npm run dev

# Start production server
npm start

# Install new dependency
npm install package-name

# Check API health
curl http://localhost:5000/health
```

### Full Stack Development

```bash
# Start everything with one command (from root)
npm run dev:all

# Or start individually
./scripts/start-backend.sh    # Terminal 1
./scripts/start-frontend.sh   # Terminal 2
```

## 🔧 Key Features of Node.js Backend

### ✅ **Enhanced Features**
- **Image Optimization**: Automatic image resizing with Sharp
- **Batch Processing**: Handle multiple images simultaneously  
- **Health Monitoring**: Real-time Ollama and model status
- **Error Recovery**: Robust error handling with cleanup
- **File Management**: Automatic cleanup of temporary files
- **Performance Metrics**: Processing time tracking
- **Model Management**: Dynamic model availability checking

### 🚀 **API Endpoints**
- `GET /health` - Health check with detailed status
- `GET /status` - System and Ollama status
- `GET /models` - Available Ollama models
- `POST /analyze-image` - Single image analysis
- `POST /batch-analyze` - Multiple image analysis

### 🛡️ **Security & Performance**
- File type and size validation
- Automatic image optimization
- Memory-efficient streaming
- Graceful error handling
- Request timeouts
- CORS configuration

The Node.js backend is more efficient and provides better real-time feedback compared to Flask, with excellent npm ecosystem integration and modern JavaScript features!

## 🎯 Quick Start (3 Commands)

```bash
# 1. Setup everything
chmod +x scripts/setup.sh && ./scripts/setup.sh

# 2. Start backend
./scripts/start-backend.sh

# 3. Start frontend  
./scripts/start-frontend.sh
```

Then visit `http://localhost:3000` to use your Gemma3 Vision Analyzer!