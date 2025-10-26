# Jacob's Agent Infrastructure

AI agents running on Cloudflare Workers, callable via MCP in Claude Desktop.

## Agents

### Ada - Form Analyzer
- **URL**: https://workmanship-form-analyzer.jacob-788.workers.dev
- **Purpose**: Processes Tally form submissions for Workmanship ministry
- **Trigger**: Webhook from Tally
- **Output**: Email to Joel with form summary

### Nova - Marketing Writer
- **URL**: https://marketing-writer.jacob-788.workers.dev
- **Purpose**: Generates LinkedIn/Substack content in Jacob's voice
- **Trigger**: MCP tool `nova_write` in Claude Desktop
- **Knowledge**: Notion AI Brain + Voice Examples database

## Setup

### Environment Variables (Cloudflare)
Both workers need these as **Text** variables:
- `ANTHROPIC_API_KEY` - Claude API key
- `NOTION_TOKEN` - Notion integration token
- `NOTION_DATABASE_ID` - Voice examples database ID (Nova only)
- `RESEND_API_KEY` - Email service key (Ada only)

### MCP Configuration
Located in `C:\Users\jbrai\agents-mcp\server.js`

Claude Desktop config: `%APPDATA%\Claude\claude_desktop_config.json`

## Deployment
1. Edit code in `/workers/[agent-name]/worker.js`
2. Copy to Cloudflare Workers dashboard
3. Click "Save and Deploy"

## Testing
- **Ada**: Submit test form at Tally
- **Nova**: In Claude Desktop, say "Nova, write about [topic]"