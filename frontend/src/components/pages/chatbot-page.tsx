import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader, Plus, Trash2, MessageCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Context {
  text: string;
  score: number;
  doc_name: string;
  source: string;
}

interface ChatResponse {
  response: string;
  contexts: Context[];
  success: boolean;
  memories_saved?: Array<{type: string; value: string}>;
}

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
}

const API_URL = 'http://localhost:8000/api/v1';

export const ChatbotPage: React.FC = () => {
  const { user } = useAuth();
  const token = localStorage.getItem('access_token') || '';
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Hello! I\'m your RAG Chatbot. I can answer questions based on the knowledge base. Feel free to ask me anything!'
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [showContexts, setShowContexts] = useState(false);
  const [lastContexts, setLastContexts] = useState<Context[]>([]);
  const [showMemories, setShowMemories] = useState(false);
  const [allMemories, setAllMemories] = useState<Array<{type: string; value: string}>>([]);
  const [loadingMemories, setLoadingMemories] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [loadingChat, setLoadingChat] = useState(false);
  const [loadingDots, setLoadingDots] = useState('.');
  const [savedMemories, setSavedMemories] = useState<Array<{type: string; value: string}>>([]);
  const [lastMemorySavedIndex, setLastMemorySavedIndex] = useState<number | null>(null);;
  const lastMessageCountRef = useRef(messages.length);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 0);
  };

  const isNearBottom = () => {
    const messagesContainer = document.querySelector('[data-messages-container]');
    if (!messagesContainer) return true;
    const { scrollTop, scrollHeight, clientHeight } = messagesContainer;
    return scrollHeight - scrollTop - clientHeight < 100;
  };

  const loadAllMemories = async () => {
    setLoadingMemories(true);
    try {
      const response = await fetch(`${API_URL}/chatbot/memories`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        const formattedMemories = Object.entries(data.memories || {}).map(([key, item]: any) => ({
          key: key, // Store the original key for deletion
          type: key.replace(/_/g, ' ').split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
          value: item.value || item
        }));
        setAllMemories(formattedMemories as any);
      }
    } catch (error) {
      console.error('Failed to load memories:', error);
    }
    setLoadingMemories(false);
  };

  const deleteMemory = async (memoryKey: string) => {
    try {
      const response = await fetch(`${API_URL}/chatbot/memories/${memoryKey}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        // Remove from local state
        setAllMemories(prev => prev.filter(m => (m as any).key !== memoryKey));
      }
    } catch (error) {
      console.error('Failed to delete memory:', error);
    }
  };

  const toggleMemories = () => {
    setShowMemories(!showMemories);
    if (!showMemories) {
      loadAllMemories();
    }
  };

  useEffect(() => {
    // Scroll when new message is added
    if (messages.length > lastMessageCountRef.current) {
      scrollToBottom();
      lastMessageCountRef.current = messages.length;
    }
    // During typing, auto-scroll if user is near bottom
    else if (loading && isNearBottom()) {
      scrollToBottom();
    }
  }, [messages, loading]);

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
  }, []);

  // Animate loading dots
  useEffect(() => {
    if (!loading) return;

    const interval = setInterval(() => {
      setLoadingDots(prev => {
        if (prev === '.') return '..';
        if (prev === '..') return '...';
        return '.';
      });
    }, 500);

    return () => clearInterval(interval);
  }, [loading]);

  const loadConversations = async () => {
    try {
      const response = await fetch(`${API_URL}/chatbot/conversations`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setConversations(data);
      }
    } catch (error) {
      console.error('Failed to load conversations:', error);
    }
  };

  const createNewChat = async () => {
    try {
      // If current chat is empty, just clear it
      if (currentConversationId && messages.length === 1) {
        setMessages([
          {
            role: 'assistant',
            content: 'Hello! I\'m your RAG Chatbot. I can answer questions based on the knowledge base. Feel free to ask me anything!'
          }
        ]);
        return;
      }

      // Otherwise create a new conversation
      const response = await fetch(`${API_URL}/chatbot/conversations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ title: 'New Chat' })
      });

      if (response.ok) {
        const newConv = await response.json();
        setCurrentConversationId(newConv.id);
        setMessages([
          {
            role: 'assistant',
            content: 'Hello! I\'m your RAG Chatbot. I can answer questions based on the knowledge base. Feel free to ask me anything!'
          }
        ]);
        await loadConversations();
      }
    } catch (error) {
      console.error('Failed to create conversation:', error);
    }
  };

  const selectConversation = async (conversationId: string) => {
    setLoadingChat(true);
    setCurrentConversationId(conversationId);
    try {
      const response = await fetch(`${API_URL}/chatbot/conversations/${conversationId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const conv = await response.json();
        setMessages(conv.messages || []);
      }
    } catch (error) {
      console.error('Failed to load conversation:', error);
    } finally {
      setLoadingChat(false);
    }
  };

  const deleteConversation = async (conversationId: string) => {
    try {
      const response = await fetch(`${API_URL}/chatbot/conversations/${conversationId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        if (currentConversationId === conversationId) {
          setCurrentConversationId(null);
          setMessages([{
            role: 'assistant',
            content: 'Hello! I\'m your RAG Chatbot. I can answer questions based on the knowledge base. Feel free to ask me anything!'
          }]);
        }
        await loadConversations();
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    }
  };

  const sendMessage = async () => {
    if (!inputValue.trim() || loading) return;

    const messageToSend = inputValue;

    const userMessage: Message = {
      role: 'user',
      content: messageToSend
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/chatbot/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message: messageToSend,
          history: messages
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: ChatResponse = await response.json();

      // Add assistant message with empty content first
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);
      setLastContexts(data.contexts);

      // Set saved memories if any and track the message index
      if (data.memories_saved && data.memories_saved.length > 0) {
        setSavedMemories(data.memories_saved);
        setLastMemorySavedIndex(messages.length + 1); // +1 because we just added the assistant message
      } else {
        setLastMemorySavedIndex(null);
      }

      // Typing animation - add characters one by one
      let currentIndex = 0;
      const typingSpeed = 15; // milliseconds between each character

      const typeCharacter = () => {
        if (currentIndex < data.response.length) {
          setMessages(prev => {
            const newMessages = [...prev];
            const lastMessage = newMessages[newMessages.length - 1];
            if (lastMessage.role === 'assistant') {
              lastMessage.content = data.response.substring(0, currentIndex + 1);
            }
            return newMessages;
          });
          currentIndex++;
          setTimeout(typeCharacter, typingSpeed);
        } else {
          // Typing complete
          setLoading(false);
        }
      };

      typeCharacter();

      // Save to conversation
      if (currentConversationId) {
        // Save user message
        await fetch(`${API_URL}/chatbot/conversations/${currentConversationId}/messages?role=user&content=${encodeURIComponent(messageToSend)}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        // Save assistant message
        await fetch(`${API_URL}/chatbot/conversations/${currentConversationId}/messages?role=assistant&content=${encodeURIComponent(data.response)}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        // Auto-update title if it's the first message
        if (messages.length === 1) {
          const title = messageToSend.substring(0, 50) + (messageToSend.length > 50 ? '...' : '');
          await fetch(`${API_URL}/chatbot/conversations/${currentConversationId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ title })
          });
          await loadConversations();
        }
      } else {
        // Create new conversation
        const createRes = await fetch(`${API_URL}/chatbot/conversations`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ title: messageToSend.substring(0, 50) })
        });

        if (createRes.ok) {
          const newConv = await createRes.json();
          setCurrentConversationId(newConv.id);
          await loadConversations();
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Failed to get response'}`
      };
      setMessages(prev => [...prev, errorMessage]);
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex h-full bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-gradient-to-b from-teal-900 via-teal-900/90 to-teal-950 backdrop-blur-xl border-r-2 border-teal-600/60 shadow-2xl transition-all duration-300 flex flex-col`}>
        <div className="p-5 border-b border-teal-600/40 bg-teal-900/30">
          <button
            onClick={createNewChat}
            className="w-full flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-500 to-cyan-400 hover:from-blue-400 hover:to-cyan-300 text-white rounded-lg transition-all duration-200 font-bold"
          >
            <Plus size={20} />
            {sidebarOpen && <span className="text-base">New Chat</span>}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {conversations.map(conv => (
            <div
              key={conv.id}
              className={`group mb-2 p-3.5 rounded-lg cursor-pointer transition-all duration-300 ${
                currentConversationId === conv.id
                  ? 'bg-gradient-to-r from-slate-900/90 to-slate-950/90 border-2 border-green-500 shadow-lg shadow-green-600/30'
                  : 'hover:bg-teal-800/50 border border-teal-700/40'
              }`}
              onClick={() => selectConversation(conv.id)}
            >
              <div className="flex items-start gap-2">
                <MessageCircle
                  size={16}
                  className={`mt-1 flex-shrink-0 transition-colors ${
                    currentConversationId === conv.id ? 'text-green-400' : 'text-cyan-400'
                  }`}
                />
                {sidebarOpen && (
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-bold truncate transition-colors ${
                      currentConversationId === conv.id ? 'text-green-300' : 'text-cyan-200'
                    }`}>{conv.title}</p>
                    <p className={`text-xs transition-colors ${
                      currentConversationId === conv.id ? 'text-green-400' : 'text-cyan-400/80'
                    }`}>
                      {new Date(conv.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>
              {sidebarOpen && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteConversation(conv.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-300 hover:bg-red-500/20 p-1.5 rounded-md ml-auto"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900/95 to-slate-800/95 backdrop-blur-xl border-b border-slate-700/50 px-8 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4 flex-1">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-slate-300 hover:text-blue-400 transition-colors text-2xl"
            >
              ☰
            </button>
            <div className="flex-1">
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">RAG Chatbot</h1>
              <p className="text-slate-400 text-sm mt-1">
                {currentConversationId
                  ? conversations.find(c => c.id === currentConversationId)?.title || 'Current Chat'
                  : 'Start a new conversation'}
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowContexts(!showContexts)}
              className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-500 hover:to-blue-600 transition-all duration-200 text-sm font-medium shadow-lg shadow-blue-500/30"
            >
              {showContexts ? 'Hide Sources' : 'Show Sources'}
            </button>
            <button
              onClick={toggleMemories}
              className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg hover:from-purple-500 hover:to-purple-600 transition-all duration-200 text-sm font-medium shadow-lg shadow-purple-500/30"
            >
              {showMemories ? 'Hide Memories' : 'Saved Memories'}
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4" data-messages-container>
          {loadingChat ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Loader size={40} className="animate-spin text-green-400 mb-4 mx-auto" />
                <p className="text-gray-300">Loading conversation...</p>
              </div>
            </div>
          ) : (
            <>
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} gap-2`}
            >
              <div
                className={`max-w-2xl px-5 py-4 rounded-xl transition-all duration-200 ${
                  message.role === 'user'
                    ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/30 rounded-br-none'
                    : 'bg-gradient-to-br from-slate-700/80 to-slate-800/80 text-gray-50 border border-slate-600/50 shadow-lg shadow-slate-900/50 rounded-bl-none'
                }`}
              >
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
              </div>
            </div>
          ))}

          {/* Memory Saved Notification - attached to the message that saved it */}
          {lastMemorySavedIndex !== null && lastMemorySavedIndex < messages.length && savedMemories.length > 0 && (
            <div className="flex justify-start animate-fadeIn">
              <div className="bg-gradient-to-r from-green-600/20 to-emerald-600/20 border border-green-500/50 rounded-xl p-3 max-w-md shadow-lg shadow-green-500/20">
                <div className="flex items-start gap-2">
                  <div className="text-lg">💾</div>
                  <div className="flex-1">
                    <p className="text-green-300 font-bold text-xs mb-1">Memory Saved!</p>
                    <div className="space-y-0.5">
                      {savedMemories.map((memory, idx) => (
                        <p key={idx} className="text-green-200 text-xs">
                          ✓ {memory.type}: {memory.value}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Saved Memories Display */}
          {showMemories && (
            <div className="mt-6 bg-gradient-to-br from-purple-700/40 to-purple-800/40 border border-purple-600/50 rounded-xl p-5">
              <h3 className="text-white font-bold mb-4 text-base">🧠 Your Saved Memories</h3>
              {loadingMemories ? (
                <p className="text-purple-300 text-sm">Loading memories...</p>
              ) : allMemories.length > 0 ? (
                <div className="space-y-3">
                  {allMemories.map((memory, idx) => (
                    <div key={idx} className="bg-purple-800/50 p-4 rounded-lg border border-purple-600/50 hover:border-purple-500/50 transition-all duration-200 flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-purple-200 text-xs font-semibold">{memory.type}</p>
                        <p className="text-purple-100 text-sm mt-1">{memory.value}</p>
                      </div>
                      <button
                        onClick={() => deleteMemory((memory as any).key)}
                        className="ml-4 px-3 py-1.5 bg-red-600/50 hover:bg-red-600 text-red-100 rounded-lg text-xs font-medium transition-all duration-200"
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-purple-300 text-sm">No memories saved yet. Start a conversation to save memories!</p>
              )}
            </div>
          )}

          {/* Contexts Display */}
          {showContexts && lastContexts.length > 0 && (
            <div className="mt-6 bg-gradient-to-br from-slate-700/40 to-slate-800/40 border border-slate-600/50 rounded-xl p-5">
              <h3 className="text-white font-bold mb-4 text-base">📚 Retrieved Sources</h3>
              <div className="space-y-3">
                {lastContexts.map((ctx, idx) => (
                  <div key={idx} className="bg-slate-800/50 p-4 rounded-lg border border-slate-600/50 hover:border-blue-500/50 transition-all duration-200">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="text-slate-100 text-xs font-semibold">{ctx.doc_name}</p>
                        <p className="text-slate-500 text-xs mt-1.5">{ctx.source}</p>
                      </div>
                      <span className="text-xs bg-gradient-to-r from-blue-600 to-blue-700 text-white px-3 py-1 rounded-full font-medium">
                        {(ctx.score * 100).toFixed(0)}%
                      </span>
                    </div>
                    <p className="text-slate-300 text-xs leading-relaxed line-clamp-2">{ctx.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-white/10 text-gray-100 border border-white/20 px-4 py-3 rounded-lg">
                <div className="flex items-center space-x-1">
                  <div className="inline-flex gap-1">
                    <span className="text-2xl font-bold text-green-400 animate-bounce" style={{ animationDelay: '0s' }}>•</span>
                    <span className="text-2xl font-bold text-green-400 animate-bounce" style={{ animationDelay: '0.15s' }}>•</span>
                    <span className="text-2xl font-bold text-green-400 animate-bounce" style={{ animationDelay: '0.3s' }}>•</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input Area */}
        <div className="bg-gradient-to-r from-slate-900/95 to-slate-800/95 backdrop-blur-xl border-t border-slate-700/50 px-8 py-6">
          <div className="flex gap-3">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask a question about the knowledge base..."
              disabled={loading}
              className="flex-1 bg-slate-800/50 border border-slate-600/50 rounded-xl px-5 py-4 text-black placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:bg-slate-800 transition-all duration-200 disabled:opacity-50 shadow-lg"
            />
            <button
              onClick={sendMessage}
              disabled={loading || !inputValue.trim()}
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 disabled:from-slate-600 disabled:to-slate-700 disabled:cursor-not-allowed text-white px-6 py-4 rounded-xl transition-all duration-200 flex items-center gap-2 font-medium shadow-lg shadow-blue-500/30 disabled:shadow-none"
            >
              <Send size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
