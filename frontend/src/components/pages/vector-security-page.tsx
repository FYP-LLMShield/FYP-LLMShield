import React from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs"
import { Shield, Database, Target, BarChart3 } from "lucide-react"
import { EmbeddingInspectionPage } from "./embedding-inspection-page"
import { VectorStoreAnalysisPage } from "./vector-store-analysis-page"
import { RetrievalAttackPage } from "./retrieval-attack-page"
import { VectorEmbeddingPage } from "./vector-embedding-page"

export const VectorSecurityPage: React.FC = () => {
  return (
    <div className="space-y-4">
      <div className="px-6 pt-6">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-teal-500" />
          <div>
            <h1 className="text-2xl font-bold text-white">Vector Security</h1>
            <p className="text-gray-400 text-sm">
              Comprehensive vector security: document inspection, anomaly detection, attack simulation, and quality evaluation.
            </p>
          </div>
        </div>
      </div>

      <div className="px-6">
        <Tabs defaultValue="inspection" className="w-full">
          <TabsList className="bg-slate-900/50 border border-slate-700/50 p-1">
            <TabsTrigger value="inspection" className="data-[state=active]:bg-teal-600">
              <Shield className="w-4 h-4 mr-2" /> Document Inspection
            </TabsTrigger>
            <TabsTrigger value="store" className="data-[state=active]:bg-blue-600">
              <Database className="w-4 h-4 mr-2" /> Anomaly Detection
            </TabsTrigger>
            <TabsTrigger value="retrieval" className="data-[state=active]:bg-orange-600">
              <Target className="w-4 h-4 mr-2" /> Attack Simulation
            </TabsTrigger>
            <TabsTrigger value="evaluation" className="data-[state=active]:bg-purple-600">
              <BarChart3 className="w-4 h-4 mr-2" /> Quality Evaluation
            </TabsTrigger>
          </TabsList>

          <TabsContent value="inspection" className="mt-0">
            <EmbeddingInspectionPage />
          </TabsContent>

          <TabsContent value="store" className="mt-0">
            <VectorStoreAnalysisPage />
          </TabsContent>

          <TabsContent value="retrieval" className="mt-0">
            <RetrievalAttackPage />
          </TabsContent>

          <TabsContent value="evaluation" className="mt-0">
            <VectorEmbeddingPage />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
