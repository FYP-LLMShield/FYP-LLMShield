// API Configuration and Client Setup
import JSZip from 'jszip';
const API_BASE_URL = 'http://localhost:8000/api/v1';

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// Auth Types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  full_name: string;
}

export interface GoogleSignInRequest {
  id_token: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  new_password: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: {
    id: string;
    email: string;
    full_name: string;
    is_verified: boolean;
    profile_picture?: string;
  };
  is_new_user?: boolean;
}

// MFA Types
export interface MFAStatusResponse {
  mfa_enabled: boolean;
  setup_complete: boolean;
  recovery_codes_remaining: number;
}

export interface MFASetupResponse {
  qr_code: string;
  secret: string;
  backup_url: string;
  recovery_codes: string[];
}

export interface MFASetupRequest {
  totp_code: string;
}

export interface MFAVerifyRequest {
  totp_code: string;
}

export interface MFADisableRequest {
  current_password: string;
  totp_code: string;
}

// Scanner Types
export interface TextScanRequest {
  content: string;
  filename?: string;
  scan_types: string[]; // Changed to required to match backend
  use_cache?: boolean;
}

export interface FileScanRequest {
  files: File[];
  scan_types: string[];
}

export interface RepoScanRequest {
  repo_url: string;
  branch?: string;
  subdir?: string;
  token?: string;
  scan_types: string[];
  use_cache?: boolean;
  max_file_size_mb?: number;
  max_files?: number;
}

// Prompt Injection Types
export interface ModelConfig {
  provider: 'openai' | 'anthropic' | 'google' | 'custom' | string;
  model_id: string;
  api_key: string | null;
  base_url?: string;
  name?: string;
  endpoint_url?: string;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
}

export interface PromptInjectionTestRequest {
  prompt: string;
  model_config: ModelConfig;
  probe_categories?: string[];
  test_intensity?: 'light' | 'moderate' | 'aggressive';
  include_document_analysis?: boolean;
}

export interface PromptInjectionDocumentRequest {
  model_config: ModelConfig;
  probe_categories?: string[];
  test_intensity?: 'light' | 'moderate' | 'aggressive';
}

export interface ProbeResult {
  probe_id: string;
  category: string;
  technique: string;
  prompt: string;
  response: string;
  detected: boolean;
  confidence: number;
  risk_level: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'SAFE';
  explanation: string;
  timestamp: string;
}

export interface PromptInjectionResponse {
  test_id: string;
  timestamp: string;
  model_info: {
    provider: string;
    model_id: string;
  };
  test_config: {
    probe_categories: string[];
    test_intensity: string;
    total_probes: number;
  };
  results: {
    total_probes: number;
    successful_injections: number;
    detection_rate: number;
    risk_score: number;
    overall_risk: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'SAFE';
  };
  probe_results: ProbeResult[];
  recommendations: string[];
  document_analysis?: {
    files_processed: number;
    vulnerabilities_found: number;
    risk_assessment: string;
  };
}

// Enhanced response models matching backend
export interface ExecutiveSummary {
  risk_level: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'SAFE';
  risk_emoji: string;
  top_risks: string[];
  compliance_concerns: string[];
}

export interface SeverityDistribution {
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
}

export interface CategoryBreakdown {
  secrets: number;
  cpp_vulnerabilities: number;
}

export interface AffectedFile {
  file_path: string;
  filename?: string;
  issue_count: number;
  critical_count: number;
  high_count: number;
  lines_affected?: number[];
}

export interface RiskMatrix {
  [category: string]: {
    [severity: string]: number;
  };
}

export interface ScanResponse {
  scan_id: string;
  timestamp: string;
  method: string;
  scan_types: string[];
  findings: Finding[];
  executive_summary: ExecutiveSummary;
  severity_distribution: SeverityDistribution;
  category_breakdown: CategoryBreakdown;
  critical_findings: Finding[];
  most_affected_files: AffectedFile[];
  risk_matrix: RiskMatrix;
  recommendations: string[];
  next_steps: string[];
  stats: {
    total_files?: number;
    total_lines?: number;
    files_scanned?: number;
    lines_scanned?: number;
    scan_duration_ms?: number;
    files_skipped?: number;
    is_binary?: boolean;
    [key: string]: any;
  };
}

export interface Finding {
  id: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low' | 'Info';
  severity_score: number;
  severity_emoji: string;
  type: string;
  file: string;
  line: number;
  column: number;
  message: string;
  code_snippet: string;
  snippet?: string;
  evidence: string;
  remediation: string;
  cwe: string;
  confidence_score: number;
  confidence_label: 'Very High' | 'High' | 'Medium' | 'Low' | 'Uncertain';
  priority_rank: number;
}

// Generic API Client
class ApiClient {
  private baseURL: string;
  private token: string | null = null;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
    this.token = localStorage.getItem('access_token');
    console.log('API Client initialized with token:', this.token ? 'Present' : 'Missing');
  }

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    return headers;
  }

  private async handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
    try {
      const data = await response.json();
      
      if (!response.ok) {
        // Handle different error formats from the backend
        let errorMessage = 'An error occurred';
        
        if (data.detail) {
          // Handle FastAPI validation errors and other detailed errors
          if (typeof data.detail === 'string') {
            errorMessage = data.detail;
          } else if (Array.isArray(data.detail)) {
            // Handle validation error arrays
            errorMessage = data.detail.map((err: any) => {
              if (typeof err === 'string') return err;
              if (err.msg) return err.msg;
              if (err.message) return err.message;
              return 'Validation error';
            }).join(', ');
          } else if (typeof data.detail === 'object') {
            // Handle error objects with msg, message, or other fields
            errorMessage = data.detail.msg || data.detail.message || data.detail.error || 'Validation error';
          }
        } else if (data.message) {
          errorMessage = typeof data.message === 'string' ? data.message : 'Server error';
        } else if (data.error) {
          errorMessage = typeof data.error === 'string' ? data.error : 'Server error';
        }
        
        return {
          success: false,
          error: errorMessage,
        };
      }

      return {
        success: true,
        data,
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to parse response',
      };
    }
  }

  async get<T>(endpoint: string, options: any = {}): Promise<ApiResponse<T>> {
    try {
      const controller = new AbortController();
      const { timeoutMs, ...fetchOptions } = options || {};
      const timeout = typeof timeoutMs === 'number' ? timeoutMs : 30000; // default 30s
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method: 'GET',
        headers: this.getHeaders(),
        signal: controller.signal,
        ...fetchOptions
      });

      clearTimeout(timeoutId);
      return this.handleResponse<T>(response);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          success: false,
          error: 'Request timeout - please try again',
        };
      }
      return {
        success: false,
        error: 'Network error occurred',
      };
    }
  }

  async post<T>(endpoint: string, data?: any, options: any = {}): Promise<ApiResponse<T>> {
    try {
      const controller = new AbortController();
      // Use longer timeout for prompt injection tests (2 minutes)
      const timeout = endpoint.includes('/prompt-injection/test') ? 120000 : 30000;
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: data ? JSON.stringify(data) : undefined,
        signal: controller.signal,
        ...options
      });

      clearTimeout(timeoutId);

      // Handle blob response for PDF downloads
      if (options.responseType === 'blob') {
        if (response.ok) {
          const blob = await response.blob();
          return {
            success: true,
            data: blob as any as T,
          };
        } else {
          const errorText = await response.text();
          return {
            success: false,
            error: errorText || 'Failed to download PDF',
          };
        }
      }

      return this.handleResponse<T>(response);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          success: false,
          error: 'Request timeout - please try again',
        };
      }
      return {
        success: false,
        error: 'Network error occurred',
      };
    }
  }

  async postFormData<T>(endpoint: string, formData: FormData, options: any = {}): Promise<ApiResponse<T>> {
    try {
      const controller = new AbortController();
      const timeout = endpoint.includes('/prompt-injection/test') ? 120000 : 30000;
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const headers: HeadersInit = {};
      if (this.token) {
        headers['Authorization'] = `Bearer ${this.token}`;
      }

      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method: 'POST',
        headers,
        body: formData,
        signal: controller.signal,
        ...options
      });

      clearTimeout(timeoutId);

      // Handle blob response for PDF downloads
      if (options.responseType === 'blob') {
        if (response.ok) {
          const blob = await response.blob();
          return {
            success: true,
            data: blob as unknown as T,
          };
        } else {
          const errorText = await response.text();
          return {
            success: false,
            error: errorText || 'Failed to download PDF',
          };
        }
      }

      return this.handleResponse<T>(response);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          success: false,
          error: 'Request timeout - please try again',
        };
      }
      return {
        success: false,
        error: 'Network error occurred',
      };
    }
  }

  setToken(token: string) {
    this.token = token;
    localStorage.setItem('access_token', token);
    console.log('API Client token updated:', token ? 'Present' : 'Missing');
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('access_token');
  }
}

// Create API client instance
const apiClient = new ApiClient(API_BASE_URL);

// Auth API Functions
export const authAPI = {
  async login(credentials: LoginRequest): Promise<ApiResponse<AuthResponse>> {
    const formData = new FormData();
    // The backend expects 'username' but your interface uses 'email'
    formData.append('username', credentials.email);
    formData.append('password', credentials.password);
    
    const response = await apiClient.postFormData<AuthResponse>('/auth/login', formData);
    
    if (response.success && response.data) {
      apiClient.setToken(response.data.access_token);
    }
    
    return response;
  },

  async register(userData: RegisterRequest): Promise<ApiResponse<AuthResponse>> {
    return apiClient.post<AuthResponse>('/auth/register', userData);
  },

  async googleSignIn(request: GoogleSignInRequest): Promise<ApiResponse<AuthResponse>> {
    const response = await apiClient.post<AuthResponse>('/auth/google-signin', request);
    
    if (response.success && response.data) {
      apiClient.setToken(response.data.access_token);
    }
    
    return response;
  },

  async forgotPassword(request: ForgotPasswordRequest): Promise<ApiResponse<{ message: string; success: boolean }>> {
    return apiClient.post('/auth/forgot-password', request);
  },

  async resetPassword(request: ResetPasswordRequest): Promise<ApiResponse<{ message: string; success: boolean }>> {
    return apiClient.post('/auth/reset-password', request);
  },

  async getCurrentUser(): Promise<ApiResponse<any>> {
    return apiClient.get('/auth/me');
  },

  setToken(token: string) {
    apiClient.setToken(token);
  },

  logout() {
    apiClient.clearToken();
  },
};

// MFA API Functions
export const mfaAPI = {
  async getStatus(): Promise<ApiResponse<MFAStatusResponse>> {
    return apiClient.get<MFAStatusResponse>('/auth/mfa/status');
  },

  async initiateSetup(): Promise<ApiResponse<MFASetupResponse>> {
    return apiClient.post<MFASetupResponse>('/auth/mfa/setup/initiate');
  },

  async completeSetup(request: MFASetupRequest): Promise<ApiResponse<{ message: string; mfa_enabled: boolean }>> {
    return apiClient.post('/auth/mfa/setup/complete', request);
  },

  async verifyCode(request: MFAVerifyRequest): Promise<ApiResponse<{ message: string; verified: boolean }>> {
    return apiClient.post('/auth/mfa/verify', request);
  },

  async disable(request: MFADisableRequest): Promise<ApiResponse<{ message: string; mfa_enabled: boolean }>> {
    return apiClient.post('/auth/mfa/disable', request);
  },

  async regenerateRecoveryCodes(): Promise<ApiResponse<{ message: string; recovery_codes: string[]; warning: string }>> {
    return apiClient.post('/auth/mfa/recovery/regenerate');
  },
};

// Scanner API Functions
export const scannerAPI = {
  async scanText(request: TextScanRequest): Promise<ApiResponse<ScanResponse>> {
    return apiClient.post<ScanResponse>('/scan/text', request);
  },

  async getTextScanPDF(request: TextScanRequest): Promise<ApiResponse<Blob>> {
    const response = await apiClient.post<Blob>('/scan/text/pdf', request, {
      responseType: 'blob'
    });
    return response;
  },

  async uploadFiles(
    files: File[], 
    scanTypes: string[] = ["secrets", "cpp_vulns"],
    useCache: boolean = true,
    maxFileSize: number = 10,
    maxFiles: number = 100
  ): Promise<ApiResponse<ScanResponse>> {
    // If there are multiple files, we need to handle them one by one or create a zip
    if (files.length === 0) {
      return {
        success: false,
        error: "No files selected"
      };
    }
    
    try {
      const formData = new FormData();
      
      // If there's only one file, send it directly
      if (files.length === 1) {
        formData.append('file', files[0]);
      } else {
        // For multiple files, create a zip file
        const zip = new JSZip();
        
        // Add all files to the zip
        for (const file of files) {
          // Read the file content
          const content = await new Promise<ArrayBuffer>((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target?.result as ArrayBuffer);
            reader.readAsArrayBuffer(file);
          });
          
          // Add file to zip with its name
          zip.file(file.name, content);
        }
        
        // Generate the zip file
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        
        // Create a File object from the zip blob
        const zipFile = new File([zipBlob], 'scan_files.zip', { type: 'application/zip' });
        
        // Append the zip file to formData
        formData.append('file', zipFile);
      }
      
      // Add scan types to form data
      formData.append('scan_types', JSON.stringify(scanTypes));
      
      // Add additional parameters
      formData.append('use_cache', String(useCache));
      formData.append('max_file_size_mb', String(maxFileSize));
      formData.append('max_files', String(maxFiles));
      
      return apiClient.postFormData<ScanResponse>('/scan/upload', formData);
    } catch (error) {
      return {
        success: false,
        error: `File upload failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  },

  async getUploadScanPDF(files: File[], scanTypes: string[] = ["secrets", "cpp_vulns"]): Promise<ApiResponse<Blob>> {
    try {
      const formData = new FormData();
      
      if (files.length === 1) {
        formData.append('file', files[0]);
      } else {
        const zip = new JSZip();
        
        for (const file of files) {
          const content = await new Promise<ArrayBuffer>((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target?.result as ArrayBuffer);
            reader.readAsArrayBuffer(file);
          });
          
          zip.file(file.name, content);
        }
        
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const zipFile = new File([zipBlob], 'scan_files.zip', { type: 'application/zip' });
        formData.append('file', zipFile);
      }
      
      formData.append('scan_types', JSON.stringify(scanTypes));
      
      const response = await apiClient.postFormData<Blob>('/scan/upload/pdf', formData, {
        responseType: 'blob'
      });
      return response;
    } catch (error) {
      return {
        success: false,
        error: `PDF generation failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  },

  async scanRepository(request: RepoScanRequest): Promise<ApiResponse<ScanResponse>> {
    return apiClient.post<ScanResponse>('/scan/github', request);
  },

  async getRepositoryScanPDF(request: RepoScanRequest): Promise<ApiResponse<Blob>> {
    const response = await apiClient.post<Blob>('/scan/github/pdf', request, {
      responseType: 'blob'
    });
    return response;
  },

  async clearCache(): Promise<ApiResponse<any>> {
    return apiClient.get('/scan/cache/clear');
  },

  async getCacheStats(): Promise<ApiResponse<any>> {
    return apiClient.get('/scanner/cache/stats');
  },

  async getHealth(): Promise<ApiResponse<any>> {
    return apiClient.get('/scanner/health');
  },
};

// Prompt Injection API Functions
export const promptInjectionAPI = {
  async getInfo(): Promise<ApiResponse<any>> {
    return apiClient.get('/prompt-injection/');
  },

  async getHealth(): Promise<ApiResponse<any>> {
    return apiClient.get('/prompt-injection/health');
  },

  async testPrompt(request: PromptInjectionTestRequest): Promise<ApiResponse<PromptInjectionResponse>> {
    return apiClient.post<PromptInjectionResponse>('/prompt-injection/test', request);
  },

  async testDocuments(files: File[], request: PromptInjectionDocumentRequest): Promise<ApiResponse<PromptInjectionResponse>> {
    try {
      const formData = new FormData();
      
      // Add files to form data
      files.forEach((file, index) => {
        formData.append('files', file);
      });
      
      // Add model config and other parameters
      formData.append('model_config', JSON.stringify(request.model_config));
      
      if (request.probe_categories) {
        formData.append('probe_categories', JSON.stringify(request.probe_categories));
      }
      
      if (request.test_intensity) {
        formData.append('test_intensity', request.test_intensity);
      }
      
      return apiClient.postFormData<PromptInjectionResponse>('/prompt-injection/test-documents', formData);
    } catch (error) {
      return {
        success: false,
        error: `Document test failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  },

  async getProbeCategories(): Promise<ApiResponse<{ categories: string[] }>> {
    return apiClient.get('/prompt-injection/probe-categories');
  },

  async getSupportedProviders(): Promise<ApiResponse<{ providers: string[] }>> {
    return apiClient.get('/prompt-injection/providers');
  },

  async validateModelConfig(modelConfig: any): Promise<ApiResponse<{ valid: boolean; connected: boolean; errors?: string[]; warnings?: string[]; response_time_ms?: number; metadata?: any }>> {
    return apiClient.post('/prompt-injection/validate-model', modelConfig);
  },

  async getTestResults(testId: string): Promise<ApiResponse<PromptInjectionResponse>> {
    return apiClient.get(`/prompt-injection/test-results/${testId}`);
  },

  // Streaming test endpoint for real-time progress updates
  async testPromptStream(request: PromptInjectionTestRequest): Promise<EventSource> {
    const token = localStorage.getItem('access_token');
    const headers: Record<string, string> = {};
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Create EventSource for streaming
    const eventSource = new EventSource(`${API_BASE_URL}/prompt-injection/test-stream`, {
      // Note: EventSource doesn't support custom headers or POST data directly
      // This would need to be implemented differently, possibly using fetch with streaming
    });

    return eventSource;
  },

  // Document scanning endpoint for uploaded files
  async scanDocument(file: File): Promise<ApiResponse<any>> {
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const response = await apiClient.post('/prompt-injection/scan-document', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      return response;
    } catch (error) {
      return {
        success: false,
        error: `Document scan failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  },

  // Export test results as PDF
  async exportPDF(testId: string, payload?: any): Promise<ApiResponse<Blob>> {
    try {
      const response = await apiClient.post(`/prompt-injection/export/pdf/${testId}`, payload || {}, {
        responseType: 'blob'
      });
      return {
        success: true,
        data: response.data as Blob
      };
    } catch (error) {
      return {
        success: false,
        error: `PDF export failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  },

  // Export test results as JSON
  async exportJSON(testId: string, payload?: any): Promise<ApiResponse<any>> {
    try {
      const response = await apiClient.post(`/prompt-injection/export/json/${testId}`, payload || {});
      return response;
    } catch (error) {
      return {
        success: false,
        error: `JSON export failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  },
};

// Scan History API Functions
export const scanHistoryAPI = {
  async getHistory(
    page: number = 1,
    limit: number = 20,
    inputType?: string,
    startDate?: string,
    endDate?: string
  ): Promise<ApiResponse<{
    scans: Array<{
      id: string;
      scan_id: string;
      input_type: string;
      input_size: number;
      scan_duration: number;
      findings_count: number;
      high_risk_count: number;
      medium_risk_count: number;
      low_risk_count: number;
      created_at: string;
    }>;
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  }>> {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });
    
    if (inputType) params.append('input_type', inputType);
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    
    return apiClient.get(`/scan-history?${params.toString()}`);
  },

  async getHistoryDetail(scanId: string): Promise<ApiResponse<{
    id: string;
    scan_id: string;
    user_id: string;
    input_type: string;
    input_size: number;
    scan_duration: number;
    findings_count: number;
    high_risk_count: number;
    medium_risk_count: number;
    low_risk_count: number;
    scan_response: any;
    created_at: string;
  }>> {
    return apiClient.get(`/scan-history/${scanId}`);
  },
};

// Profile and Model Configuration Types
export interface ModelConfigurationResponse {
  id: string;
  config_name: string;
  model_type: string;
  model_name: string;
  description?: string;
  tags: string[];
  parameters: Record<string, any>;
  credentials?: Record<string, any>;
  endpoint_config: Record<string, any>;
  status: string;
  validation_results?: Record<string, any>;
  last_tested?: string;
  is_shared: boolean;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

export interface ProfileResponse {
  id: string;
  profile_name: string;
  description?: string;
  tags: string[];
  is_active: boolean;
  model_config_ids: string[];
  settings: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface ProfileWithConfigs extends ProfileResponse {
  model_configs: ModelConfigurationResponse[];
}

// Profile API
export const profileAPI = {
  // Get all profiles for the current user
  async getAllProfiles(): Promise<ApiResponse<{ profiles: ProfileResponse[] }>> {
    try {
      const response = await apiClient.get('/profile/profiles');
      return {
        success: true,
        data: { profiles: (response.data as any)?.profiles || [] }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.detail || 'Failed to fetch profiles'
      };
    }
  },

  // Get a specific profile with model configurations
  async getProfileWithConfigurations(profileId: string): Promise<ApiResponse<ProfileWithConfigs>> {
    try {
      const response = await apiClient.get(`/profile/profiles/${profileId}/with-configs`);
      return {
        success: true,
        data: response.data as ProfileWithConfigs
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.detail || 'Failed to fetch profile'
      };
    }
  },

  // Get all model configurations for the current user
  async getAllModelConfigurations(): Promise<ApiResponse<{ configurations: ModelConfigurationResponse[] }>> {
    try {
      const response = await apiClient.get('/model-config/configurations');
      return {
        success: true,
        data: { configurations: (response.data as any)?.configurations || [] }
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.detail || 'Failed to fetch model configurations'
      };
    }
  },

  // Get a specific model configuration
  async getModelConfiguration(configId: string): Promise<ApiResponse<ModelConfigurationResponse>> {
    try {
      const response = await apiClient.get(`/model-config/configurations/${configId}`);
      return {
        success: true,
        data: response.data as ModelConfigurationResponse
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.detail || 'Failed to fetch model configuration'
      };
    }
  }
};

export default apiClient;