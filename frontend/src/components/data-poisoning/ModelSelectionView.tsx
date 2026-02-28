/**
 * Model Selection View Component
 * Displays 3 glassmorphic cards for model selection
 */

import React from 'react'
import { motion } from 'framer-motion'
import { Button } from '../ui/button'
import { Loader2 } from 'lucide-react'

interface Model {
  id: string
  name: string
  size: string
  description: string
}

interface Props {
  models: Model[]
  loading: boolean
  onModelSelect: (modelId: string) => void
  loadingModel?: string | null
}

export default function ModelSelectionView({ models, loading, onModelSelect, loadingModel }: Props) {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    }
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5 }
    }
  }

  return (
    <div className="min-h-screen p-8 flex flex-col justify-center">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-12 text-center"
      >
        <h1 className="text-4xl font-bold text-white mb-3">Data Poisoning Detection</h1>
        <p className="text-gray-400 text-lg max-w-2xl mx-auto">
          Compare responses between safe and poisoned models to detect behavioral anomalies and malicious influences.
        </p>
      </motion.div>

      {/* Models Grid */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="animate-spin h-8 w-8 text-orange-500" />
        </div>
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto w-full"
        >
          {models.map((model) => (
            <motion.div key={model.id} variants={itemVariants}>
              <ModelCard model={model} onSelect={onModelSelect} isLoading={loadingModel === model.id} />
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  )
}

interface ModelCardProps {
  model: Model
  onSelect: (modelId: string) => void
  isLoading?: boolean
}

function ModelCard({ model, onSelect, isLoading = false }: ModelCardProps) {
  return (
    <motion.div
      whileHover={!isLoading ? { scale: 1.05 } : {}}
      className="group h-full"
    >
      <div className={`h-full bg-white/5 backdrop-blur-md rounded-3xl border border-white/10 p-8 transition-all duration-300 flex flex-col ${
        isLoading
          ? 'border-orange-500/50 bg-orange-500/5'
          : 'hover:border-orange-500/30 hover:bg-white/10 cursor-pointer'
      }`}
        onClick={() => !isLoading && onSelect(model.id)}
      >
        {/* Icon Area */}
        <div className="mb-6 flex justify-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500/20 to-red-500/20 flex items-center justify-center group-hover:from-orange-500/40 group-hover:to-red-500/40 transition-all duration-300">
            <span className="text-3xl">🤖</span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1">
          <h3 className="text-xl font-bold text-white mb-2 text-center">{model.name}</h3>
          <p className="text-gray-400 text-sm text-center mb-4">{model.size} parameters</p>
          <p className="text-gray-400 text-sm text-center leading-relaxed">{model.description}</p>
        </div>

        {/* Button */}
        <Button
          onClick={(e) => {
            e.stopPropagation()
            if (!isLoading) onSelect(model.id)
          }}
          disabled={isLoading}
          className={`mt-6 w-full font-semibold py-2 rounded-lg transition-all duration-300 ${
            isLoading
              ? 'bg-orange-600/50 text-white/70 cursor-not-allowed'
              : 'bg-orange-600 hover:bg-orange-700 text-white group-hover:shadow-lg group-hover:shadow-orange-500/25'
          }`}
        >
          {isLoading ? (
            <>
              <Loader2 className="inline mr-2 h-4 w-4 animate-spin" />
              Loading...
            </>
          ) : (
            'Select Model'
          )}
        </Button>
      </div>
    </motion.div>
  )
}


