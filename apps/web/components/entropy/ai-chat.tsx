"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useLanguage } from "@/components/providers/language-provider"
import { Send, Bot, User, Sparkles, Copy, ThumbsUp, ThumbsDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
}

interface AIChatProps {
  context?: string
  placeholder?: string
  className?: string
}

export function AIChat({ context, placeholder, className }: AIChatProps) {
  const { t, dir } = useLanguage()
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content: "Hello! I'm your AI assistant. I can help you with proposal writing, answer questions about RFP requirements, suggest improvements, and more. How can I assist you today?",
      timestamp: new Date(),
    }
  ])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsLoading(true)

    // Simulate AI response
    setTimeout(() => {
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: getAIResponse(input),
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, aiMessage])
      setIsLoading(false)
    }, 1500)
  }

  const getAIResponse = (userInput: string): string => {
    const lowerInput = userInput.toLowerCase()
    
    if (lowerInput.includes("deadline") || lowerInput.includes("due date")) {
      return "Based on the RFP document, the submission deadline is March 25, 2024 at 5:00 PM EST. I recommend completing your final review at least 24 hours before submission to allow time for any last-minute adjustments."
    }
    
    if (lowerInput.includes("requirement") || lowerInput.includes("compliance")) {
      return "I've analyzed the RFP requirements. There are 47 mandatory requirements across 5 sections. Currently, 42 requirements are fully addressed, 3 are partially addressed, and 2 need attention. Would you like me to detail the requirements that need work?"
    }
    
    if (lowerInput.includes("improve") || lowerInput.includes("suggestion")) {
      return "Here are my suggestions to strengthen your proposal:\n\n1. **Executive Summary**: Add more specific metrics about past performance\n2. **Technical Approach**: Include a visual timeline of the implementation phases\n3. **Team Qualifications**: Highlight relevant certifications more prominently\n4. **Pricing**: Consider adding a cost-benefit analysis\n\nWould you like me to help with any of these improvements?"
    }
    
    if (lowerInput.includes("competitor") || lowerInput.includes("win")) {
      return "Based on historical data for similar RFPs, your win probability is estimated at 72%. Key differentiators to emphasize include your team's domain expertise, innovative technical approach, and competitive pricing. I recommend strengthening the risk mitigation section as that's often a deciding factor."
    }
    
    return "I understand you're asking about that. Let me analyze the RFP documents and your current proposal to provide relevant insights. Could you please provide more specific details about what aspect you'd like me to focus on?"
  }

  return (
    <div className={cn("flex flex-col h-full", className)} dir={dir}>
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex gap-3",
                message.role === "user" && "flex-row-reverse"
              )}
            >
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback className={cn(
                  message.role === "assistant" 
                    ? "bg-primary/10 text-primary" 
                    : "bg-muted"
                )}>
                  {message.role === "assistant" ? (
                    <Bot className="h-4 w-4" />
                  ) : (
                    <User className="h-4 w-4" />
                  )}
                </AvatarFallback>
              </Avatar>
              <div
                className={cn(
                  "flex flex-col gap-1 max-w-[80%]",
                  message.role === "user" && "items-end"
                )}
              >
                <div
                  className={cn(
                    "rounded-lg px-4 py-2.5 text-sm",
                    message.role === "assistant"
                      ? "bg-muted"
                      : "bg-primary text-primary-foreground"
                  )}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>
                </div>
                {message.role === "assistant" && (
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                      <Copy className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                      <ThumbsUp className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                      <ThumbsDown className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-3">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary/10 text-primary">
                  <Bot className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              <div className="bg-muted rounded-lg px-4 py-2.5">
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" />
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="p-4 border-t">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder={placeholder || t("ai_placeholder")}
            disabled={isLoading}
            className="flex-1"
          />
          <Button onClick={handleSend} disabled={!input.trim() || isLoading}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <Sparkles className="h-3 w-3 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            AI suggestions are generated based on your documents and proposal context
          </p>
        </div>
      </div>
    </div>
  )
}
