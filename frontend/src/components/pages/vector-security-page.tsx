import React, { useState } from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"
import { Tabs, TabsContent, TabsList } from "../ui/tabs"
import { Shield, Database, Target } from "lucide-react"
import { cn } from "../../lib/utils"
import { EmbeddingInspectionPage } from "./embedding-inspection-page"
import { VectorStoreAnalysisPage } from "./vector-store-analysis-page"
import { RetrievalAttackPage } from "./retrieval-attack-page"

type VectorPrimaryTab = "inspection" | "store" | "retrieval"

/** Shared layout only — selection colors are inlined per tab so Tailwind always emits teal/blue/orange fills. */
const vectorTabBase =
  "relative flex h-auto min-h-0 flex-1 min-w-0 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 px-4 py-4 text-sm font-semibold outline-none transition-all duration-200 ease-out " +
  "focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950 " +
  "[&_svg]:size-5 [&_svg]:shrink-0"

export const VectorSecurityPage: React.FC = () => {
  const [primaryTab, setPrimaryTab] = useState<VectorPrimaryTab>("inspection")

  return (
    <div className="space-y-6 pb-8">
      <div className="px-6 pt-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-teal-500/15 ring-1 ring-teal-500/25">
            <Shield className="h-7 w-7 text-teal-600 dark:text-teal-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Vector Security</h1>
            <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">
              Document inspection, anomaly detection, and retrieval attack simulation for safer RAG and vector stores.
            </p>
          </div>
        </div>
      </div>

      <div className="px-6">
        <Tabs
          value={primaryTab}
          onValueChange={(v) => setPrimaryTab(v as VectorPrimaryTab)}
          className="w-full gap-0"
        >
          <TabsList className="mb-5 flex h-auto w-full min-h-0 flex-wrap gap-3 bg-transparent p-0 sm:flex-nowrap">
            <TabsPrimitive.Trigger
              type="button"
              value="inspection"
              className={cn(
                vectorTabBase,
                primaryTab === "inspection"
                  ? "z-[1] !border-teal-600 !bg-teal-600 !text-white shadow-lg ring-2 ring-teal-400/90 ring-offset-2 ring-offset-white hover:!bg-teal-700 dark:ring-offset-slate-950 [&_svg]:!text-white"
                  : "z-0 !border-slate-200 !bg-white !text-slate-900 shadow-sm hover:-translate-y-0.5 hover:!border-teal-400 hover:!bg-teal-50 hover:shadow-md dark:!border-slate-600 dark:!bg-slate-800 dark:!text-slate-100 dark:hover:!border-teal-500 dark:hover:!bg-slate-700/90 [&_svg]:!text-slate-900 dark:[&_svg]:!text-slate-100"
              )}
            >
              <Shield className="shrink-0" aria-hidden />
              <span className="truncate">Document Inspection</span>
            </TabsPrimitive.Trigger>
            <TabsPrimitive.Trigger
              type="button"
              value="store"
              className={cn(
                vectorTabBase,
                primaryTab === "store"
                  ? "z-[1] !border-blue-600 !bg-blue-600 !text-white shadow-lg ring-2 ring-blue-400/90 ring-offset-2 ring-offset-white hover:!bg-blue-700 dark:ring-offset-slate-950 [&_svg]:!text-white"
                  : "z-0 !border-slate-200 !bg-white !text-slate-900 shadow-sm hover:-translate-y-0.5 hover:!border-blue-400 hover:!bg-blue-50 hover:shadow-md dark:!border-slate-600 dark:!bg-slate-800 dark:!text-slate-100 dark:hover:!border-blue-500 dark:hover:!bg-slate-700/90 [&_svg]:!text-slate-900 dark:[&_svg]:!text-slate-100"
              )}
            >
              <Database className="shrink-0" aria-hidden />
              <span className="truncate">Anomaly Detection</span>
            </TabsPrimitive.Trigger>
            <TabsPrimitive.Trigger
              type="button"
              value="retrieval"
              className={cn(
                vectorTabBase,
                primaryTab === "retrieval"
                  ? "z-[1] !border-orange-600 !bg-orange-600 !text-white shadow-lg ring-2 ring-orange-400/90 ring-offset-2 ring-offset-white hover:!bg-orange-700 dark:ring-offset-slate-950 [&_svg]:!text-white"
                  : "z-0 !border-slate-200 !bg-white !text-slate-900 shadow-sm hover:-translate-y-0.5 hover:!border-orange-400 hover:!bg-orange-50 hover:shadow-md dark:!border-slate-600 dark:!bg-slate-800 dark:!text-slate-100 dark:hover:!border-orange-500 dark:hover:!bg-slate-700/90 [&_svg]:!text-slate-900 dark:[&_svg]:!text-slate-100"
              )}
            >
              <Target className="shrink-0" aria-hidden />
              <span className="truncate">Attack Simulation</span>
            </TabsPrimitive.Trigger>
          </TabsList>

          <TabsContent
            value="inspection"
            className="mt-0 rounded-xl border border-slate-200/90 bg-slate-100/80 p-1 shadow-inner dark:border-slate-600 dark:bg-slate-950/50"
          >
            <EmbeddingInspectionPage />
          </TabsContent>
          <TabsContent
            value="store"
            className="mt-0 rounded-xl border border-slate-200/90 bg-slate-100/80 p-1 shadow-inner dark:border-slate-600 dark:bg-slate-950/50"
          >
            <VectorStoreAnalysisPage />
          </TabsContent>
          <TabsContent
            value="retrieval"
            className="mt-0 rounded-xl border border-slate-200/90 bg-slate-100/80 p-1 shadow-inner dark:border-slate-600 dark:bg-slate-950/50"
          >
            <RetrievalAttackPage />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
