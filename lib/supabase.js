// Supabase Helper Functions
// Reusable logging and state management for all agents

/**
 * Log the start of an agent execution
 * Returns execution ID for tracking
 */
export async function logExecutionStart(supabaseUrl, supabaseKey, conversationId, agentId, input) {
  try {
    const logEntry = {
      conversation_id: conversationId || null,
      agent_id: agentId,
      input: input,
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

/**
 * Log successful completion of an agent execution
 */
export async function logExecutionComplete(supabaseUrl, supabaseKey, executionId, output, durationMs) {
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

/**
 * Log failed execution with error details
 */
export async function logExecutionError(supabaseUrl, supabaseKey, executionId, errorMessage, durationMs) {
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

/**
 * Create or get existing conversation
 */
export async function getOrCreateConversation(supabaseUrl, supabaseKey, userId) {
  try {
    // Check for active conversation
    const checkResponse = await fetch(
      `${supabaseUrl}/rest/v1/conversations?user_id=eq.${userId}&status=eq.active&order=created_at.desc&limit=1`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        }
      }
    );

    const existing = await checkResponse.json();
    if (existing && existing.length > 0) {
      return existing[0];
    }

    // Create new conversation
    const createResponse = await fetch(`${supabaseUrl}/rest/v1/conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        user_id: userId,
        status: 'active',
        created_at: new Date().toISOString()
      })
    });

    const result = await createResponse.json();
    return result[0];
  } catch (error) {
    console.error('Error in getOrCreateConversation:', error);
    return null;
  }
}

/**
 * Save a message to the conversation
 */
export async function saveMessage(supabaseUrl, supabaseKey, conversationId, role, content, agentId = null) {
  if (!conversationId) return null;

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        conversation_id: conversationId,
        role: role,
        content: content,
        agent_id: agentId,
        created_at: new Date().toISOString()
      })
    });

    if (!response.ok) {
      console.error('Failed to save message:', await response.text());
      return null;
    }

    const result = await response.json();
    return result[0];
  } catch (error) {
    console.error('Error in saveMessage:', error);
    return null;
  }
}