const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
const axios = require('axios');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Configuration
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE) || 16 * 1024 * 1024; // 16MB
const OLLAMA_HOST = process.env.OLLAMA_HOST || 'localhost';
const OLLAMA_PORT = process.env.OLLAMA_PORT || 11434;
const OLLAMA_BASE_URL = `http://${OLLAMA_HOST}:${OLLAMA_PORT}`;
const GEMMA_MODEL = process.env.GEMMA_MODEL || 'gemma3:4b';

// Allowed file extensions
const ALLOWED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Create upload directory if it doesn't exist
const initializeUploadDir = async () => {
  try {
    await fs.access(UPLOAD_DIR);
  } catch (error) {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    console.log(`📁 Created upload directory: ${UPLOAD_DIR}`);
  }
};

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_EXTENSIONS.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed. Use: ${ALLOWED_EXTENSIONS.join(', ')}`));
    }
  }
});

// Utility Functions
const convertImageToBase64 = async (filePath) => {
  try {
    const buffer = await fs.readFile(filePath);
    return buffer.toString('base64');
  } catch (error) {
    throw new Error(`Failed to read image file: ${error.message}`);
  }
};

const optimizeImage = async (inputPath, outputPath, maxWidth = 1024) => {
  try {
    await sharp(inputPath)
      .resize(maxWidth, null, { 
        withoutEnlargement: true,
        fit: 'inside'
      })
      .jpeg({ quality: 85 })
      .toFile(outputPath);
    
    return outputPath;
  } catch (error) {
    console.warn(`Image optimization failed, using original: ${error.message}`);
    return inputPath;
  }
};

const checkOllamaHealth = async () => {
  try {
    const response = await axios.get(`${OLLAMA_BASE_URL}/api/tags`, { timeout: 5000 });
    return response.status === 200;
  } catch (error) {
    return false;
  }
};

const checkModelAvailability = async (modelName) => {
  try {
    const response = await axios.get(`${OLLAMA_BASE_URL}/api/tags`);
    const models = response.data.models || [];
    return models.some(model => model.name.includes(modelName.split(':')[0]));
  } catch (error) {
    return false;
  }
};

const callGemma3Vision = async (imagePath, prompt = 'Analyze this image and provide a detailed summary') => {
  try {
    // Check if Ollama is running
    const isOllamaHealthy = await checkOllamaHealth();
    if (!isOllamaHealthy) {
      throw new Error('Ollama server is not running. Please start Ollama with: ollama serve');
    }

    // Check if model is available
    const isModelAvailable = await checkModelAvailability(GEMMA_MODEL);
    if (!isModelAvailable) {
      throw new Error(`Model ${GEMMA_MODEL} not found. Please install with: ollama pull ${GEMMA_MODEL}`);
    }

    // Optimize image for faster processing
    const optimizedPath = `${imagePath}_optimized.jpg`;
    const finalImagePath = await optimizeImage(imagePath, optimizedPath);

    // Convert image to base64
    const imageBase64 = await convertImageToBase64(finalImagePath);

    // Prepare the request payload for Ollama
    const payload = {
      model: GEMMA_MODEL,
      prompt: prompt,
      images: [imageBase64],
      stream: false,
      options: {
        temperature: 0.7,
        top_p: 0.9,
        max_tokens: 500
      }
    };

    console.log(`🤖 Analyzing image with ${GEMMA_MODEL}...`);
    
    // Call Ollama API
    const response = await axios.post(
      `${OLLAMA_BASE_URL}/api/generate`,
      payload,
      {
        timeout: 120000, // 2 minutes timeout
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    // Clean up optimized image if it was created
    if (finalImagePath !== imagePath) {
      try {
        await fs.unlink(finalImagePath);
      } catch (cleanupError) {
        console.warn(`Failed to cleanup optimized image: ${cleanupError.message}`);
      }
    }

    if (response.data && response.data.response) {
      return response.data.response;
    } else {
      throw new Error('Invalid response from Ollama');
    }

  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      throw new Error('Cannot connect to Ollama. Make sure Ollama is running on port 11434');
    } else if (error.code === 'ETIMEDOUT') {
      throw new Error('Analysis timed out. Try with a smaller image or simpler prompt');
    } else {
      throw new Error(`Gemma3 analysis failed: ${error.message}`);
    }
  }
};

const cleanupFile = async (filePath) => {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    console.warn(`Failed to cleanup file ${filePath}: ${error.message}`);
  }
};

// Routes

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const ollamaHealthy = await checkOllamaHealth();
    const modelAvailable = await checkModelAvailability(GEMMA_MODEL);
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        api: true,
        ollama: ollamaHealthy,
        model: modelAvailable ? GEMMA_MODEL : 'not_available'
      },
      config: {
        maxFileSize: `${MAX_FILE_SIZE / 1024 / 1024}MB`,
        allowedExtensions: ALLOWED_EXTENSIONS,
        ollamaUrl: OLLAMA_BASE_URL,
        model: GEMMA_MODEL
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// System status endpoint
app.get('/status', async (req, res) => {
  try {
    const ollamaHealthy = await checkOllamaHealth();
    
    let availableModels = [];
    if (ollamaHealthy) {
      try {
        const response = await axios.get(`${OLLAMA_BASE_URL}/api/tags`);
        availableModels = response.data.models?.map(m => m.name) || [];
      } catch (error) {
        console.warn('Failed to fetch models:', error.message);
      }
    }

    res.json({
      ollama: {
        running: ollamaHealthy,
        url: OLLAMA_BASE_URL,
        availableModels
      },
      currentModel: GEMMA_MODEL,
      modelAvailable: availableModels.some(m => m.includes(GEMMA_MODEL.split(':')[0]))
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to check system status',
      message: error.message
    });
  }
});

// Single image analysis endpoint
app.post('/analyze-image', upload.single('image'), async (req, res) => {
  let filePath = null;
  
  try {
    // Validate file upload
    if (!req.file) {
      return res.status(400).json({
        error: 'No image file provided'
      });
    }

    filePath = req.file.path;
    const prompt = req.body.prompt || 'Analyze this image and provide a detailed summary';

    console.log(`📸 Processing image: ${req.file.originalname} (${(req.file.size / 1024 / 1024).toFixed(2)}MB)`);

    // Analyze image with Gemma3
    const startTime = Date.now();
    const summary = await callGemma3Vision(filePath, prompt);
    const processingTime = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(`✅ Analysis completed in ${processingTime}s`);

    res.json({
      success: true,
      summary,
      filename: req.file.originalname,
      fileSize: req.file.size,
      processingTime: `${processingTime}s`,
      timestamp: new Date().toISOString(),
      model: GEMMA_MODEL
    });

  } catch (error) {
    console.error('❌ Analysis failed:', error.message);
    
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    });
  } finally {
    // Cleanup uploaded file
    if (filePath) {
      await cleanupFile(filePath);
    }
  }
});

// Batch image analysis endpoint
app.post('/batch-analyze', upload.array('images', 10), async (req, res) => {
  const uploadedFiles = req.files || [];
  
  try {
    if (uploadedFiles.length === 0) {
      return res.status(400).json({
        error: 'No image files provided'
      });
    }

    console.log(`📸 Processing batch of ${uploadedFiles.length} images`);

    const results = [];
    const prompt = req.body.prompt || 'Analyze this image and provide a detailed summary';

    for (let i = 0; i < uploadedFiles.length; i++) {
      const file = uploadedFiles[i];
      
      try {
        console.log(`Processing ${i + 1}/${uploadedFiles.length}: ${file.originalname}`);
        
        const startTime = Date.now();
        const summary = await callGemma3Vision(file.path, prompt);
        const processingTime = ((Date.now() - startTime) / 1000).toFixed(1);

        results.push({
          success: true,
          filename: file.originalname,
          summary,
          processingTime: `${processingTime}s`,
          fileSize: file.size
        });

      } catch (error) {
        results.push({
          success: false,
          filename: file.originalname,
          error: error.message
        });
      } finally {
        // Cleanup each file after processing
        await cleanupFile(file.path);
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`✅ Batch processing completed: ${successCount}/${uploadedFiles.length} successful`);

    res.json({
      success: true,
      results,
      summary: {
        total: uploadedFiles.length,
        successful: successCount,
        failed: uploadedFiles.length - successCount
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Batch analysis failed:', error.message);
    
    // Cleanup any remaining files
    for (const file of uploadedFiles) {
      await cleanupFile(file.path);
    }
    
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Model management endpoints
app.get('/models', async (req, res) => {
  try {
    const response = await axios.get(`${OLLAMA_BASE_URL}/api/tags`);
    res.json(response.data);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch models',
      message: error.message
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`
      });
    }
    return res.status(400).json({
      error: `Upload error: ${error.message}`
    });
  }
  
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    path: req.path,
    method: req.method,
    availableEndpoints: [
      'GET /health',
      'GET /status', 
      'GET /models',
      'POST /analyze-image',
      'POST /batch-analyze'
    ]
  });
});

// Start server
const startServer = async () => {
  try {
    await initializeUploadDir();
    
    app.listen(PORT, () => {
      console.log('🚀 Gemma3 Vision API Server Started');
      console.log('================================');
      console.log(`📍 Server: http://localhost:${PORT}`);
      console.log(`🤖 Ollama: ${OLLAMA_BASE_URL}`);
      console.log(`🧠 Model: ${GEMMA_MODEL}`);
      console.log('📋 Endpoints:');
      console.log('   GET  /health - Health check');
      console.log('   GET  /status - System status');
      console.log('   GET  /models - Available models');
      console.log('   POST /analyze-image - Analyze single image');
      console.log('   POST /batch-analyze - Analyze multiple images');
      console.log('================================');
      
      // Check Ollama connection on startup
      setTimeout(async () => {
        const healthy = await checkOllamaHealth();
        const modelAvailable = await checkModelAvailability(GEMMA_MODEL);
        
        if (!healthy) {
          console.warn('⚠️  Ollama not detected. Start with: ollama serve');
        }
        if (!modelAvailable) {
          console.warn(`⚠️  Model ${GEMMA_MODEL} not found. Install with: ollama pull ${GEMMA_MODEL}`);
        }
        if (healthy && modelAvailable) {
          console.log('✅ Ready to analyze images with Gemma3!');
        }
      }, 1000);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down server...');
  
  // Cleanup upload directory
  try {
    const files = await fs.readdir(UPLOAD_DIR);
    for (const file of files) {
      await cleanupFile(path.join(UPLOAD_DIR, file));
    }
    console.log('🧹 Cleaned up temporary files');
  } catch (error) {
    console.warn('Failed to cleanup files:', error.message);
  }
  
  process.exit(0);
});

module.exports = app;