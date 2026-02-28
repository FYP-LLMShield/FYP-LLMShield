/**
 * Chat Panel Component
 * Displays conversation history for safe or poison model
 */

import React from 'react'
import { Skeleton } from '../ui/skeleton'
import type { Message } from '../pages/data-poisoning-page'

interface Props {
  title: 'Safe Model' | 'Poisoned Model'
  messages: Message[]
  type: 'safe' | 'poison'
  isGenerating: boolean
}

export default function ChatPanel({ title, messages, type, isGenerating }: Props) {
  const borderColor = type === 'safe' ? 'border-green-500/20' : 'border-red-500/20'
  const responseBgColor = type === 'safe' ? 'bg-green-950/30' : 'bg-red-950/30'

  return (
    <div className={`h-full flex flex-col ${borderColor}`}>
      {/* Header */}
      <div className={`p-4 border-b ${borderColor}`}>
        <div className={`${
          type === 'safe'
            ? 'bg-gradient-to-r from-emerald-600/40 via-green-600/40 to-teal-600/40 border-2 border-emerald-400/80 shadow-lg shadow-emerald-500/30'
            : 'bg-gradient-to-r from-rose-600/40 via-red-600/40 to-orange-600/40 border-2 border-rose-400/80 shadow-lg shadow-rose-500/30'
        } rounded-2xl p-5 backdrop-blur-sm`}>
          <div className="flex items-center gap-3">
            <span className="text-2xl">{type === 'safe' ? '✅' : '⚠️'}</span>
            <div>
              <h3 className={`font-extrabold text-lg ${
                type === 'safe' ? 'text-emerald-200' : 'text-rose-200'
              }`}>
                {type === 'safe' ? 'SAFE MODEL' : 'POISON MODEL'}
              </h3>
              <p className={`text-xs mt-1 font-semibold ${
                type === 'safe' ? 'text-emerald-300/70' : 'text-rose-300/70'
              }`}>
                📊 {messages.length} {messages.length === 1 ? 'turn' : 'turns'} exchanged
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-hidden w-full">
        <div className="p-6 space-y-4">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center min-h-96">
              <div className={`text-center p-8 rounded-2xl ${
                type === 'safe'
                  ? 'bg-emerald-500/10 border-2 border-emerald-400/30'
                  : 'bg-rose-500/10 border-2 border-rose-400/30'
              }`}>
                <p className={`text-2xl mb-3 ${
                  type === 'safe' ? 'text-emerald-300' : 'text-rose-300'
                }`}>
                  {type === 'safe' ? '🟢' : '🔴'}
                </p>
                <p className={`text-sm font-semibold ${
                  type === 'safe' ? 'text-emerald-200' : 'text-rose-200'
                }`}>
                  No messages yet
                </p>
                <p className="text-xs text-gray-400 mt-2">
                  Send a prompt to start the conversation
                </p>
              </div>
            </div>
          ) : (
            messages.map((message, idx) => {
              const response = type === 'safe' ? message.safeResponse : message.poisonResponse
              return (
                <div key={message.id} className="space-y-4 mb-6">
                  {/* Prompt */}
                  <div className="flex justify-end pr-2">
                    <div className="max-w-2xl bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-600 border-2 border-violet-400/80 rounded-2xl p-5 shadow-2xl shadow-violet-500/40 backdrop-blur-sm">
                      <p className="text-white text-sm font-bold leading-relaxed break-words">
                        <span className="text-violet-200 font-extrabold text-base">💬 You:</span> {message.prompt}
                      </p>
                      <p className="text-xs text-violet-100/80 mt-3 font-semibold">
                        ✨ Turn {idx + 1}
                      </p>
                    </div>
                  </div>

                  {/* Response */}
                  <div className="flex justify-start pl-2">
                    <div className={`max-w-2xl border-3 rounded-2xl p-5 shadow-2xl backdrop-blur-sm ${
                      type === 'safe'
                        ? 'bg-gradient-to-br from-emerald-900/60 via-green-900/50 to-teal-900/60 border-emerald-400/80 shadow-emerald-500/40'
                        : 'bg-gradient-to-br from-rose-900/60 via-red-900/50 to-orange-900/60 border-rose-400/80 shadow-rose-500/40'
                    }`}>
                      {response ? (
                        <>
                          <div className={`flex items-center gap-2 mb-3 p-2 rounded-lg ${
                            type === 'safe'
                              ? 'bg-emerald-500/30'
                              : 'bg-rose-500/30'
                          }`}>
                            <p className={`${
                              type === 'safe' ? 'text-emerald-200' : 'text-rose-200'
                            } text-xs font-bold uppercase tracking-widest`}>
                              {type === 'safe' ? '✅ SAFE MODEL' : '⚠️ POISON MODEL'}
                            </p>
                          </div>
                          <p className="text-white text-sm leading-relaxed break-words font-medium">
                            {response}
                          </p>
                          <div className={`flex items-center gap-2 mt-4 pt-3 border-t-2 ${
                            type === 'safe'
                              ? 'border-emerald-500/30'
                              : 'border-rose-500/30'
                          }`}>
                            <span className={`text-xs font-semibold ${
                              type === 'safe' ? 'text-emerald-300' : 'text-rose-300'
                            }`}>
                              ⏱️ {message.generationTime}ms
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="flex items-center space-x-3">
                          <div className={`animate-spin h-5 w-5 border-3 rounded-full ${
                            type === 'safe'
                              ? 'border-emerald-400 border-t-emerald-700'
                              : 'border-rose-400 border-t-rose-700'
                          }`} />
                          <p className={`text-sm font-semibold ${
                            type === 'safe'
                              ? 'text-emerald-200'
                              : 'text-rose-200'
                          }`}>Generating response...</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Divider */}
                  {idx < messages.length - 1 && (
                    <div className={`border-t ${borderColor} opacity-30 my-2`} />
                  )}
                </div>
              )
            })
          )}

          {/* Loading */}
          {isGenerating && messages.length > 0 && (
            <div className="space-y-3">
              <div className="flex justify-start">
                <div className={`max-w-xs ${responseBgColor} border ${borderColor} rounded-lg p-3`}>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-48 bg-white/10" />
                    <Skeleton className="h-4 w-40 bg-white/10" />
                    <Skeleton className="h-4 w-44 bg-white/10" />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


