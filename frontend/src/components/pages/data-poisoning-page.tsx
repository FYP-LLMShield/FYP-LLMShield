/**
 * Data Poisoning Detection Page
 * =============================
 * Allows users to compare responses between safe and poisoned LLM models.
 * Features model selection and side-by-side chat interface.
 */

import React, { useState, useEffect } from 'react'
import ModelSelectionView from '../data-poisoning/ModelSelectionView'
import SplitChatView from '../data-poisoning/SplitChatView'

export interface Message {
  id: string
  prompt: string
  safeResponse: string
  poisonResponse: string
  timestamp: number
  generationTime: number
}

interface Model {
  id: string
  name: string
  size: string
  description: string
}

export function DataPoisoningPage() {
  // Navigation state
  const [view, setView] = useState<'selection' | 'chat'>('selection')
  const [selectedModel, setSelectedModel] = useState<string | null>(null)
  const [selectedModelName, setSelectedModelName] = useState<string | null>(null)

  // Chat state
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Models state
  const [models, setModels] = useState<Model[]>([])
  const [loadingModels, setLoadingModels] = useState(true)
  const [preloadingModel, setPreloadingModel] = useState<string | null>(null)

  // Load available models on component mount
  useEffect(() => {
    const loadModels = async () => {
      try {
        const apiUrl = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000'
        const response = await fetch(`${apiUrl}/api/v1/data-poisoning/models`)
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.detail || 'Failed to load models')
        }
        const data = await response.json()
        setModels(data.models || [])
      } catch (err) {
        console.error('Error loading models:', err)
        setError(err instanceof Error ? err.message : 'Failed to load available models')
      } finally {
        setLoadingModels(false)
      }
    }

    loadModels()
  }, [])

  // Handle model selection with preloading
  const handleModelSelect = async (modelId: string) => {
    const selectedModelObj = models.find((m) => m.id === modelId)
    if (selectedModelObj) {
      setSelectedModel(modelId)
      setSelectedModelName(selectedModelObj.name)
      setMessages([]) // Clear chat history when switching models
      setError(null)
      setPreloadingModel(modelId) // Show loading on card during preload
      setView('chat')

      try {
        // Preload model so generation is instant
        const apiUrl = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000'
        const response = await fetch(
          `${apiUrl}/api/v1/data-poisoning/preload/${modelId}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('access_token') || ''}`
            }
          }
        )

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          const errorMsg = errorData.detail || 'Failed to load model'
          setError(errorMsg)
          setView('selection')
          console.warn(`Model preload failed: ${errorMsg}`)
        } else {
          const data = await response.json()
          if (!data.success) {
            setError(data.message || 'Model preload failed')
            setView('selection')
          } else {
            console.info(`Model ${modelId} preloaded successfully`)
            setError(null)
          }
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to preload model'
        console.error('Model preload error:', err)
        setError(errorMessage)
        setView('selection')
      } finally {
        setPreloadingModel(null)
      }
    }
  }

  // Handle back to model selection
  const handleBackToSelection = () => {
    setView('selection')
    setError(null)
  }

  // Helper function to fetch with timeout
  const fetchWithTimeout = async (url: string, options: RequestInit, timeoutMs: number = 180000) => {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    try {
      return await fetch(url, {
        ...options,
        signal: controller.signal
      })
    } finally {
      clearTimeout(timeoutId)
    }
  }

  // Handle sending message
  const handleSendMessage = async (prompt: string) => {
    if (!selectedModel || !prompt.trim()) return

    const messageId = Date.now().toString()
    setInputValue('')
    setIsGenerating(true)
    setError(null)

    // Add prompt immediately to show it right away
    const tempMessage: Message = {
      id: messageId,
      prompt: prompt,
      safeResponse: '',  // Empty initially
      poisonResponse: '',  // Empty initially
      timestamp: Date.now(),
      generationTime: 0
    }

    setMessages((prev) => [...prev, tempMessage])

    try {
      // Call backend API with 180 second (3 minute) timeout
      const apiUrl = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000'
      const response = await fetchWithTimeout(
        `${apiUrl}/api/v1/data-poisoning/generate`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('access_token') || ''}`
          },
          body: JSON.stringify({
            model_id: selectedModel,
            prompt: prompt
          })
        },
        180000 // 180 seconds = 3 minutes timeout
      )

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || 'Generation failed')
      }

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Generation failed')
      }

      // Update message with actual responses
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId
            ? {
                ...msg,
                safeResponse: data.safe_response || '(No response)',
                poisonResponse: data.poison_response || '(No response)',
                generationTime: data.generation_time_ms || 0
              }
            : msg
        )
      )
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred during generation'
      setError(errorMessage)
      console.error('Generation error:', err)

      // Remove temp message if error occurs
      setMessages((prev) => prev.filter((msg) => msg.id !== messageId))
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div style={{ backgroundColor: '#1d2736' }} className="min-h-screen">
      {view === 'selection' ? (
        <ModelSelectionView
          models={models}
          loading={loadingModels}
          onModelSelect={handleModelSelect}
          loadingModel={preloadingModel}
        />
      ) : (
        <SplitChatView
          modelId={selectedModel!}
          modelName={selectedModelName!}
          messages={messages}
          inputValue={inputValue}
          isGenerating={isGenerating}
          error={error}
          onInputChange={setInputValue}
          onSendMessage={handleSendMessage}
          onBack={handleBackToSelection}
        />
      )}
    </div>
  )
}

export default DataPoisoningPage
