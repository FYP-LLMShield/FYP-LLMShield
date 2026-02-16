// Lightweight API client and helpers to satisfy frontend imports.
// NOTE: Endpoints are best-effort guesses; adjust to match your backend routes.

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8000/api/v1"

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE"

interface RequestOptions {
  method?: HttpMethod
  body?: any
  headers?: Record<string, string>
}

const apiClient = {
  token: null as string | null,

  setToken(token: string | null) {
    this.token = token
    if (token) localStorage.setItem("access_token", token)
  },

  logout() {
    this.token = null
    localStorage.removeItem("access_token")
  },

  async request(path: string, { method = "GET", body, headers = {} }: RequestOptions = {}, retryOnAuth = true): Promise<any> {
    const token = this.token || localStorage.getItem("access_token")
    const mergedHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      ...headers,
    }
    if (token) mergedHeaders["Authorization"] = `Bearer ${token}`

    const response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: mergedHeaders,
      body: body ? JSON.stringify(body) : undefined,
    })

    // Handle 401 Unauthorized - try to refresh token
    if (response.status === 401 && retryOnAuth) {
      const refreshToken = localStorage.getItem('refresh_token')
      if (refreshToken) {
        try {
          const refreshResponse = await fetch(`${API_BASE}/auth/refresh`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${refreshToken}`
            }
          })

          if (refreshResponse.ok) {
            const refreshData = await refreshResponse.json()
            if (refreshData.access_token) {
              localStorage.setItem('access_token', refreshData.access_token)
              this.setToken(refreshData.access_token)
              // Retry the original request with new token
              return this.request(path, { method, body, headers }, false) // Don't retry again
            }
          }
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError)
        }
      }

      // If refresh failed or no refresh token, clear auth and return error
      if (response.status === 401) {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        localStorage.removeItem('user')
      }
    }

    const data = await response.json().catch(() => null)
    const success = response.ok
    return success ? { success, data } : { success, error: data?.detail || response.statusText, data }
  },
}

// -------- Auth APIs --------
export const authAPI = {
  setToken: (token: string | null) => apiClient.setToken(token),
  logout: () => apiClient.logout(),

  login: (payload: any) => apiClient.request("/auth/login", { method: "POST", body: payload }),
  register: (payload: any) => apiClient.request("/auth/register", { method: "POST", body: payload }),
  getCurrentUser: () => apiClient.request("/auth/me"),
  googleSignIn: (payload: any) => apiClient.request("/auth/google", { method: "POST", body: payload }),
  forgotPassword: (payload: any) => apiClient.request("/auth/forgot-password", { method: "POST", body: payload }),
  resetPassword: (payload: any) => apiClient.request("/auth/reset-password", { method: "POST", body: payload }),
}

// -------- MFA APIs --------
export const mfaAPI = {
  getStatus: () => apiClient.request("/auth/mfa/status"),
  initiateSetup: () => apiClient.request("/auth/mfa/setup/initiate", { method: "POST" }),
  completeSetup: (payload: any) => apiClient.request("/auth/mfa/setup/complete", { method: "POST", body: payload }),
  regenerateRecoveryCodes: () => apiClient.request("/auth/mfa/recovery-codes", { method: "POST" }),
  disable: (payload: any) => apiClient.request("/auth/mfa/disable", { method: "POST", body: payload }),
}

// -------- Scanner APIs (Legacy - Regex based + PDF exports) --------
export const scannerAPI = {
  scanText: (payload: any) => apiClient.request("/scan/text", { method: "POST", body: payload }),
  uploadFiles: (files: File[], categories?: string[], useCache?: boolean, maxFileSize?: number, maxFiles?: number) => {
    const formData = new FormData()
    // Upload only the first file for single file endpoint
    if (files.length > 0) {
      formData.append("file", files[0])
    }
    // Convert categories array to comma-separated string
    if (categories && categories.length) {
      formData.append("scan_types", categories.join(","))
    } else {
      formData.append("scan_types", "secrets,cpp_vulns")
    }
    return fetch(`${API_BASE}/scan/upload`, {
      method: "POST",
      body: formData,
      headers: apiClient.token ? { Authorization: `Bearer ${apiClient.token}` } : undefined,
    }).then(async (res) => {
      const data = await res.json().catch(() => null)
      return res.ok ? { success: true, data } : { success: false, error: data?.detail || res.statusText, data }
    })
  },
  scanRepository: (payload: any) => apiClient.request("/scan/github", { method: "POST", body: payload }),
  getCacheStats: () => apiClient.request("/scan/cache/stats", { method: "GET" }),
  clearCache: () => apiClient.request("/scan/cache/clear", { method: "GET" }),
  getTextScanPDF: async (payload: any) => {
    try {
      console.log("Calling PDF endpoint with payload:", payload);
      const token = apiClient.token || localStorage.getItem("access_token")
      const headers: any = {
        "Content-Type": "application/json",
      }
      if (token) {
        headers["Authorization"] = `Bearer ${token}`
      }
      console.log("Headers being sent:", { ...headers, Authorization: headers.Authorization ? "Bearer [TOKEN]" : "None" });

      const res = await fetch(`${API_BASE}/scan/text/pdf`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      })
      console.log(`PDF response status: ${res.status}`);
      const blob = await res.blob()
      console.log(`PDF blob size: ${blob.size} bytes`);
      if (!res.ok) {
        const errorText = await blob.text()
        console.error("PDF Error:", errorText);
        return { success: false, error: `${res.status}: ${res.statusText}`, data: blob }
      }
      return { success: true, data: blob }
    } catch (err: any) {
      console.error("PDF Fetch Error:", err);
      return { success: false, error: err.message, data: null }
    }
  },
  getUploadScanPDF: async (files: File[], categories?: string[]) => {
    try {
      const formData = new FormData()
      if (files.length > 0) {
        formData.append("file", files[0])
        console.log(`Uploading file for PDF: ${files[0].name}`);
      }
      if (categories && categories.length) {
        formData.append("scan_types", categories.join(","))
      } else {
        formData.append("scan_types", "secrets,cpp_vulns")
      }
      console.log("Calling upload PDF endpoint");
      const token = apiClient.token || localStorage.getItem("access_token")
      const headers: any = {}
      if (token) {
        headers["Authorization"] = `Bearer ${token}`
      }
      console.log("Headers being sent:", { ...headers, Authorization: headers.Authorization ? "Bearer [TOKEN]" : "None" });

      const res = await fetch(`${API_BASE}/scan/upload/pdf`, {
        method: "POST",
        body: formData,
        headers,
      })
      console.log(`Upload PDF response status: ${res.status}`);
      const blob = await res.blob()
      console.log(`PDF blob size: ${blob.size} bytes`);
      if (!res.ok) {
        const errorText = await blob.text()
        console.error("Upload PDF Error:", errorText);
        return { success: false, error: `${res.status}: ${res.statusText}`, data: blob }
      }
      return { success: true, data: blob }
    } catch (err: any) {
      console.error("Upload PDF Fetch Error:", err);
      return { success: false, error: err.message, data: null }
    }
  },
  getRepositoryScanPDF: async (payload: any) => {
    try {
      console.log("Calling GitHub PDF endpoint with payload:", payload);
      const token = apiClient.token || localStorage.getItem("access_token")
      const headers: any = {
        "Content-Type": "application/json",
      }
      if (token) {
        headers["Authorization"] = `Bearer ${token}`
      }
      console.log("Headers being sent:", { ...headers, Authorization: headers.Authorization ? "Bearer [TOKEN]" : "None" });

      const res = await fetch(`${API_BASE}/scan/github/pdf`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      })
      console.log(`GitHub PDF response status: ${res.status}`);
      const blob = await res.blob()
      console.log(`PDF blob size: ${blob.size} bytes`);
      if (!res.ok) {
        const errorText = await blob.text()
        console.error("GitHub PDF Error:", errorText);
        return { success: false, error: `${res.status}: ${res.statusText}`, data: blob }
      }
      return { success: true, data: blob }
    } catch (err: any) {
      console.error("GitHub PDF Fetch Error:", err);
      return { success: false, error: err.message, data: null }
    }
  },
}

// -------- SAST Scanner APIs (Semgrep + TruffleHog) --------
export const sastAPI = {
  // Scan pasted C/C++ code
  scanText: (payload: any) => apiClient.request("/sast/text", { method: "POST", body: payload }),

  // Upload and scan C/C++ file
  uploadFile: (file: File) => {
    const formData = new FormData()
    formData.append("file", file)
    return fetch(`${API_BASE}/sast/upload`, {
      method: "POST",
      body: formData,
      headers: apiClient.token ? { Authorization: `Bearer ${apiClient.token}` } : undefined,
    }).then(async (res) => {
      const data = await res.json().catch(() => null)
      return res.ok ? { success: true, data } : { success: false, error: data?.detail || res.statusText, data }
    })
  },

  // Scan GitHub repository
  scanRepository: (payload: any) => apiClient.request("/sast/github", { method: "POST", body: payload }),

  // Get SAST scanner info and capabilities
  getInfo: () => apiClient.request("/sast/", { method: "GET" }),

  // Check SAST scanner health
  getHealth: () => apiClient.request("/sast/health", { method: "GET" }),
}

export const scanHistoryAPI = {
  getHistory: (page = 1, limit = 20, inputType?: string) => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) })
    if (inputType) params.append("input_type", inputType)
    return apiClient.request(`/scan/history?${params.toString()}`)
  },
}

// -------- Prompt Injection APIs --------
export interface ModelConfig {
  name?: string
  provider: string
  model_id: string
  api_key?: string | null
  base_url?: string | null
  temperature?: number
  max_tokens?: number
  top_p?: number
}

export interface ProfileResponse {
  id: string
  name?: string
  profile_name?: string
  description?: string
  model_configs?: any[]
  tags?: string[]
  is_active?: boolean
  model_config_ids?: string[]
}

export interface ProfileWithConfigs extends ProfileResponse {
  model_configs: ModelConfigurationResponse[]
}

export interface ModelConfigurationResponse {
  id: string
  model_type: string
  model_name: string
  credentials?: { api_key?: string }
  parameters?: Record<string, any>
  endpoint_config?: { base_url?: string }
  config_name?: string
  description?: string
  created_at?: string
  tags?: string[]
}

export const promptInjectionAPI = {
  test: (payload: any) => apiClient.request("/prompt-injection/test", { method: "POST", body: payload }),
  testStream: (payload: any) => apiClient.request("/prompt-injection/test-stream", { method: "POST", body: payload }),
  testDocuments: (files: File[], payload: any) => {
    const formData = new FormData()
    files.forEach((f) => formData.append("files", f))
    formData.append("scan_request", JSON.stringify(payload))
    return fetch(`${API_BASE}/prompt-injection/test-documents`, {
      method: "POST",
      body: formData,
      headers: apiClient.token ? { Authorization: `Bearer ${apiClient.token}` } : undefined,
    }).then(async (res) => {
      const data = await res.json().catch(() => null)
      return res.ok ? { success: true, data } : { success: false, error: data?.detail || res.statusText, data }
    })
  },
  getInfo: () => apiClient.request("/prompt-injection/"),
  getProbeCategories: () => apiClient.request("/prompt-injection/categories"),
  validateModelConfig: (payload: any) => apiClient.request("/prompt-injection/validate-model", { method: "POST", body: payload }),
  export: (format: string, testId: string) =>
    apiClient.request(`/prompt-injection/export/${format}/${testId}`, { method: "POST" }),
  embeddingInspection: (file: File, opts?: { chunk_size?: number; chunk_overlap?: number }) => {
    const formData = new FormData()
    formData.append("file", file)
    if (opts?.chunk_size) formData.append("chunk_size", String(opts.chunk_size))
    if (opts?.chunk_overlap) formData.append("chunk_overlap", String(opts.chunk_overlap))
    return fetch(`${API_BASE}/prompt-injection/embedding-inspection`, {
      method: "POST",
      body: formData,
      headers: apiClient.token ? { Authorization: `Bearer ${apiClient.token}` } : undefined,
    }).then(async (res) => {
      const data = await res.json().catch(() => null)
      return res.ok ? { success: true, data } : { success: false, error: data?.detail || res.statusText, data }
    })
  },
  vectorStoreAnalysis: (file: File, opts?: {
    sample_size?: number;
    batch_size?: number;
    enable_clustering?: boolean;
    enable_collision_detection?: boolean;
    enable_outlier_detection?: boolean;
    enable_trigger_detection?: boolean;
    collision_threshold?: number;
  }) => {
    const formData = new FormData()
    formData.append("file", file)
    if (opts?.sample_size) formData.append("sample_size", String(opts.sample_size))
    if (opts?.batch_size) formData.append("batch_size", String(opts.batch_size))
    if (opts?.enable_clustering !== undefined) formData.append("enable_clustering", String(opts.enable_clustering))
    if (opts?.enable_collision_detection !== undefined) formData.append("enable_collision_detection", String(opts.enable_collision_detection))
    if (opts?.enable_outlier_detection !== undefined) formData.append("enable_outlier_detection", String(opts.enable_outlier_detection))
    if (opts?.enable_trigger_detection !== undefined) formData.append("enable_trigger_detection", String(opts.enable_trigger_detection))
    if (opts?.collision_threshold !== undefined) formData.append("collision_threshold", String(opts.collision_threshold))
    return fetch(`${API_BASE}/prompt-injection/vector-store-analysis`, {
      method: "POST",
      body: formData,
      headers: apiClient.token ? { Authorization: `Bearer ${apiClient.token}` } : undefined,
    }).then(async (res) => {
      const data = await res.json().catch(() => null)
      return res.ok ? { success: true, data } : { success: false, error: data?.detail || res.statusText, data }
    })
  },

  // Multi-source vector store analysis (supports all cloud DBs)
  vectorStoreAnalysisMultiSource: (opts: {
    source_type: string;
    file?: File;
    // Pinecone
    pinecone_api_key?: string;
    pinecone_index_name?: string;
    pinecone_environment?: string;
    pinecone_host?: string;
    pinecone_namespace?: string;
    // ChromaDB
    chroma_host?: string;
    chroma_port?: number;
    chroma_persist_directory?: string;
    chroma_collection_name?: string;
    chroma_api_key?: string;
    chroma_tenant?: string;
    chroma_database?: string;
    // Qdrant
    qdrant_host?: string;
    qdrant_port?: number;
    qdrant_url?: string;
    qdrant_api_key?: string;
    qdrant_collection_name?: string;
    // Weaviate
    weaviate_host?: string;
    weaviate_port?: number;
    weaviate_url?: string;
    weaviate_api_key?: string;
    weaviate_class_name?: string;
    // Analysis params
    sample_size?: number;
    batch_size?: number;
    enable_clustering?: boolean;
    enable_collision_detection?: boolean;
    enable_outlier_detection?: boolean;
    enable_trigger_detection?: boolean;
    collision_threshold?: number;
  }) => {
    const formData = new FormData()
    formData.append("source_type", opts.source_type)
    // File
    if (opts.file) formData.append("file", opts.file)
    // Pinecone
    if (opts.pinecone_api_key) formData.append("pinecone_api_key", opts.pinecone_api_key)
    if (opts.pinecone_index_name) formData.append("pinecone_index_name", opts.pinecone_index_name)
    if (opts.pinecone_environment) formData.append("pinecone_environment", opts.pinecone_environment)
    if (opts.pinecone_host) formData.append("pinecone_host", opts.pinecone_host)
    if (opts.pinecone_namespace) formData.append("pinecone_namespace", opts.pinecone_namespace)
    // ChromaDB
    if (opts.chroma_host) formData.append("chroma_host", opts.chroma_host)
    if (opts.chroma_port) formData.append("chroma_port", String(opts.chroma_port))
    if (opts.chroma_persist_directory) formData.append("chroma_persist_directory", opts.chroma_persist_directory)
    if (opts.chroma_collection_name) formData.append("chroma_collection_name", opts.chroma_collection_name)
    if (opts.chroma_api_key) formData.append("chroma_api_key", opts.chroma_api_key)
    if (opts.chroma_tenant) formData.append("chroma_tenant", opts.chroma_tenant)
    if (opts.chroma_database) formData.append("chroma_database", opts.chroma_database)
    // Qdrant
    if (opts.qdrant_host) formData.append("qdrant_host", opts.qdrant_host)
    if (opts.qdrant_port) formData.append("qdrant_port", String(opts.qdrant_port))
    if (opts.qdrant_url) formData.append("qdrant_url", opts.qdrant_url)
    if (opts.qdrant_api_key) formData.append("qdrant_api_key", opts.qdrant_api_key)
    if (opts.qdrant_collection_name) formData.append("qdrant_collection_name", opts.qdrant_collection_name)
    // Weaviate
    if (opts.weaviate_host) formData.append("weaviate_host", opts.weaviate_host)
    if (opts.weaviate_port) formData.append("weaviate_port", String(opts.weaviate_port))
    if (opts.weaviate_url) formData.append("weaviate_url", opts.weaviate_url)
    if (opts.weaviate_api_key) formData.append("weaviate_api_key", opts.weaviate_api_key)
    if (opts.weaviate_class_name) formData.append("weaviate_class_name", opts.weaviate_class_name)
    // Analysis params
    if (opts.sample_size) formData.append("sample_size", String(opts.sample_size))
    if (opts.batch_size) formData.append("batch_size", String(opts.batch_size))
    if (opts.enable_clustering !== undefined) formData.append("enable_clustering", String(opts.enable_clustering))
    if (opts.enable_collision_detection !== undefined) formData.append("enable_collision_detection", String(opts.enable_collision_detection))
    if (opts.enable_outlier_detection !== undefined) formData.append("enable_outlier_detection", String(opts.enable_outlier_detection))
    if (opts.enable_trigger_detection !== undefined) formData.append("enable_trigger_detection", String(opts.enable_trigger_detection))
    if (opts.collision_threshold !== undefined) formData.append("collision_threshold", String(opts.collision_threshold))
    return fetch(`${API_BASE}/prompt-injection/vector-store-analysis-multi-source`, {
      method: "POST",
      body: formData,
      headers: apiClient.token ? { Authorization: `Bearer ${apiClient.token}` } : undefined,
    }).then(async (res) => {
      const data = await res.json().catch(() => null)
      return res.ok ? { success: true, data } : { success: false, error: data?.detail || res.statusText, data }
    })
  },

  // Get supported vector DB sources
  getVectorDBSources: () => apiClient.request("/prompt-injection/vector-db/supported-sources"),

  // Test connection to a vector database
  testVectorDBConnection: (opts: {
    source_type: string;
    // Pinecone
    pinecone_api_key?: string;
    pinecone_index_name?: string;
    pinecone_environment?: string;
    pinecone_host?: string;
    pinecone_namespace?: string;
    // ChromaDB
    chroma_host?: string;
    chroma_port?: number;
    chroma_persist_directory?: string;
    chroma_collection_name?: string;
    chroma_api_key?: string;
    chroma_tenant?: string;
    chroma_database?: string;
    // Qdrant
    qdrant_host?: string;
    qdrant_port?: number;
    qdrant_url?: string;
    qdrant_api_key?: string;
    qdrant_collection_name?: string;
    // Weaviate
    weaviate_host?: string;
    weaviate_port?: number;
    weaviate_url?: string;
    weaviate_api_key?: string;
    weaviate_class_name?: string;
  }) => apiClient.request("/prompt-injection/vector-db/test-connection", {
    method: "POST",
    body: opts
  }),
  embeddingSanitizePreview: (file: File, opts?: {
    chunk_size?: number;
    chunk_overlap?: number;
    excluded_chunk_ids?: string;  // Comma-separated
    custom_denylist_patterns?: string;  // Comma-separated regex patterns
  }) => {
    const formData = new FormData()
    formData.append("file", file)
    if (opts?.chunk_size) formData.append("chunk_size", String(opts.chunk_size))
    if (opts?.chunk_overlap) formData.append("chunk_overlap", String(opts.chunk_overlap))
    if (opts?.excluded_chunk_ids) formData.append("excluded_chunk_ids", opts.excluded_chunk_ids)
    if (opts?.custom_denylist_patterns) formData.append("custom_denylist_patterns", opts.custom_denylist_patterns)
    return fetch(`${API_BASE}/prompt-injection/embedding-inspection/sanitize-preview`, {
      method: "POST",
      body: formData,
      headers: apiClient.token ? { Authorization: `Bearer ${apiClient.token}` } : undefined,
    }).then(async (res) => {
      const data = await res.json().catch(() => null)
      return res.ok ? { success: true, data } : { success: false, error: data?.detail || res.statusText, data }
    })
  },
  embeddingReanalyze: (file: File, opts?: {
    chunk_size?: number;
    chunk_overlap?: number;
    excluded_chunk_ids?: string;  // Comma-separated
    original_scan_id?: string;
    additional_denylist_patterns?: string;  // Comma-separated regex patterns
  }) => {
    const formData = new FormData()
    formData.append("file", file)
    if (opts?.chunk_size) formData.append("chunk_size", String(opts.chunk_size))
    if (opts?.chunk_overlap) formData.append("chunk_overlap", String(opts.chunk_overlap))
    if (opts?.excluded_chunk_ids) formData.append("excluded_chunk_ids", opts.excluded_chunk_ids)
    if (opts?.original_scan_id) formData.append("original_scan_id", opts.original_scan_id)
    if (opts?.additional_denylist_patterns) formData.append("additional_denylist_patterns", opts.additional_denylist_patterns)
    return fetch(`${API_BASE}/prompt-injection/embedding-inspection/reanalyze`, {
      method: "POST",
      body: formData,
      headers: apiClient.token ? { Authorization: `Bearer ${apiClient.token}` } : undefined,
    }).then(async (res) => {
      const data = await res.json().catch(() => null)
      return res.ok ? { success: true, data } : { success: false, error: data?.detail || res.statusText, data }
    })
  },
  exportInspectionReport: async (inspectionData: any, format: 'pdf' | 'json' = 'pdf') => {
    const token = apiClient.token || localStorage.getItem("access_token")
    const response = await fetch(`${API_BASE}/prompt-injection/embedding-inspection/export`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        inspection_data: inspectionData,
        format: format,
      }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: "Export failed" }))
      throw new Error(error.detail || "Export failed")
    }

    // Download the file
    const blob = await response.blob()
    const filename = format === 'pdf' 
      ? `inspection_report_${inspectionData.scan_id || 'report'}.pdf`
      : `inspection_report_${inspectionData.scan_id || 'report'}.json`
    
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
    
    return { success: true }
  },
  exportSanitizedDocument: (file: File, opts?: {
    chunk_size?: number;
    chunk_overlap?: number;
    excluded_chunk_ids?: string;
    custom_denylist_patterns?: string;
    stopwords?: string;
    remediation_method?: string;
  }) => {
    const formData = new FormData()
    formData.append("file", file)
    if (opts?.chunk_size) formData.append("chunk_size", String(opts.chunk_size))
    if (opts?.chunk_overlap) formData.append("chunk_overlap", String(opts.chunk_overlap))
    if (opts?.excluded_chunk_ids) formData.append("excluded_chunk_ids", opts.excluded_chunk_ids)
    if (opts?.custom_denylist_patterns) formData.append("custom_denylist_patterns", opts.custom_denylist_patterns)
    if (opts?.stopwords) formData.append("stopwords", opts.stopwords)
    if (opts?.remediation_method) formData.append("remediation_method", opts.remediation_method)
    
    return fetch(`${API_BASE}/prompt-injection/embedding-inspection/export-sanitized`, {
      method: "POST",
      body: formData,
      headers: apiClient.token ? { Authorization: `Bearer ${apiClient.token}` } : undefined,
    }).then(async (res) => {
      if (!res.ok) {
        const error = await res.json().catch(() => ({ detail: "Export failed" }))
        return { success: false, error: error.detail || "Export failed" }
      }
      
      // Download the file
      const blob = await res.blob()
      const contentDisposition = res.headers.get('Content-Disposition')
      const filenameMatch = contentDisposition?.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
      const filename = filenameMatch ? filenameMatch[1].replace(/['"]/g, '') : 'sanitized_document.txt'
      
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      return { success: true }
    })
  },
  robustDetect: (payload: { text: string; sensitivity?: number }) =>
    apiClient.request("/prompt-injection/robust-detect", { method: "POST", body: payload }),
  benchmark: (payload: any) => apiClient.request("/prompt-injection/benchmark", { method: "POST", body: payload }),
  batchTest: (file: File, sensitivity: number = 1.0) => {
    const formData = new FormData()
    formData.append("file", file)
    formData.append("sensitivity", sensitivity.toString())
    return fetch(`${API_BASE}/prompt-injection/batch-test`, {
      method: "POST",
      body: formData,
      headers: apiClient.token ? { Authorization: `Bearer ${apiClient.token}` } : undefined,
    }).then(async (res) => {
      const data = await res.json().catch(() => null)
      return res.ok ? { success: true, data } : { success: false, error: data?.detail || res.statusText, data }
    })
  },
  retrievalAttackSimulation: (file: File, params: RetrievalAttackParams) => {
    const formData = new FormData()
    formData.append("file", file)
    formData.append("queries", params.queries)
    if (params.top_k) formData.append("top_k", String(params.top_k))
    if (params.similarity_threshold) formData.append("similarity_threshold", String(params.similarity_threshold))
    if (params.rank_shift_threshold) formData.append("rank_shift_threshold", String(params.rank_shift_threshold))
    if (params.variants) formData.append("variants", params.variants)
    if (params.enable_model_inference !== undefined) formData.append("enable_model_inference", String(params.enable_model_inference))
    return fetch(`${API_BASE}/prompt-injection/retrieval-attack-simulation`, {
      method: "POST",
      body: formData,
      headers: apiClient.token ? { Authorization: `Bearer ${apiClient.token}` } : undefined,
    }).then(async (res) => {
      const data = await res.json().catch(() => null)
      return res.ok ? { success: true, data } : { success: false, error: data?.detail || res.statusText, data }
    })
  },
  exportRetrievalAttackReport: (scanId: string, reportData: any, format: string = 'json') => {
    return fetch(`${API_BASE}/prompt-injection/retrieval-attack-simulation/export`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiClient.token ? { Authorization: `Bearer ${apiClient.token}` } : {})
      },
      body: JSON.stringify({ scan_id: scanId, report_data: reportData, format })
    }).then(async (res) => {
      if (!res.ok) {
        const error = await res.text()
        return { success: false, error }
      }
      
      if (format === 'json') {
        const data = await res.json()
        return { success: true, data }
      } else {
        // For CSV/PDF, return blob for download
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `retrieval_attack_${scanId}.${format}`
        a.click()
        URL.revokeObjectURL(url)
        return { success: true, data: null }
      }
    })
  },
}


export const profileAPI = {
  getProfiles: () => apiClient.request("/profiles"),
  getAllProfiles: () => apiClient.request("/profiles"),
  getProfileWithConfigurations: (id: string) => apiClient.request(`/profiles/${id}/with-configs`),
}

// Types for scanner components
export interface Finding {
  id: string
  file: string
  line: number
  message?: string
  severity?: string
  priority_rank?: number
  [key: string]: any
}

export interface ScanResponse {
  findings: Finding[]
  critical_findings?: Finding[]
  most_affected_files?: any[]
  severity_distribution?: any
  executive_summary?: any
  recommendations?: string[]
  next_steps?: string[]
  [key: string]: any
}

// Embedding inspection types
export interface EmbeddingChunk {
  chunk_id: number
  text: string
  page_number: number
  start_idx: number
  end_idx: number
  start_line: number
  end_line: number
  tokens: number
}

export interface EmbeddingFinding {
  chunk_id: number
  snippet: string
  reason_label: string
  risk_score: number
  location: Record<string, any>
  recommended_action: string
}

export interface EmbeddingInspectionResponse {
  scan_id: string
  filename: string
  file_type: string
  file_size: number
  scan_timestamp: string
  total_chunks: number
  chunk_size: number
  chunk_overlap: number
  findings: EmbeddingFinding[]
  chunks: EmbeddingChunk[]
  recommendations: string[]
}

// Vector Store Anomaly Detection types
export interface AnomalyFinding {
  category: string
  vector_id?: number
  vector_ids?: number[]
  vector_id_a?: number
  vector_id_b?: number
  record_id?: string
  record_ids?: string[]
  source_doc?: string
  source_chunk?: string
  nearest_neighbors?: Array<{ vector_id: number; similarity: number; record_id?: string }>
  similarity_scores?: Record<string, number>
  confidence: number
  description: string
  recommended_action: string
  metadata?: Record<string, any>
  cluster_id?: number
  tenants?: string[]
  sources?: string[]
  norm?: number
  z_score?: number
  similarity?: number
}

export interface PoisonedVectorSummary {
  record_id?: string
  record_ids?: string[]
  category: string
  description: string
  recommended_action: string
  source_doc?: string
  confidence: number
}

export interface VectorStoreAnalysisResponse {
  scan_id: string
  scan_timestamp: string
  total_vectors: number
  vectors_analyzed: number
  coverage_percentage: number
  confidence: number
  distribution_stats: Record<string, any>
  findings: AnomalyFinding[]
  summary: {
    total_findings: number
    category_counts: Record<string, number>
    severity_counts: Record<string, number>
    anomaly_rate: number
    poisoned_vector_count?: number
  }
  recommendations: string[]
  poisoned_vectors?: PoisonedVectorSummary[]
  sampling_info?: {
    method: string
    sample_size: number
    total_size: number
    coverage: number
  }
}

// Sanitization Preview Types
export interface SanitizedChunkPreview {
  chunk_id: number
  page_number: number
  original_text: string
  sanitized_text: string
  patterns_matched: string[]
  action_taken: string  // "masked", "removed", "excluded"
}

export interface SanitizationPreviewResponse {
  scan_id: string
  filename: string
  scan_timestamp: string
  original_findings_count: number
  remaining_findings_count: number
  excluded_chunk_ids: number[]
  sanitized_chunks: SanitizedChunkPreview[]
  recommendations: string[]
}

// Reanalysis Types
export interface ReanalysisResponse {
  scan_id: string
  original_scan_id?: string
  filename: string
  file_type: string
  file_size: number
  scan_timestamp: string
  total_chunks: number
  analyzed_chunks: number
  excluded_chunk_ids: number[]
  chunk_size: number
  chunk_overlap: number
  findings: EmbeddingFinding[]
  chunks: EmbeddingChunk[]
  recommendations: string[]
  comparison: {
    original_total_chunks: number
    analyzed_chunks: number
    excluded_chunks: number
    original_findings_count: number
    new_findings_count: number
    findings_reduction: number
    reduction_percentage: number
  }
}

export interface RobustDetectionResult {
  is_malicious: boolean
  confidence: number
  category: string
  matched_patterns: string[]
  risk_level: string
  details: {
    normalization_applied: boolean
    obfuscation_detected: boolean
    multi_language_match: boolean
    structural_anomaly: boolean
    highest_score_category: string
  }
}

export interface BenchmarkResult {
  benchmark_id: string
  models_tested: string[]
  results: Record<string, any>
  comparison_summary: {
    most_secure: string
    least_secure: string
    average_violations: number
    total_violations: number
  }
}

export interface BatchResult {
  prompt: string
  is_malicious: boolean
  confidence: number
  risk_level: string
  category?: string
  matched_patterns: string[]
}

export interface BatchTestResponse {
  batch_id: string
  total_processed: number
  violations_found: number
  results: BatchResult[]
  summary: {
    total: number
    violations: number
    clean: number
    violation_rate: number
  }
}

// Retrieval Attack Simulation Types
export interface RetrievalManipulationFinding {
  query: string
  variant_type: string
  variant_query: string
  target_vector_id: string
  baseline_rank?: number
  adversarial_rank?: number
  rank_shift: number
  similarity_score: number
  metadata: Record<string, any>
  confidence: number
  description: string
  responsible_vectors: string[]
  recommended_action: string
}

export interface BehavioralImpactResult {
  query: string
  retrieved_chunks: string[]
  composed_prompt: string
  model_response: string
  policy_violation: boolean
  topic_flip: boolean
  toxicity_score: number
  pii_detected: boolean
  trace: Record<string, any>
}

export interface QueryResultSummary {
  query: string
  status: string
  error_message?: string
  baseline_top_k: string[]
  findings_count: number
  has_behavioral_impact: boolean
}

export interface RetrievalAttackResponse {
  scan_id: string
  timestamp: string
  total_queries: number
  successful_queries: number
  failed_queries: number
  attack_success_rate: number
  findings: RetrievalManipulationFinding[]
  behavioral_impacts: BehavioralImpactResult[]
  query_summaries: QueryResultSummary[]
  parameters: Record<string, any>
  recommendations: string[]
}

export interface RetrievalAttackParams {
  queries: string  // Newline-separated
  top_k?: number
  similarity_threshold?: number
  rank_shift_threshold?: number
  variants?: string  // Comma-separated: paraphrase,unicode,homoglyph,trigger
  enable_model_inference?: boolean
}

export default apiClient

