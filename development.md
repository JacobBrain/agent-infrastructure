# Development Guide

**For developers building new agents or modifying existing infrastructure.**

---

## Quick Start

### Adding a New Agent (Step-by-Step)

**Time required:** 30-60 minutes for a basic agent

#### Step 1: Plan the Agent

Before writing code, answer:
- **What does it do?** (One clear purpose)
- **What triggers it?** (Webhook, MCP, API, email)
- **What inputs does it need?** (Define schema)
- **What outputs does it produce?** (Define schema)
- **What external services does it call?** (Claude API, Notion, etc.)

**Example:**
- **Agent:** Meeting Summarizer
- **Trigger:** Email forward or API call
- **Inputs:** Meeting transcript (text)
- **Outputs:** Summary with action items (JSON)
- **Services:** Claude API for summarization

#### Step 2: Create Worker File

Create `/workers/[agent-name]/worker.js`:

```javascript
// [Agent Name] - [Brief Description]
// Triggered by: [trigger type]

export default {
  async fetch(request, env) {
    // CORS headers for API access
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // Handle preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Health check endpoint
    if (request.method === 'GET') {
      return new Response(JSON.stringify({
        agent: '[agent-name]',
        status: 'running',
        version: '1.0.0',
        hasRequiredEnvVars: checkEnvVars(env)
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Only accept POST for actual work
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { 
        status: 405,
        headers: corsHeaders
      });
    }

    try {
      // Parse standard request format
      const { conversationId, userId, input, metadata } = await request.json();
      
      // Log execution start to Supabase
      const executionId = await logExecutionStart(
        env.SUPABASE_URL,
        env.SUPABASE_KEY,
        conversationId,
        '[agent-name]',
        input
      );

      // YOUR AGENT LOGIC HERE
      const result = await processRequest(input, env);

      // Log execution success
      await logExecutionComplete(
        env.SUPABASE_URL,
        env.SUPABASE_KEY,
        executionId,
        result
      );

      // Return standard response format
      return new Response(JSON.stringify({
        success: true,
        output: result,
        error: null,
        metadata: {
          agentId: '[agent-name]',
          executionId: executionId,
          timestamp: new Date().toISOString()
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Error:', error);
      
      // Log execution failure
      await logExecutionError(
        env.SUPABASE_URL,
        env.SUPABASE_KEY,
        executionId,
        error.message
      );

      return new Response(JSON.stringify({
        success: false,
        output: null,
        error: error.message,
        metadata: {
          agentId: '[agent-name]',
          timestamp: new Date().toISOString()
        }
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};

async function processRequest(input, env) {
  // Your agent's core logic
  // Call external APIs, process data, etc.
  return {};
}

function checkEnvVars(env) {
  const required = ['ANTHROPIC_API_KEY', 'SUPABASE_URL', 'SUPABASE_KEY'];
  return required.every(key => !!env[key]);
}

// Import Supabase helper functions from /lib/supabase.js
async function logExecutionStart(url, key, conversationId, agentId, input) {
  // Implementation in /lib/supabase.js
}
// ... other helper functions
```

#### Step 3: Add to Agent Registry

Edit `/agent-registry.json`:

```json
{
  "agents": [
    // ... existing agents
    {
      "id": "meeting-summarizer",
      "name": "Meeting Summarizer",
      "description": "Summarizes meeting transcripts and extracts action items",
      "url": "https://meeting-summarizer.jacob-788.workers.dev",
      "capabilities": ["summarization", "action-items", "meeting-notes"],
      "triggers": ["email", "api"],
      "input_schema": {
        "transcript": {
          "type": "string",
          "required": true,
          "description": "Full meeting transcript"
        },
        "participants": {
          "type": "array",
          "required": false,
          "description": "List of participant names"
        }
      },
      "output_schema": {
        "summary": {
          "type": "string",
          "description": "Concise meeting summary"
        },
        "action_items": {
          "type": "array",
          "description": "List of action items with owners"
        }
      },
      "requires_env_vars": [
        "ANTHROPIC_API_KEY",
        "SUPABASE_URL",
        "SUPABASE_KEY"
      ],
      "version": "1.0.0",
      "created_date": "2025-10-26"
    }
  ]
}
```

#### Step 4: Configure Environment Variables

In Cloudflare Workers dashboard:
1. Go to Worker settings
2. Add environment variables (Text type):
   - `ANTHROPIC_API_KEY` (if needed)
   - `SUPABASE_URL` (if needed)
   - `SUPABASE_KEY` (if needed)
   - Any agent-specific keys

**Note:** In the future, these will be centralized at account level.

#### Step 5: Deploy to Cloudflare

**Current workflow:**
1. Copy your `worker.js` code
2. Go to Cloudflare Workers dashboard
3. Create new worker or edit existing
4. Paste code
5. Click "Save and Deploy"

**Future workflow (when Wrangler is set up):**
```bash
cd /workers/[agent-name]
wrangler deploy
```

#### Step 6: Test the Agent

**Health check:**
```bash
curl https://[agent-name].jacob-788.workers.dev
```

Expected response:
```json
{
  "agent": "meeting-summarizer",
  "status": "running",
  "version": "1.0.0",
  "hasRequiredEnvVars": true
}
```

**Functional test:**
```bash
curl -X POST https://[agent-name].jacob-788.workers.dev \
  -H "Content-Type: application/json" \
  -d '{
    "conversationId": "test-123",
    "userId": "jacob@jacobbrain.com",
    "input": {
      "transcript": "Test meeting transcript..."
    }
  }'
```

Expected response:
```json
{
  "success": true,
  "output": { /* your agent's output */ },
  "error": null,
  "metadata": {
    "agentId": "meeting-summarizer",
    "executionId": "uuid",
    "timestamp": "2025-10-26T..."
  }
}
```

#### Step 7: Verify Logging

Check Supabase:
1. Open Supabase dashboard
2. Go to Table Editor → `agent_executions`
3. Find your test execution
4. Verify input, output, and duration are logged

#### Step 8: Update Documentation

**Update README.md:**
Add your agent to the "Current Agents" section:
```markdown
### Meeting Summarizer ✅ WORKING
- **URL**: https://meeting-summarizer.jacob-788.workers.dev
- **Purpose**: Summarizes meeting transcripts and extracts action items
- **Trigger**: Email forward or API call
- **Output**: Summary with action items in JSON
- **Status**: Operational
```

**Update this file (DEVELOPMENT.md):**
Add any unique development notes or gotchas for your agent.

#### Step 9: Commit to GitHub

```bash
git add .
git commit -m "Add meeting-summarizer agent"
git push origin main
```

#### Step 10: Test with Orchestrator (Future)

Once orchestrator is deployed:
```
# In Claude Desktop
"Summarize this meeting for me: [paste transcript]"
```

Orchestrator should route to your agent automatically.

---

## Testing Checklist

Before marking an agent as "production ready," verify:

### Functional Tests
- [ ] Health check endpoint returns 200
- [ ] Accepts standard request format
- [ ] Returns standard response format
- [ ] Handles missing inputs gracefully
- [ ] Handles API errors gracefully
- [ ] Timeout doesn't crash worker

### Integration Tests
- [ ] Logs to Supabase correctly
- [ ] Calls external APIs successfully (Claude, Notion, etc.)
- [ ] Environment variables load correctly
- [ ] CORS headers allow API access

### Documentation Tests
- [ ] Added to agent-registry.json
- [ ] README.md updated
- [ ] Input/output schemas documented
- [ ] Example request/response provided

### Security Tests
- [ ] No API keys in code
- [ ] No secrets in logs
- [ ] Input validation present
- [ ] Error messages don't leak sensitive info

---

## Common Patterns

### Calling Claude API

```javascript
async function callClaude(prompt, env) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: prompt
      }]
    })
  });

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.status}`);
  }

  const data = await response.json();
  return data.content[0].text;
}
```

### Searching Notion

```javascript
async function searchNotion(query, env) {
  const response = await fetch('https://api.notion.com/v1/search', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.NOTION_TOKEN}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query: query,
      filter: { property: 'object', value: 'page' },
      page_size: 5
    })
  });

  if (!response.ok) {
    throw new Error(`Notion API error: ${response.status}`);
  }

  const data = await response.json();
  return data.results;
}
```

### Logging to Supabase

```javascript
async function logToSupabase(url, key, table, data) {
  const response = await fetch(`${url}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    console.error('Supabase logging failed:', await response.text());
    // Don't throw - logging failure shouldn't break agent
  }

  return await response.json();
}
```

---

## Debugging Tips

### Worker Won't Deploy
- Check syntax errors in dashboard console
- Verify all imported functions exist
- Make sure `export default` is present

### Agent Returns Errors
1. Check Cloudflare Worker logs (dashboard → Logs & Analytics)
2. Check Supabase `agent_executions` table for details
3. Test locally with curl (see Step 6 above)
4. Verify environment variables are set

### External API Calls Fail
- Verify API key is in environment variables
- Check API endpoint URL is correct
- Ensure request format matches API docs
- Check Cloudflare network restrictions (see README)

### Logging Not Working
- Verify Supabase URL and key are correct
- Check Supabase table schema matches your data
- Look for errors in Worker logs
- Test Supabase connection with simple curl

---

## Performance Guidelines

### Keep Workers Fast
- Aim for < 1000ms execution time
- Cache Notion queries when possible
- Minimize Claude API calls
- Use Promise.all() for parallel operations

### Handle Large Inputs
- If transcript > 100KB, chunk it
- If processing takes > 10s, return job ID immediately
- Use Supabase as simple queue for long tasks

### Optimize Costs
- Claude API: Use shortest prompts possible
- Supabase: Batch inserts when possible
- Cloudflare: Free tier covers 100K requests/day

---

## Code Style

### Follow These Conventions
- Use async/await (not callbacks)
- Handle errors explicitly (try/catch)
- Log errors with context
- Use descriptive variable names
- Comment complex logic
- Keep functions small (< 50 lines)

### Example of Good Style
```javascript
async function generateSummary(transcript, env) {
  try {
    // Build prompt with clear instructions
    const prompt = buildPrompt(transcript);
    
    // Call Claude API with error handling
    const summary = await callClaude(prompt, env);
    
    // Parse and validate response
    const parsed = JSON.parse(summary);
    if (!parsed.summary || !parsed.action_items) {
      throw new Error('Invalid Claude response format');
    }
    
    return parsed;
  } catch (error) {
    console.error('Summary generation failed:', error);
    throw new Error(`Failed to generate summary: ${error.message}`);
  }
}
```

---

## Deployment Workflow

### Current Process
1. Edit code in Cursor
2. Save and commit to GitHub
3. Copy code to Cloudflare dashboard
4. Click "Save and Deploy"
5. Test with curl
6. Mark as deployed in Notion/tracking tool

### Future Process (When Wrangler Set Up)
1. Edit code in Cursor
2. Run `wrangler deploy` from terminal
3. Test automatically via script
4. Commit to GitHub

---

## Rollback Procedure

If an agent breaks in production:

1. **Immediate:** Revert in Cloudflare dashboard
   - Go to Worker → Deployments
   - Click "Rollback" on previous working version

2. **Fix locally:** Debug in Cursor
   - Use version control to see what changed
   - Test fix thoroughly

3. **Redeploy:** Follow deployment workflow

4. **Document:** Add to ARCHITECTURE.md decision log
   - What broke
   - Why it broke  
   - How it was fixed

---

## Getting Help

### When Stuck
1. Check ARCHITECTURE.md for design rationale
2. Review similar agent code (Ada or Nova)
3. Check Cloudflare Workers docs
4. Ask in Claude Project: "Agent Infrastructure"

### Common Issues
- **"Module not found"**: Check import paths
- **"API key invalid"**: Verify env var name matches code
- **"Timeout"**: Optimize or make async
- **"CORS error"**: Add corsHeaders to response

---

## Next Steps for Infrastructure

### Upcoming Improvements
1. **Wrangler CLI setup** - Automated deployments
2. **Shared helper library** - `/lib/agent-helpers.js`
3. **Test framework** - Automated testing
4. **CI/CD pipeline** - GitHub Actions deployment
5. **Local development** - Wrangler dev mode

---

*This guide will evolve as the infrastructure matures. Suggest improvements via GitHub issues or in the Claude Project.*