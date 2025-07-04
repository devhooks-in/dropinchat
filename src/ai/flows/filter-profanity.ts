'use server';

/**
 * @fileOverview A profanity filter AI agent.
 *
 * - filterProfanity - A function that handles the profanity filtering process.
 * - FilterProfanityInput - The input type for the filterProfanity function.
 * - FilterProfanityOutput - The return type for the filterProfanity function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const FilterProfanityInputSchema = z.object({
  text: z.string().describe('The text to filter for profanity.'),
});
export type FilterProfanityInput = z.infer<typeof FilterProfanityInputSchema>;

const FilterProfanityOutputSchema = z.object({
  filteredText: z.string().describe('The filtered text, with profanity replaced by asterisks.'),
  isProfane: z.boolean().describe('Whether the input text contained profanity.'),
});
export type FilterProfanityOutput = z.infer<typeof FilterProfanityOutputSchema>;

export async function filterProfanity(input: FilterProfanityInput): Promise<FilterProfanityOutput> {
  return filterProfanityFlow(input);
}

const prompt = ai.definePrompt({
  name: 'filterProfanityPrompt',
  input: {schema: FilterProfanityInputSchema},
  output: {schema: FilterProfanityOutputSchema},
  prompt: `You are a content moderation bot that filters out profanity.

  You will receive text as input.  If the text contains profanity, replace the profanity with asterisks ('***').
  The number of asterisks should match the number of characters in the profanity.
  If the text does not contain profanity, return the original text.
  Set the isProfane output field to true if the text contained profanity, and false otherwise.

  Input text: {{{text}}}`,
});

const filterProfanityFlow = ai.defineFlow(
  {
    name: 'filterProfanityFlow',
    inputSchema: FilterProfanityInputSchema,
    outputSchema: FilterProfanityOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
