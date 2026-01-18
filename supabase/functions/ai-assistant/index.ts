import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, conversationHistory = [], mode = "text" } = await req.json();

    if (!message) {
      return new Response(
        JSON.stringify({ error: "Message is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("AI Assistant request:", message, "mode:", mode);

    // Build conversation messages
    const systemPrompt = `You are Alsamos AI Assistant - a helpful, friendly, and professional voice assistant similar to Google Assistant and Yandex Alisa. 

Your capabilities:
- Answer questions about any topic with accurate, up-to-date information
- Help with web searches and navigation
- Provide quick facts, definitions, and explanations
- Assist with calculations, conversions, and comparisons
- Give weather updates, time, and general information
- Offer friendly, conversational responses

Communication style:
- Be concise but helpful - keep responses under 3-4 sentences for voice mode
- Be warm, friendly, and professional
- Use natural, conversational language
- When you don't know something, admit it honestly
- For complex topics, provide a brief summary first

Current capabilities context:
- You are integrated into the Alsamos search engine and browser
- You can help users search the web, navigate to websites, and answer questions
- Users may be speaking to you via voice or typing`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...conversationHistory.slice(-10), // Keep last 10 messages for context
      { role: "user", content: message }
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        max_tokens: mode === "voice" ? 200 : 500, // Shorter for voice
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI API error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Too many requests. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI service quota exceeded." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error("AI service error");
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || "I'm sorry, I couldn't process that request.";

    // Detect if the response contains a search intent
    const searchIntentPatterns = [
      /search for (.+)/i,
      /look up (.+)/i,
      /find (.+)/i,
      /what is (.+)/i,
      /who is (.+)/i,
      /show me (.+)/i,
    ];

    let action = null;
    const lowerMessage = message.toLowerCase();
    
    // Check for navigation intents
    if (lowerMessage.includes("open ") || lowerMessage.includes("go to ")) {
      const urlMatch = message.match(/(?:open|go to)\s+(.+)/i);
      if (urlMatch) {
        let site = urlMatch[1].trim();
        if (!site.includes(".")) {
          site = `${site}.com`;
        }
        if (!site.startsWith("http")) {
          site = `https://${site}`;
        }
        action = { type: "navigate", url: site };
      }
    }
    
    // Check for search intents
    for (const pattern of searchIntentPatterns) {
      const match = message.match(pattern);
      if (match) {
        action = { type: "search", query: match[1] };
        break;
      }
    }

    return new Response(
      JSON.stringify({
        reply,
        action,
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in ai-assistant:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Assistant error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
