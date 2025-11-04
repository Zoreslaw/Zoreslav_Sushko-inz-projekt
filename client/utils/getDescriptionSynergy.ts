import { OPENAI_API_KEY } from '@/config/constants';

/**
 * Compare the descriptions of two users and return a synergy
 * score from 0 (no synergy) to 20 (extremely compatible).
 *
 * @param descA - The description of user A
 * @param descB - The description of user B
 * @returns number from 0..20
 */
export async function getDescriptionSynergy(descA: string, descB: string): Promise<number> {
  // If either description is empty, skip calling GPT
  if (!descA || !descB) return 0;

  const prompt = `I have two users' descriptions. 
User A: """${descA}"""
User B: """${descB}"""

Give me a single integer from 0 to 20 that represents how compatible or similar they are based on these descriptions alone. 
Only return the integer, nothing else.`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 10,
        temperature: 0.7,
      }),
    });

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content?.trim() || '0';
    const numeric = parseInt(text, 10);
    if (isNaN(numeric)) {
      return 0;
    }
    // clamp to 0..20
    return Math.max(0, Math.min(20, numeric));
  } catch (err) {
    console.error('Error calling OpenAI for synergy:', err);
    // fallback to 0 if error
    return 0;
  }
}
