import { prisma } from '../../lib/prisma';

interface TrainingExample {
  id: string;
  timestamp: number;
  input: {
    message?: string;
    graphAnalysis?: string;
    entityType?: string;
  };
  output: string;
  rating: number; // 1 for good, -1 for bad
}

export class AIMemory {
  constructor() {
    // No local storage setup needed
  }

  public async addExample(input: TrainingExample['input'], output: string, rating: number) {
    const prompt = JSON.stringify(input);
    const ratingStr = rating > 0 ? 'good' : 'bad';
    
    try {
        const example = await prisma.aIMemory.create({
            data: {
                prompt,
                response: output,
                rating: ratingStr
            }
        });
        return example;
    } catch (error) {
        console.error('Failed to save to DB:', error);
        return null;
    }
  }

  public async getRelevantExamples(context: string): Promise<TrainingExample[]> {
    try {
        // Fetch only 'good' examples
        const examples = await prisma.aIMemory.findMany({
            where: { rating: 'good' },
            orderBy: { timestamp: 'desc' },
            take: 50 // Fetch recent ones to filter in memory
        });
        
        // Simple relevance: check if keywords from input match stored examples
        // In a real system, this would use vector embeddings (pgvector)
        const contextWords = context.toLowerCase().split(/\W+/);
        
        const relevant = examples.map((ex: any) => {
            let score = 0;
            const exText = ex.prompt.toLowerCase();
            contextWords.forEach(word => {
                if (word.length > 3 && exText.includes(word)) score++;
            });
            
            // Reconstruct TrainingExample structure
            const result: any = {
                id: ex.id,
                timestamp: ex.timestamp.getTime(),
                input: JSON.parse(ex.prompt),
                output: ex.response,
                rating: 1,
                score
            };
            return result;
        })
        .sort((a: any, b: any) => b.score - a.score)
        .slice(0, 3); // Return top 3
        
        return relevant;
        
    } catch (error) {
        console.error('Failed to fetch from DB:', error);
        return [];
    }
  }
}

export const aiMemory = new AIMemory();
