// Workmanship Form Analyzer - Cloudflare Worker
// Handles both "Request for Help" and "Apply to be a Helper" forms

export default {
  async fetch(request, env) {
    // Add a test endpoint
    if (request.method === 'GET') {
      return new Response(JSON.stringify({
        message: 'Worker is running',
        hasResendKey: !!env.RESEND_API_KEY,
        resendKeyPrefix: env.RESEND_API_KEY?.substring(0, 10) || 'NO KEY',
        hasAnthropicKey: !!env.ANTHROPIC_API_KEY,
        anthropicKeyPrefix: env.ANTHROPIC_API_KEY?.substring(0, 10) || 'NO KEY'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Only accept POST requests for webhook
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    try {
      // Parse incoming webhook data from Tally
      console.log('Parsing webhook data...');
      const webhookData = await request.json();
      console.log('Webhook data received:', JSON.stringify(webhookData).substring(0, 200));
      
      const formData = webhookData.data;
      console.log('Form data extracted');
      
      // Determine which form was submitted
      const formType = determineFormType(formData);
      console.log('Form type:', formType);
      
      // Skip Claude analysis for now - just test email sending
      console.log('Skipping Claude API...');
      const analysis = "Test analysis - Claude API skipped for debugging";
      console.log('Analysis skipped');
      
      // Send email via Resend
      console.log('Sending email...');
      const emailResult = await sendEmail(formData, analysis, formType, env.RESEND_API_KEY);
      console.log('Email result:', JSON.stringify(emailResult));
      
      return new Response(JSON.stringify({
        success: true,
        formType: formType,
        emailSent: emailResult.success,
        emailError: emailResult.error || null,
        emailResponseText: emailResult.responseText || null,
        emailData: emailResult.data,
        debugInfo: {
          hasResendKey: !!env.RESEND_API_KEY,
          resendKeyPrefix: env.RESEND_API_KEY?.substring(0, 10),
          hasAnthropicKey: !!env.ANTHROPIC_API_KEY
        }
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
      
    } catch (error) {
      console.error('ERROR:', error.message);
      console.error('Stack:', error.stack);
      return new Response(JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};

function determineFormType(formData) {
  const formName = formData.formName?.toLowerCase() || '';
  
  // Check form name first
  if (formName.includes('helper')) {
    return 'helper';
  }
  if (formName.includes('request')) {
    return 'request';
  }
  
  // Fallback: check field labels
  const fieldLabels = formData.fields.map(f => f.label?.toLowerCase() || '');
  
  if (fieldLabels.some(label => label.includes('skills offered'))) {
    return 'helper';
  }
  
  return 'request'; // Default
}

async function analyzeSubmission(formData, formType, apiKey) {
  const prompt = formType === 'request' 
    ? buildRequestPrompt(formData)
    : buildHelperPrompt(formData);

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: prompt
      }]
    })
  });

  const data = await response.json();
  return data.content[0].text;
}

function buildRequestPrompt(formData) {
  return `You are analyzing a "Request for Help" submission for a church ministry called Workmanship.

Form Data:
${JSON.stringify(formData, null, 2)}

Please provide a brief, clear summary focusing on:
- The type of help needed
- Key details about the request
- Any urgency or special considerations
- Financial situation (can they pay for supplies?)

Keep it concise and professional - this will be sent to the ministry coordinator.`;
}

function buildHelperPrompt(formData) {
  return `You are analyzing an "Apply to be a Helper" submission for a church ministry called Workmanship.

Form Data:
${JSON.stringify(formData, null, 2)}

Please provide a brief, clear summary focusing on:
- What skills they're offering
- Their availability or experience
- Any relevant details about how they can help

Keep it concise and professional - this will be sent to the ministry coordinator.`;
}

async function sendEmail(formData, analysis, formType, apiKey) {
  try {
    const emailConfig = formType === 'request'
      ? buildRequestEmail(formData, analysis)
      : buildHelperEmail(formData, analysis);

    console.log('Preparing to send email via Resend...');
    console.log('API key exists:', !!apiKey);
    console.log('API key starts with:', apiKey?.substring(0, 10));

    const emailPayload = {
      from: 'Ada (Jacob\'s AI Assistant) <noreply@agent.jacobbrain.com>',
      to: 'joel0954@comcast.net',
      cc: ['jbrainiv@gmail.com', 'jacob.brain@mvccfrederick.com'],
      subject: emailConfig.subject,
      html: emailConfig.body
    };
    
    console.log('Email payload prepared:', {
      from: emailPayload.from,
      to: emailPayload.to,
      subject: emailPayload.subject,
      bodyLength: emailPayload.html.length
    });

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(emailPayload)
    });

    console.log('Resend response status:', response.status);
    
    const result = await response.json();
    console.log('Resend API response:', JSON.stringify(result));
    
    if (!response.ok) {
      console.error('Resend API error:', result);
      return { 
        success: false, 
        data: result,
        error: `Resend API returned ${response.status}`,
        responseText: JSON.stringify(result)
      };
    }
    
    return { success: true, data: result };
  } catch (error) {
    console.error('Email sending error:', error);
    return { 
      success: false, 
      error: error.message,
      stack: error.stack
    };
  }
}

function getFieldValue(fields, labelMatch) {
  const field = fields.find(f => {
    const label = f.label?.toLowerCase() || '';
    return label.includes(labelMatch.toLowerCase());
  });
  return field?.value || null;
}

function getCheckboxText(fields, labelMatch) {
  const field = fields.find(f => {
    const label = f.label?.toLowerCase() || '';
    return label.includes(labelMatch.toLowerCase());
  });
  
  if (!field || !field.value) return 'Not specified';
  
  // If value is an array of IDs, look up the text in options
  if (Array.isArray(field.value) && field.options) {
    const selectedOptions = field.value.map(id => {
      const option = field.options.find(opt => opt.id === id);
      return option?.text || id;
    });
    return selectedOptions.join(', ');
  }
  
  // If value is boolean or already text
  return field.value === true ? 'Yes' : field.value === false ? 'No' : String(field.value);
}

function buildRequestEmail(formData, analysis) {
  const fields = formData.fields;
  
  const firstName = getFieldValue(fields, 'first name') || 'Unknown';
  const lastName = getFieldValue(fields, 'last name') || '';
  const name = `${firstName} ${lastName}`.trim();
  const email = getFieldValue(fields, 'email') || 'Not provided';
  const phone = getFieldValue(fields, 'phone') || 'Not provided';
  const isRegular = getCheckboxText(fields, 'mvcc regular attender');
  const helpType = getCheckboxText(fields, 'checkbox');
  const details = fields.find(f => f.key === 'question_GKK09Z')?.value || 'No details provided';
  const financial = getFieldValue(fields, 'financial') || getFieldValue(fields, 'pay for parts') || 'Not specified';
  const submissionDate = formData.createdAt || new Date().toISOString();

  const subject = `New Help Request Submission - ${name} (${helpType})`;
  
  const body = `
    <p>Hi Joel,</p>
    
    <p>There has been a new "Request for Help" submission that I wanted to let you know about.</p>
    
    <p><strong>Summary of the submission:</strong></p>
    
    <p>
      <strong>Name:</strong> ${name}<br>
      <strong>Email:</strong> ${email}<br>
      <strong>Phone:</strong> ${phone}<br>
      <strong>MVCC Regular Attender:</strong> ${isRegular}
    </p>
    
    <p><strong>Type of Help Needed:</strong> ${helpType}</p>
    
    <p><strong>Details:</strong> "${details}"</p>
    
    <p><strong>Financial Situation:</strong> ${financial}</p>
    
    <p><strong>Submission Date:</strong> ${new Date(submissionDate).toLocaleString('en-US', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true 
    })}</p>
    
    <p>You can see more details and the full submission in the <a href="https://docs.google.com/spreadsheets/d/1nFxhaOTeTwYj1k_c1xcsKy-NGADKdQEJCV-Cj1-35eY/edit?gid=0#gid=0">Submit Request for Help Google Sheet</a>.</p>
    
    <p>Let me know if you need any additional information!</p>
    
    <p>Best regards,<br>
    Ada (Jacob's AI Assistant)</p>
  `;

  return { subject, body };
}

function buildHelperEmail(formData, analysis) {
  const fields = formData.fields;
  
  const firstName = getFieldValue(fields, 'first name') || 'Unknown';
  const lastName = getFieldValue(fields, 'last name') || '';
  const name = `${firstName} ${lastName}`.trim();
  const email = getFieldValue(fields, 'email') || 'Not provided';
  const phone = getFieldValue(fields, 'phone') || 'Not provided';
  const isRegular = getCheckboxText(fields, 'mvcc regular attender');
  const skills = getCheckboxText(fields, 'skills offered') || getCheckboxText(fields, 'checkbox');
  const details = getFieldValue(fields, 'details') || getFieldValue(fields, 'textarea') || 'No details provided';
  const financial = getFieldValue(fields, 'financial position') || 'Not specified';
  const submissionDate = formData.createdAt || new Date().toISOString();

  const subject = `New "Apply to be a Helper" Submission`;
  
  const body = `
    <p>Hi Joel,</p>
    
    <p>There's a new "Apply to be a Helper" submission that came in on ${new Date(submissionDate).toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric' 
    })} at ${new Date(submissionDate).toLocaleTimeString('en-US', { 
      hour: 'numeric',
      minute: '2-digit',
      hour12: true 
    })}.</p>
    
    <p><strong>Submission Summary:</strong></p>
    
    <ul>
      <li><strong>Name:</strong> ${name}</li>
      <li><strong>Email:</strong> ${email}</li>
      <li><strong>Phone:</strong> ${phone}</li>
      <li><strong>MVCC Regular Attender:</strong> ${isRegular}</li>
      <li><strong>Details:</strong> ${details}</li>
      <li><strong>Skills Offered:</strong> ${skills}</li>
      <li><strong>Financial Position:</strong> ${financial}</li>
    </ul>
    
    <p>You can view the full details and all submissions in the <a href="https://docs.google.com/spreadsheets/d/1xeAnyLNwALRLZQBXbiR06OO_WxnNfVA0tMUXkpSLJ3g/edit?gid=0#gid=0">Apply to be a Helper Google Sheet</a>.</p>
    
    <p>Best regards,<br>
    Ada</p>
  `;

  return { subject, body };
}