
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
          api_key: modelConfig.api_key,
          base_url: modelConfig.endpoint_url,
          temperature: modelConfig.temperature,
          max_tokens: modelConfig.max_tokens
        },
        probe_categories: testConfig.probe_categories,
        custom_prompts: [prompt]
      };

      // Use fetch with streaming for real-time progress updates
      const response = await fetch('/api/prompt-injection/test-stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(testRequest)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      // Read the streaming response
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              switch (data.type) {
                case 'start':
                  console.log('Test started:', data.test_id);
                  break;
                  
                case 'progress':
                  setScanProgress(Math.round(data.progress));
                  console.log(`Progress: ${Math.round(data.progress)}% (${data.completed_probes}/${data.total_probes})`);
                  break;
                  
                case 'complete':
                  setScanProgress(100);
                  setScanResults(data);
                  setIsScanning(false);
                  return; // Exit the function
                  
                case 'error':
                  throw new Error(data.message);
              }
            } catch (parseError) {
              console.error('Error parsing event data:', parseError);
            }
          }
        }
      }

    } catch (error) {
      setError(error.message || 'An error occurred during testing');
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
      if (profilesResult.success) {
        setProfiles(profilesResult.data.profiles);
      } else {
        console.error('Failed to load profiles:', profilesResult.error);
      }
    } catch (error) {
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
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="prompt" className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Prompt Testing
              </TabsTrigger>
              <TabsTrigger value="documents" className="flex items-center gap-2">
                <Upload className="w-4 h-4" />
                Document Testing
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
                      className="min-h-[120px]"
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