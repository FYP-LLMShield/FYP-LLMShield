import React, { useState } from "react"
import {
  promptInjectionAPI,
  EmbeddingInspectionResponse,
  EmbeddingFinding,
  SanitizationPreviewResponse,
  ReanalysisResponse
} from "../../lib/api"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/card"
import { Badge } from "../ui/badge"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Textarea } from "../ui/textarea"
import { Progress } from "../ui/progress"
import { Switch } from "../ui/switch"
import { Checkbox } from "../ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from "../ui/dialog"
import {
  AlertTriangle,
  FileText,
  Shield,
  Loader2,
  CheckCircle2,
  Eye,
  RefreshCw,
  Trash2,
  Lock,
  ArrowRight,
  Download,
  FileDown,
  Wand2,
  EyeOff,
  Sparkles,
  Settings
} from "lucide-react"

export const EmbeddingInspectionPage: React.FC = () => {
  const [file, setFile] = useState<File | null>(null)
  const [chunkSize, setChunkSize] = useState<number>(500)
  const [chunkOverlap, setChunkOverlap] = useState<number>(100)
  const [result, setResult] = useState<EmbeddingInspectionResponse | ReanalysisResponse | null>(null)
  const [previewResult, setPreviewResult] = useState<SanitizationPreviewResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isPreviewing, setIsPreviewing] = useState(false)
  const [isReanalyzing, setIsReanalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)

  // New states for interactive features
  const [excludedChunkIds, setExcludedChunkIds] = useState<Set<number>>(new Set())
  const [customPatterns, setCustomPatterns] = useState<string>("")
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [stopwords, setStopwords] = useState<string>("")
  const [remediationMethod, setRemediationMethod] = useState<'sanitize' | 'mask' | 'remove'>('sanitize')
  const [maskedFindings, setMaskedFindings] = useState<Set<string>>(new Set())
  const [isExportingSanitized, setIsExportingSanitized] = useState(false)
  
  // Pattern category filters
  type CategoryKey = 'instruction_payload' | 'trigger_phrases' | 'obfuscated_tokens' | 'extreme_repetition'
  
  const [enabledCategories, setEnabledCategories] = useState<Record<CategoryKey, boolean>>({
    instruction_payload: true,
    trigger_phrases: true,
    obfuscated_tokens: true,
    extreme_repetition: true,
  })

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
      setError(null)
    }
  }

  const formatBytes = (bytes: number) => {
    if (!bytes) return "0 B"
    const sizes = ["B", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`
  }

  const riskBadge = (score: number) => {
    if (score >= 0.8) return <Badge className="bg-red-600 text-white">High</Badge>
    if (score >= 0.5) return <Badge className="bg-amber-500 text-white">Medium</Badge>
    return <Badge className="bg-emerald-600 text-white">Low</Badge>
  }

  const handleInspect = async () => {
    if (!file) {
      setError("Please select a document to inspect.")
      return
    }
    setIsLoading(true)
    setError(null)
    setResult(null)
    setExcludedChunkIds(new Set())
    try {
      const response = await promptInjectionAPI.embeddingInspection(file, {
        chunk_size: chunkSize,
        chunk_overlap: chunkOverlap,
      })
      if (response.success && response.data) {
        setResult(response.data as EmbeddingInspectionResponse)
      } else {
        setError(response.error || "Inspection failed.")
      }
    } catch (e: any) {
      setError(e?.message || "Inspection failed.")
    } finally {
      setIsLoading(false)
    }
  }

  const handlePreview = async () => {
    if (!file) return
    setIsPreviewing(true)
    setError(null)
    try {
      const response = await promptInjectionAPI.embeddingSanitizePreview(file, {
        chunk_size: chunkSize,
        chunk_overlap: chunkOverlap,
        excluded_chunk_ids: Array.from(excludedChunkIds).join(","),
        custom_denylist_patterns: customPatterns,
      })
      if (response.success && response.data) {
        setPreviewResult(response.data as SanitizationPreviewResponse)
        setIsPreviewOpen(true)
      } else {
        setError(response.error || "Preview failed.")
      }
    } catch (e: any) {
      setError(e?.message || "Preview failed.")
    } finally {
      setIsPreviewing(false)
    }
  }

  const handleReanalyze = async () => {
    if (!file) return
    setIsReanalyzing(true)
    setError(null)
    try {
      const response = await promptInjectionAPI.embeddingReanalyze(file, {
        chunk_size: chunkSize,
        chunk_overlap: chunkOverlap,
        excluded_chunk_ids: Array.from(excludedChunkIds).join(","),
        additional_denylist_patterns: customPatterns,
        original_scan_id: result?.scan_id
      })
      if (response.success && response.data) {
        setResult(response.data as ReanalysisResponse)
      } else {
        setError(response.error || "Re-analysis failed.")
      }
    } catch (e: any) {
      setError(e?.message || "Re-analysis failed.")
    } finally {
      setIsReanalyzing(false)
    }
  }

  const toggleChunkExclusion = (chunkId: number) => {
    setExcludedChunkIds(prev => {
      const next = new Set(prev)
      if (next.has(chunkId)) next.delete(chunkId)
      else next.add(chunkId)
      return next
    })
  }

  const toggleAllFindings = () => {
    if (!result) return
    if (excludedChunkIds.size === result.findings.length) {
      setExcludedChunkIds(new Set())
    } else {
      const allIds = new Set(result.findings.map(f => f.chunk_id))
      setExcludedChunkIds(allIds)
    }
  }

  const toggleCategory = (category: CategoryKey) => {
    setEnabledCategories(prev => ({ ...prev, [category]: !prev[category] }))
  }

  const filteredFindings = (findings: EmbeddingFinding[]) => {
    return findings.filter(f => {
      const key = f.reason_label as CategoryKey
      return enabledCategories[key] !== false
    })
  }

  const groupedFindings = (findings: EmbeddingFinding[]) => {
    const groups = new Map<number, EmbeddingFinding[]>()
    findings.forEach(f => {
      if (!groups.has(f.chunk_id)) groups.set(f.chunk_id, [])
      groups.get(f.chunk_id)!.push(f)
    })
    return groups
  }

  const topFindings = (findings: EmbeddingFinding[]) => {
    const filtered = filteredFindings(findings)
    return [...filtered].sort((a, b) => b.risk_score - a.risk_score).slice(0, 30)
  }

  const handleExportReport = async (format: 'pdf' | 'json' = 'pdf') => {
    if (!result) return
    setIsExporting(true)
    try {
      await promptInjectionAPI.exportInspectionReport(result, format)
    } catch (e: any) {
      setError(e?.message || "Export failed")
    } finally {
      setIsExporting(false)
    }
  }

  const handleQuickSanitize = (finding: EmbeddingFinding) => {
    // Add finding to masked list
    const key = `${finding.chunk_id}-${finding.reason_label}`
    setMaskedFindings(prev => new Set([...prev, key]))
    // Also add to custom patterns if it's a specific pattern
    if (finding.snippet && finding.snippet.length < 100) {
      const pattern = finding.snippet.substring(0, 50).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      setCustomPatterns(prev => prev ? `${prev}, ${pattern}` : pattern)
    }
  }

  const handleMaskFinding = (finding: EmbeddingFinding) => {
    const key = `${finding.chunk_id}-${finding.reason_label}`
    setMaskedFindings(prev => new Set([...prev, key]))
  }

  const handleExcludeFinding = (finding: EmbeddingFinding) => {
    toggleChunkExclusion(finding.chunk_id)
  }

  const isFindingMasked = (finding: EmbeddingFinding) => {
    const key = `${finding.chunk_id}-${finding.reason_label}`
    return maskedFindings.has(key)
  }

  const handleExportSanitizedDocument = async () => {
    if (!file || !result) return
    setIsExportingSanitized(true)
    try {
      // This will call a new endpoint to export the sanitized document
      const response = await promptInjectionAPI.exportSanitizedDocument(file, {
        chunk_size: chunkSize,
        chunk_overlap: chunkOverlap,
        excluded_chunk_ids: Array.from(excludedChunkIds).join(","),
        custom_denylist_patterns: customPatterns,
        stopwords: stopwords,
        remediation_method: remediationMethod
      })
      if (response.success) {
        // File download is handled by the API function
      } else {
        setError(response.error || "Export failed")
      }
    } catch (e: any) {
      setError(e?.message || "Export sanitized document failed")
    } finally {
      setIsExportingSanitized(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="w-6 h-6 text-teal-500" />
        <div>
          <h1 className="text-2xl font-bold text-white">Embedding Inspection</h1>
          <p className="text-gray-400 text-sm">
            Scan documents for adversarial/poisonous content before sending to the vector store.
          </p>
        </div>
      </div>

      <Card className="bg-slate-900/70 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Upload & Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm text-gray-300 block mb-1">Document</label>
              <Input type="file" accept=".pdf,.docx,.txt,.md" onChange={handleFileChange} className="bg-slate-800 border-slate-600 text-gray-100 file:text-gray-100" />
            </div>
            <div>
              <label className="text-sm text-gray-300 block mb-1">Chunk Size (words)</label>
              <Input
                type="number"
                min={50}
                value={chunkSize}
                onChange={(e) => setChunkSize(Number(e.target.value))}
                className="bg-slate-800 border-slate-600 text-gray-100 placeholder:text-gray-500"
              />
            </div>
            <div>
              <label className="text-sm text-gray-300 block mb-1">Chunk Overlap (words)</label>
              <Input
                type="number"
                min={0}
                value={chunkOverlap}
                onChange={(e) => setChunkOverlap(Number(e.target.value))}
                className="bg-slate-800 border-slate-600 text-gray-100 placeholder:text-gray-500"
              />
            </div>
          </div>
          
          {/* Chunk Size Suggestions */}
          {result && result.findings.length > 0 && (
            <div className="border-t border-slate-700 pt-4">
              <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
                <div className="flex items-start gap-3">
                  <Sparkles className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <h3 className="text-sm font-semibold text-blue-300">Chunk Size Recommendations</h3>
                    <p className="text-xs text-blue-200">
                      {(() => {
                        const avgFindingsPerChunk = result.findings.length / result.total_chunks
                        const highRiskCount = result.findings.filter(f => f.risk_score >= 0.8).length
                        
                        if (avgFindingsPerChunk > 2) {
                          return `High finding density detected (${avgFindingsPerChunk.toFixed(1)} findings/chunk). Consider reducing chunk size to ${Math.floor(chunkSize * 0.7)} words for better isolation.`
                        } else if (highRiskCount > 10 && chunkSize > 300) {
                          return `Many high-risk findings detected. Consider smaller chunks (${Math.floor(chunkSize * 0.8)} words) to isolate malicious content.`
                        } else if (result.findings.length === 0) {
                          return "No suspicious patterns detected. Current chunk size appears appropriate."
                        } else {
                          return "Current chunk size seems reasonable. Monitor findings density as you add more documents."
                        }
                      })()}
                    </p>
                    {(() => {
                      const avgFindingsPerChunk = result.findings.length / result.total_chunks
                      const suggestedSize = avgFindingsPerChunk > 2 ? Math.floor(chunkSize * 0.7) : 
                                          (result.findings.filter(f => f.risk_score >= 0.8).length > 10 ? Math.floor(chunkSize * 0.8) : null)
                      
                      return suggestedSize ? (
                        <Button
                          size="sm"
                          onClick={() => setChunkSize(suggestedSize)}
                          className="bg-blue-600 hover:bg-blue-500 text-white h-7 text-xs"
                        >
                          Apply {suggestedSize} words
                        </Button>
                      ) : null
                    })()}
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <div className="border-t border-slate-700 pt-4">
            <label className="text-sm text-gray-300 block mb-3 font-semibold">Pattern Categories</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="flex items-center space-x-2 bg-slate-800/50 px-3 py-2 rounded-lg">
                <Checkbox
                  id="cat-instruction"
                  checked={enabledCategories.instruction_payload}
                  onCheckedChange={() => toggleCategory("instruction_payload")}
                />
                <label htmlFor="cat-instruction" className="text-sm text-gray-300 cursor-pointer">
                  Instruction Payloads
                </label>
              </div>
              <div className="flex items-center space-x-2 bg-slate-800/50 px-3 py-2 rounded-lg">
                <Checkbox
                  id="cat-trigger"
                  checked={enabledCategories.trigger_phrases}
                  onCheckedChange={() => toggleCategory("trigger_phrases")}
                />
                <label htmlFor="cat-trigger" className="text-sm text-gray-300 cursor-pointer">
                  Trigger Phrases
                </label>
              </div>
              <div className="flex items-center space-x-2 bg-slate-800/50 px-3 py-2 rounded-lg">
                <Checkbox
                  id="cat-obfuscation"
                  checked={enabledCategories.obfuscated_tokens}
                  onCheckedChange={() => toggleCategory("obfuscated_tokens")}
                />
                <label htmlFor="cat-obfuscation" className="text-sm text-gray-300 cursor-pointer">
                  Obfuscation
                </label>
              </div>
              <div className="flex items-center space-x-2 bg-slate-800/50 px-3 py-2 rounded-lg">
                <Checkbox
                  id="cat-repetition"
                  checked={enabledCategories.extreme_repetition}
                  onCheckedChange={() => toggleCategory("extreme_repetition")}
                />
                <label htmlFor="cat-repetition" className="text-sm text-gray-300 cursor-pointer">
                  Repetition
                </label>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Button
              onClick={handleInspect}
              disabled={isLoading}
              size="lg"
              className="bg-teal-600 hover:bg-teal-500 text-white font-semibold px-8 py-3 shadow-lg border-0"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" /> Inspecting...
                </>
              ) : (
                <>
                  <Shield className="w-5 h-5" /> Run Inspection
                </>
              )}
            </Button>
            {error && <span className="text-sm text-red-400">{error}</span>}
          </div>
        </CardContent>
      </Card>

      {isLoading && (
        <Card className="bg-slate-900/70 border-slate-800">
          <CardContent className="py-6 flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-teal-400 animate-spin" />
            <span className="text-gray-200">Inspecting document...</span>
          </CardContent>
        </Card>
      )}

      {result && (
        <div className="space-y-4">
          <Card className="bg-gradient-to-r from-slate-900/90 via-slate-800/90 to-slate-900/90 border-teal-500/30 shadow-xl">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <CardTitle className="text-white flex items-center gap-2 text-xl">
                    <FileText className="w-6 h-6 text-teal-400" />
                    {result.filename}
                  </CardTitle>
                  <p className="text-sm text-gray-400 mt-1">
                    {formatBytes(result.file_size)} • {result.total_chunks} chunks • Scanned at {new Date(result.scan_timestamp).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleExportReport('json')}
                    disabled={isExporting}
                    variant="outline"
                    size="sm"
                    className="border-slate-600 hover:border-teal-500 hover:bg-slate-800"
                  >
                    {isExporting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <FileDown className="w-4 h-4 mr-1" /> JSON
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={() => handleExportReport('pdf')}
                    disabled={isExporting}
                    className="bg-teal-600 hover:bg-teal-500 text-white shadow-lg"
                    size="sm"
                  >
                    {isExporting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Download className="w-4 h-4 mr-1" /> Download Report
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-gray-200">
              <div className="flex flex-wrap gap-3">
                <Badge variant="outline" className="border-teal-500/50 text-teal-300 bg-teal-500/10 px-3 py-1">
                  Chunk size: {result.chunk_size}
                </Badge>
                <Badge variant="outline" className="border-teal-500/50 text-teal-300 bg-teal-500/10 px-3 py-1">
                  Overlap: {result.chunk_overlap}
                </Badge>
                <Badge variant="outline" className="border-teal-500/50 text-teal-300 bg-teal-500/10 px-3 py-1">
                  Findings: {result.findings.length}
                </Badge>
                <Badge variant="outline" className="border-amber-500/50 text-amber-300 bg-amber-500/10 px-3 py-1">
                  Scan ID: {result.scan_id.slice(0, 8)}
                </Badge>
              </div>
              {result.findings.length === 0 && (
                <div className="flex items-center gap-2 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <span className="text-emerald-400 font-medium">No suspicious content detected. Document is safe for embedding.</span>
                </div>
              )}
            </CardContent>
          </Card>

          {result.findings.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-4">
                {/* Summary Card */}
                <Card className="bg-gradient-to-br from-slate-900/90 to-slate-800/90 border-slate-700">
                  <CardContent className="p-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-red-400">
                          {result.findings.filter(f => f.risk_score >= 0.8).length}
                        </div>
                        <div className="text-xs text-gray-400">High Risk</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-amber-400">
                          {result.findings.filter(f => f.risk_score >= 0.5 && f.risk_score < 0.8).length}
                        </div>
                        <div className="text-xs text-gray-400">Medium Risk</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-emerald-400">
                          {result.findings.filter(f => f.risk_score < 0.5).length}
                        </div>
                        <div className="text-xs text-gray-400">Low Risk</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-teal-400">
                          {new Set(result.findings.map(f => f.chunk_id)).size}
                        </div>
                        <div className="text-xs text-gray-400">Affected Chunks</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="bg-slate-900/70 border-slate-800">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-white flex items-center gap-2 text-lg">
                        <AlertTriangle className="w-5 h-5 text-amber-400" />
                        Flagged Passages
                      </CardTitle>
                      <p className="text-sm text-gray-400 mt-1">
                        Showing {topFindings(result.findings).length} findings ({filteredFindings(result.findings).length} after filters)
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={toggleAllFindings}
                      className="text-gray-400 hover:text-white"
                    >
                      {excludedChunkIds.size === result.findings.length ? "Deselect All" : "Select All to Exclude"}
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {topFindings(result.findings).map((f, idx) => {
                      // Count other findings in same chunk
                      const chunkFindings = result.findings.filter(finding => finding.chunk_id === f.chunk_id)
                      const isDuplicate = idx > 0 && result.findings[idx - 1]?.chunk_id === f.chunk_id
                      
                      return (
                        <div key={`${f.chunk_id}-${idx}-${f.snippet.slice(0, 20)}`} className={`p-4 rounded-lg border transition-colors ${excludedChunkIds.has(f.chunk_id) ? 'border-red-500/50 bg-red-500/5' : isDuplicate ? 'border-slate-700/50 bg-slate-800/30' : 'border-slate-700 bg-slate-800/60'}`}>
                          <div className="flex items-start gap-3">
                            <Checkbox
                              id={`exclude-${f.chunk_id}-${idx}`}
                              checked={excludedChunkIds.has(f.chunk_id)}
                              onCheckedChange={() => toggleChunkExclusion(f.chunk_id)}
                              className="mt-1"
                            />
                            <div className="flex-1 space-y-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                {riskBadge(f.risk_score)}
                                <Badge variant="outline" className="border-slate-600 text-slate-200 capitalize">
                                  {f.reason_label.replace(/_/g, " ")}
                                </Badge>
                                <span className="text-xs text-gray-400">
                                  Chunk {f.chunk_id} • Page {f.location.page_number} • lines {f.location.start_line}-{f.location.end_line}
                                </span>
                                {chunkFindings.length > 1 && !isDuplicate && (
                                  <Badge className="bg-orange-500/20 text-orange-300 border-orange-500/30">
                                    {chunkFindings.length} patterns
                                  </Badge>
                                )}
                                {excludedChunkIds.has(f.chunk_id) && (
                                  <Badge className="bg-red-900/40 text-red-400 border-red-500/50">To be excluded</Badge>
                                )}
                              </div>
                              <div className="text-sm text-gray-100 whitespace-pre-wrap leading-relaxed">{f.snippet}</div>
                              <div className="border-t border-slate-700/50 mt-3 pt-3 space-y-2">
                                <div className="text-xs text-amber-200">
                                  <span className="font-semibold">Recommended:</span> {f.recommended_action}
                                </div>
                                {!isFindingMasked(f) ? (
                                  <div className="flex gap-2 flex-wrap">
                                    <Button 
                                      size="sm" 
                                      onClick={() => handleQuickSanitize(f)}
                                      className="bg-teal-600 hover:bg-teal-500 text-white h-7 text-xs"
                                    >
                                      <Wand2 className="w-3 h-3 mr-1" /> Auto-Fix
                                    </Button>
                                    <Button 
                                      size="sm" 
                                      variant="outline"
                                      onClick={() => handleMaskFinding(f)}
                                      className="border-slate-600 hover:bg-slate-700 h-7 text-xs"
                                    >
                                      <EyeOff className="w-3 h-3 mr-1" /> Mask
                                    </Button>
                                    <Button 
                                      size="sm" 
                                      variant="destructive"
                                      onClick={() => handleExcludeFinding(f)}
                                      className="h-7 text-xs"
                                    >
                                      <Trash2 className="w-3 h-3 mr-1" /> Exclude Chunk
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2 p-2 rounded bg-teal-500/10 border border-teal-500/30">
                                    <Sparkles className="w-4 h-4 text-teal-400" />
                                    <span className="text-xs text-teal-300 font-medium">Marked for sanitization</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-6">
                <Card className="bg-gradient-to-br from-slate-900/90 to-slate-800/80 border-teal-500/40 shadow-lg">
                  <CardHeader className="border-b border-slate-700/50 pb-4">
                    <CardTitle className="text-white flex items-center gap-2 text-lg">
                      <RefreshCw className="w-5 h-5 text-teal-400" />
                      Sanitization Hub
                    </CardTitle>
                    <CardDescription className="text-gray-400">
                      Customize risk mitigation before final processing.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-gray-400 uppercase tracking-wider flex items-center gap-1">
                        <Settings className="w-3 h-3" />
                        Remediation Method
                      </label>
                      <select 
                        value={remediationMethod}
                        onChange={(e) => setRemediationMethod(e.target.value as 'sanitize' | 'mask' | 'remove')}
                        className="w-full bg-slate-800 border-slate-700 text-gray-100 text-sm rounded-md p-2"
                      >
                        <option value="sanitize">Sanitize (replace with [REDACTED])</option>
                        <option value="mask">Mask (hide with ***)</option>
                        <option value="remove">Remove (delete entirely)</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Stopword List</label>
                      <Textarea
                        placeholder="Comma-separated words to always flag (e.g., ignore, disregard, override)"
                        value={stopwords}
                        onChange={(e) => setStopwords(e.target.value)}
                        className="bg-slate-800 border-slate-700 text-sm h-20"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Custom Denylist Patterns</label>
                      <Textarea
                        placeholder="Comma-separated regex patterns (e.g., [0-9]{10}, Confidential)"
                        value={customPatterns}
                        onChange={(e) => setCustomPatterns(e.target.value)}
                        className="bg-slate-800 border-slate-700 text-sm h-20"
                      />
                    </div>

                    <div className="pt-4 space-y-3">
                      <Button
                        disabled={isPreviewing || isReanalyzing}
                        onClick={handlePreview}
                        className="w-full bg-slate-800 hover:bg-slate-700 text-white border border-slate-600"
                      >
                        {isPreviewing ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Eye className="w-4 h-4 mr-2" />
                        )}
                        Preview Sanitization
                      </Button>

                      <Button
                        disabled={isReanalyzing || isPreviewing}
                        onClick={handleReanalyze}
                        className="w-full bg-teal-600 hover:bg-teal-500 text-white"
                      >
                        {isReanalyzing ? (
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <RefreshCw className="w-4 h-4 mr-2" />
                        )}
                        Run Re-analysis
                      </Button>

                      <div className="pt-2 border-t border-slate-700/50">
                        <Button
                          disabled={isExportingSanitized || !result.findings.length}
                          onClick={handleExportSanitizedDocument}
                          className="w-full bg-gradient-to-r from-blue-600 to-teal-600 hover:from-blue-500 hover:to-teal-500 text-white font-semibold shadow-lg"
                        >
                          {isExportingSanitized ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <FileDown className="w-4 h-4 mr-2" />
                          )}
                          Export Clean Document
                        </Button>
                        <p className="text-xs text-gray-400 mt-2 text-center">
                          Download sanitized version for your embedding pipeline
                        </p>
                      </div>
                    </div>

                    {result.hasOwnProperty('comparison') && (
                      <div className="mt-6 p-4 rounded-lg bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/40 shadow-inner">
                        <div className="flex items-center gap-2 mb-3">
                          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                          <span className="text-sm font-semibold text-emerald-300">Re-analysis Complete</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div className="text-gray-300 font-medium">Findings Reduced:</div>
                          <div className="text-emerald-400 font-bold text-lg">↓ {(result as any).comparison.findings_reduction}</div>
                          <div className="text-gray-300 font-medium">Reduction %:</div>
                          <div className="text-emerald-400 font-bold text-lg">{(result as any).comparison.reduction_percentage.toFixed(1)}%</div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
                
                {/* Recommendations Card */}
                {result.recommendations && result.recommendations.length > 0 && (
                  <Card className="bg-gradient-to-br from-amber-900/20 to-slate-900/90 border-amber-500/30 shadow-lg">
                    <CardHeader className="border-b border-amber-500/20 pb-3">
                      <CardTitle className="text-white flex items-center gap-2 text-base">
                        <AlertTriangle className="w-5 h-5 text-amber-400" />
                        Recommendations
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                      <ul className="space-y-2">
                        {result.recommendations.map((rec, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm text-gray-200">
                            <span className="text-amber-400 mt-0.5">•</span>
                            <span className="flex-1">{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          )}

          {/* Sanitization Preview Dialog */}
          <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
            <DialogContent className="max-w-4xl bg-slate-900 border-slate-800 text-white overflow-hidden flex flex-col max-h-[90vh]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-xl">
                  <Eye className="w-6 h-6 text-teal-400" />
                  Sanitization Preview
                </DialogTitle>
                <CardDescription className="text-gray-400">
                  Showing how {previewResult?.sanitized_chunks.length} chunks will be affected.
                </CardDescription>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {previewResult?.sanitized_chunks.map((preview) => (
                  <div key={preview.chunk_id} className="space-y-3 p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-teal-500/20 text-teal-300 flex items-center gap-1">
                          <FileText className="w-3 h-3" />
                          Chunk {preview.chunk_id} • Page {preview.page_number}
                        </Badge>
                        <Badge className={`${
                          preview.action_taken === 'masked' ? 'bg-blue-500/20 text-blue-300' :
                          preview.action_taken === 'removed' ? 'bg-red-500/20 text-red-300' :
                          'bg-amber-500/20 text-amber-300'
                        }`}>
                          {preview.action_taken.toUpperCase()}
                        </Badge>
                      </div>
                    </div>

                    {/* Side-by-side comparison with color coding */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="text-xs text-red-400 font-semibold flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          Original (Suspicious)
                        </div>
                        <pre className="text-xs text-gray-200 whitespace-pre-wrap bg-red-950/20 border border-red-500/30 p-3 rounded max-h-48 overflow-y-auto">
                          {preview.original_text}
                        </pre>
                      </div>
                      <div className="space-y-2">
                        <div className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Sanitized (Safe)
                        </div>
                        <pre className="text-xs text-emerald-200 whitespace-pre-wrap bg-emerald-950/20 border border-emerald-500/30 p-3 rounded max-h-48 overflow-y-auto">
                          {preview.sanitized_text}
                        </pre>
                      </div>
                    </div>

                    {preview.patterns_matched.length > 0 && (
                      <div className="flex items-start gap-2 p-2 rounded bg-amber-500/10 border border-amber-500/20">
                        <Shield className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                        <div className="text-xs text-amber-200">
                          <span className="font-semibold">Patterns detected:</span> {preview.patterns_matched.join(", ")}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <DialogFooter className="p-4 border-t border-slate-800 bg-slate-900/50">
                <div className="flex items-center justify-between w-full">
                  <div className="text-sm text-gray-400">
                    Findings reduced from <span className="text-red-400">{previewResult?.original_findings_count}</span> to <span className="text-emerald-400">{previewResult?.remaining_findings_count}</span>
                  </div>
                  <Button onClick={() => setIsPreviewOpen(false)} className="bg-teal-600 hover:bg-teal-500">
                    Got it
                  </Button>
                </div>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {result.recommendations.length > 0 && (
            <Card className="bg-gradient-to-br from-blue-900/20 via-slate-900/90 to-slate-900/90 border-blue-500/30 shadow-lg">
              <CardHeader className="border-b border-blue-500/20 pb-3">
                <CardTitle className="text-white flex items-center gap-2">
                  <Shield className="w-5 h-5 text-blue-400" />
                  Security Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-4">
                {result.recommendations.map((rec, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-slate-800/40 border border-slate-700/50">
                    <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-blue-400 font-bold text-xs">{idx + 1}</span>
                    </div>
                    <span className="text-sm text-gray-200 flex-1 leading-relaxed">{rec}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}




