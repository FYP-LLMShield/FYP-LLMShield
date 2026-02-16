
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Badge } from '../../components/ui/badge';
import { Progress } from '../../components/ui/progress';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { 
  Shield, 
  Upload, 
  Play, 
  Download, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  Settings,
  FileText,
  Zap,
  Target,
  Brain,
  BookOpen,
  X
} from 'lucide-react';
import { 
  promptInjectionAPI, 
  profileAPI,
  ModelConfig, 
  PromptInjectionTestRequest, 
  PromptInjectionDocumentRequest, 
  PromptInjectionResponse,
  ModelConfigurationResponse,
  ProfileResponse 
} from '../../lib/api';

const PromptInjectionPage = () => {
  // State for prompt testing
  const [prompt, setPrompt] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanResults, setScanResults] = useState(null);
  const [error, setError] = useState('');
  
  // State for file upload
  const [selectedFiles, setSelectedFiles] = useState([]);
  
  // State for RAG simulation
  const [ragVectorStoreFile, setRagVectorStoreFile] = useState(null);
  const [ragQueries, setRagQueries] = useState('');
  const [ragConfig, setRagConfig] = useState({
    top_k: 10,
    similarity_threshold: 0.7,
    rank_shift_threshold: 5,
    variants: 'paraphrase,unicode,homoglyph,trigger',
    enable_model_inference: false
  });
  const [ragResults, setRagResults] = useState(null);
  
  // State for model configuration
  const [modelConfig, setModelConfig] = useState({
    provider: 'openai',
    model_id: 'gpt-3.5-turbo',
    api_key: '',
    endpoint_url: '',
    temperature: 0.7,
    max_tokens: 500
  });
  
  // State for test configuration
  const [testConfig, setTestConfig] = useState({
    probe_categories: ['prompt_injection', 'jailbreak'],
    test_intensity: 'moderate',
    include_document_analysis: false
  });
  
  // State for saved configurations modal
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [savedConfigurations, setSavedConfigurations] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [loadingConfigs, setLoadingConfigs] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState(null);
  
  // Available options
  const [availableCategories, setAvailableCategories] = useState([]);
  const [availableProviders, setAvailableProviders] = useState([]);
  const [systemInfo, setSystemInfo] = useState(null);

  // Load initial data
  useEffect(() => {
    loadSystemInfo();
    loadProbeCategories();
    loadSupportedProviders();
  }, []);

  const loadSystemInfo = async () => {
    try {
      const response = await promptInjectionAPI.getInfo();
      if (response.success) {
        setSystemInfo(response.data);
      }
    } catch (error) {
      console.error('Failed to load system info:', error);
    }
  };

  const loadProbeCategories = async () => {
    try {
      const response = await promptInjectionAPI.getProbeCategories();
      if (response.success) {
        setAvailableCategories(response.data.categories || []);
      }
    } catch (error) {
      console.error('Failed to load probe categories:', error);
      // Fallback categories
      setAvailableCategories(['prompt_injection', 'jailbreak', 'system_prompt_leak', 'data_leakage']);
    }
  };

  const loadSupportedProviders = async () => {
    try {
      const response = await promptInjectionAPI.getSupportedProviders();
      if (response.success) {
        setAvailableProviders(response.data.providers || []);
      }
    } catch (error) {
      console.error('Failed to load supported providers:', error);
      // Fallback providers
      setAvailableProviders(['openai', 'anthropic', 'google', 'custom']);
    }
  };

  // Handle prompt testing
  const startPromptTest = async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt to test');
      return;
    }

    if (!modelConfig.api_key) {
      setError('Please configure your model API key');
      return;
    }

    setIsScanning(true);
    setError('');
    setScanProgress(0);
    setScanResults(null);

    try {
      // Validate model config first
      const validationResponse = await promptInjectionAPI.validateModelConfig(modelConfig);
      if (!validationResponse.success || !validationResponse.data?.valid) {
        throw new Error(validationResponse.data?.message || 'Invalid model configuration');
      }

      // Start the streaming test
      const testRequest = {
        model: {
          name: `${modelConfig.provider} - ${modelConfig.model_id}`,
          provider: modelConfig.provider,
          model_id: modelConfig.model_id,
          api_key: modelConfig.api_key || null,
          base_url: modelConfig.endpoint_url || null,
          temperature: modelConfig.temperature || 0.7,
          max_tokens: modelConfig.max_tokens || 500
        },
        probe_categories: testConfig.probe_categories || ['prompt_injection'],
        custom_prompts: [prompt],
        max_concurrent: 3,
        perturbations: []
      };

      // Get API base URL from environment or use default
      const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8000/api/v1";
      
      // Use fetch with streaming for real-time progress updates
      const token = localStorage.getItem('access_token');
      const headers = {
        'Content-Type': 'application/json'
      };
      
      if (token && token.trim()) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_BASE}/prompt-injection/test-stream`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(testRequest)
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.detail || errorData.message || errorMessage;
        } catch (e) {
          if (errorText) {
            errorMessage = errorText;
          }
        }
        throw new Error(errorMessage);
      }

      if (!response.body) {
        throw new Error('Response body is null. Server may not support streaming.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      // Read the streaming response
      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            // Check if we have any remaining data in buffer
            if (buffer.trim()) {
              const lines = buffer.split('\n');
              for (const line of lines) {
                if (line.trim() && line.startsWith('data: ')) {
                  try {
                    const data = JSON.parse(line.slice(6));
                    if (data.type === 'complete') {
                      setScanProgress(100);
                      setScanResults(data);
                      setIsScanning(false);
                      return;
                    }
                  } catch (parseError) {
                    console.error('Error parsing final data:', parseError);
                  }
                }
              }
            }
            // If we reach here without a complete message, something went wrong
            if (isScanning) {
              throw new Error('Stream ended unexpectedly. The test may have failed on the server.');
            }
            break;
          }
          
          // Decode chunk and add to buffer
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          
          // Keep the last incomplete line in buffer
          buffer = lines.pop() || '';
          
          for (const line of lines) {
            if (line.trim() && line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                
                switch (data.type) {
                  case 'start':
                    console.log('Test started:', data.test_id);
                    break;
                    
                  case 'progress':
                    setScanProgress(Math.round(data.progress || 0));
                    console.log(`Progress: ${Math.round(data.progress || 0)}% (${data.completed_probes || 0}/${data.total_probes || 0})`);
                    break;
                    
                  case 'complete':
                    setScanProgress(100);
                    // Map backend response structure to frontend expected structure
                    const mappedResults = {
                      test_id: data.test_id,
                      timestamp: data.scan_timestamp || new Date().toISOString(),
                      model_info: data.model_info || {},
                      results: {
                        total_probes: data.total_probes || 0,
                        completed_probes: data.completed_probes || 0,
                        violations_found: data.violations_found || 0,
                        successful_injections: data.violations_found || 0,
                        detection_rate: data.total_probes > 0 
                          ? (data.total_probes - (data.violations_found || 0)) / data.total_probes 
                          : 1.0,
                        overall_risk: data.violations_found > 0 
                          ? (data.violations_found / data.total_probes > 0.5 ? 'CRITICAL' : 'HIGH')
                          : 'SAFE'
                      },
                      probe_results: data.results || [],
                      recommendations: data.summary?.recommendations || [],
                      performance_metrics: data.performance_metrics || {},
                      message: data.message
                    };
                    setScanResults(mappedResults);
                    setIsScanning(false);
                    return; // Exit the function
                    
                  case 'error':
                    throw new Error(data.message || 'An error occurred during testing');
                }
              } catch (parseError) {
                console.error('Error parsing event data:', parseError, 'Line:', line);
                // Continue processing other lines
              }
            }
          }
        }
      } catch (streamError) {
        console.error('Stream reading error:', streamError);
        throw new Error(streamError.message || 'Failed to read streaming response');
      } finally {
        reader.releaseLock();
      }

    } catch (error) {
      console.error('Prompt injection test error:', error);
      let errorMessage = error.message || 'An error occurred during testing';
      
      // Provide more helpful error messages
      if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
        errorMessage = 'Failed to connect to server. Please ensure the backend server is running on ' + (process.env.REACT_APP_API_URL || 'http://localhost:8000');
      } else if (error.message?.includes('404') || error.message?.includes('Not Found')) {
        errorMessage = 'Endpoint not found. The test-stream endpoint may not be available. Please check the backend server configuration.';
      } else if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
        errorMessage = 'Authentication failed. Please log in again.';
      } else if (error.message?.includes('500') || error.message?.includes('Internal Server Error')) {
        errorMessage = 'Server error occurred. Please check the backend logs for details.';
      }
      
      setError(errorMessage);
      setScanProgress(0);
      setIsScanning(false);
    }
  };

  // Handle document testing
  const startDocumentTest = async () => {
    if (selectedFiles.length === 0) {
      setError('Please select files to test');
      return;
    }

    if (!modelConfig.api_key) {
      setError('Please configure your model API key');
      return;
    }

    setIsScanning(true);
    setError('');
    setScanProgress(0);
    setScanResults(null);

    try {
      const documentRequest = {
        model_config: modelConfig,
        probe_categories: testConfig.probe_categories,
        test_intensity: testConfig.test_intensity
      };

      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setScanProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + Math.random() * 8;
        });
      }, 800);

      const response = await promptInjectionAPI.testDocuments(selectedFiles, documentRequest);
      
      clearInterval(progressInterval);
      setScanProgress(100);

      if (response.success) {
        setScanResults(response.data);
      } else {
        throw new Error(response.error || 'Document test failed');
      }
    } catch (error) {
      setError(error.message || 'An error occurred during document testing');
      setScanProgress(0);
    } finally {
      setIsScanning(false);
    }
  };

  // Handle file selection
  const handleFileSelect = (event) => {
    const files = Array.from(event.target.files);
    setSelectedFiles(files);
  };

  // Handle RAG vector store file selection
  const handleRagVectorStoreSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      setRagVectorStoreFile(file);
    }
  };

  // Handle RAG simulation test
  const startRagSimulation = async () => {
    if (!ragVectorStoreFile) {
      setError('Please upload a vector store snapshot file');
      return;
    }

    if (!ragQueries.trim()) {
      setError('Please enter at least one query');
      return;
    }

    setIsScanning(true);
    setError('');
    setScanProgress(0);
    setRagResults(null);

    try {
      const response = await promptInjectionAPI.retrievalAttackSimulation(ragVectorStoreFile, {
        queries: ragQueries,
        top_k: ragConfig.top_k,
        similarity_threshold: ragConfig.similarity_threshold,
        rank_shift_threshold: ragConfig.rank_shift_threshold,
        variants: ragConfig.variants,
        enable_model_inference: ragConfig.enable_model_inference
      });

      setScanProgress(100);

      if (response.success) {
        setRagResults(response.data);
      } else {
        throw new Error(response.error || 'RAG simulation failed');
      }
    } catch (error) {
      setError(error.message || 'An error occurred during RAG simulation');
      setScanProgress(0);
    } finally {
      setIsScanning(false);
    }
  };

  // Update RAG config
  const updateRagConfig = (field, value) => {
    setRagConfig(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Handle model config changes
  const updateModelConfig = (field, value) => {
    setModelConfig(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Handle test config changes
  const updateTestConfig = (field, value) => {
    setTestConfig(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Toggle probe category
  const toggleProbeCategory = (category) => {
    setTestConfig(prev => ({
      ...prev,
      probe_categories: prev.probe_categories.includes(category)
        ? prev.probe_categories.filter(c => c !== category)
        : [...prev.probe_categories, category]
    }));
  };

  // Export results
  const exportReport = () => {
    if (!scanResults) return;

    const reportData = {
      test_id: scanResults.test_id,
      timestamp: scanResults.timestamp,
      model_info: scanResults.model_info,
      results: scanResults.results,
      probe_results: scanResults.probe_results,
      recommendations: scanResults.recommendations
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prompt-injection-report-${scanResults.test_id}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Get risk level color
  const getRiskColor = (riskLevel) => {
    switch (riskLevel) {
      case 'CRITICAL': return 'text-red-600 bg-red-50';
      case 'HIGH': return 'text-orange-600 bg-orange-50';
      case 'MEDIUM': return 'text-yellow-600 bg-yellow-50';
      case 'LOW': return 'text-blue-600 bg-blue-50';
      case 'SAFE': return 'text-green-600 bg-green-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  // Handle saved configurations
  const openConfigModal = async () => {
    setLoadingConfigs(true);
    setShowConfigModal(true);
    
    try {
      const profilesResult = await profileAPI.getAllProfiles();
      if (profilesResult.success && profilesResult.data) {
        // Handle both response formats: { profiles: [...] } or direct array
        const profilesList = Array.isArray(profilesResult.data) 
          ? profilesResult.data 
          : (profilesResult.data.profiles || []);
        setProfiles(profilesList);
      } else {
        setProfiles([]); // Ensure profiles is always an array
        console.error('Failed to load profiles:', profilesResult.error || 'Unknown error');
      }
    } catch (error) {
      setProfiles([]); // Ensure profiles is always an array
      console.error('Error loading profiles:', error);
    } finally {
      setLoadingConfigs(false);
    }
  };

  const closeConfigModal = () => {
    setShowConfigModal(false);
    setSelectedProfile(null);
  };

  const loadProfileConfigurations = async (profileId) => {
    setLoadingConfigs(true);
    try {
      const response = await profileAPI.getProfileWithConfigurations(profileId);
      if (response.success && response.data.model_configs) {
        setSavedConfigurations(response.data.model_configs);
        setSelectedProfile(response.data);
      }
    } catch (error) {
      console.error('Failed to load profile configurations:', error);
      setError('Failed to load profile configurations');
    } finally {
      setLoadingConfigs(false);
    }
  };

  const applyConfiguration = (config) => {
    // Map backend configuration to frontend model config format
    setModelConfig({
      provider: config.model_type || 'openai',
      model_id: config.model_name || 'gpt-3.5-turbo',
      api_key: config.credentials?.api_key || '',
      endpoint_url: config.endpoint_config?.url || '',
      temperature: config.parameters?.temperature || 0.7,
      max_tokens: config.parameters?.max_tokens || 500
    });
    
    closeConfigModal();
    
    // Show success message
    setError('');
    // You could add a success toast here if you have a toast system
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="w-8 h-8 text-blue-600" />
            Prompt Injection Testing
          </h1>
          <p className="text-gray-600 mt-1">
            Test your AI models against prompt injection attacks
          </p>
        </div>
        {systemInfo && (
          <Badge variant="outline" className="text-sm">
            {systemInfo.name} v{systemInfo.version}
          </Badge>
        )}
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Configuration Panel */}
        <div className="lg:col-span-1 space-y-4">
          {/* Model Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Model Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Provider</label>
                <Select 
                  value={modelConfig.provider} 
                  onValueChange={(value) => updateModelConfig('provider', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableProviders.map(provider => (
                      <SelectItem key={provider} value={provider}>
                        {provider.charAt(0).toUpperCase() + provider.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Model ID</label>
                <Input
                  value={modelConfig.model_id}
                  onChange={(e) => updateModelConfig('model_id', e.target.value)}
                  placeholder="e.g., gpt-3.5-turbo"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">API Key</label>
                <Input
                  type="password"
                  value={modelConfig.api_key}
                  onChange={(e) => updateModelConfig('api_key', e.target.value)}
                  placeholder="Enter your API key"
                />
              </div>

              {modelConfig.provider === 'custom' && (
                <div>
                  <label className="text-sm font-medium mb-2 block">Endpoint URL</label>
                  <Input
                    value={modelConfig.endpoint_url}
                    onChange={(e) => updateModelConfig('endpoint_url', e.target.value)}
                    placeholder="https://api.example.com/v1/chat"
                  />
                </div>
              )}

              <div>
                <label className="text-sm font-medium mb-2 block">Temperature</label>
                <Input
                  type="number"
                  min="0"
                  max="2"
                  step="0.1"
                  value={modelConfig.temperature}
                  onChange={(e) => updateModelConfig('temperature', parseFloat(e.target.value))}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Max Tokens</label>
                <Input
                  type="number"
                  min="1"
                  max="4000"
                  value={modelConfig.max_tokens}
                  onChange={(e) => updateModelConfig('max_tokens', parseInt(e.target.value))}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2">
                <Button 
                  onClick={openConfigModal}
                  variant="outline" 
                  className="flex-1"
                >
                  <BookOpen className="w-4 h-4 mr-2" />
                  View Saved Configurations
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Test Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5" />
                Test Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Test Intensity</label>
                <Select 
                  value={testConfig.test_intensity} 
                  onValueChange={(value) => updateTestConfig('test_intensity', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="moderate">Moderate</SelectItem>
                    <SelectItem value="aggressive">Aggressive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Probe Categories</label>
                <div className="space-y-2">
                  {availableCategories.map(category => (
                    <div key={category} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={category}
                        checked={testConfig.probe_categories.includes(category)}
                        onChange={() => toggleProbeCategory(category)}
                        className="rounded"
                      />
                      <label htmlFor={category} className="text-sm">
                        {category.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Testing Panel */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="prompt" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="prompt" className="flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Model Injection Testing
              </TabsTrigger>
              <TabsTrigger value="documents" className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Document Scan
              </TabsTrigger>
              <TabsTrigger value="rag" className="flex items-center gap-2">
                <Target className="w-4 h-4" />
                RAG Simulation
              </TabsTrigger>
            </TabsList>

            <TabsContent value="prompt" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Test a Prompt</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Enter your prompt:</label>
                    <Textarea
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder="Type your prompt here to test for injection vulnerabilities..."
                      className="min-h-[120px] bg-white text-black placeholder:text-gray-500 border-slate-700"
                      style={{ color: '#000000' }}
                    />
                  </div>
                  
                  <Button 
                    onClick={startPromptTest} 
                    disabled={isScanning || !prompt.trim() || !modelConfig.api_key}
                    className="w-full"
                  >
                    {isScanning ? (
                      <>
                        <Zap className="w-4 h-4 mr-2 animate-spin" />
                        Testing...
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 mr-2" />
                        Start Test
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="documents" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Test Documents</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Select files to test:</label>
                    <Input
                      type="file"
                      multiple
                      onChange={handleFileSelect}
                      accept=".txt,.pdf,.docx,.md"
                      className="cursor-pointer"
                    />
                    {selectedFiles.length > 0 && (
                      <div className="mt-2">
                        <p className="text-sm text-gray-600">
                          {selectedFiles.length} file(s) selected:
                        </p>
                        <ul className="text-xs text-gray-500 mt-1">
                          {selectedFiles.map((file, index) => (
                            <li key={index}>{file.name}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  
                  <Button 
                    onClick={startDocumentTest} 
                    disabled={isScanning || selectedFiles.length === 0 || !modelConfig.api_key}
                    className="w-full"
                  >
                    {isScanning ? (
                      <>
                        <Zap className="w-4 h-4 mr-2 animate-spin" />
                        Testing...
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 mr-2" />
                        Start Document Test
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="rag" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="w-5 h-5" />
                    RAG Retrieval Injection Simulation
                  </CardTitle>
                  <p className="text-sm text-gray-600 mt-1">
                    Simulate retrieval and inference to detect combined injection paths
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Vector Store Upload */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">Vector Store Snapshot (JSON)</label>
                    <Input
                      type="file"
                      accept=".json"
                      onChange={handleRagVectorStoreSelect}
                      className="cursor-pointer"
                    />
                    {ragVectorStoreFile && (
                      <div className="mt-2">
                        <p className="text-sm text-gray-600">
                          Selected: {ragVectorStoreFile.name}
                        </p>
                      </div>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      Upload a JSON file containing vector store snapshot with embeddings and metadata
                    </p>
                  </div>

                  {/* Queries Input */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">Test Queries (one per line)</label>
                    <Textarea
                      value={ragQueries}
                      onChange={(e) => setRagQueries(e.target.value)}
                      placeholder="Enter test queries, one per line...&#10;Example:&#10;What is machine learning?&#10;How does neural network work?"
                      className="min-h-[120px] bg-white text-black placeholder:text-gray-500 border-slate-700"
                      style={{ color: '#000000' }}
                    />
                  </div>

                  {/* Configuration */}
                  <div className="space-y-3 border-t pt-4">
                    <h4 className="text-sm font-semibold">Simulation Configuration</h4>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium mb-2 block">Top K</label>
                        <Input
                          type="number"
                          min="1"
                          max="50"
                          value={ragConfig.top_k}
                          onChange={(e) => updateRagConfig('top_k', parseInt(e.target.value))}
                        />
                      </div>

                      <div>
                        <label className="text-sm font-medium mb-2 block">Similarity Threshold</label>
                        <Input
                          type="number"
                          min="0"
                          max="1"
                          step="0.1"
                          value={ragConfig.similarity_threshold}
                          onChange={(e) => updateRagConfig('similarity_threshold', parseFloat(e.target.value))}
                        />
                      </div>

                      <div>
                        <label className="text-sm font-medium mb-2 block">Rank Shift Threshold</label>
                        <Input
                          type="number"
                          min="1"
                          max="20"
                          value={ragConfig.rank_shift_threshold}
                          onChange={(e) => updateRagConfig('rank_shift_threshold', parseInt(e.target.value))}
                        />
                      </div>

                      <div>
                        <label className="text-sm font-medium mb-2 block">Variant Types</label>
                        <Input
                          value={ragConfig.variants}
                          onChange={(e) => updateRagConfig('variants', e.target.value)}
                          placeholder="paraphrase,unicode,homoglyph,trigger"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Comma-separated: paraphrase, unicode, homoglyph, trigger, leetspeak
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="enable_model_inference"
                        checked={ragConfig.enable_model_inference}
                        onChange={(e) => updateRagConfig('enable_model_inference', e.target.checked)}
                        className="rounded"
                      />
                      <label htmlFor="enable_model_inference" className="text-sm">
                        Enable Model Inference (analyze behavioral impact)
                      </label>
                    </div>
                  </div>
                  
                  <Button 
                    onClick={startRagSimulation} 
                    disabled={isScanning || !ragVectorStoreFile || !ragQueries.trim()}
                    className="w-full"
                  >
                    {isScanning ? (
                      <>
                        <Zap className="w-4 h-4 mr-2 animate-spin" />
                        Running Simulation...
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 mr-2" />
                        Start RAG Simulation
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Progress */}
          {isScanning && (
            <Card className="mt-4">
              <CardContent className="pt-6">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Testing in progress...</span>
                    <span>{Math.round(scanProgress)}%</span>
                  </div>
                  <Progress value={scanProgress} className="w-full" />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Results */}
          {scanResults && (
            <Card className="mt-4">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="w-5 h-5" />
                    Test Results
                  </CardTitle>
                  <Button onClick={exportReport} variant="outline" size="sm">
                    <Download className="w-4 h-4 mr-2" />
                    Export Report
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold">{scanResults.results?.total_probes || 0}</div>
                    <div className="text-sm text-gray-600">Total Probes</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">
                      {scanResults.results?.successful_injections || 0}
                    </div>
                    <div className="text-sm text-gray-600">Successful Injections</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {Math.round((scanResults.results?.detection_rate || 0) * 100)}%
                    </div>
                    <div className="text-sm text-gray-600">Detection Rate</div>
                  </div>
                  <div className="text-center">
                    <Badge className={getRiskColor(scanResults.results?.overall_risk || 'SAFE')}>
                      {scanResults.results?.overall_risk || 'SAFE'}
                    </Badge>
                  </div>
                </div>

                {/* Probe Results */}
                {scanResults.probe_results && scanResults.probe_results.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2">Probe Results</h4>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {scanResults.probe_results.map((probe, index) => (
                        <div key={index} className="border rounded p-3 text-sm">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium">{probe.technique}</span>
                            <div className="flex items-center gap-2">
                              <Badge className={getRiskColor(probe.risk_level)}>
                                {probe.risk_level}
                              </Badge>
                              {probe.detected ? (
                                <CheckCircle className="w-4 h-4 text-green-600" />
                              ) : (
                                <XCircle className="w-4 h-4 text-red-600" />
                              )}
                            </div>
                          </div>
                          <p className="text-gray-600 text-xs">{probe.explanation}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recommendations */}
                {scanResults.recommendations && scanResults.recommendations.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2">Recommendations</h4>
                    <ul className="space-y-1 text-sm">
                      {scanResults.recommendations.map((rec, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* RAG Simulation Results */}
          {ragResults && (
            <Card className="mt-4">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Target className="w-5 h-5" />
                    RAG Simulation Results
                  </CardTitle>
                  <Button 
                    onClick={() => {
                      const blob = new Blob([JSON.stringify(ragResults, null, 2)], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `rag-simulation-${ragResults.scan_id}.json`;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                    }} 
                    variant="outline" 
                    size="sm"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export Report
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Summary Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold">{ragResults.total_queries || 0}</div>
                    <div className="text-sm text-gray-600">Total Queries</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {ragResults.successful_queries || 0}
                    </div>
                    <div className="text-sm text-gray-600">Successful</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">
                      {Math.round((ragResults.attack_success_rate || 0) * 100)}%
                    </div>
                    <div className="text-sm text-gray-600">Attack Success Rate</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {ragResults.findings?.length || 0}
                    </div>
                    <div className="text-sm text-gray-600">Findings</div>
                  </div>
                </div>

                {/* Findings */}
                {ragResults.findings && ragResults.findings.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2">Retrieval Manipulation Findings</h4>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {ragResults.findings.map((finding, index) => (
                        <div key={index} className="border rounded p-3 text-sm">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <span className="font-medium">{finding.variant_type}</span>
                              <Badge variant="outline" className="ml-2 text-xs">
                                {finding.confidence > 0.7 ? 'HIGH' : finding.confidence > 0.4 ? 'MEDIUM' : 'LOW'}
                              </Badge>
                            </div>
                            {finding.rank_shift > 0 ? (
                              <AlertTriangle className="w-4 h-4 text-orange-600" />
                            ) : (
                              <CheckCircle className="w-4 h-4 text-green-600" />
                            )}
                          </div>
                          <div className="space-y-1 text-xs text-gray-600">
                            <p><strong>Query:</strong> {finding.query}</p>
                            <p><strong>Variant:</strong> {finding.variant_query}</p>
                            <p><strong>Target Vector:</strong> {finding.target_vector_id}</p>
                            <p><strong>Rank Shift:</strong> {finding.baseline_rank !== null ? `${finding.baseline_rank + 1} → ${finding.adversarial_rank + 1}` : `New entry at ${finding.adversarial_rank + 1}`}</p>
                            <p><strong>Similarity:</strong> {finding.similarity_score.toFixed(3)}</p>
                            <p className="text-gray-700 mt-1">{finding.description}</p>
                            <p className="text-blue-600 mt-1"><strong>Action:</strong> {finding.recommended_action}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Behavioral Impacts */}
                {ragResults.behavioral_impacts && ragResults.behavioral_impacts.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2">Behavioral Impact Analysis</h4>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {ragResults.behavioral_impacts.map((impact, index) => (
                        <div key={index} className="border rounded p-3 text-sm">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium">{impact.query}</span>
                            <div className="flex items-center gap-2">
                              {impact.policy_violation && (
                                <Badge className="bg-red-100 text-red-800">Policy Violation</Badge>
                              )}
                              {impact.pii_detected && (
                                <Badge className="bg-orange-100 text-orange-800">PII Detected</Badge>
                              )}
                            </div>
                          </div>
                          <div className="space-y-1 text-xs text-gray-600">
                            <p><strong>Toxicity Score:</strong> {impact.toxicity_score.toFixed(2)}</p>
                            <p><strong>Topic Flip:</strong> {impact.topic_flip ? 'Yes' : 'No'}</p>
                            <p className="text-gray-700 mt-1 line-clamp-2">{impact.model_response}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Query Summaries */}
                {ragResults.query_summaries && ragResults.query_summaries.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2">Query Summaries</h4>
                    <div className="space-y-2">
                      {ragResults.query_summaries.map((summary, index) => (
                        <div key={index} className="border rounded p-2 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{summary.query}</span>
                            <div className="flex items-center gap-2">
                              <Badge variant={summary.status === 'success' ? 'default' : 'destructive'}>
                                {summary.status}
                              </Badge>
                              {summary.findings_count > 0 && (
                                <Badge variant="outline">{summary.findings_count} findings</Badge>
                              )}
                            </div>
                          </div>
                          {summary.error_message && (
                            <p className="text-red-600 text-xs mt-1">{summary.error_message}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recommendations */}
                {ragResults.recommendations && ragResults.recommendations.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2">Recommendations</h4>
                    <ul className="space-y-1 text-sm">
                      {ragResults.recommendations.map((rec, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Saved Configurations Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                Saved Configurations
              </h2>
              <Button onClick={closeConfigModal} variant="ghost" size="sm">
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              {loadingConfigs ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <span className="ml-2">Loading configurations...</span>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Profile Selection */}
                  {profiles.length > 0 && (
                    <div>
                      <h3 className="text-lg font-medium mb-3">Select Profile</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {profiles.map((profile) => (
                          <Card 
                            key={profile.id} 
                            className={`cursor-pointer transition-all hover:shadow-md ${
                              selectedProfile?.id === profile.id ? 'ring-2 ring-blue-500' : ''
                            }`}
                            onClick={() => loadProfileConfigurations(profile.id)}
                          >
                            <CardContent className="p-4">
                              <div className="flex items-center justify-between">
                                <div>
                                  <h4 className="font-medium">{profile.name || `Profile ${profile.id}`}</h4>
                                  <p className="text-sm text-gray-600">
                                    {profile.model_config_ids?.length || 0} configurations
                                  </p>
                                </div>
                                {selectedProfile?.id === profile.id && (
                                  <CheckCircle className="w-5 h-5 text-blue-600" />
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Configurations List */}
                  <div>
                    <h3 className="text-lg font-medium mb-3">
                      {selectedProfile ? `Configurations for ${selectedProfile.name || 'Selected Profile'}` : 'All Configurations'}
                    </h3>
                    
                    {savedConfigurations.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>No saved configurations found</p>
                        <p className="text-sm">Create configurations to see them here</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {savedConfigurations.map((config) => (
                          <Card key={config.id} className="hover:shadow-md transition-shadow">
                            <CardContent className="p-4">
                              <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                  <h4 className="font-medium">{config.config_name || config.model_name}</h4>
                                  <Badge variant="outline" className="text-xs">
                                    {config.model_type || 'Unknown'}
                                  </Badge>
                                </div>
                                
                                <div className="space-y-2 text-sm text-gray-600">
                                  <div className="flex justify-between">
                                    <span>Model:</span>
                                    <span className="font-medium">{config.model_name}</span>
                                  </div>
                                  {config.parameters?.temperature && (
                                    <div className="flex justify-between">
                                      <span>Temperature:</span>
                                      <span>{config.parameters.temperature}</span>
                                    </div>
                                  )}
                                  {config.parameters?.max_tokens && (
                                    <div className="flex justify-between">
                                      <span>Max Tokens:</span>
                                      <span>{config.parameters.max_tokens}</span>
                                    </div>
                                  )}
                                  {config.endpoint_config?.url && (
                                    <div className="flex justify-between">
                                      <span>Endpoint:</span>
                                      <span className="truncate max-w-32" title={config.endpoint_config.url}>
                                        {config.endpoint_config.url}
                                      </span>
                                    </div>
                                  )}
                                  <div className="flex justify-between">
                                    <span>Status:</span>
                                    <Badge 
                                      variant={config.status === 'active' ? 'default' : 'secondary'}
                                      className="text-xs"
                                    >
                                      {config.status || 'Unknown'}
                                    </Badge>
                                  </div>
                                </div>
                                
                                <Button 
                                  onClick={() => applyConfiguration(config)}
                                  className="w-full"
                                  size="sm"
                                >
                                  Apply Configuration
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PromptInjectionPage;