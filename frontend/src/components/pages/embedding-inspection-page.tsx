import React, { useState } from "react"
import {
  promptInjectionAPI,
  EmbeddingInspectionResponse,
  EmbeddingFinding,
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
  AlertTriangle,
  FileText,
  Shield,
  Loader2,
  CheckCircle2,
  Trash2,
  Lock,
  ArrowRight,
  Download,
  FileDown,
  Wand2,
  EyeOff,
  Sparkles
} from "lucide-react"

export const EmbeddingInspectionPage: React.FC = () => {
  const [file, setFile] = useState<File | null>(null)
  const [chunkSize, setChunkSize] = useState<number>(500)
  const [chunkOverlap, setChunkOverlap] = useState<number>(100)
  const [result, setResult] = useState<EmbeddingInspectionResponse | ReanalysisResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)

  // Interactive features: exclude chunks, mask findings, denylist patterns
  const [excludedChunkIds, setExcludedChunkIds] = useState<Set<number>>(new Set())
  const [customPatterns, setCustomPatterns] = useState<string>("")
  const [maskedFindings, setMaskedFindings] = useState<Set<string>>(new Set())
  
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

  /** User-friendly recommendation per finding — one clear action + details */
  const getFindingRecommendation = (f: EmbeddingFinding): {
    title: string
    /** One sentence: exactly what the user should do for this chunk */
    recommendedAction: string
    explanation: string
    steps: string[]
  } => {
    const label = (f.reason_label || "").replace(/_/g, " ")
    const highRisk = f.risk_score >= 0.8
    switch (f.reason_label) {
      case "instruction_payload":
        return {
          title: "Instruction override / jailbreak pattern",
          recommendedAction: "Sanitize or remove this passage and add the phrase to your denylist; or exclude this entire chunk from embedding.",
          explanation: "This text may try to override model instructions or inject commands. It can mislead your RAG or LLM if embedded as-is.",
          steps: [
            "Use Auto-Fix to replace the phrase with [REDACTED], or Exclude Chunk to drop it from embedding.",
            "Add the phrase to your denylist so future scans catch it.",
            "Re-run inspection after changes to confirm the finding is resolved.",
          ],
        }
      case "trigger_phrases":
        return {
          title: "Trigger phrase detected",
          recommendedAction: "Remove or mask the phrase and add it to your stopword list; then re-run inspection.",
          explanation: "Trigger phrases can bias retrieval or trigger unsafe behavior. They should not appear in trusted content.",
          steps: [
            "Use Mask to hide the phrase or Auto-Fix to sanitize it.",
            "Add the phrase to your stopword list and re-run inspection when satisfied.",
          ],
        }
      case "obfuscated_tokens":
        return {
          title: "Obfuscated or encoded content",
          recommendedAction: "Decode and inspect this content; if it looks malicious, normalize or remove it and add similar patterns to your denylist.",
          explanation: "This may be deliberately obfuscated to hide instructions or evade filters. Decode and review before embedding.",
          steps: [
            "Decode the content (e.g. unescape, decode base64) and check for hidden instructions.",
            "Use Exclude Chunk if the whole passage is suspicious, or sanitize the harmful part.",
            "Add the pattern to Custom Denylist Patterns for future scans.",
          ],
        }
      case "extreme_repetition":
        return {
          title: "Extreme repetition",
          recommendedAction: "Exclude this chunk from embedding or shorten it; consider reducing chunk size so repeated blocks are isolated.",
          explanation: "Heavy repetition can skew embeddings and retrieval. It may also be used to stress-test or manipulate the system.",
          steps: [
            "Use Exclude Chunk to drop this chunk from embedding, or edit the source to shorten repetition.",
            "Consider reducing Chunk Size in Upload & Settings so similar content is split into smaller chunks.",
            "Re-scan after changes; if repetition is legitimate (e.g. a list), you can leave it and monitor.",
          ],
        }
      default:
        return {
          title: `Issue: ${label}`,
          recommendedAction: f.recommended_action || (highRisk ? "Sanitize or remove this passage before embedding, then re-scan." : "Review this passage; use Auto-Fix, Mask, or Exclude Chunk below as needed."),
          explanation: f.recommended_action || "Review this passage before embedding.",
          steps: highRisk
            ? ["Review the flagged text.", "Use Auto-Fix to sanitize or Exclude Chunk to remove from embedding.", "Re-scan after changes."]
            : ["Review and fix if needed.", "Use Auto-Fix, Mask, or Exclude Chunk below."],
        }
    }
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
    setMaskedFindings(prev => {
      const newSet = new Set(Array.from(prev))
      newSet.add(key)
      return newSet
    })
    // Also add to custom patterns if it's a specific pattern
    if (finding.snippet && finding.snippet.length < 100) {
      const pattern = finding.snippet.substring(0, 50).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      setCustomPatterns(prev => prev ? `${prev}, ${pattern}` : pattern)
    }
  }

  const handleMaskFinding = (finding: EmbeddingFinding) => {
    const key = `${finding.chunk_id}-${finding.reason_label}`
    setMaskedFindings(prev => {
      const newSet = new Set(Array.from(prev))
      newSet.add(key)
      return newSet
    })
  }

  const handleExcludeFinding = (finding: EmbeddingFinding) => {
    toggleChunkExclusion(finding.chunk_id)
  }

  const isFindingMasked = (finding: EmbeddingFinding) => {
    const key = `${finding.chunk_id}-${finding.reason_label}`
    return maskedFindings.has(key)
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
                className="bg-white border-slate-400 text-gray-900 placeholder:text-gray-500"
              />
            </div>
            <div>
              <label className="text-sm text-gray-300 block mb-1">Chunk Overlap (words)</label>
              <Input
                type="number"
                min={0}
                value={chunkOverlap}
                onChange={(e) => setChunkOverlap(Number(e.target.value))}
                className="bg-white border-slate-400 text-gray-900 placeholder:text-gray-500"
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

          {/* Clear report summary and top-level recommendations when there are findings */}
          {result.findings.length > 0 && (
            <Card className="bg-gradient-to-br from-teal-900/30 to-slate-900/90 border-teal-500/40 shadow-lg">
              <CardHeader className="pb-2">
                <CardTitle className="text-white flex items-center gap-2 text-lg">
                  <FileText className="w-5 h-5 text-teal-400" />
                  Report summary — what to do
                </CardTitle>
                <CardDescription className="text-gray-400">
                  We found {result.findings.length} issue{result.findings.length !== 1 ? "s" : ""} in your document. Follow the steps below to fix them before embedding.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                    <span className="text-2xl font-bold text-red-400">{result.findings.filter(f => f.risk_score >= 0.8).length}</span>
                    <span className="block text-gray-400">High risk — fix first</span>
                  </div>
                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                    <span className="text-2xl font-bold text-amber-400">{result.findings.filter(f => f.risk_score >= 0.5 && f.risk_score < 0.8).length}</span>
                    <span className="block text-gray-400">Medium risk</span>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-700/50 border border-slate-600">
                    <span className="text-2xl font-bold text-teal-400">{new Set(result.findings.map(f => f.chunk_id)).size}</span>
                    <span className="block text-gray-400">Chunks affected</span>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-700/50 border border-slate-600">
                    <span className="text-2xl font-bold text-white">{result.total_chunks}</span>
                    <span className="block text-gray-400">Total chunks scanned</span>
                  </div>
                </div>
                <div className="rounded-xl bg-slate-800/60 border border-slate-600 p-4">
                  <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                    <ArrowRight className="w-4 h-4 text-teal-400" />
                    Recommended next steps
                  </h4>
                  <ol className="space-y-2 text-gray-200 text-sm list-decimal list-inside">
                    <li>Review each <strong className="text-white">flagged passage</strong> below and read the clear recommendation for that finding.</li>
                    <li>Use <strong className="text-teal-300">Auto-Fix</strong> to sanitize, <strong className="text-slate-300">Mask</strong> to hide, or <strong className="text-red-300">Exclude Chunk</strong> to drop unsafe chunks.</li>
                    <li>Re-run inspection after making changes to confirm findings are resolved.</li>
                  </ol>
                </div>
              </CardContent>
            </Card>
          )}

          {result.findings.length > 0 && (
            <div className="w-full max-w-6xl space-y-6">
                {/* Summary Card - full width */}
                <Card className="bg-gradient-to-br from-slate-900/90 to-slate-800/90 border-slate-700">
                  <CardContent className="p-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                      <div className="text-center p-3 rounded-lg bg-slate-800/50">
                        <div className="text-3xl font-bold text-red-400">
                          {result.findings.filter(f => f.risk_score >= 0.8).length}
                        </div>
                        <div className="text-sm text-gray-400 mt-1">High Risk</div>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-slate-800/50">
                        <div className="text-3xl font-bold text-amber-400">
                          {result.findings.filter(f => f.risk_score >= 0.5 && f.risk_score < 0.8).length}
                        </div>
                        <div className="text-sm text-gray-400 mt-1">Medium Risk</div>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-slate-800/50">
                        <div className="text-3xl font-bold text-emerald-400">
                          {result.findings.filter(f => f.risk_score < 0.5).length}
                        </div>
                        <div className="text-sm text-gray-400 mt-1">Low Risk</div>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-slate-800/50">
                        <div className="text-3xl font-bold text-teal-400">
                          {new Set(result.findings.map(f => f.chunk_id)).size}
                        </div>
                        <div className="text-sm text-gray-400 mt-1">Affected Chunks</div>
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
                              {/* Clear recommendation for this chunk — user can act accordingly */}
                              {(() => {
                                const rec = getFindingRecommendation(f)
                                return (
                                  <div className="border-t border-slate-700/50 mt-3 pt-3 space-y-3">
                                    <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-4 space-y-3">
                                      <h4 className="text-amber-200 font-semibold text-sm flex items-center gap-2">
                                        <AlertTriangle className="w-4 h-4 shrink-0" />
                                        {rec.title}
                                      </h4>
                                      {/* Single clear recommended action so user may act accordingly */}
                                      <div className="rounded-md bg-teal-500/15 border border-teal-500/40 px-3 py-2.5">
                                        <p className="text-xs font-semibold text-teal-200 uppercase tracking-wider mb-1">Recommended action for this chunk</p>
                                        <p className="text-sm text-white font-medium leading-snug">{rec.recommendedAction}</p>
                                      </div>
                                      <p className="text-sm text-gray-200 leading-relaxed">{rec.explanation}</p>
                                      <div className="mt-2">
                                        <p className="text-xs font-medium text-amber-200/90 mb-1">Steps you can take:</p>
                                        <ul className="list-decimal list-inside space-y-1 text-xs text-gray-300">
                                          {rec.steps.map((step, i) => (
                                            <li key={i}>{step}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    </div>
                                    {!isFindingMasked(f) ? (
                                      <div className="flex gap-2 flex-wrap">
                                        <Button 
                                          size="sm" 
                                          onClick={() => handleQuickSanitize(f)}
                                          className="bg-teal-600 hover:bg-teal-500 text-white h-8 text-xs"
                                        >
                                          <Wand2 className="w-3 h-3 mr-1" /> Auto-Fix
                                        </Button>
                                        <Button 
                                          size="sm" 
                                          variant="outline"
                                          onClick={() => handleMaskFinding(f)}
                                          className="border-slate-600 hover:bg-slate-700 h-8 text-xs"
                                        >
                                          <EyeOff className="w-3 h-3 mr-1" /> Mask
                                        </Button>
                                        <Button 
                                          size="sm" 
                                          variant="destructive"
                                          onClick={() => handleExcludeFinding(f)}
                                          className="h-8 text-xs"
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
                                )
                              })()}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </CardContent>
                </Card>

                {/* Clear recommendations - full width below report */}
                {result.recommendations && result.recommendations.length > 0 && (
                  <Card className="bg-gradient-to-br from-amber-900/20 to-slate-900/90 border-amber-500/30 shadow-lg">
                    <CardHeader className="border-b border-amber-500/20 pb-3">
                      <CardTitle className="text-white flex items-center gap-2 text-lg">
                        <AlertTriangle className="w-5 h-5 text-amber-400" />
                        Clear recommendations
                      </CardTitle>
                      <CardDescription className="text-gray-400">
                        Prioritized actions based on this scan
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-5">
                      <ol className="space-y-4 list-none pl-0 max-w-3xl">
                        {result.recommendations.map((rec, idx) => (
                          <li key={idx} className="flex items-start gap-4 text-base text-gray-200 leading-relaxed">
                            <span className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-500/30 text-amber-300 font-semibold flex items-center justify-center text-sm">
                              {idx + 1}
                            </span>
                            <span className="flex-1 pt-0.5">{rec}</span>
                          </li>
                        ))}
                      </ol>
                    </CardContent>
                  </Card>
                )}
            </div>
          )}

        </div>
      )}
    </div>
  )
}




