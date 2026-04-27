import React, { useState } from "react"
import { promptInjectionAPI, RetrievalAttackResponse, RetrievalManipulationFinding, RetrievalAttackParams } from "../../lib/api"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/card"
import { Badge } from "../ui/badge"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Textarea } from "../ui/textarea"
import { Switch } from "../ui/switch"
import { Label } from "../ui/label"
import * as TabsPrimitive from "@radix-ui/react-tabs"
import { Tabs, TabsContent, TabsList } from "../ui/tabs"
import { cn } from "../../lib/utils"
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

const retrievalSubTabLayout =
  "relative flex min-h-0 min-w-0 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border-2 px-3 py-2.5 text-sm font-semibold outline-none transition-all duration-200 " +
  "focus-visible:ring-2 focus-visible:ring-orange-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background [&_svg]:size-4 [&_svg]:shrink-0"

function retrievalSubTabTriggerClass(activeTab: string, value: string, disabled?: boolean): string {
  if (disabled) {
    return cn(
      retrievalSubTabLayout,
      "cursor-not-allowed !border-slate-200 !bg-slate-100 !text-slate-400 opacity-80 dark:!border-slate-700 dark:!bg-slate-900 dark:!text-slate-500 [&_svg]:!text-slate-400 dark:[&_svg]:!text-slate-500"
    )
  }
  if (activeTab === value) {
    return cn(
      retrievalSubTabLayout,
      "z-[1] cursor-default !border-orange-600 !bg-orange-600 !text-white shadow-md ring-2 ring-orange-300 ring-offset-2 ring-offset-background hover:!bg-orange-700 dark:ring-orange-400/60 dark:ring-offset-background [&_svg]:!text-white"
    )
  }
  return cn(
    retrievalSubTabLayout,
    "z-0 border-border bg-muted/90 text-foreground shadow-sm hover:-translate-y-0.5 hover:border-orange-400 hover:bg-muted dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-orange-500 dark:hover:bg-slate-800 [&_svg]:text-foreground dark:[&_svg]:text-slate-200"
  )
}

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
        const movesIntoTopK = result.findings.filter(f => f.baseline_rank == null).length
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
        if (asr >= 0.7) return "text-red-600 dark:text-red-500"
        if (asr >= 0.4) return "text-amber-600 dark:text-amber-500"
        return "text-emerald-600 dark:text-emerald-500"
    }

    const headlineTop3Asr = result?.summary_metrics?.headline_variant_asr_top3_changed as number | undefined
    const materialFindingsCount = result?.summary_metrics?.material_findings_count as number | undefined
    const legacyQueryAsr = result?.summary_metrics?.legacy_query_asr as number | undefined

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center gap-3">
                <Target className="h-6 w-6 shrink-0 text-orange-600 dark:text-orange-500" />
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Retrieval Attack Simulation</h1>
                    <p className="text-sm text-muted-foreground">
                        Simulate adversarial queries to test retrieval system robustness and measure ranking manipulation.
                    </p>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="mb-1 flex h-auto w-full min-h-0 flex-wrap gap-2 border-0 bg-transparent p-0">
                    <TabsPrimitive.Trigger
                        value="config"
                        className={retrievalSubTabTriggerClass(activeTab, "config")}
                    >
                        <Settings className="shrink-0" aria-hidden />
                        Configuration
                    </TabsPrimitive.Trigger>
                    <TabsPrimitive.Trigger
                        value="results"
                        disabled={!result}
                        className={retrievalSubTabTriggerClass(activeTab, "results", !result)}
                    >
                        <BarChart3 className="shrink-0" aria-hidden />
                        Results
                    </TabsPrimitive.Trigger>
                    <TabsPrimitive.Trigger
                        value="findings"
                        disabled={!result}
                        className={retrievalSubTabTriggerClass(activeTab, "findings", !result)}
                    >
                        <AlertTriangle className="shrink-0" aria-hidden />
                        Findings ({result?.findings.length || 0}
                        {typeof materialFindingsCount === "number" ? ` · ${materialFindingsCount} material` : ""})
                    </TabsPrimitive.Trigger>
                </TabsList>

                <TabsContent value="config" className="space-y-6 mt-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Left: Queries & File */}
                        <Card className="border-border shadow-sm">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Search className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                                    Queries & Index
                                </CardTitle>
                                <CardDescription>
                                    Provide queries to test and a vector index snapshot
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label className="text-sm font-medium text-foreground">Vector Index Snapshot (JSON)</Label>
                                    <Input
                                        type="file"
                                        accept=".json"
                                        onChange={handleFileChange}
                                        className="border border-slate-300 bg-white text-black shadow-sm file:font-medium file:text-black dark:border-slate-600 dark:bg-white dark:text-black"
                                    />
                                    {file && (
                                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                            <FileText className="h-3 w-3 shrink-0" />
                                            {file.name} ({(file.size / 1024).toFixed(1)} KB)
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-sm font-medium text-foreground">Test Queries (one per line)</Label>
                                    <Textarea
                                        placeholder="Enter queries to test...&#10;What is machine learning?&#10;How do I login?&#10;Show me internal documents"
                                        value={queries}
                                        onChange={(e) => setQueries(e.target.value)}
                                        className="h-40 border border-slate-300 bg-white font-mono text-sm text-black placeholder:text-slate-500 shadow-sm dark:border-slate-600 dark:bg-white dark:text-black dark:placeholder:text-slate-500"
                                    />
                                    <div className="text-xs text-muted-foreground">
                                        {queries.split('\n').filter(q => q.trim()).length} queries
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Right: Parameters */}
                        <Card className="border-border shadow-sm">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Settings className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                                    Simulation Parameters
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-sm font-medium text-foreground">Top-K</Label>
                                        <Input
                                            type="number"
                                            min={1}
                                            max={100}
                                            value={topK}
                                            onChange={(e) => setTopK(Number(e.target.value))}
                                            className="border border-slate-300 bg-white text-black shadow-sm dark:border-slate-600 dark:bg-white dark:text-black"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-sm font-medium text-foreground">Similarity Threshold</Label>
                                        <Input
                                            type="number"
                                            step={0.05}
                                            min={0}
                                            max={1}
                                            value={similarityThreshold}
                                            onChange={(e) => setSimilarityThreshold(Number(e.target.value))}
                                            className="border border-slate-300 bg-white text-black shadow-sm dark:border-slate-600 dark:bg-white dark:text-black"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-sm font-medium text-foreground">Rank Shift Δ</Label>
                                        <Input
                                            type="number"
                                            min={1}
                                            max={50}
                                            value={rankShiftThreshold}
                                            onChange={(e) => setRankShiftThreshold(Number(e.target.value))}
                                            className="border border-slate-300 bg-white text-black shadow-sm dark:border-slate-600 dark:bg-white dark:text-black"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <Label className="text-sm font-medium text-foreground">Adversarial Variants</Label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 p-2.5 dark:bg-slate-900/60">
                                            <Checkbox checked={enableParaphrase} onCheckedChange={(c) => setEnableParaphrase(!!c)} />
                                            <span className="text-sm font-medium text-foreground">Paraphrase</span>
                                        </div>
                                        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 p-2.5 dark:bg-slate-900/60">
                                            <Checkbox checked={enableUnicode} onCheckedChange={(c) => setEnableUnicode(!!c)} />
                                            <span className="text-sm font-medium text-foreground">Unicode</span>
                                        </div>
                                        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 p-2.5 dark:bg-slate-900/60">
                                            <Checkbox checked={enableHomoglyph} onCheckedChange={(c) => setEnableHomoglyph(!!c)} />
                                            <span className="text-sm font-medium text-foreground">Homoglyph</span>
                                        </div>
                                        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 p-2.5 dark:bg-slate-900/60">
                                            <Checkbox checked={enableTrigger} onCheckedChange={(c) => setEnableTrigger(!!c)} />
                                            <span className="text-sm font-medium text-foreground">Trigger-Augmented</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between rounded-lg border border-border bg-muted/50 p-3 dark:bg-slate-900/60">
                                    <div>
                                        <Label className="text-sm font-medium text-foreground">Model Inference</Label>
                                        <p className="text-xs text-muted-foreground">Analyze behavioral impact on LLM responses</p>
                                    </div>
                                    <Switch checked={enableModelInference} onCheckedChange={setEnableModelInference} />
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="text-sm text-muted-foreground">
                            When your snapshot and queries are set, run the simulation to generate results.
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                            <Button
                                onClick={handleSimulate}
                                disabled={isLoading || !file || !queries.trim()}
                                className="border border-orange-300 bg-orange-50 px-6 text-black shadow-sm hover:bg-orange-100 disabled:opacity-60 dark:border-orange-700/40 dark:bg-orange-600 dark:text-white dark:shadow-md dark:shadow-orange-900/15 dark:ring-1 dark:ring-orange-700/30 dark:hover:bg-orange-500 [&_svg]:text-current"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Simulating...
                                    </>
                                ) : (
                                    <>
                                        <Play className="mr-2 h-4 w-4" />
                                        Run Simulation
                                    </>
                                )}
                            </Button>
                            {error && <span className="text-sm text-red-600 dark:text-red-400">{error}</span>}
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="results" className="space-y-6 mt-6">
                    {result && (
                        <>
                            {/* Summary Cards */}
                            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                                <Card className="border-border shadow-sm">
                                    <CardContent className="pt-6">
                                        <div className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">Top‑3 screen change rate</div>
                                        <div className={`text-3xl font-bold ${asrColor(typeof headlineTop3Asr === "number" ? headlineTop3Asr : result.attack_success_rate)}`}>
                                            {((typeof headlineTop3Asr === "number" ? headlineTop3Asr : result.attack_success_rate) * 100).toFixed(1)}%
                                        </div>
                                        <div className="mt-2 text-[11px] leading-snug text-muted-foreground">
                                            Share of query×variant runs where the <span className="font-semibold text-foreground">top‑3 result set</span> changed vs baseline.
                                        </div>
                                        <div className="mt-2 text-[11px] text-muted-foreground">
                                            Legacy “any rank delta” query rate:{" "}
                                            <span className="font-mono text-foreground">
                                                {((typeof legacyQueryAsr === "number" ? legacyQueryAsr : result.attack_success_rate) * 100).toFixed(1)}%
                                            </span>
                                        </div>
                                    </CardContent>
                                </Card>
                                <Card className="border-border shadow-sm">
                                    <CardContent className="pt-6">
                                        <div className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">Total Queries</div>
                                        <div className="text-3xl font-bold text-foreground">{result.total_queries}</div>
                                        <div className="text-xs text-muted-foreground">
                                            <span className="text-emerald-600 dark:text-emerald-400">{result.successful_queries} ok</span>
                                            {result.failed_queries > 0 && (
                                                <span className="text-red-600 dark:text-red-400"> / {result.failed_queries} failed</span>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                                <Card className="border-border shadow-sm">
                                    <CardContent className="pt-6">
                                        <div className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">Ranking deltas</div>
                                        <div className={`text-3xl font-bold ${result.findings.length > 0 ? 'text-amber-600 dark:text-amber-500' : 'text-emerald-600 dark:text-emerald-500'}`}>
                                            {result.findings.length}
                                        </div>
                                        <div className="text-xs text-muted-foreground">All pairwise rank changes (verbose)</div>
                                        {typeof materialFindingsCount === "number" && (
                                            <div className="mt-2 text-[11px] text-muted-foreground">
                                                Material subset:{" "}
                                                <span className="font-mono text-foreground">{materialFindingsCount}</span>{" "}
                                                <span className="text-muted-foreground">(large Δ or promoted into top‑3)</span>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                                <Card className="border-border shadow-sm">
                                    <CardContent className="pt-6">
                                        <div className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">Variants Tested</div>
                                        <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                                            {result.parameters.variant_types?.length || 0}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Recommendations */}
                            {result.recommendations.length > 0 && (
                                <Card className="border-border shadow-sm">
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2 text-lg">
                                            <Shield className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                                            Recommendations
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-2">
                                            {result.recommendations.map((rec, idx) => (
                                                <div key={idx} className="flex items-start gap-3 rounded-lg border border-orange-200 bg-orange-50/80 p-3 dark:border-orange-500/25 dark:bg-orange-500/10">
                                                    <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-orange-600 dark:text-orange-400" />
                                                    <span className="text-sm text-foreground">{rec}</span>
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
                                    <Card className="border-border shadow-sm">
                                        <CardHeader>
                                            <CardTitle className="flex items-center gap-2 text-lg">
                                                <BarChart3 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                                                Rank-Shift Metrics
                                            </CardTitle>
                                            <CardDescription>
                                                Analysis of ranking manipulation across all findings
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-5">
                                                <div className="rounded-xl border border-border bg-muted/40 p-4 text-center dark:border-slate-700 dark:bg-slate-900/80">
                                                    <div className="mb-1 text-xs font-medium uppercase text-muted-foreground">Average Shift</div>
                                                    <div className={`text-2xl font-bold ${metrics.average > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                                        {metrics.average > 0 ? '+' : ''}{metrics.average.toFixed(1)}
                                                    </div>
                                                </div>
                                                <div className="rounded-xl border border-border bg-muted/40 p-4 text-center dark:border-slate-700 dark:bg-slate-900/80">
                                                    <div className="mb-1 text-xs font-medium uppercase text-muted-foreground">Max Shift</div>
                                                    <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                                                        +{metrics.max}
                                                    </div>
                                                </div>
                                                <div className="rounded-xl border border-border bg-muted/40 p-4 text-center dark:border-slate-700 dark:bg-slate-900/80">
                                                    <div className="mb-1 text-xs font-medium uppercase text-muted-foreground">Min Shift</div>
                                                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                                                        {metrics.min}
                                                    </div>
                                                </div>
                                                <div className="rounded-xl border border-border bg-muted/40 p-4 text-center dark:border-slate-700 dark:bg-slate-900/80">
                                                    <div className="mb-1 text-xs font-medium uppercase text-muted-foreground">New in Top-K</div>
                                                    <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                                                        {metrics.movesIntoTopK}
                                                    </div>
                                                </div>
                                                <div className="rounded-xl border border-border bg-muted/40 p-4 text-center dark:border-slate-700 dark:bg-slate-900/80">
                                                    <div className="mb-1 text-xs font-medium uppercase text-muted-foreground">Significant</div>
                                                    <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                                                        {metrics.significantShifts}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Distribution Bar */}
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between text-sm font-medium text-foreground">
                                                    <span>Rank Shift Distribution</span>
                                                    <span className="text-xs font-normal text-muted-foreground">{metrics.total} findings</span>
                                                </div>
                                                <div className="flex h-8 overflow-hidden rounded-lg bg-muted">
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
                                                <div className="flex justify-between gap-2 text-xs text-muted-foreground">
                                                    <span className="flex items-center gap-1">
                                                        <div className="h-3 w-3 shrink-0 rounded bg-red-500" />
                                                        Improved (worse for security)
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <div className="h-3 w-3 shrink-0 rounded bg-gray-500" />
                                                        No change
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <div className="h-3 w-3 shrink-0 rounded bg-emerald-500" />
                                                        Degraded (better for security)
                                                    </span>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                )
                            })()}

                            {/* Export Options */}
                            <Card className="border-border shadow-sm">
                                <CardHeader>
                                    <CardTitle className="text-lg">Export Report</CardTitle>
                                    <CardDescription>
                                        Download full simulation results with reproducible parameters
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex flex-wrap items-center gap-4">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <Label className="text-sm font-medium text-foreground">Format:</Label>
                                            <div className="flex gap-2">
                                                {(['json', 'csv', 'pdf'] as const).map(format => (
                                                    <Button
                                                        key={format}
                                                        variant={exportFormat === format ? 'default' : 'outline'}
                                                        size="sm"
                                                        onClick={() => setExportFormat(format)}
                                                        className={exportFormat === format ? 'bg-orange-600 text-white' : 'border-border text-foreground'}
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
                                    <div className="mt-4 space-y-1 text-xs text-muted-foreground">
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
                        <Card className="border-border shadow-sm">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <ArrowUpDown className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                                    Ranking Manipulations ({result.findings.length})
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {result.findings.slice(0, 20).map((finding, idx) => (
                                    <div
                                        key={idx}
                                        className="cursor-pointer rounded-xl border border-border bg-muted/40 p-4 transition-all hover:border-orange-400 hover:bg-muted/60 dark:border-slate-700 dark:bg-slate-900/70 dark:hover:border-orange-500/50 dark:hover:bg-slate-800/80"
                                        onClick={() => openFindingDetails(finding)}
                                    >
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center gap-2">
                                                {confidenceBadge(finding.confidence)}
                                                {variantBadge(finding.variant_type)}
                                            </div>
                                            <div className="flex items-center gap-2 text-sm">
                                                {finding.rank_shift > 0 ? (
                                                    <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                                                        <TrendingUp className="h-4 w-4" />
                                                        +{finding.rank_shift}
                                                    </span>
                                                ) : (
                                                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                                                        <TrendingDown className="h-4 w-4" />
                                                        {finding.rank_shift}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="mb-2 text-sm text-foreground">{finding.description}</div>
                                        <div className="text-xs text-muted-foreground">
                                            Query: <span className="font-mono text-foreground">{finding.query.slice(0, 50)}...</span>
                                        </div>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    )}

                    {result && result.findings.length === 0 && (
                        <Card className="border-border shadow-sm">
                            <CardContent className="py-12 text-center">
                                <CheckCircle className="mx-auto mb-4 h-12 w-12 text-emerald-600 dark:text-emerald-500" />
                                <h3 className="mb-2 text-lg font-semibold text-foreground">No Manipulations Detected</h3>
                                <p className="text-muted-foreground">The retrieval pipeline appears robust against the tested adversarial variants.</p>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>
            </Tabs>

            {/* Finding Details Dialog */}
            <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
                <DialogContent className="max-w-2xl border-border bg-background text-foreground">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-xl text-foreground">
                            <Target className="w-6 h-6 text-orange-600 dark:text-orange-500" />
                            Manipulation Details
                        </DialogTitle>
                    </DialogHeader>

                    {selectedFinding && (
                        <div className="space-y-6 pt-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <span className="text-xs font-bold uppercase text-muted-foreground">Variant Type</span>
                                    <div className="flex">{variantBadge(selectedFinding.variant_type)}</div>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-xs font-bold uppercase text-muted-foreground">Confidence</span>
                                    <div className="flex">{confidenceBadge(selectedFinding.confidence)}</div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <span className="text-xs font-bold uppercase text-muted-foreground">Original Query</span>
                                <p className="rounded border border-border bg-muted p-3 font-mono text-sm text-foreground">
                                    {selectedFinding.query}
                                </p>
                            </div>

                            <div className="space-y-2">
                                <span className="text-xs font-bold uppercase text-muted-foreground">Adversarial Variant</span>
                                <p className="rounded border border-orange-500/40 bg-orange-500/10 p-3 font-mono text-sm text-orange-900 dark:text-orange-200">
                                    {selectedFinding.variant_query}
                                </p>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div className="rounded-lg bg-muted/70 p-3 text-center">
                                    <div className="mb-1 text-xs text-muted-foreground">Baseline Rank</div>
                                    <div className="text-xl font-bold text-foreground">
                                        {selectedFinding.baseline_rank !== undefined ? `#${selectedFinding.baseline_rank + 1}` : "N/A"}
                                    </div>
                                </div>
                                <div className="rounded-lg bg-muted/70 p-3 text-center">
                                    <div className="mb-1 text-xs text-muted-foreground">Adversarial Rank</div>
                                    <div className="text-xl font-bold text-orange-600 dark:text-orange-400">
                                        {selectedFinding.adversarial_rank !== undefined ? `#${selectedFinding.adversarial_rank + 1}` : "N/A"}
                                    </div>
                                </div>
                                <div className="rounded-lg bg-muted/70 p-3 text-center">
                                    <div className="mb-1 text-xs text-muted-foreground">Rank Shift</div>
                                    <div className={`text-xl font-bold ${selectedFinding.rank_shift > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                        {selectedFinding.rank_shift > 0 ? '+' : ''}{selectedFinding.rank_shift}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <span className="text-xs font-bold uppercase text-muted-foreground">Target Vector</span>
                                <div className="rounded border border-border bg-muted p-3 text-sm text-foreground">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">ID:</span>
                                        <span className="font-mono">{selectedFinding.target_vector_id}</span>
                                    </div>
                                    <div className="mt-1 flex justify-between">
                                        <span className="text-muted-foreground">Similarity:</span>
                                        <span className="font-mono">{selectedFinding.similarity_score.toFixed(4)}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3 rounded border border-orange-500/30 bg-orange-500/10 p-3 dark:border-orange-500/25">
                                <Shield className="mt-0.5 h-5 w-5 shrink-0 text-orange-600 dark:text-orange-400" />
                                <div className="space-y-1">
                                    <div className="text-sm font-bold text-orange-800 dark:text-orange-300">Recommended Action</div>
                                    <div className="text-xs text-orange-900/90 dark:text-orange-200/90">{selectedFinding.recommended_action}</div>
                                </div>
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="secondary" onClick={() => setIsDetailsOpen(false)}>
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
