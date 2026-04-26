import React from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs"
import { Shield, Database, Target } from "lucide-react"
import { EmbeddingInspectionPage } from "./embedding-inspection-page"
import { VectorStoreAnalysisPage } from "./vector-store-analysis-page"
import { RetrievalAttackPage } from "./retrieval-attack-page"

export const VectorSecurityPage: React.FC = () => {
  return (
    <div className="space-y-4">
      <div className="px-6 pt-6">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-teal-500" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Vector Security</h1>
            <p className="text-muted-foreground text-sm">
              Comprehensive vector security: document inspection, anomaly detection, and attack simulation.
            </p>
          </div>
        </div>
      </div>

      <div className="px-6">
        <Tabs defaultValue="inspection" className="w-full">
          {/* Three clearly separate tab cards with gap between them */}
          <TabsList className="w-full inline-flex p-0 gap-3 bg-transparent h-auto min-h-0 mb-4">
            <TabsTrigger
              value="inspection"
              className="flex-1 min-w-0 rounded-xl py-4 px-5 border-2 border-slate-300 bg-slate-100/80 text-slate-600 hover:border-slate-400 hover:bg-slate-200/80 hover:text-slate-800 dark:border-slate-600 dark:bg-slate-800/50 dark:text-gray-400 dark:hover:border-slate-500 dark:hover:bg-slate-800/70 dark:hover:text-gray-300 data-[state=active]:border-teal-500 data-[state=active]:bg-teal-600/25 data-[state=active]:text-white data-[state=active]:ring-2 data-[state=active]:ring-teal-500/30 data-[state=active]:shadow-lg data-[state=active]:shadow-teal-500/10 transition-all duration-200"
            >
              <Shield className="w-5 h-5 mr-2 shrink-0" /> Document Inspection
            </TabsTrigger>
            <TabsTrigger
              value="store"
              className="flex-1 min-w-0 rounded-xl py-4 px-5 border-2 border-slate-300 bg-slate-100/80 text-slate-600 hover:border-slate-400 hover:bg-slate-200/80 hover:text-slate-800 dark:border-slate-600 dark:bg-slate-800/50 dark:text-gray-400 dark:hover:border-slate-500 dark:hover:bg-slate-800/70 dark:hover:text-gray-300 data-[state=active]:border-blue-500 data-[state=active]:bg-blue-600/25 data-[state=active]:text-white data-[state=active]:ring-2 data-[state=active]:ring-blue-500/30 data-[state=active]:shadow-lg data-[state=active]:shadow-blue-500/10 transition-all duration-200"
            >
              <Database className="w-5 h-5 mr-2 shrink-0" /> Anomaly Detection
            </TabsTrigger>
            <TabsTrigger
              value="retrieval"
              className="flex-1 min-w-0 rounded-xl py-4 px-5 border-2 border-slate-300 bg-slate-100/80 text-slate-600 hover:border-slate-400 hover:bg-slate-200/80 hover:text-slate-800 dark:border-slate-600 dark:bg-slate-800/50 dark:text-gray-400 dark:hover:border-slate-500 dark:hover:bg-slate-800/70 dark:hover:text-gray-300 data-[state=active]:border-orange-500 data-[state=active]:bg-orange-600/25 data-[state=active]:text-white data-[state=active]:ring-2 data-[state=active]:ring-orange-500/30 data-[state=active]:shadow-lg data-[state=active]:shadow-orange-500/10 transition-all duration-200"
            >
              <Target className="w-5 h-5 mr-2 shrink-0" /> Attack Simulation
            </TabsTrigger>
          </TabsList>

          {/* Content panel below the tab row */}
          <TabsContent value="inspection" className="mt-0 rounded-xl border-2 border-slate-200 bg-slate-50/90 shadow-xl dark:border-slate-600 dark:bg-slate-800/40">
            <EmbeddingInspectionPage />
          </TabsContent>
          <TabsContent value="store" className="mt-0 rounded-xl border-2 border-slate-200 bg-slate-50/90 shadow-xl dark:border-slate-600 dark:bg-slate-800/40">
            <VectorStoreAnalysisPage />
          </TabsContent>
          <TabsContent value="retrieval" className="mt-0 rounded-xl border-2 border-slate-200 bg-slate-50/90 shadow-xl dark:border-slate-600 dark:bg-slate-800/40">
            <RetrievalAttackPage />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
