# Jacob's Agent Infrastructure

AI agents running on Cloudflare Workers, managed via GitHub, and callable through multiple triggers (MCP, webhooks, email - future).

## Overview

This repository manages a suite of AI agents that automate tasks across Jacob's business operations. Each agent specializes in a specific domain but shares common infrastructure and knowledge bases.

**Shared Knowledge Base:** All agents can access the "AI Brain" in Notion—a centralized knowledge repository containing context about Jacob's business, communication style, processes, and strategic thinking. This ensures consistent outputs across all agents.

**Future Vision:** Building toward an orchestrator agent that acts as the primary interface. It will delegate specific tasks to specialized sub-agents (like Ada and Nova) based on the request, managing collaboration and consolidating results.

---

## Current Agents

### Ada - Form Analyzer ✅ WORKING
- **URL**: https://workmanship-form-analyzer.jacob-788.workers.dev
- **Purpose**: Processes Tally form submissions for Workmanship ministry
- **Trigger**: Webhook from Tally forms
- **Output**: Formatted email to Joel with submission summary and analysis
- **Handles**: "Request for Help" and "Apply to be a Helper" form types
- **Status**: Operational
- **Customization**: Email templates in `buildRequestEmail()` and `buildHelperEmail()` functions

### Nova - Marketing Writer ✅ WORKING
- **URL**: https://marketing-writer.jacob-788.workers.dev
- **Purpose**: Generates LinkedIn/Substack content in Jacob's voice
- **Trigger**: MCP tool `nova_write` in Claude Desktop
- **Knowledge Sources**: 
  - Marketing Voice Examples database (ID: `297abcd1b44580ed8332e6bf77a8059d`)
  - AI Brain general knowledge base
  - Platform-specific style guides (LinkedIn, Substack)
- **Parameters**: 
  - `topic` - What to write about
  - `platform` - LinkedIn or Substack
  - `style` - Optional style notes or adjustments
- **Status**: Operational (message tuning ongoing)
- **Customization**: Modify system prompts in `buildSystemPrompt()` and add voice examples to Notion database

---

## Infrastructure & Accounts

### Cloudflare Workers
- **Account**: jacob@jacobbrain.com
- **Purpose**: Serverless compute platform hosting all agent workers
- **Deployment**: Manual copy/paste from local files to Cloudflare dashboard
- **Cost**: Free tier (sufficient for current usage)

### Anthropic API
- **Model**: `claude-sonnet-4-20250514`
- **Purpose**: Powers all agent reasoning and content generation
- **Cost**: Pay-per-token usage
- **Note**: Shared across all agents via environment variables

### Notion
- **Purpose**: 
  - Knowledge base ("AI Brain") - centralized context for all agents
  - Voice examples database - writing style reference for Nova
  - Documentation and process storage
- **Integration**: API access via integration token
- **Cost**: Free (current tier)

### Resend
- **Purpose**: Email delivery service for Ada
- **Cost**: Free tier (sufficient for current volume)

### GitHub
- **Purpose**: Version control and code backup for all agent workers
- **Workflow**: Edit locally → Push to GitHub → Copy to Cloudflare dashboard
- **Note**: GitHub is not directly connected to Cloudflare; serves as source of truth

---

## Setup Instructions

### Prerequisites
- Cloudflare Workers account
- Anthropic API key
- Notion workspace with API access
- Resend API key (for Ada only)
- Node.js installed (for MCP server)
- Claude Desktop installed

### Environment Variables (Cloudflare Workers)

**Current Configuration (Per-Worker):**
Each worker currently has its own copy of environment variables set in the Cloudflare dashboard.

**Shared Variables (Ada & Nova):**
- `ANTHROPIC_API_KEY` - Claude API key for content generation
- `NOTION_TOKEN` - Notion integration token for knowledge base access

**Ada-Specific:**
- `RESEND_API_KEY` - Email service authentication

**Nova-Specific:**
- `NOTION_DATABASE_ID` - Marketing Voice Examples database ID: `297abcd1b44580ed8332e6bf77a8059d`

**Future Improvement:**
Investigating Cloudflare's ability to set environment variables at a higher account or project level. This would allow:
- Single source of truth for shared credentials
- Update API keys once, apply to all workers
- Easier credential rotation as agent count scales

### Notion Setup

#### AI Brain (Shared Knowledge Base)
- **Location**: [AI Brain page](https://www.notion.so/241abcd1b44580609e11d2e298cdf80a)
- **Purpose**: Central knowledge repository accessible by all agents
- **Contains**: 
  - Jacob's background, values, and communication preferences
  - Business processes and methodologies
  - Client context and project information
  - Strategic frameworks and decision-making guidelines

#### Marketing Voice Examples Database
- **Database ID**: `297abcd1b44580ed8332e6bf77a8059d`
- **Required Properties**:
  - `Content` (Text) - The actual post/content example
  - `Platform` (Select) - LinkedIn, Substack
  - `Tag` (Multi-select) - Categories like philosophy, productivity, leadership, etc.
- **Purpose**: Provides Nova with examples of Jacob's writing style across platforms
- **Usage**: Nova queries this database to match tone, structure, and voice when generating content

**Getting Notion Credentials:**
1. Go to https://www.notion.so/my-integrations
2. Create new integration → Copy integration token
3. Share your databases/pages with the integration
4. Extract database ID from the database URL (32-character hex string)

### MCP Server Configuration

**What it does:**
The MCP (Model Context Protocol) server acts as a bridge between Claude Desktop and Cloudflare Workers. It registers custom tools (like `nova_write`) that appear in Claude Desktop, routes requests to the appropriate worker, and returns results.

**Location:** `C:\Users\jbrai\agents-mcp\server.js`

**Claude Desktop Config:** `%APPDATA%\Claude\claude_desktop_config.json`

**Usage in Claude Desktop:**
Simply say: "Nova, write a LinkedIn post about [topic]" and the MCP server will:
1. Parse your request
2. Call the Nova worker with appropriate parameters
3. Return the generated content

---

## Deployment Workflow

**Current Process:**
1. Edit code in `/workers/[agent-name]/worker.js` using Cursor
2. Save changes
3. Push to GitHub using GitHub Desktop (for version control)
4. Copy updated code to Cloudflare Workers dashboard
5. Click "Save and Deploy" in Cloudflare

**Note:** GitHub and Cloudflare are not directly connected. Manual copy/paste is required to deploy changes.

---

## Testing

### Ada
- Submit a test form via Tally webhook
- Check Resend dashboard for delivery confirmation
- Verify email received at joel0954@comcast.net

### Nova
- In Claude Desktop: "Nova, write a LinkedIn post about [topic]"
- Or: "Nova, create a Substack note about [subject]"
- Review generated content and provide feedback for refinement

### Worker Health Check
Both workers expose GET endpoints to verify they're running:
- Ada: https://workmanship-form-analyzer.jacob-788.workers.dev
- Nova: https://marketing-writer.jacob-788.workers.dev

Returns JSON with environment variable status and worker health info.

---

## Future Roadmap

### Orchestrator Agent (Planned)
A manager-level agent that:
- Serves as the primary interface for all agent interactions
- Routes requests to specialized sub-agents (Ada, Nova, etc.)
- Coordinates multi-step workflows requiring multiple agents
- Consolidates results and handles complex decision-making
- Maintains conversation context across agent handoffs

### Additional Triggers (Planned)
- **Email**: Send requests via email to trigger agent workflows
- **Slack**: Integrate with team communication
- **API**: Direct REST API access for custom integrations
- **Scheduled**: Cron-based automation for recurring tasks

### Shared Variable Management (Investigation)
Research Cloudflare's capabilities for:
- Account-level or project-level environment variables
- Centralized secrets management
- Easier credential rotation across multiple workers

---

## Customization Guide

### Adding Voice Examples to Nova
1. Open Marketing Voice Examples database in Notion
2. Add new entries with:
   - Actual content from LinkedIn/Substack posts
   - Platform tag
   - Content category tags
3. Nova will automatically use new examples on next generation

### Modifying Email Templates (Ada)
Edit the following functions in `/workers/ada-form-analyzer/worker.js`:
- `buildRequestEmail()` - "Request for Help" format
- `buildHelperEmail()` - "Apply to be a Helper" format

Change subject lines, email body structure, or add/remove fields as needed.

### Tuning Nova's Voice
1. **Add examples**: More voice examples in Notion = better style matching
2. **Adjust prompts**: Edit `buildSystemPrompt()` in worker.js to modify instructions
3. **Platform formatting**: Modify `buildUserPrompt()` for platform-specific rules

---

## Architecture

### Ada Flow
```
Tally Form Submission 
  → Webhook POST to Ada Worker
  → Parse form data
  → Claude API analyzes submission
  → Format email via template
  → Resend API sends email
  → Joel receives formatted summary
```

### Nova Flow
```
Claude Desktop User Input
  → MCP Server intercepts request
  → Calls Nova Worker API
  → Nova fetches voice examples from Notion
  → Nova searches AI Brain for context
  → Claude API generates content
  → Content returned to Claude Desktop
  → User reviews/refines
```

---

## Version Control

All code is maintained in this GitHub repository as the source of truth. Changes should be:
1. Made in local development environment (Cursor)
2. Committed and pushed to GitHub
3. Manually deployed to Cloudflare Workers

This ensures proper version history and rollback capability if needed.