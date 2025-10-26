# Agent Infrastructure Architecture

**Last Updated:** October 26, 2025  
**Version:** 1.0 (Pre-Orchestrator)

---

## System Overview

This infrastructure enables autonomous AI agents to handle business operations across Jacob's fractional COO practice and personal workflows. The system is designed for:

- **Modularity**: Each agent is independent and replaceable
- **Scalability**: Can grow from 2 agents to 20+ without architectural changes
- **Observability**: All agent actions are logged and traceable
- **Flexibility**: Multiple trigger mechanisms (webhooks, MCP, API, email)

---

## Core Design Principles

### 1. Stateless Agents, Stateful Orchestrator
- **Sub-agents** (Ada, Nova, etc.) are stateless workers that accept requests and return results
- **Orchestrator** manages state, conversation history, and multi-step workflows
- This allows agents to scale independently and be easily replaced/upgraded

### 2. Single Source of Truth
- **Notion** = Knowledge base (business context, style guides, processes)
- **Supabase** = Operational data (conversations, logs, execution history)
- **GitHub** = Code and configuration (version control)
- No duplication: each type of data lives in one place

### 3. Standard Interfaces
All agents implement the same request/response contract:
```javascript
// Request
{
  conversationId: "uuid",
  userId: "jacob@jacobbrain.com",
  input: { /* agent-specific params */ },
  metadata: { trigger: "mcp", timestamp: "..." }
}

// Response
{
  success: true,
  output: { /* agent-specific results */ },
  error: null,
  metadata: { agentId: "nova", executionTime: 1234 }
}
```

This makes agents interchangeable and simplifies orchestration logic.

---

## Technology Stack & Rationale

### Cloudflare Workers (Compute)
**Why chosen:**
- Serverless: No server management, automatic scaling
- Edge deployment: Low latency globally
- Cost-effective: Free tier covers significant usage
- Fast cold starts: Sub-50ms initialization
- Native HTTP/fetch: Easy to call external APIs

**Why not alternatives:**
- AWS Lambda: More complex, slower cold starts, costs add up
- Railway/Fly.io: Requires server management, ongoing costs
- Vercel Functions: Similar to Workers but less generous free tier

### Supabase (Database & State)
**Why chosen:**
- PostgreSQL: Real relational database (vs limited KV stores)
- Generous free tier: Unlimited API requests, 500MB storage
- Built-in features: Auth, storage, real-time subscriptions (future use)
- REST API: Easy to call from Cloudflare Workers
- Row-level security: Can add user isolation later
- Mature & reliable: Production-ready, good developer experience

**Why not alternatives:**
- Cloudflare KV: Too limited (no complex queries, only key-value)
- Cloudflare D1: Still in beta, less mature, SQLite limitations
- PlanetScale: Good but free tier more restrictive
- MongoDB: Overkill, prefer relational for structured agent data

### Notion (Knowledge Base)
**Why chosen:**
- Already Jacob's system of record for business knowledge
- API access: Agents can search and retrieve context
- Human-friendly: Easy to update without code changes
- Rich content: Supports documents, databases, images
- Collaborative: Team can update knowledge base

**Why not alternatives:**
- Store in Supabase: Not designed for unstructured knowledge
- Google Docs: No API access for agents
- Markdown files in repo: Not human-friendly to update

### Anthropic Claude (AI Engine)
**Why chosen:**
- Best-in-class reasoning for agentic workflows
- 200K context window: Can handle long conversations + knowledge
- Function calling: Natural fit for agent coordination
- Reliable API: Excellent uptime and performance

**Current model:** `claude-sonnet-4-20250514`

---

## Architecture Patterns

### Current State (2 Agents, No Orchestrator)

```
┌──────────────────┐        ┌──────────────────┐
│   Tally Webhook  │        │  Claude Desktop  │
└────────┬─────────┘        └────────┬─────────┘
         │                           │
         │ POST                      │ MCP
         ▼                           ▼
    ┌─────────┐                 ┌─────────┐
    │   Ada   │                 │  Nova   │
    └────┬────┘                 └────┬────┘
         │                           │
         │ Resend API                │ Notion API
         ▼                           ▼
    Joel's Email              Voice Examples DB
```

**Characteristics:**
- Direct triggers to agents
- No state persistence
- No conversation memory
- Agents are isolated

### Target State (With Orchestrator)

```
┌──────────────────────────────────────────────────┐
│  Triggers: MCP, Email, Slack, API, Webhooks      │
└─────────────────────┬────────────────────────────┘
                      │
                      ▼
         ┌────────────────────────┐
         │    ORCHESTRATOR        │
         │  - Route requests      │
         │  - Manage state        │
         │  - Coordinate agents   │
         │  - Aggregate results   │
         └───┬──────────┬─────────┘
             │          │
    ┌────────┴──┐   ┌──┴─────────┐
    │           │   │            │
    ▼           ▼   ▼            ▼
┌──────┐   ┌──────┐ ┌──────┐  ┌──────┐
│ Ada  │   │ Nova │ │Agent3│  │Agent4│
└──┬───┘   └──┬───┘ └──┬───┘  └──┬───┘
   │          │        │         │
   └──────────┴────────┴─────────┘
              │
              ▼
      ┌───────────────┐
      │   Supabase    │
      │ - Conversations│
      │ - Messages    │
      │ - Logs        │
      └───────┬───────┘
              │
              ▼
      ┌───────────────┐
      │    Notion     │
      │  AI Brain KB  │
      └───────────────┘
```

**Characteristics:**
- Single entry point for all triggers
- Persistent state in Supabase
- Conversation memory across sessions
- Agents can be called in sequence or parallel
- Full execution tracing

---

## State Management Strategy

### What Needs State?
1. **Conversation history**: "User asked X, Nova responded Y, user refined to Z"
2. **Multi-step workflows**: "Generate draft → Get approval → Post to LinkedIn"
3. **User preferences**: "Jacob prefers short LinkedIn posts"
4. **Execution logs**: "Nova was called 3 times today, 2 succeeded, 1 failed"

### Where State Lives

**Supabase Tables:**

**`conversations`**
- One row per conversation thread
- Tracks status (active, completed, failed)
- Links to user and all messages

**`messages`**
- One row per message in a conversation
- Role: user, assistant, system
- Includes which agent generated it

**`agent_executions`**
- One row per agent invocation
- Input, output, duration, errors
- For debugging and analytics

**`agents`** (optional - see Agent Registry section)
- Metadata about each agent
- Capabilities, URLs, schemas

### State Access Pattern
```javascript
// Orchestrator receives request
const conversation = await getOrCreateConversation(userId);

// Load history
const history = await getMessages(conversation.id);

// Call agent with context
const result = await callAgent('nova', {
  conversationId: conversation.id,
  input: userRequest,
  context: history
});

// Save result
await saveMessage(conversation.id, {
  role: 'assistant',
  content: result.output,
  agentId: 'nova'
});
```

---

## Agent Communication

### Request Flow
1. Orchestrator receives user input
2. Determines which agent(s) to invoke (routing logic)
3. Makes HTTP POST to agent worker URL
4. Agent processes request (may call Notion, Claude API, etc.)
5. Agent returns standard response
6. Orchestrator saves to Supabase
7. Returns result to user

### Error Handling
- Agents return `success: false` with error message
- Orchestrator logs failure to `agent_executions`
- Orchestrator can retry or route to different agent
- User receives helpful error message

### Timeout Strategy
- Cloudflare Workers have 30s CPU time limit (free tier)
- Long-running tasks should return immediately with job ID
- Use Supabase as simple job queue
- Poll for completion or use webhooks

---

## Agent Registry

### Purpose
The orchestrator needs to know:
- What agents exist
- What each agent can do
- How to call them
- What inputs they expect

### Two Options

**Option A: JSON File in Repo** (current recommendation)
```json
{
  "agents": [
    {
      "id": "nova",
      "name": "Nova - Marketing Writer",
      "url": "https://marketing-writer.jacob-788.workers.dev",
      "capabilities": ["content_generation", "linkedin", "substack"],
      "triggers": ["mcp", "api"],
      "input_schema": {
        "topic": "string",
        "platform": "string",
        "style": "string?"
      }
    }
  ]
}
```

**Pros:**
- Simple, version controlled
- Easy to edit and review
- No database queries needed

**Cons:**
- Static: requires deployment to add agents
- Can't update at runtime

**Option B: Supabase Table** (future)
- Store registry in `agents` table
- Query dynamically at runtime
- Update via API without deployment
- Better for 10+ agents

**Decision:** Start with JSON file, migrate to Supabase when agent count exceeds 8.

### Notion Alternative?
Notion could theoretically hold the registry, but:
- Adds API latency on every request
- Notion API is slower than JSON file or DB query
- Notion better suited for human-readable knowledge, not machine config
- **Recommendation:** Keep registry in JSON/Supabase, keep knowledge in Notion

---

## Routing Logic

### How Orchestrator Decides Which Agent to Call

**Phase 1: Simple Rules (Current Plan)**
```javascript
function routeRequest(userInput) {
  const input = userInput.toLowerCase();
  
  // Keyword matching
  if (input.includes('write') || input.includes('post') || input.includes('content')) {
    return ['nova'];
  }
  
  if (input.includes('form') || input.includes('workmanship')) {
    return ['ada'];
  }
  
  // Default: ask user for clarification
  return null;
}
```

**Phase 2: LLM-Based Routing (Future)**
```javascript
async function routeRequest(userInput, registry) {
  const prompt = `
    User request: "${userInput}"
    
    Available agents:
    ${JSON.stringify(registry.agents)}
    
    Which agent(s) should handle this? Return JSON array of agent IDs.
  `;
  
  const result = await callClaude(prompt);
  return JSON.parse(result);
}
```

**Phase 3: Multi-Agent Workflows (Future)**
```javascript
// Complex request: "Write a post about pricing and email it to my newsletter"
const workflow = [
  { agent: 'nova', task: 'generate_content' },
  { agent: 'reviewer', task: 'check_brand' },
  { agent: 'emailer', task: 'send_newsletter' }
];
```

**Decision:** Start with Phase 1, move to Phase 2 when you have 5+ agents.

---

## Security Considerations

### API Keys & Secrets
- **Never** commit to GitHub
- Store as Cloudflare environment variables
- Rotate regularly (quarterly)
- Future: Centralized secrets management (Cloudflare or 1Password)

### Webhook Security
- Ada's webhook is currently unauthenticated (Tally webhook)
- **Risk:** Anyone with URL could trigger
- **Mitigation (future):** Verify Tally signature or use API key

### API Access
- Orchestrator will expose REST API
- Require API key for non-MCP triggers
- Rate limiting (100 req/hour per user)

### Data Privacy
- Agent execution logs may contain sensitive info
- Supabase row-level security (future)
- Regular log rotation/cleanup

---

## Observability & Debugging

### Logging Strategy
Every agent execution logs to Supabase:
- Input received
- Output generated
- Duration
- Success/failure
- Error messages

### Debugging Workflow
1. User reports issue: "Nova didn't generate the right tone"
2. Query `agent_executions` for that conversation
3. See exact input/output from Nova
4. Check which voice examples were used
5. Adjust prompts or add more examples

### Metrics to Track (Future)
- Agent success rate
- Average execution time
- Most-used agents
- Error patterns

---

## Future Enhancements

### Near-Term (Next 3 Months)
1. **Orchestrator deployment** - Central coordination
2. **5-8 more agents** - Email handler, scheduler, research agent, etc.
3. **Email trigger** - Send email to agents@jacobbrain.com
4. **Improved routing** - LLM-based agent selection

### Medium-Term (3-6 Months)
1. **Queue-based async** - Cloudflare Queues for long-running tasks
2. **Human-in-the-loop** - Approval workflows for sensitive actions
3. **Multi-agent coordination** - Agents call other agents
4. **Web dashboard** - View conversations, logs, agent status

### Long-Term (6-12 Months)
1. **Voice interface** - Phone/voice triggers
2. **Proactive agents** - Agents suggest actions without prompting
3. **Learning loop** - Agents improve from feedback
4. **Client-specific agents** - Custom agents per client engagement

---

## Key Architectural Decisions

### Decision Log

**2025-10-26: Use Supabase over Cloudflare D1/KV**
- Rationale: More mature, better free tier, full PostgreSQL
- Trade-off: Another service to manage vs native Cloudflare
- Review: When agent count > 20 or need real-time features

**2025-10-26: Agent registry in JSON file initially**
- Rationale: Simple, version controlled, no DB queries
- Trade-off: Static vs dynamic
- Review: When agent count > 8

**2025-10-26: Rules-based routing initially**
- Rationale: Fast, predictable, easy to debug
- Trade-off: Less flexible than LLM routing
- Review: When routing logic becomes complex (5+ agents)

**2025-10-26: Notion for knowledge, Supabase for operations**
- Rationale: Each tool optimized for its purpose
- Trade-off: Two systems to maintain
- Review: If operational burden too high

---

## Architecture Review Triggers

Re-evaluate these decisions when:
- Agent count exceeds 10
- Request volume > 10K/day
- Need real-time features (WebSockets, live updates)
- Multi-tenancy required (multiple users/clients)
- Cost exceeds $100/month
- Cold start latency becomes problematic

---

## Questions for Future Architects

When working on this system, consider:

1. **Does this agent need state?** If no, keep it stateless
2. **Does this belong in Notion or Supabase?** Knowledge → Notion, Operations → Supabase
3. **Can this be synchronous?** If yes, HTTP is fine. If no, use queues
4. **Should the orchestrator handle this?** Or should a sub-agent?
5. **Is this a new capability or a new agent?** Don't create agents unnecessarily

---

## References

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Supabase Docs](https://supabase.com/docs)
- [Anthropic API Docs](https://docs.anthropic.com/)
- [Notion API Docs](https://developers.notion.com/)

---

*This document should be updated whenever major architectural decisions are made. Treat it as the single source of truth for system design rationale.*