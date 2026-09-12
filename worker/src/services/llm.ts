// Screening produced nothing from 2026-07-16 to 2026-09-12 because the shared
// Anthropic key ran out of credits and every failure looked like a generic API
// error. Name the causes that are specific and actionable so the reason is
// obvious from the log line alone. The same helper exists in Receipt Splitter
// and the EN->LV translator, which share this key and were equally dead.
export function describeAnthropicFailure(status: number, body: string): string {
  const b = body.toLowerCase();
  if (b.includes('credit balance')) {
    return 'ANTHROPIC CREDIT BALANCE EXHAUSTED — top up at console.anthropic.com. This key is shared with Receipt Splitter and the EN->LV translator, so those are down too.';
  }
  if (status === 401 || b.includes('authentication_error')) {
    return 'ANTHROPIC API KEY INVALID OR REVOKED — check the ANTHROPIC_API_KEY secret on the worker.';
  }
  if (status === 429) return 'ANTHROPIC RATE LIMIT — retry shortly.';
  if (status === 529 || status === 503) return 'ANTHROPIC OVERLOADED — retry shortly.';
  return `Anthropic API error ${status}`;
}

export interface ScreeningResult {
  is_positive: boolean;
  category: string;
  valence_score: number;
  locality: string;
  why_one_line: string;
  suggested_headline: string;
  flags: string[];
  needs_human_check: boolean;
}

const RUBRIC_PROMPT = `You are a content screener for "Dochas Times", a local good-news outlet covering Oxfordshire, England (and broader UK positive stories).

Score the following story snippet against our editorial rubric.

ACCEPT (high valence_score 6-10):
- Genuine improvement to a place or service
- A solution to a known problem
- An act of generosity or kindness
- Recovery from hardship (focus on the recovery, not the hardship)
- Community coming-together
- A milestone or achievement (personal, local, or national)

REJECT (low valence_score 0-3):
- Toxic positivity or forced optimism
- Advertising dressed as a story
- Tragedy spun with a silver lining (e.g. "house burned down but neighbours brought tea")
- Safeguarding issues (children named in sensitive contexts)
- Defamation or hate speech
- Unverifiable or extraordinary claims without evidence

Output ONLY valid JSON with this exact shape:
{
  "is_positive": true/false,
  "category": "community|youth|environment|charity|milestone|event|other",
  "valence_score": 0-10,
  "locality": "best guess of place name, or 'UK-wide'",
  "why_one_line": "one sentence rationale",
  "suggested_headline": "reworded headline in our editorial voice",
  "flags": ["none"] or list of flags like ["unverifiable", "possible_ad", "safeguarding", "needs_context"],
  "needs_human_check": true/false
}`;

function buildAggregatedPrompt(title: string, snippet: string, sourceName: string): string {
  return `${RUBRIC_PROMPT}

Source: ${sourceName}
Title: ${title}
Snippet: ${snippet}`;
}

function buildSubmissionPrompt(title: string, body: string): string {
  return `${RUBRIC_PROMPT}

This is a user-submitted story. In addition to screening, please also provide a polished version of the body text suitable for publication. Add a "polished_body" field to your JSON output.

Title: ${title}
Body: ${body}`;
}

export function parseResponse(raw: string): ScreeningResult {
  // Strip markdown code fences if present
  let cleaned = raw.trim();
  // Remove code fences anywhere in the string
  cleaned = cleaned.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '');
  // Try to extract JSON object if there's surrounding text
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    cleaned = jsonMatch[0];
  }

  const parsed = JSON.parse(cleaned);

  return {
    is_positive: Boolean(parsed.is_positive),
    category: parsed.category || 'other',
    valence_score: Math.max(0, Math.min(10, Number(parsed.valence_score) || 0)),
    locality: parsed.locality || 'Unknown',
    why_one_line: parsed.why_one_line || '',
    suggested_headline: parsed.suggested_headline || '',
    flags: Array.isArray(parsed.flags) ? parsed.flags : ['none'],
    needs_human_check: Boolean(parsed.needs_human_check),
  };
}

export async function screenStory(
  apiKey: string,
  title: string,
  snippet: string,
  sourceName: string,
  origin: 'aggregated' | 'submission',
  body?: string
): Promise<ScreeningResult> {
  const prompt =
    origin === 'submission' && body
      ? buildSubmissionPrompt(title, body)
      : buildAggregatedPrompt(title, snippet, sourceName);

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`${describeAnthropicFailure(res.status, errBody)} | upstream ${res.status}: ${errBody}`);
  }

  const data = (await res.json()) as {
    content: { type: string; text: string }[];
  };

  const text = data.content?.[0]?.text;
  if (!text) throw new Error('Empty response from Anthropic API');

  try {
    return parseResponse(text);
  } catch {
    console.error('Failed to parse LLM response:', text);
    return {
      is_positive: false,
      category: 'other',
      valence_score: 0,
      locality: 'Unknown',
      why_one_line: 'Failed to parse AI response',
      suggested_headline: title,
      flags: ['parse_error'],
      needs_human_check: true,
    };
  }
}
