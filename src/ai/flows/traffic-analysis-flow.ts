

'use server';
/**
 * @fileOverview Flow para análise de trânsito usando IA.
 *
 * - analyzeTraffic - Função que recebe uma rota e data e retorna uma análise de trânsito.
 * - TrafficAnalysisInput - O tipo de entrada para a função analyzeTraffic.
 * - TrafficAnalysisOutput - O tipo de saída da função analyzeTraffic.
 */

import { ai } from '@/ai/genkit';
import { googleAI } from '@genkit-ai/googleai';
import { z } from 'zod';
import { geocodeAddress, getWeatherForecastAction, getDirectionsAction } from '@/lib/data-server-actions';
import type { Location } from '@/lib/types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toZonedTime } from 'date-fns-tz';


const TrafficAnalysisInputSchema = z.object({
  routeStops: z.array(z.string()).describe("Uma lista de endereços que compõem a rota."),
  date: z.string().describe("A data para a qual a análise de trânsito deve ser feita, no formato ISO (ex: '2024-08-15T12:00:00.000Z')."),
  totalDuration: z.string().describe("A duração total estimada da rota, ex: '3h 45min'."),
});
export type TrafficAnalysisInput = z.infer<typeof TrafficAnalysisInputSchema>;

export type TrafficAnalysisOutput = string;

export async function analyzeTraffic(input: TrafficAnalysisInput): Promise<TrafficAnalysisOutput> {
  return trafficAnalysisFlow(input);
}

const PromptInputSchema = z.object({
  routeStops: z.array(z.string()),
  date: z.string(),
  weather: z.string().optional(),
  trafficDuration: z.string().optional(),
  totalDuration: z.string().optional(),
  routeSummary: z.string().optional(),
  tollInfo: z.string().optional(),
});


const trafficAnalysisPrompt = ai.definePrompt({
  name: 'trafficAnalysisPrompt',
  input: { schema: PromptInputSchema },
  model: googleAI.model('gemini-3-pro-preview'),
  prompt: `
[INÍCIO DO PROMPT]
# Persona e Objetivo
Você é o **Copiloto Inteligente**, um assistente de trânsito pessoal. Sua linguagem é natural, direta e parceira (como um amigo experiente conversando).
Seu objetivo não é apenas dar dados frios, mas ajudar o motorista a se planejar mentalmente para o trajeto, evitando estresse.

# Dados da Viagem
- **Quando:** {{{date}}}
- **Trajeto:** {{{routeStops}}}
- **Tempo padrão (sem trânsito):** {{{trafficDuration}}}
- **Previsão do Tempo:** {{{weather}}}
- **Duração Total Estimada Inicialmente:** {{{totalDuration}}}

# Instruções de Pesquisa (Obrigatório)
Antes de responder, utilize a busca do Google para verificar:
1.  A situação real das rodovias/avenidas citadas no trajeto agora (busque por acidentes recentes, obras ou interdições).
2.  Se há grandes eventos na cidade que impactam o fluxo (shows, jogos, manifestações).
3.  Como a previsão do tempo {{{weather}}} está afetando o trânsito hoje (ex: alagamentos conhecidos).

# Formato da Resposta
A resposta deve ser fácil de ler em uma tela de celular. Siga esta estrutura:

## 🚦 Veredito: [Tranquilo / Atenção / Caótico]
*(Uma frase curta resumindo se vale a pena sair agora ou se o motorista vai passar raiva)*

## ⏱️ Previsão de Tempo Real
* **Estimativa de viagem:** [X horas e Y minutos]
* **Atraso esperado:** [Aproximadamente +X min em relação ao normal]

## 🧐 O que está pegando?
*(Explique em linguagem natural o motivo do trânsito. Exemplo: "Além da chuva, tem uma obra na faixa da direita na Av. X que está travando tudo" ou "Dia atípico, fluxo livre por ser feriado".)*

## 💡 Dica do Copiloto
*(Uma recomendação prática. Exemplo: "Se puder, espere mais 30min para sair", "Fuja da via X e pegue a via Y", ou "Prepare uma playlist longa, vai demorar".)*

---
*Lembrete: O trânsito muda rápido. Dê uma olhada no Waze/Maps antes de ligar o carro.*
`
});

const trafficAnalysisFlow = ai.defineFlow(
  {
    name: 'trafficAnalysisFlow',
    inputSchema: TrafficAnalysisInputSchema,
    outputSchema: z.string(),
  },
  async (input) => {
    try {
        let weatherInfo = "Não foi possível obter a previsão do tempo.";
        let trafficInfo = "Não foi possível obter dados de trânsito em tempo real.";
        let routeSummary = "Sem resumo da rota.";
        let tollInfo = "Sem informações de pedágio.";

        const analysisDate = new Date(input.date);
        
        const timeZone = 'America/Sao_Paulo';
        const zonedDate = toZonedTime(analysisDate, timeZone);
        const formattedDateForPrompt = format(zonedDate, "dd 'de' MMMM 'de' yyyy, 'iniciando aproximadamente às' HH:mm", { locale: ptBR }) + " (Horário de Brasília)";

        if (input.routeStops.length > 0) {
            const originLocation = await geocodeAddress(input.routeStops[0]);
            
            if (originLocation) {
                const weatherResult = await getWeatherForecastAction(originLocation, analysisDate);
                if (weatherResult) {
                    weatherInfo = `${weatherResult.condition}, temperatura de ${weatherResult.tempC}°C.`;
                }

                if (input.routeStops.length > 1) {
                    const destinationLocation = await geocodeAddress(input.routeStops[1]);
                    if (destinationLocation) {
                        const directionsResult = await getDirectionsAction(originLocation, destinationLocation);
                        if (directionsResult) {
                            const hours = Math.floor(directionsResult.durationSeconds / 3600);
                            const minutes = Math.floor((directionsResult.durationSeconds % 3600) / 60);
                            let durationText = '';
                            if (hours > 0) durationText += `${hours}h `;
                            if (minutes > 0) durationText += `${minutes}min`;
                            trafficInfo = `A duração estimada para o primeiro trecho da rota é de ${durationText.trim()}.`;
                        }
                    }
                }
            }
        }

        const response = await trafficAnalysisPrompt({ 
            ...input, 
            date: formattedDateForPrompt,
            weather: weatherInfo, 
            trafficDuration: trafficInfo,
        });

        const outputText = response.text; 

        if (!outputText) {
            throw new Error("A IA não retornou uma resposta.");
        }
        return outputText;
    } catch (error) {
        console.error("Erro no fluxo de análise de trânsito:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return `Falha na análise de trânsito: ${errorMessage}`;
    }
  }
);
    



