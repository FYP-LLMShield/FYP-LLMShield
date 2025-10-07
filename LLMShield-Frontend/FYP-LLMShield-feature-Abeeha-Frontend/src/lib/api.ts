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

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: {
    id: string;
    email: string;
    full_name: string;
    is_verified: boolean;
  };
}

// Scanner Types
export interface TextScanRequest {
  content: string;  // Changed from 'text' to 'content'
  filename?: string; // Optional filename parameter
  scan_types?: string[]; // Changed to array to match backend
}

export interface FileScanRequest {
  files: File[];
}

export interface RepoScanRequest {
  repo_url: string;
  branch?: string;
  subdir?: string;
  token?: string;
  scan_types: string[]; // Make this required, not optional
}

export interface ScanResponse {
  scan_id: string;
  status: string;
  findings: Finding[];
  summary: {
    total_files: number;
    total_lines: number;
    vulnerabilities_found: number;
    risk_level: string;
  };
}

export interface Finding {
  id: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  type: string;
  file: string;
  line: number;
  column: number;
  description: string;
  code_snippet: string;
  recommendation: string;
  cwe: string;
}

// Generic API Client
class ApiClient {
  private baseURL: string;
  private token: string | null = null;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
    this.token = localStorage.getItem('access_token');
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

  async post<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: data ? JSON.stringify(data) : undefined,
      });

      return this.handleResponse<T>(response);
    } catch (error) {
      return {
        success: false,
        error: 'Network error occurred',
      };
    }
  }

  async postFormData<T>(endpoint: string, formData: FormData): Promise<ApiResponse<T>> {
    try {
      const headers: HeadersInit = {};
      if (this.token) {
        headers['Authorization'] = `Bearer ${this.token}`;
      }

      const response = await fetch(`${this.baseURL}${endpoint}`, {
        method: 'POST',
        headers,
        body: formData,
      });

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

  async getCurrentUser(): Promise<ApiResponse<any>> {
    return apiClient.get('/auth/me');
  },

  logout() {
    apiClient.clearToken();
  },
};

// Scanner API Functions
export const scannerAPI = {
  async scanText(request: TextScanRequest): Promise<ApiResponse<ScanResponse>> {
    return apiClient.post<ScanResponse>('/scan/text', request);
  },

  async uploadFiles(files: File[]): Promise<ApiResponse<ScanResponse>> {
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
      
      return apiClient.postFormData<ScanResponse>('/scan/upload', formData);
    } catch (error) {
      return {
        success: false,
        error: `File upload failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  },

  async scanRepository(request: RepoScanRequest): Promise<ApiResponse<ScanResponse>> {
    return apiClient.post<ScanResponse>('/scan/github', request);
  },

  async getHealth(): Promise<ApiResponse<any>> {
    return apiClient.get('/scan/health');
  },
};

export default apiClient;