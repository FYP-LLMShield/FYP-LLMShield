/**
 * Split Chat View Component
 * Displays side-by-side chat for safe and poison models
 */

import React, { useEffect, useRef } from 'react'
import { Button } from '../ui/button'
import { Textarea } from '../ui/textarea'
import { Alert, AlertDescription } from '../ui/alert'
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle
} from '../ui/resizable'
import { ArrowLeft, Send, Loader2, AlertTriangle } from 'lucide-react'
import ChatPanel from './ChatPanel'
import type { Message } from '../pages/data-poisoning-page'

interface Props {
  modelId: string
  modelName: string
  messages: Message[]
  inputValue: string
  isGenerating: boolean
  error: string | null
  onInputChange: (value: string) => void
  onSendMessage: (prompt: string) => void
  onBack: () => void
}

export default function SplitChatView({
  modelId,
  modelName,
  messages,
  inputValue,
  isGenerating,
  error,
  onInputChange,
  onSendMessage,
  onBack
}: Props) {
  const sharedScrollRef = useRef<HTMLDivElement>(null)
  const leftPanelRef = useRef<HTMLDivElement>(null)
  const rightPanelRef = useRef<HTMLDivElement>(null)

  // Synchronize scroll between both panels
  useEffect(() => {
    const handleScroll = (sourceRef: HTMLDivElement | null, targetRef: HTMLDivElement | null) => {
      if (sourceRef && targetRef) {
        const listener = () => {
          if (targetRef) {
            targetRef.scrollTop = sourceRef.scrollTop
          }
        }
        sourceRef.addEventListener('scroll', listener)
        return () => sourceRef.removeEventListener('scroll', listener)
      }
    }

    if (leftPanelRef.current && rightPanelRef.current) {
      const unsubscribeLeft = handleScroll(leftPanelRef.current, rightPanelRef.current)
      const unsubscribeRight = handleScroll(rightPanelRef.current, leftPanelRef.current)

      return () => {
        unsubscribeLeft?.()
        unsubscribeRight?.()
      }
    }
  }, [])

  // Auto-scroll both panels to bottom when messages change
  useEffect(() => {
    const timer = requestAnimationFrame(() => {
      if (leftPanelRef.current) {
        leftPanelRef.current.scrollTop = leftPanelRef.current.scrollHeight
      }
      if (rightPanelRef.current) {
        rightPanelRef.current.scrollTop = rightPanelRef.current.scrollHeight
      }
    })

    return () => cancelAnimationFrame(timer)
  }, [messages, isGenerating])

  const handleSend = () => {
    if (inputValue.trim() && !isGenerating) {
      onSendMessage(inputValue)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="h-screen flex flex-col" style={{ backgroundColor: '#1d2736' }}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10 bg-black/20 backdrop-blur-sm">
        <Button
          onClick={onBack}
          variant="ghost"
          className="text-gray-300 hover:text-white"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Models
        </Button>
        <h2 className="text-lg font-semibold text-white flex-1 text-center">{modelName} Comparison</h2>
        <div className="w-32" /> {/* Spacer for alignment */}
      </div>

      {/* Error Alert */}
      {error && (
        <Alert className="mx-4 mt-4 bg-red-950/50 border-red-500/30 text-red-400">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Split View with Shared Scrolling */}
      <div ref={sharedScrollRef} className="flex-1 min-h-0 relative flex overflow-hidden">
        {/* Loading overlay during model preload */}
        {isGenerating && messages.length === 0 && (
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center z-50">
            <Loader2 className="h-12 w-12 animate-spin text-orange-500 mb-4" />
            <h3 className="text-white text-lg font-semibold mb-2">Loading Model...</h3>
            <p className="text-gray-300 text-sm">Please wait while the model is being loaded into memory</p>
            <p className="text-gray-400 text-xs mt-2">This may take 1-2 minutes for the first load</p>
          </div>
        )}

        {/* Left Panel - Safe Model */}
        <div ref={leftPanelRef} className="flex-1 overflow-y-auto overflow-x-hidden border-r border-white/10 bg-black/10">
          <div className="min-h-full">
            <ChatPanel
              title="Safe Model"
              messages={messages}
              type="safe"
              isGenerating={isGenerating}
            />
          </div>
        </div>

        {/* Divider */}
        <div className="w-1 bg-gradient-to-b from-transparent via-white/20 to-transparent" />

        {/* Right Panel - Poison Model */}
        <div ref={rightPanelRef} className="flex-1 overflow-y-auto overflow-x-hidden bg-black/10">
          <div className="min-h-full">
            <ChatPanel
              title="Poisoned Model"
              messages={messages}
              type="poison"
              isGenerating={isGenerating}
            />
          </div>
        </div>
      </div>

      {/* Input Bar */}
      <div className="p-4 border-t border-white/10 bg-black/20 backdrop-blur-sm">
        <div className="flex gap-3">
          <Textarea
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter your prompt... (Press Enter to send, Shift+Enter for new line)"
            className="flex-1 bg-white/5 border-white/10 text-gray-900 placeholder-gray-500 resize-none max-h-24 font-medium"
            disabled={isGenerating}
            rows={3}
          />
          <Button
            onClick={handleSend}
            disabled={isGenerating || !inputValue.trim()}
            className="bg-orange-600 hover:bg-orange-700 text-white font-semibold px-6 self-end"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Send
              </>
            )}
          </Button>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          {messages.length} {messages.length === 1 ? 'prompt' : 'prompts'} exchanged
        </p>
      </div>
    </div>
  )
}
