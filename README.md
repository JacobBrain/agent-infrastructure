# Jacob's Agent Infrastructure

AI agents running on Cloudflare Workers, managed via GitHub, and callable through multiple triggers (MCP, webhooks, API, email).

## Overview

This repository manages autonomous AI agents that automate business operations across Jacob's fractional COO practice and personal workflows. Each agent specializes in a specific domain but shares common infrastructure and knowledge bases.

**Core Principles:**
- **Single source of truth:** Notion for knowledge, Supabase for operations, GitHub for code
- **Modularity:** Each agent is independent and replaceable
- **Observability:** All actions are logged and traceable
- **Scalability:** Designed to grow from 2 agents to 20+ without architectural changes

**Future Vision:** Building toward an orchestrator agent that acts as the primary interface, delegating tasks to specialized sub-agents based on the request.

## Documentation

- **[ARCHITECTURE.md](ARCHITECTURE.md)** - System design, technology choices, and architectural decisions
- **[DEVELOPMENT.md](DEVELOPMENT.md)** - Developer guide for adding new agents
- **[agent-registry.json](agent-registry.json)** - Machine-readable registry of all agents

---

## Current Agents

### Ada - Form Analyzer ✅ WORKING
- **Purpose**: Processes Tally form submissions for Workmanship ministry
- **Trigger**: Webhook from Tally forms
- **Output**: Formatted email to Joel with submission summary
- **Handles**: "Request for Help" and "Apply to be a Helper" forms

### Nova - Marketing Writer ✅ WORKING
- **Purpose**: Generates LinkedIn/Substack content in Jacob's voice
- **Trigger**: MCP tool `nova_write` in Claude Desktop
- **Knowledge**: Marketing Voice Examples database + AI Brain
- **Status**: Operational (message tuning ongoing)

---

## Infrastructure Stack

### Compute: Cloudflare Workers
- **Purpose**: Serverless hosting for all agents
- **Cost**: Free tier (sufficient for current usage)
- **Account**: jacob@jacobbrain.com

### Database: Supabase
- **Purpose**: Conversation state, execution logs, agent coordination
- **Cost**: Free tier (unlimited API requests, 500MB storage)
- **Setup**: See [DEVELOPMENT.md](DEVELOPMENT.md) for schema and configuration

### Knowledge Base: Notion
- **Purpose**: Business context, style guides, processes
- **AI Brain**: [241abcd1b44580609e11d2e298cdf80a](https://www.notion.so/241abcd1b44580609e11d2e298cdf80a)
- **Voice Examples**: [297abcd1b44580ed8332e6bf77a8059d](https://www.notion.so/297abcd1b44580ed8332e6bf77a8059d)

### AI Engine: Anthropic Claude
- **Model**: `claude-sonnet-4-20250514`
- **Purpose**: Content generation, reasoning, analysis

### Email: Resend
- **Purpose**: Email delivery for Ada
- **Cost**: Free tier

### Version Control: GitHub
- **Purpose**: Code backup and version history
- **Workflow**: Edit locally → Push to GitHub → Copy to Cloudflare

---

## Quick Start

### For Users
- **Ada**: Submit forms via Tally → Automatic email notifications
- **Nova**: In Claude Desktop, say "Nova, write a [platform] post about [topic]"

### For Developers
See **[DEVELOPMENT.md](DEVELOPMENT.md)** for complete guide on:
- Adding new agents (step-by-step)
- Testing procedures
- Deployment workflows
- Common patterns and examples

### For Architects
See **[ARCHITECTURE.md](ARCHITECTURE.md)** for:
- System design rationale
- Technology choices and trade-offs
- State management strategy
- Future roadmap and scaling plans

---

## Project Structure

```
/
├── README.md                      # This file
├── ARCHITECTURE.md                # System design and decisions
├── DEVELOPMENT.md                 # Developer guide
├── agent-registry.json            # Machine-readable agent metadata
├── /workers
│   ├── /ada-form-analyzer
│   │   └── worker.js
│   └── /nova-marketing
│       └── worker.js
└── /lib (future)
    ├── supabase.js               # Database helpers
    ├── agent-interface.js        # Standard request/response format
    └── agent-registry.js         # Registry query functions
```

---

## Environment Variables

**Shared across agents:**
- `ANTHROPIC_API_KEY` - Claude API key
- `NOTION_TOKEN` - Notion integration token
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_KEY` - Supabase API key

**Agent-specific:**
- `RESEND_API_KEY` - Email service (Ada only)
- `NOTION_DATABASE_ID` - Voice examples database (Nova only)

**Future**: Investigating Cloudflare account-level variables to centralize credential management.

---

## Deployment

### Current Process
1. Edit code in Cursor (local IDE)
2. Commit and push to GitHub (version control)
3. Copy code to Cloudflare Workers dashboard
4. Click "Save and Deploy"
5. Test via health check endpoint

### Future Process (Planned)
1. Edit code locally
2. Run `wrangler deploy` from terminal
3. Automatic testing and deployment
4. Commit to GitHub post-deployment

---

## Testing

### Health Checks
Each agent exposes a GET endpoint that returns status:
- Ada: https://workmanship-form-analyzer.jacob-788.workers.dev
- Nova: https://marketing-writer.jacob-788.workers.dev

### Functional Testing
- **Ada**: Submit test form via Tally webhook
- **Nova**: In Claude Desktop, request a test post
- **Logs**: Check Supabase `agent_executions` table for execution history

---

## Future Roadmap

### Near-Term (Next 3 Months)
1. **Orchestrator agent** - Central coordinator for all sub-agents
2. **5-8 additional agents** - Email handler, scheduler, research agent, etc.
3. **Email triggers** - Send emails to trigger agent workflows
4. **Improved routing** - LLM-based agent selection

### Medium-Term (3-6 Months)
1. **Queue-based async** - For long-running tasks
2. **Human-in-the-loop** - Approval workflows for sensitive actions
3. **Multi-agent coordination** - Complex workflows spanning multiple agents
4. **Web dashboard** - View conversations, logs, and agent status

### Long-Term (6-12 Months)
1. **Voice interface** - Phone/voice triggers
2. **Proactive agents** - Suggest actions without prompting
3. **Learning loop** - Agents improve from feedback
4. **Client-specific agents** - Custom agents per client engagement

---

## Support & Contributing

### Getting Help
- **Documentation**: Check ARCHITECTURE.md and DEVELOPMENT.md
- **Issues**: Review similar agent code (Ada or Nova)
- **Questions**: Ask in Claude Project: "Agent Infrastructure"

### Contributing
1. Follow patterns in DEVELOPMENT.md
2. Test thoroughly before deployment
3. Update agent-registry.json
4. Document any architectural decisions in ARCHITECTURE.md

---

## License & Ownership

This is a private repository for Jacob Brain's internal agent infrastructure. Not licensed for external use.

**Contact**: jacob@jacobbrain.com