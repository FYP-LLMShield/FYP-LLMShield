import React, { useState } from "react"
import { promptInjectionAPI, RetrievalAttackResponse, RetrievalManipulationFinding, RetrievalAttackParams } from "../../lib/api"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/card"
import { Badge } from "../ui/badge"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Textarea } from "../ui/textarea"
import { Switch } from "../ui/switch"
import { Label } from "../ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs"
import { Checkbox } from "../ui/checkbox"
import {
    AlertTriangle,
    Target,
    Loader2,
    CheckCircle,
    XCircle,
    TrendingUp,
    TrendingDown,
    Download,
    Play,
    Search,
    Settings,
    BarChart3,
    ArrowUpDown,
    FileText,
    Shield
} from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter
} from "../ui/dialog"

export const RetrievalAttackPage: React.FC = () => {
    const [file, setFile] = useState<File | null>(null)
    const [queries, setQueries] = useState<string>("")
    const [topK, setTopK] = useState<number>(10)
    const [similarityThreshold, setSimilarityThreshold] = useState<number>(0.7)
    const [rankShiftThreshold, setRankShiftThreshold] = useState<number>(5)
    const [enableParaphrase, setEnableParaphrase] = useState<boolean>(true)
    const [enableUnicode, setEnableUnicode] = useState<boolean>(true)
    const [enableHomoglyph, setEnableHomoglyph] = useState<boolean>(true)
    const [enableTrigger, setEnableTrigger] = useState<boolean>(true)
    const [enableModelInference, setEnableModelInference] = useState<boolean>(false)
    const [activeTab, setActiveTab] = useState("config")
    const [result, setResult] = useState<RetrievalAttackResponse | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [selectedFinding, setSelectedFinding] = useState<RetrievalManipulationFinding | null>(null)
    const [isDetailsOpen, setIsDetailsOpen] = useState(false)

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0])
            setError(null)
        }
    }

    const getVariants = (): string => {
        const variants = []
        if (enableParaphrase) variants.push("paraphrase")
        if (enableUnicode) variants.push("unicode")
        if (enableHomoglyph) variants.push("homoglyph")
        if (enableTrigger) variants.push("trigger")
        return variants.join(",")
    }

    const handleSimulate = async () => {
        if (!file) {
            setError("Please select a vector index snapshot file.")
            return
        }
        if (!queries.trim()) {
            setError("Please enter at least one query.")
            return
        }

        setIsLoading(true)
        setError(null)
        setResult(null)

        try {
            const params: RetrievalAttackParams = {
                queries: queries,
                top_k: topK,
                similarity_threshold: similarityThreshold,
                rank_shift_threshold: rankShiftThreshold,
                variants: getVariants(),
                enable_model_inference: enableModelInference
            }
            const response = await promptInjectionAPI.retrievalAttackSimulation(file, params)
            if (response.success && response.data) {
                setResult(response.data as RetrievalAttackResponse)
                setActiveTab("results")
            } else {
                setError(response.error || "Simulation failed.")
            }
        } catch (e: any) {
            setError(e?.message || "Simulation failed.")
        } finally {
            setIsLoading(false)
        }
    }

    const [exportFormat, setExportFormat] = useState<'json' | 'csv' | 'pdf'>('json')
    const [isExporting, setIsExporting] = useState(false)

    const handleExport = async (format: 'json' | 'csv' | 'pdf' = exportFormat) => {
        if (!result) return
        setIsExporting(true)
        try {
            const response = await promptInjectionAPI.exportRetrievalAttackReport(result.scan_id, result, format)
            if (!response.success) {
                setError(`Export failed: ${response.error}`)
            }
        } catch (e: any) {
            console.error("Export failed:", e)
            setError(`Export failed: ${e.message}`)
        } finally {
            setIsExporting(false)
        }
    }

    const calculateRankShiftMetrics = () => {
        if (!result || !result.findings || result.findings.length === 0) {
            return null
        }

        const rankShifts = result.findings.map(f => f.rank_shift)
        const avgShift = rankShifts.reduce((a, b) => a + b, 0) / rankShifts.length
        const maxShift = Math.max(...rankShifts)
        const minShift = Math.min(...rankShifts)
        const movesIntoTopK = result.findings.filter(f => f.baseline_rank === undefined || f.baseline_rank === null).length
        const significantShifts = rankShifts.filter(s => Math.abs(s) >= rankShiftThreshold).length
        
        // Distribution
        const positive = rankShifts.filter(s => s > 0).length
        const negative = rankShifts.filter(s => s < 0).length
        const neutral = rankShifts.filter(s => s === 0).length

        return {
            average: avgShift,
            max: maxShift,
            min: minShift,
            movesIntoTopK,
            significantShifts,
            distribution: { positive, negative, neutral },
            total: rankShifts.length
        }
    }

    const openFindingDetails = (finding: RetrievalManipulationFinding) => {
        setSelectedFinding(finding)
        setIsDetailsOpen(true)
    }

    const confidenceBadge = (confidence: number) => {
        if (confidence >= 0.8) return <Badge className="bg-red-600 text-white">Critical</Badge>
        if (confidence >= 0.6) return <Badge className="bg-orange-500 text-white">High</Badge>
        if (confidence >= 0.4) return <Badge className="bg-amber-500 text-white">Medium</Badge>
        return <Badge className="bg-emerald-600 text-white">Low</Badge>
    }

    const variantBadge = (variant: string) => {
        const colors: Record<string, string> = {
            paraphrase: "bg-blue-600",
            unicode: "bg-purple-600",
            homoglyph: "bg-pink-600",
            trigger: "bg-orange-600",
            leetspeak: "bg-teal-600"
        }
        return (
            <Badge className={colors[variant] || "bg-gray-600"}>
                {variant}
            </Badge>
        )
    }

    const asrColor = (asr: number) => {
        if (asr >= 0.7) return "text-red-500"
        if (asr >= 0.4) return "text-amber-500"
        return "text-emerald-500"
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center gap-3">
                <Target className="w-6 h-6 text-orange-500" />
                <div>
                    <h1 className="text-2xl font-bold text-white">Retrieval Attack Simulation</h1>
                    <p className="text-gray-400 text-sm">
                        Simulate adversarial queries to test retrieval system robustness and measure ranking manipulation.
                    </p>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="bg-slate-800 border-slate-700">
                    <TabsTrigger value="config" className="data-[state=active]:bg-orange-600">
                        <Settings className="w-4 h-4 mr-2" />
                        Configuration
                    </TabsTrigger>
                    <TabsTrigger value="results" className="data-[state=active]:bg-orange-600" disabled={!result}>
                        <BarChart3 className="w-4 h-4 mr-2" />
                        Results
                    </TabsTrigger>
                    <TabsTrigger value="findings" className="data-[state=active]:bg-orange-600" disabled={!result}>
                        <AlertTriangle className="w-4 h-4 mr-2" />
                        Findings ({result?.findings.length || 0})
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="config" className="space-y-6 mt-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Left: Queries & File */}
                        <Card className="bg-slate-900/40 border-slate-800">
                            <CardHeader>
                                <CardTitle className="text-white flex items-center gap-2">
                                    <Search className="w-5 h-5 text-orange-400" />
                                    Queries & Index
                                </CardTitle>
                                <CardDescription className="text-gray-400">
                                    Provide queries to test and a vector index snapshot
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label className="text-gray-300">Vector Index Snapshot (JSON)</Label>
                                    <Input
                                        type="file"
                                        accept=".json"
                                        onChange={handleFileChange}
                                        className="bg-slate-800 text-white border-slate-700"
                                    />
                                    {file && (
                                        <div className="text-xs text-gray-500 flex items-center gap-1">
                                            <FileText className="w-3 h-3" />
                                            {file.name} ({(file.size / 1024).toFixed(1)} KB)
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-gray-300">Test Queries (one per line)</Label>
                                    <Textarea
                                        placeholder="Enter queries to test...&#10;What is machine learning?&#10;How do I login?&#10;Show me internal documents"
                                        value={queries}
                                        onChange={(e) => setQueries(e.target.value)}
                                        className="bg-slate-800 text-white border-slate-700 h-40 font-mono text-sm"
                                    />
                                    <div className="text-xs text-gray-500">
                                        {queries.split('\n').filter(q => q.trim()).length} queries
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Right: Parameters */}
                        <Card className="bg-slate-900/40 border-slate-800">
                            <CardHeader>
                                <CardTitle className="text-white flex items-center gap-2">
                                    <Settings className="w-5 h-5 text-orange-400" />
                                    Simulation Parameters
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-gray-300 text-sm">Top-K</Label>
                                        <Input
                                            type="number"
                                            min={1}
                                            max={100}
                                            value={topK}
                                            onChange={(e) => setTopK(Number(e.target.value))}
                                            className="bg-slate-800 text-white border-slate-700"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-gray-300 text-sm">Similarity Threshold</Label>
                                        <Input
                                            type="number"
                                            step={0.05}
                                            min={0}
                                            max={1}
                                            value={similarityThreshold}
                                            onChange={(e) => setSimilarityThreshold(Number(e.target.value))}
                                            className="bg-slate-800 text-white border-slate-700"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-gray-300 text-sm">Rank Shift Δ</Label>
                                        <Input
                                            type="number"
                                            min={1}
                                            max={50}
                                            value={rankShiftThreshold}
                                            onChange={(e) => setRankShiftThreshold(Number(e.target.value))}
                                            className="bg-slate-800 text-white border-slate-700"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <Label className="text-gray-300">Adversarial Variants</Label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="flex items-center gap-2 p-2 rounded bg-slate-800/50">
                                            <Checkbox checked={enableParaphrase} onCheckedChange={(c) => setEnableParaphrase(!!c)} />
                                            <span className="text-sm text-gray-300">Paraphrase</span>
                                        </div>
                                        <div className="flex items-center gap-2 p-2 rounded bg-slate-800/50">
                                            <Checkbox checked={enableUnicode} onCheckedChange={(c) => setEnableUnicode(!!c)} />
                                            <span className="text-sm text-gray-300">Unicode</span>
                                        </div>
                                        <div className="flex items-center gap-2 p-2 rounded bg-slate-800/50">
                                            <Checkbox checked={enableHomoglyph} onCheckedChange={(c) => setEnableHomoglyph(!!c)} />
                                            <span className="text-sm text-gray-300">Homoglyph</span>
                                        </div>
                                        <div className="flex items-center gap-2 p-2 rounded bg-slate-800/50">
                                            <Checkbox checked={enableTrigger} onCheckedChange={(c) => setEnableTrigger(!!c)} />
                                            <span className="text-sm text-gray-300">Trigger-Augmented</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50 border border-slate-700">
                                    <div>
                                        <Label className="text-gray-300">Model Inference</Label>
                                        <p className="text-xs text-gray-500">Analyze behavioral impact on LLM responses</p>
                                    </div>
                                    <Switch checked={enableModelInference} onCheckedChange={setEnableModelInference} />
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="flex items-center gap-4">
                        <Button
                            onClick={handleSimulate}
                            disabled={isLoading || !file || !queries.trim()}
                            className="bg-orange-600 hover:bg-orange-500 text-white px-6"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Simulating...
                                </>
                            ) : (
                                <>
                                    <Play className="w-4 h-4 mr-2" />
                                    Run Simulation
                                </>
                            )}
                        </Button>
                        {error && <span className="text-red-400 text-sm">{error}</span>}
                    </div>
                </TabsContent>

                <TabsContent value="results" className="space-y-6 mt-6">
                    {result && (
                        <>
                            {/* Summary Cards */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <Card className="bg-slate-900/40 border-slate-800">
                                    <CardContent className="pt-6">
                                        <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Attack Success Rate</div>
                                        <div className={`text-3xl font-bold ${asrColor(result.attack_success_rate)}`}>
                                            {(result.attack_success_rate * 100).toFixed(1)}%
                                        </div>
                                    </CardContent>
                                </Card>
                                <Card className="bg-slate-900/40 border-slate-800">
                                    <CardContent className="pt-6">
                                        <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Total Queries</div>
                                        <div className="text-3xl font-bold text-white">{result.total_queries}</div>
                                        <div className="text-xs text-gray-500">
                                            <span className="text-emerald-400">{result.successful_queries} ok</span>
                                            {result.failed_queries > 0 && (
                                                <span className="text-red-400"> / {result.failed_queries} failed</span>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                                <Card className="bg-slate-900/40 border-slate-800">
                                    <CardContent className="pt-6">
                                        <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Findings</div>
                                        <div className={`text-3xl font-bold ${result.findings.length > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
                                            {result.findings.length}
                                        </div>
                                        <div className="text-xs text-gray-500">Ranking manipulations</div>
                                    </CardContent>
                                </Card>
                                <Card className="bg-slate-900/40 border-slate-800">
                                    <CardContent className="pt-6">
                                        <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Variants Tested</div>
                                        <div className="text-3xl font-bold text-blue-400">
                                            {result.parameters.variant_types?.length || 0}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Recommendations */}
                            {result.recommendations.length > 0 && (
                                <Card className="bg-slate-900/40 border-slate-800">
                                    <CardHeader>
                                        <CardTitle className="text-white flex items-center gap-2 text-lg">
                                            <Shield className="w-5 h-5 text-orange-400" />
                                            Recommendations
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-2">
                                            {result.recommendations.map((rec, idx) => (
                                                <div key={idx} className="flex items-start gap-3 p-3 rounded-lg bg-orange-500/5 border border-orange-500/20">
                                                    <CheckCircle className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
                                                    <span className="text-sm text-gray-300">{rec}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Rank-Shift Metrics Visualization */}
                            {result.findings.length > 0 && (() => {
                                const metrics = calculateRankShiftMetrics()
                                if (!metrics) return null

                                return (
                                    <Card className="bg-slate-900/40 border-slate-800">
                                        <CardHeader>
                                            <CardTitle className="text-white flex items-center gap-2 text-lg">
                                                <BarChart3 className="w-5 h-5 text-blue-400" />
                                                Rank-Shift Metrics
                                            </CardTitle>
                                            <CardDescription className="text-gray-400">
                                                Analysis of ranking manipulation across all findings
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                                                <div className="p-4 bg-slate-800/50 rounded-xl text-center">
                                                    <div className="text-xs text-gray-400 uppercase mb-1">Average Shift</div>
                                                    <div className={`text-2xl font-bold ${metrics.average > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                                                        {metrics.average > 0 ? '+' : ''}{metrics.average.toFixed(1)}
                                                    </div>
                                                </div>
                                                <div className="p-4 bg-slate-800/50 rounded-xl text-center">
                                                    <div className="text-xs text-gray-400 uppercase mb-1">Max Shift</div>
                                                    <div className="text-2xl font-bold text-orange-400">
                                                        +{metrics.max}
                                                    </div>
                                                </div>
                                                <div className="p-4 bg-slate-800/50 rounded-xl text-center">
                                                    <div className="text-xs text-gray-400 uppercase mb-1">Min Shift</div>
                                                    <div className="text-2xl font-bold text-blue-400">
                                                        {metrics.min}
                                                    </div>
                                                </div>
                                                <div className="p-4 bg-slate-800/50 rounded-xl text-center">
                                                    <div className="text-xs text-gray-400 uppercase mb-1">New in Top-K</div>
                                                    <div className="text-2xl font-bold text-purple-400">
                                                        {metrics.movesIntoTopK}
                                                    </div>
                                                </div>
                                                <div className="p-4 bg-slate-800/50 rounded-xl text-center">
                                                    <div className="text-xs text-gray-400 uppercase mb-1">Significant</div>
                                                    <div className="text-2xl font-bold text-amber-400">
                                                        {metrics.significantShifts}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Distribution Bar */}
                                            <div className="space-y-2">
                                                <div className="text-sm text-gray-400 flex items-center justify-between">
                                                    <span>Rank Shift Distribution</span>
                                                    <span className="text-xs text-gray-500">{metrics.total} findings</span>
                                                </div>
                                                <div className="flex h-8 rounded-lg overflow-hidden bg-slate-800">
                                                    {metrics.distribution.positive > 0 && (
                                                        <div
                                                            className="bg-red-500 flex items-center justify-center text-xs font-bold text-white"
                                                            style={{ width: `${(metrics.distribution.positive / metrics.total) * 100}%` }}
                                                            title={`${metrics.distribution.positive} positive shifts (worse ranking)`}
                                                        >
                                                            {metrics.distribution.positive > 2 && `↑ ${metrics.distribution.positive}`}
                                                        </div>
                                                    )}
                                                    {metrics.distribution.neutral > 0 && (
                                                        <div
                                                            className="bg-gray-500 flex items-center justify-center text-xs font-bold text-white"
                                                            style={{ width: `${(metrics.distribution.neutral / metrics.total) * 100}%` }}
                                                            title={`${metrics.distribution.neutral} no change`}
                                                        >
                                                            {metrics.distribution.neutral > 2 && `= ${metrics.distribution.neutral}`}
                                                        </div>
                                                    )}
                                                    {metrics.distribution.negative > 0 && (
                                                        <div
                                                            className="bg-emerald-500 flex items-center justify-center text-xs font-bold text-white"
                                                            style={{ width: `${(metrics.distribution.negative / metrics.total) * 100}%` }}
                                                            title={`${metrics.distribution.negative} negative shifts (better ranking)`}
                                                        >
                                                            {metrics.distribution.negative > 2 && `↓ ${metrics.distribution.negative}`}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex justify-between text-xs text-gray-500">
                                                    <span className="flex items-center gap-1">
                                                        <div className="w-3 h-3 bg-red-500 rounded"></div>
                                                        Improved (worse for security)
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <div className="w-3 h-3 bg-gray-500 rounded"></div>
                                                        No change
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <div className="w-3 h-3 bg-emerald-500 rounded"></div>
                                                        Degraded (better for security)
                                                    </span>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                )
                            })()}

                            {/* Export Options */}
                            <Card className="bg-slate-900/40 border-slate-800">
                                <CardHeader>
                                    <CardTitle className="text-white text-lg">Export Report</CardTitle>
                                    <CardDescription className="text-gray-400">
                                        Download full simulation results with reproducible parameters
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-2">
                                            <Label className="text-gray-300">Format:</Label>
                                            <div className="flex gap-2">
                                                {(['json', 'csv', 'pdf'] as const).map(format => (
                                                    <Button
                                                        key={format}
                                                        variant={exportFormat === format ? 'default' : 'outline'}
                                                        size="sm"
                                                        onClick={() => setExportFormat(format)}
                                                        className={exportFormat === format ? 'bg-orange-600' : 'border-slate-700'}
                                                    >
                                                        {format.toUpperCase()}
                                                    </Button>
                                                ))}
                                            </div>
                                        </div>
                                        <Button
                                            onClick={() => handleExport()}
                                            disabled={isExporting}
                                            className="bg-orange-600 hover:bg-orange-500"
                                        >
                                            {isExporting ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                    Exporting...
                                                </>
                                            ) : (
                                                <>
                                                    <Download className="w-4 h-4 mr-2" />
                                                    Export {exportFormat.toUpperCase()}
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                    <div className="mt-4 text-xs text-gray-500 space-y-1">
                                        <div>• JSON: Full report with all findings and behavioral impacts</div>
                                        <div>• CSV: Tabular format with ASR, rank-shift metrics, and implicated vectors</div>
                                        <div>• PDF: Professional report with summary and top findings</div>
                                    </div>
                                </CardContent>
                            </Card>
                        </>
                    )}
                </TabsContent>

                <TabsContent value="findings" className="space-y-6 mt-6">
                    {result && result.findings.length > 0 && (
                        <Card className="bg-slate-900/40 border-slate-800">
                            <CardHeader>
                                <CardTitle className="text-white flex items-center gap-2">
                                    <ArrowUpDown className="w-5 h-5 text-amber-400" />
                                    Ranking Manipulations ({result.findings.length})
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {result.findings.slice(0, 20).map((finding, idx) => (
                                    <div
                                        key={idx}
                                        className="p-4 rounded-xl border border-slate-700 bg-slate-800/40 hover:bg-slate-800/60 hover:border-orange-500/50 transition-all cursor-pointer"
                                        onClick={() => openFindingDetails(finding)}
                                    >
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                {confidenceBadge(finding.confidence)}
                                                {variantBadge(finding.variant_type)}
                                            </div>
                                            <div className="flex items-center gap-2 text-sm">
                                                {finding.rank_shift > 0 ? (
                                                    <span className="text-red-400 flex items-center gap-1">
                                                        <TrendingUp className="w-4 h-4" />
                                                        +{finding.rank_shift}
                                                    </span>
                                                ) : (
                                                    <span className="text-emerald-400 flex items-center gap-1">
                                                        <TrendingDown className="w-4 h-4" />
                                                        {finding.rank_shift}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-sm text-gray-100 mb-2">{finding.description}</div>
                                        <div className="text-xs text-gray-500">
                                            Query: <span className="text-gray-400">{finding.query.slice(0, 50)}...</span>
                                        </div>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    )}

                    {result && result.findings.length === 0 && (
                        <Card className="bg-slate-900/40 border-slate-800">
                            <CardContent className="py-12 text-center">
                                <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
                                <h3 className="text-lg font-semibold text-white mb-2">No Manipulations Detected</h3>
                                <p className="text-gray-400">The retrieval pipeline appears robust against the tested adversarial variants.</p>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>
            </Tabs>

            {/* Finding Details Dialog */}
            <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
                <DialogContent className="max-w-2xl bg-slate-900 border-slate-800 text-white">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-xl">
                            <Target className="w-6 h-6 text-orange-500" />
                            Manipulation Details
                        </DialogTitle>
                    </DialogHeader>

                    {selectedFinding && (
                        <div className="space-y-6 pt-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <span className="text-xs text-slate-500 uppercase font-bold">Variant Type</span>
                                    <div className="flex">{variantBadge(selectedFinding.variant_type)}</div>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-xs text-slate-500 uppercase font-bold">Confidence</span>
                                    <div className="flex">{confidenceBadge(selectedFinding.confidence)}</div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <span className="text-xs text-slate-500 uppercase font-bold">Original Query</span>
                                <p className="text-sm text-slate-200 bg-slate-800/50 p-3 rounded border border-slate-700 font-mono">
                                    {selectedFinding.query}
                                </p>
                            </div>

                            <div className="space-y-2">
                                <span className="text-xs text-slate-500 uppercase font-bold">Adversarial Variant</span>
                                <p className="text-sm text-orange-200 bg-orange-900/20 p-3 rounded border border-orange-700/50 font-mono">
                                    {selectedFinding.variant_query}
                                </p>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div className="p-3 bg-slate-800/50 rounded-lg text-center">
                                    <div className="text-xs text-gray-500 mb-1">Baseline Rank</div>
                                    <div className="text-xl font-bold text-gray-300">
                                        {selectedFinding.baseline_rank !== undefined ? `#${selectedFinding.baseline_rank + 1}` : "N/A"}
                                    </div>
                                </div>
                                <div className="p-3 bg-slate-800/50 rounded-lg text-center">
                                    <div className="text-xs text-gray-500 mb-1">Adversarial Rank</div>
                                    <div className="text-xl font-bold text-orange-400">
                                        {selectedFinding.adversarial_rank !== undefined ? `#${selectedFinding.adversarial_rank + 1}` : "N/A"}
                                    </div>
                                </div>
                                <div className="p-3 bg-slate-800/50 rounded-lg text-center">
                                    <div className="text-xs text-gray-500 mb-1">Rank Shift</div>
                                    <div className={`text-xl font-bold ${selectedFinding.rank_shift > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                                        {selectedFinding.rank_shift > 0 ? '+' : ''}{selectedFinding.rank_shift}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <span className="text-xs text-slate-500 uppercase font-bold">Target Vector</span>
                                <div className="text-sm text-slate-300 bg-slate-800/50 p-3 rounded border border-slate-700">
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">ID:</span>
                                        <span className="font-mono">{selectedFinding.target_vector_id}</span>
                                    </div>
                                    <div className="flex justify-between mt-1">
                                        <span className="text-gray-500">Similarity:</span>
                                        <span className="font-mono">{selectedFinding.similarity_score.toFixed(4)}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="p-3 bg-orange-900/20 border border-orange-800/50 rounded flex gap-3">
                                <Shield className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
                                <div className="space-y-1">
                                    <div className="text-sm font-bold text-orange-300">Recommended Action</div>
                                    <div className="text-xs text-orange-200/80">{selectedFinding.recommended_action}</div>
                                </div>
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button onClick={() => setIsDetailsOpen(false)} className="bg-slate-800 hover:bg-slate-700">
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
