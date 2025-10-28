// Nova - Marketing Writer Agent
// Generates LinkedIn/Substack content in Jacob's voice

export default {
    async fetch(request, env) {
      // CORS headers
      const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      };
  
      // Handle preflight
      if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
      }
  
      // Test endpoint
      if (request.method === 'GET') {
        return new Response(JSON.stringify({
          message: 'Nova is running',
          hasAnthropicKey: !!env.ANTHROPIC_API_KEY,
          hasNotionToken: !!env.NOTION_TOKEN,
          hasNotionDatabase: !!env.NOTION_DATABASE_ID,
          hasSupabaseUrl: !!env.SUPABASE_URL,
          hasSupabaseKey: !!env.SUPABASE_KEY
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
  
      if (request.method !== 'POST') {
        return new Response('Method not allowed', { 
          status: 405,
          headers: corsHeaders
        });
      }
  
      // Track execution time and ID
      const startTime = Date.now();
      let executionId = null;
  
      try {
        const { topic, platform, style } = await request.json();
        
        console.log('Request received:', { topic, platform, style });

        // Start execution logging
        executionId = await logExecutionStart(
          env.SUPABASE_URL,
          env.SUPABASE_KEY,
          null, // no conversationId for Nova (MCP/API triggered)
          'nova',
          {
            topic: topic,
            platform: platform,
            style: style || null
          }
        );
  
        // Fetch voice examples from Notion
        console.log('Fetching voice examples from Notion...');
        const voiceExamples = await getVoiceExamples(env.NOTION_TOKEN, env.NOTION_DATABASE_ID, platform);
        console.log(`Found ${voiceExamples.length} voice examples`);
  
        // Search Notion workspace for relevant context
        console.log('Searching Notion workspace...');
        const contextDocs = await searchNotionWorkspace(env.NOTION_TOKEN, topic, platform);
        console.log(`Found ${contextDocs.length} relevant docs`);
  
        // Generate content with Claude
        console.log('Generating content with Claude...');
        const draft = await generateContent(
          topic,
          platform,
          style,
          voiceExamples,
          contextDocs,
          env.ANTHROPIC_API_KEY
        );

        const output = {
          draft: draft,
          voiceExamplesUsed: voiceExamples.length,
          contextDocsUsed: contextDocs.length
        };

        // Log successful execution
        const duration = Date.now() - startTime;
        await logExecutionComplete(
          env.SUPABASE_URL,
          env.SUPABASE_KEY,
          executionId,
          output,
          duration
        );
  
        return new Response(JSON.stringify({
          success: true,
          output: output,
          error: null,
          metadata: {
            agentId: 'nova',
            executionId: executionId,
            timestamp: new Date().toISOString()
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
  
      } catch (error) {
        console.error('Error:', error);

        // Log failed execution
        const duration = Date.now() - startTime;
        await logExecutionError(
          env.SUPABASE_URL,
          env.SUPABASE_KEY,
          executionId,
          error.message,
          duration
        );

        return new Response(JSON.stringify({
          success: false,
          output: null,
          error: error.message,
          metadata: {
            agentId: 'nova',
            executionId: executionId,
            timestamp: new Date().toISOString()
          }
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }
  };
  
  async function getVoiceExamples(notionToken, databaseId, platform) {
    try {
      const response = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${notionToken}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          filter: platform ? {
            property: 'Platform',
            select: {
              equals: platform
            }
          } : undefined,
          page_size: 10
        })
      });
  
      if (!response.ok) {
        const error = await response.text();
        console.error('Notion API error:', error);
        return [];
      }
  
      const data = await response.json();
      
      return data.results.map(page => {
        const content = page.properties.Content?.rich_text?.[0]?.plain_text || '';
        const tags = page.properties.Tag?.multi_select?.map(t => t.name) || [];
        
        return {
          content: content,
          tags: tags,
          platform: page.properties.Platform?.select?.name || ''
        };
      }).filter(ex => ex.content);
  
    } catch (error) {
      console.error('Error fetching voice examples:', error);
      return [];
    }
  }
  
  async function searchNotionWorkspace(notionToken, topic, platform) {
    try {
      const searchQuery = platform === 'LinkedIn' ? 'LinkedIn Content Style Guide' : 
                         platform === 'Substack' ? 'Substack Strategy' : 
                         topic;
  
      const response = await fetch('https://api.notion.com/v1/search', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${notionToken}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: searchQuery,
          filter: {
            property: 'object',
            value: 'page'
          },
          page_size: 5
        })
      });
  
      if (!response.ok) {
        console.error('Notion search error:', await response.text());
        return [];
      }
  
      const data = await response.json();
      
      // Fetch content for each page
      const pages = await Promise.all(
        data.results.slice(0, 3).map(async (page) => {
          try {
            const pageContent = await fetch(`https://api.notion.com/v1/blocks/${page.id}/children`, {
              headers: {
                'Authorization': `Bearer ${notionToken}`,
                'Notion-Version': '2022-06-28'
              }
            });
            
            const blocks = await pageContent.json();
            const text = blocks.results
              .map(block => extractBlockText(block))
              .filter(Boolean)
              .join('\n');
            
            return {
              title: page.properties?.title?.title?.[0]?.plain_text || 'Untitled',
              content: text
            };
          } catch (err) {
            console.error('Error fetching page content:', err);
            return null;
          }
        })
      );
  
      return pages.filter(Boolean);
  
    } catch (error) {
      console.error('Error searching Notion:', error);
      return [];
    }
  }
  
  function extractBlockText(block) {
    const type = block.type;
    if (!block[type]) return '';
    
    const richText = block[type].rich_text || [];
    return richText.map(t => t.plain_text).join('');
  }
  
  async function generateContent(topic, platform, style, voiceExamples, contextDocs, apiKey) {
    const systemPrompt = buildSystemPrompt(platform, voiceExamples, contextDocs);
    const userPrompt = buildUserPrompt(topic, platform, style);
  
    console.log('Calling Anthropic API...');
    console.log('API Key prefix:', apiKey?.substring(0, 20));
    console.log('Model:', 'claude-sonnet-4-20250514');
  
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: userPrompt
        }],
        system: systemPrompt
      })
    });
  
    console.log('Anthropic response status:', response.status);
    
    const responseText = await response.text();
    console.log('Anthropic raw response:', responseText);
    
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      throw new Error(`Failed to parse Anthropic response: ${responseText}`);
    }
    
    if (!response.ok) {
      throw new Error(`Claude API error (${response.status}): ${JSON.stringify(data)}`);
    }
  
    return data.content[0].text;
  }
  
  function buildSystemPrompt(platform, voiceExamples, contextDocs) {
    let prompt = `You are Nova, Jacob Brain's marketing writing assistant. Your job is to write ${platform || 'social media'} content that sounds exactly like Jacob.
  
  # Jacob's Voice & Style
  
  Jacob writes with a direct, practical, anti-fluff style. Key characteristics:
  
  - **Direct and concise**: Gets to the point quickly, no unnecessary words
  - **Practical over theoretical**: Emphasizes actionable advice and real-world application  
  - **Conversational but professional**: Approachable tone while maintaining credibility
  - **Contrarian when warranted**: Challenges conventional wisdom with nuanced takes
  - **Structured thinking**: Often uses bullets, numbers, or clear sections
  - **No hype or buzzwords**: Avoids marketing speak and empty phrases
  - **Personal experience**: Draws from building agencies and working with professional services firms
  
  `;
  
    if (voiceExamples.length > 0) {
      prompt += `\n# Voice Examples\n\nHere are examples of Jacob's actual posts:\n\n`;
      voiceExamples.slice(0, 5).forEach((ex, i) => {
        prompt += `Example ${i + 1} (${ex.tags.join(', ')}):\n${ex.content}\n\n`;
      });
    }
  
    if (contextDocs.length > 0) {
      prompt += `\n# Style Guidelines from Notion\n\n`;
      contextDocs.forEach(doc => {
        prompt += `## ${doc.title}\n${doc.content}\n\n`;
      });
    }
  
    prompt += `\nWrite in Jacob's voice. Match his style, tone, and approach. Be direct, practical, and valuable.`;
  
    return prompt;
  }
  
  function buildUserPrompt(topic, platform, style) {
    let prompt = `Write a ${platform || 'social media'} post about: ${topic}\n\n`;
    
    if (style) {
      prompt += `Style notes: ${style}\n\n`;
    }
  
    if (platform === 'LinkedIn') {
      prompt += `LinkedIn formatting:
  - Start with a strong hook (first 1-2 sentences)
  - Keep paragraphs short (1-3 sentences)
  - Use line breaks for readability
  - Can use bullets (🚫, ✏️, etc.) or emojis sparingly
  - 150-300 words typically
  - End with insight or call to action`;
    } else if (platform === 'Substack') {
      prompt += `Substack Note formatting:
  - Can be shorter and punchier than LinkedIn
  - More casual, conversational
  - Quick takes, observations, or insights
  - 50-150 words`;
    }
   
    return prompt;
  }

// === SUPABASE HELPER FUNCTIONS ===

async function logExecutionStart(supabaseUrl, supabaseKey, conversationId, agentId, input) {
  try {
    const logEntry = {
      conversation_id: conversationId || null,
      agent_id: agentId,
      input: input,
      form_type: null, // Nova doesn't process forms
      status: 'running',
      created_at: new Date().toISOString()
    };

    const response = await fetch(`${supabaseUrl}/rest/v1/agent_executions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(logEntry)
    });

    if (!response.ok) {
      console.error('Failed to log execution start:', await response.text());
      return null;
    }

    const result = await response.json();
    return result[0]?.id || null;
  } catch (error) {
    console.error('Error in logExecutionStart:', error);
    return null;
  }
}

async function logExecutionComplete(supabaseUrl, supabaseKey, executionId, output, durationMs) {
  if (!executionId) return;

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/agent_executions?id=eq.${executionId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify({
        output: output,
        status: 'success',
        duration_ms: durationMs
      })
    });

    if (!response.ok) {
      console.error('Failed to log execution complete:', await response.text());
    }
  } catch (error) {
    console.error('Error in logExecutionComplete:', error);
  }
}

async function logExecutionError(supabaseUrl, supabaseKey, executionId, errorMessage, durationMs) {
  if (!executionId) return;

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/agent_executions?id=eq.${executionId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify({
        status: 'error',
        error_message: errorMessage,
        duration_ms: durationMs
      })
    });

    if (!response.ok) {
      console.error('Failed to log execution error:', await response.text());
    }
  } catch (error) {
    console.error('Error in logExecutionError:', error);
  }
}