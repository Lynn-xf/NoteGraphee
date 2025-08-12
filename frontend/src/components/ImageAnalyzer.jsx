import React, { useState, useCallback, useEffect } from 'react';
import { Upload, Image, FileText, AlertCircle, CheckCircle, Loader, Server, Wifi, WifiOff } from 'lucide-react';

const API_BASE_URL = 'http://localhost:5000';

const ImageAnalyzer = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [apiStatus, setApiStatus] = useState('unknown');
  const [history, setHistory] = useState([]);

  // Check API health on component mount
  useEffect(() => {
    checkApiHealth();
  }, []);

  // Check API health
  const checkApiHealth = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/health`);
      if (response.ok) {
        setApiStatus('online');
      } else {
        setApiStatus('offline');
      }
    } catch (error) {
      setApiStatus('offline');
    }
  };

  // Handle file selection
  const handleFileSelect = useCallback((file) => {
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setError('Please select a valid image file (PNG, JPG, JPEG, GIF, or WEBP)');
      return;
    }

    // Validate file size (16MB limit)
    if (file.size > 16 * 1024 * 1024) {
      setError('File size must be less than 16MB');
      return;
    }

    setSelectedFile(file);
    setError(null);
    setResult(null);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target.result);
    reader.readAsDataURL(file);
  }, []);

  // Handle drag events
  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  // Handle drop
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  }, [handleFileSelect]);

  // Handle file input change
  const handleInputChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  // Analyze image
  const analyzeImage = async () => {
    if (!selectedFile) {
      setError('Please select an image first');
      return;
    }

    setLoading(true);
    setError(null);
    const startTime = Date.now();

    try {
      const formData = new FormData();
      formData.append('image', selectedFile);
      if (customPrompt.trim()) {
        formData.append('prompt', customPrompt);
      }

      const response = await fetch(`${API_BASE_URL}/analyze-image`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      const endTime = Date.now();
      const processingTime = ((endTime - startTime) / 1000).toFixed(1);

      if (response.ok && data.success) {
        const resultWithTime = {
          ...data,
          processingTime,
          timestamp: new Date().toLocaleString()
        };
        setResult(resultWithTime);
        
        // Add to history
        setHistory(prev => [{
          id: Date.now(),
          filename: data.filename,
          summary: data.summary,
          prompt: customPrompt || 'Analyze this image and provide a detailed summary',
          timestamp: new Date().toLocaleString(),
          processingTime
        }, ...prev.slice(0, 4)]); // Keep last 5 results
        
        setApiStatus('online');
      } else {
        setError(data.error || 'Analysis failed');
      }
    } catch (err) {
      setError('Failed to connect to the API. Make sure the Node.js server is running on port 5000 and Ollama is installed with Gemma3 model.');
      setApiStatus('offline');
    } finally {
      setLoading(false);
    }
  };

  // Clear current analysis
  const clearCurrent = () => {
    setSelectedFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    setCustomPrompt('');
  };

  // Clear history
  const clearHistory = () => {
    setHistory([]);
  };

  // Quick prompt templates
  const promptTemplates = [
    "Describe what you see in this image in detail",
    "Identify all objects and people in this image",
    "Extract and read any text visible in this image",
    "Analyze the colors, composition, and artistic style",
    "Describe the setting, location, and context of this scene"
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8 animate-fade-in">
          <h1 className="text-4xl font-bold gradient-text mb-2">
            Handwriting Notes Analyzer
          </h1>
          <p className="text-lg text-gray-600 mb-4">
            Upload an image of your handwriting note and get AI-powered analysis using Gemma3 Vision via Ollama
          </p>
          
          {/* API Status */}
          <div className="flex items-center justify-center space-x-4">
            <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm transition-all ${
              apiStatus === 'online' ? 'bg-green-100 text-green-800 animate-pulse-fast' : 
              apiStatus === 'offline' ? 'bg-red-100 text-red-800' : 
              'bg-gray-100 text-gray-800'
            }`}>
              {apiStatus === 'online' ? <Wifi size={16} /> : <WifiOff size={16} />}
              <span>API Status: {apiStatus}</span>
            </div>
            <button
              onClick={checkApiHealth}
              className="text-blue-600 hover:text-blue-700 text-sm underline transition-colors"
            >
              Check Status
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Upload Section */}
          <div className="xl:col-span-2 bg-white rounded-lg shadow-lg p-6 animate-slide-up">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4 flex items-center">
              <Upload className="mr-2" size={24} />
              Upload & Analyze Notes
            </h2>

            {/* File Upload Area */}
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-all duration-300 ${
                dragActive
                  ? 'border-blue-400 bg-blue-50 drop-zone-active'
                  : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              {preview ? (
                <div className="space-y-4 animate-fade-in">
                  <img
                    src={preview}
                    alt="Preview"
                    className="max-w-full max-h-64 mx-auto rounded-lg shadow-md object-contain"
                  />
                  <div className="text-sm text-gray-600 space-y-1">
                    <p><strong>File:</strong> {selectedFile?.name}</p>
                    <p><strong>Size:</strong> {(selectedFile?.size / 1024 / 1024).toFixed(2)} MB</p>
                    <p><strong>Type:</strong> {selectedFile?.type}</p>
                  </div>
                  <button
                    onClick={clearCurrent}
                    className="text-red-600 hover:text-red-700 text-sm underline transition-colors"
                  >
                    Remove Image
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <Image size={48} className="mx-auto text-gray-400" />
                  <div>
                    <p className="text-lg text-gray-600 mb-2">
                      Drag and drop an image here, or
                    </p>
                    <label className="cursor-pointer bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-4 py-2 rounded-lg transition-all duration-200">
                      Choose File
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleInputChange}
                        className="hidden"
                      />
                    </label>
                  </div>
                  <p className="text-sm text-gray-500">
                    Supports PNG, JPG, JPEG, GIF, WEBP (max 16MB)
                  </p>
                </div>
              )}
            </div>

            {/* Quick Prompt Templates */}
            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Quick Prompt Templates
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {promptTemplates.map((template, index) => (
                  <button
                    key={index}
                    onClick={() => setCustomPrompt(template)}
                    className="text-left p-2 text-sm bg-gray-50 hover:bg-blue-50 hover:border-blue-200 rounded border text-gray-700 transition-all duration-200"
                  >
                    {template}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Prompt */}
            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Analysis Prompt
              </label>
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="Describe what you want to analyze in the image..."
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition-all"
                rows={3}
              />
            </div>

            {/* Analyze Button */}
            <button
              onClick={analyzeImage}
              disabled={!selectedFile || loading || apiStatus === 'offline'}
              className="w-full mt-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-400 text-white py-3 px-6 rounded-lg font-medium transition-all duration-200 flex items-center justify-center"
            >
              {loading ? (
                <>
                  <Loader className="animate-spin mr-2" size={20} />
                  <span className="loading-dots">Analyzing with Gemma3</span>
                </>
              ) : (
                <>
                  <FileText className="mr-2" size={20} />
                  Analyze Image
                </>
              )}
            </button>

            {/* Current Results */}
            <div className="mt-8">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">Analysis Results</h3>
              
              {loading && (
                <div className="flex items-center justify-center py-12 animate-fade-in">
                  <div className="text-center">
                    <Loader className="animate-spin mx-auto mb-4" size={48} />
                    <p className="text-gray-600">Processing with Gemma3 Vision...</p>
                    <p className="text-sm text-gray-500 mt-1">This may take 10-60 seconds depending on your hardware</p>
                  </div>
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start animate-slide-up">
                  <AlertCircle className="text-red-500 mr-3 mt-0.5 flex-shrink-0" size={20} />
                  <div>
                    <h4 className="font-medium text-red-800">Error</h4>
                    <p className="text-red-600 mt-1">{error}</p>
                    {apiStatus === 'offline' && (
                      <div className="mt-2 text-sm text-red-600">
                        <p>Troubleshooting steps:</p>
                        <ul className="list-disc list-inside mt-1 space-y-1">
                          <li>Make sure Node.js server is running: <code className="bg-red-100 px-1 rounded">node server.js</code></li>
                          <li>Install Ollama: <code className="bg-red-100 px-1 rounded">curl -fsSL https://ollama.ai/install.sh | sh</code></li>
                          <li>Download Gemma3: <code className="bg-red-100 px-1 rounded">ollama pull gemma3:4b</code></li>
                          <li>Start Ollama: <code className="bg-red-100 px-1 rounded">ollama serve</code></li>
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {result && (
                <div className="space-y-4 animate-slide-up">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start">
                    <CheckCircle className="text-green-500 mr-3 mt-0.5 flex-shrink-0" size={20} />
                    <div>
                      <h4 className="font-medium text-green-800">Analysis Complete</h4>
                      <p className="text-green-600 mt-1">
                        Processed in {result.processingTime}s • {result.timestamp}
                      </p>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-medium text-gray-800 mb-2">Gemma3 Analysis</h4>
                    <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                      {result.summary}
                    </p>
                  </div>
                </div>
              )}

              {!loading && !error && !result && (
                <div className="flex items-center justify-center py-12 text-gray-500">
                  <div className="text-center">
                    <FileText size={48} className="mx-auto mb-4 opacity-50" />
                    <p>Upload an image and click "Analyze Image" to see results</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* History Sidebar */}
          <div className="bg-white rounded-lg shadow-lg p-6 animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-gray-800 flex items-center">
                <Server className="mr-2" size={20} />
                Recent Analysis
              </h3>
              {history.length > 0 && (
                <button
                  onClick={clearHistory}
                  className="text-red-600 hover:text-red-700 text-sm underline transition-colors"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="space-y-4 max-h-96 overflow-y-auto scrollbar-thin">
              {history.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  No analysis history yet
                </p>
              ) : (
                history.map((item) => (
                  <div key={item.id} className="bg-gray-50 rounded-lg p-3 border hover:shadow-sm transition-shadow">
                    <div className="text-sm text-gray-600 mb-2">
                      <div className="font-medium truncate">{item.filename}</div>
                      <div className="text-xs">{item.timestamp} • {item.processingTime}s</div>
                    </div>
                    <div className="text-sm text-gray-800 mb-2 font-medium">
                      Prompt: {item.prompt}
                    </div>
                    <div className="text-sm text-gray-700">
                      {item.summary.substring(0, 150)}
                      {item.summary.length > 150 && '...'}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Setup Instructions */}
            <div className="mt-6 p-4 bg-blue-50 rounded-lg text-sm">
              <h4 className="font-medium text-blue-800 mb-2">Setup Instructions</h4>
              <div className="text-blue-700 space-y-1">
                <p>1. Install Ollama:</p>
                <code className="block bg-blue-100 p-1 rounded text-xs mb-1">curl -fsSL https://ollama.ai/install.sh | sh</code>
                <p>2. Download Gemma3:</p>
                <code className="block bg-blue-100 p-1 rounded text-xs mb-1">ollama pull gemma3:4b</code>
                <p>3. Start servers:</p>
                <code className="block bg-blue-100 p-1 rounded text-xs">node server.js</code>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageAnalyzer;