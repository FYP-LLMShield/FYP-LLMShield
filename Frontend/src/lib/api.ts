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
        return {
          success: false,
          error: data.detail || data.message || 'An error occurred',
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

  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      return this.handleResponse<T>(response);
    } catch (error) {
      return {
        success: false,
        error: 'Network error occurred',
      };
    }
  }

  async post<T>(endpoint: string, data?: any, options: any = {}): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: data ? JSON.stringify(data) : undefined,
        ...options
      });

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
      return {
        success: false,
        error: 'Network error occurred',
      };
    }
  }

  async postFormData<T>(endpoint: string, formData: FormData, options: any = {}): Promise<ApiResponse<T>> {
    try {
      const headers: HeadersInit = {};
      if (this.token) {
        headers['Authorization'] = `Bearer ${this.token}`;
      }

      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method: 'POST',
        headers,
        body: formData,
        ...options
      });

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

export default apiClient;