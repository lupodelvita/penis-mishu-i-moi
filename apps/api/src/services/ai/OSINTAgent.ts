
import { aiMemory } from './AIMemory';

export interface AIRequest {
  type: 'chat' | 'analysis' | 'suggestion' | 'pattern' | 'explanation';
  content: {
    message?: string;
    graph?: any;
    entity?: any;
  };
}

export class OSINTAgent {
  
  // --- Open WebUI Integration ---

  private async checkOpenWebUIAvailability(): Promise<boolean> {
    try {
      // Check if Open WebUI is reachable
      const url = process.env.OPEN_WEBUI_URL || 'http://localhost:8181';
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const res = await fetch(`${url}/api/version`, { 
        signal: controller.signal 
      });
      clearTimeout(timeoutId);
      
      return res.ok;
    } catch (e) {
      console.log('Open WebUI check failed:', e);
      return false;
    }
  }

  private async generateResponseUsingOpenWebUI(request: AIRequest, contextString: string): Promise<string | null> {
      try {
        const baseUrl = process.env.OPEN_WEBUI_URL || 'http://localhost:8181';
        const apiKey = process.env.OPEN_WEBUI_API_KEY;
        
        if (!apiKey || apiKey === 'CHANGE_ME_GET_FROM_OPEN_WEBUI_SETTINGS') {
             console.error('OSINTAgent: OPEN_WEBUI_API_KEY is missing in .env');
             return 'Config Error: Please set OPEN_WEBUI_API_KEY in apps/api/.env';
        }

        const examples = await aiMemory.getRelevantExamples(contextString);
        
        let systemPrompt = `You are an OSINT (Open-Source Intelligence) assistant. Your goal is to help users analyze data, identify patterns, and provide insights based on the provided context. Be concise, professional, and directly answer the user's request.`;

        if (examples.length > 0) {
            systemPrompt += `\n\nHere are some examples of good responses you have given in the past (few-shot learning):\n`;
            examples.forEach((ex, i) => {
                systemPrompt += `\nExample ${i+1}:\nInput: ${JSON.stringify(ex.input)}\nOutput: ${ex.output}\n`;
            });
        }
        
        // Construct user prompt based on request type
        let userPrompt = '';
        if (request.type === 'chat') userPrompt = request.content.message || '';
        else userPrompt = `Please perform a ${request.type} on this data: ${JSON.stringify(request.content)}`;

        // Using Open WebUI /v1/chat/completions endpoint (OpenAI Compatible)
        // This endpoint often automatically handles RAG if the model/collection is selected correctly,
        // or if we use the backend chat endpoint. 
        // For simple RAG usage in Open WebUI, specific model selection is key.
        // Assuming default model or user checks logs.
        
        // Create an AbortController for timeout
        const controller = new AbortController();
        // DeepSeek-R1 and similar reasoning models can take a LONG time (up to 5 mins on CPU)
        // Normal models take ~30s. We set a generous 5 min timeout.
        const timeout = setTimeout(() => controller.abort(), 300000); 

        const modelName = process.env.OPEN_WEBUI_MODEL || 'deepseek-r1:latest';
        console.log(`OSINTAgent: Using model "${modelName}"`);

        try {
            const res = await fetch(`${baseUrl}/api/chat/completions`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: modelName,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userPrompt }
                    ],
                    stream: false
                }),
                signal: controller.signal
            });
            clearTimeout(timeout);
    
            if (!res.ok) {
                 const errText = await res.text();
                 console.error('Open WebUI Error:', errText);
                 return `AI Error: ${res.status} ${res.statusText} - ${errText}`;
            }
    
            const data: any = await res.json();
            return data.choices?.[0]?.message?.content || data.message?.content || null;
            
        } catch (fetchError: any) {
            clearTimeout(timeout);
            if (fetchError.name === 'AbortError') {
                console.error('Open WebUI Request Timed Out (DeepSeek is thinking too long)');
                return 'AI Response Timed Out. The model is taking too long to think. Consider using a faster model or increasing resources.';
            }
            throw fetchError;
        }

      } catch (e) {
          console.error('Open WebUI generation failed:', e);
          return null;
      }
  }

  public async processRequest(request: AIRequest): Promise<string | any> {
    // 1. Retrieve relevant examples from memory (Few-Shot Learning)
    const contextString = JSON.stringify(request.content);
    const examples = await aiMemory.getRelevantExamples(contextString);
    
    // 2. Exact Match Short-circuit (Memory)
    const exactMatch = examples.find(ex => JSON.stringify(ex.input) === contextString && (ex as any).score >= 5);
    if (exactMatch) {
      console.log('OSINTAgent: Using learned response from memory');
      return exactMatch.output;
    }

    // 3. Try Real AI (Open WebUI)
    const webuiAvailable = await this.checkOpenWebUIAvailability();
    if (webuiAvailable) {
        console.log('OSINTAgent: Using Open WebUI Provider');
        const aiResponse = await this.generateResponseUsingOpenWebUI(request, contextString);
        if (aiResponse) return aiResponse;
    } else {
        console.log('OSINTAgent: Open WebUI unavailable, using fallback (Smart Mock)');
    }

    // 4. Generate Response (Default Logic / Smart Mock)
    return this.generateDefaultResponse(request);
  }

  public async saveFeedback(request: AIRequest, response: string, rating: number) {
    console.log(`OSINTAgent: Learning from feedback (${rating > 0 ? 'Positive' : 'Negative'})`);
    aiMemory.addExample(request.content, response, rating);
    return { success: true };
  }

  private generateDefaultResponse(request: AIRequest): any {
    switch (request.type) {
      case 'chat':
        return this.generateChatResponse(request.content.message || '');
      case 'analysis':
        return this.generateAnalysisResponse(request.content.graph);
      case 'suggestion':
        return this.generateSuggestionResponse(request.content.entity);
      case 'pattern':
        return this.generatePatternResponse(request.content.graph);
      case 'explanation':
        return this.generateExplanationResponse(request.content.entity);
      default:
        return "Извините, я не понимаю этот тип запроса.";
    }
  }

  // --- Logic moved from ai.ts and enhanced ---

  private generateChatResponse(message: string): string {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('анализ')) {
      return 'Ваш граф содержит несколько интересных паттернов. Я заметил кластеры вокруг главной сущности домена, что указывает на хорошо связанную инфраструктуру.';
    }
    if (lowerMessage.includes('паттерн')) {
      return 'Я нашел 3 потенциальных паттерна: 1) Несколько IP-адресов используют один ASN, 2) Общий почтовый домен у разных сущностей, 3) Временная кластеризация создания сущностей.';
    }
    
    return 'Я могу помочь вам проанализировать графы, предложить трансформации, найти паттерны и объяснить сущности. Просто спросите!';
  }

  private generateAnalysisResponse(graph: any): string {
    const entityCount = graph.entities?.length || 0;
    const linkCount = graph.links?.length || 0;
    
    return `
**Анализ графа:**

- **Сущности**: ${entityCount} узлов
- **Связи**: ${linkCount} соединений
- **Плотность**: ${linkCount > 0 ? (linkCount / (entityCount * (entityCount - 1))).toFixed(3) : 0}
- **Среднее кол-во связей**: ${entityCount > 0 ? (linkCount * 2 / entityCount).toFixed(1) : 0}

**Ключевые инсайты:**
${entityCount > 10 ? '- Обнаружен большой граф. Рекомендуется использовать фильтры.' : '- Небольшой граф. Удобен для детального анализа.'}
${linkCount > entityCount * 2 ? '- Сильно связанный граф. Ищите центральные хабы.' : '- Разреженные связи. Возможно, требуются дополнительные трансформации.'}

**Рекомендации:**
- Запустите трансформации на изолированных сущностях
- Ищите кластеры связанных сущностей
- Проверьте сущности с большим количеством связей (потенциальные ключевые узлы)
    `.trim();
  }

  private generateSuggestionResponse(entity: any): string[] {
    const suggestions: Record<string, string[]> = {
      'domain': [
        'Запустить DNS lookup для поиска IP',
        'Проверить WHOIS информацию',
        'Найти поддомены (Subdomain enumeration)',
        'Проанализировать SSL сертификат',
      ],
      'ip_address': [
        'Обратный DNS lookup (Reverse DNS)',
        'IP Геолокация',
        'Сканирование портов (если разрешено)',
        'Поиск связанных доменов',
      ],
      'email_address': [
        'Найти профили в соцсетях',
        'Проверить утечки данных (HIBP)',
        'Извлечь домен',
        'Валидация email',
      ],
      'username': [
        'Поиск по социальным платформам',
        'Проверить профиль GitHub',
        'Поиск связанных emails',
      ],
    };
    
    return suggestions[entity.type] || [
      'Нет конкретных предложений для этого типа сущности',
      'Попробуйте изучить связанные сущности',
    ];
  }

  private generatePatternResponse(graph: any): any[] {
     const patterns: any[] = [];
    
    // Pattern 1: Entities with same domain
    const domains = new Map<string, any[]>();
    for (const entity of graph.entities || []) {
      if (entity.type === 'email_address') {
        const domain = entity.value.split('@')[1];
        if (!domains.has(domain)) domains.set(domain, []);
        domains.get(domain)!.push(entity);
      }
    }
    
    for (const [domain, entities] of domains) {
      if (entities.length > 1) {
        patterns.push({
          type: 'shared_domain',
          description: `${entities.length} email-адресов используют домен: ${domain}`,
          entities: entities.map(e => e.id),
        });
      }
    }
    
    // Pattern 2: Highly connected nodes
    const connections = new Map<string, number>();
    for (const link of graph.links || []) {
      connections.set(link.source, (connections.get(link.source) || 0) + 1);
      connections.set(link.target, (connections.get(link.target) || 0) + 1);
    }
    
    for (const [entityId, count] of connections) {
      if (count > 3) {
        const entity = graph.entities?.find((e: any) => e.id === entityId);
        patterns.push({
          type: 'hub_node',
          description: `Сущность "${entity?.value}" имеет ${count} связей`,
          entities: [entityId],
        });
      }
    }
    return patterns;
  }

  private generateExplanationResponse(entity: any): string {
    const explanations: Record<string, string> = {
      'domain': `Доменное имя (${entity.value}) — это человекочитаемый адрес веб-сайта или сервиса. Он может быть преобразован в IP-адреса и содержит информацию о регистрации.`,
      'ip_address': `IP-адрес (${entity.value}) — это числовой идентификатор устройства в сети. Он может раскрыть местоположение, провайдера (ISP) и хостинг-информацию.`,
      'email_address': `Email-адрес (${entity.value}) может раскрыть связанный домен, потенциальные профили в соцсетях и часто фигурирует в утечках данных.`,
      'person': `Сущность "Человек" (${entity.value}) представляет индивидуума. Может быть связана с профилями в соцсетях, контактной информацией и организациями.`,
      'organization': `Организация (${entity.value}) представляет компанию или группу. Может быть связана с доменами, людьми и локациями.`,
    };
    
    return explanations[entity.type] || `Это сущность типа ${entity.type} со значением: ${entity.value}`;
  }
}

export const osintAgent = new OSINTAgent();
