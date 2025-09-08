
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
});


const trafficAnalysisPrompt = ai.definePrompt({
  name: 'trafficAnalysisPrompt',
  input: { schema: PromptInputSchema },
  model: googleAI.model('gemini-2.5-pro'),
  prompt: `
[INÍCIO DO PROMPT]
1. Missão
   Você deve agir como um especialista em logística que explica o trânsito de forma clara e prática. O objetivo é prever como estarão as condições de tráfego em um lugar e horário específicos, usando informações públicas disponíveis na internet e redes sociais.
   A resposta deve ser objetiva, fácil de entender e trazer recomendações úteis.

2. CONTEXTO DA ANÁLISE
Data da Previsão: {{{date}}}. A análise deve cobrir o período da manhã e da tarde, correspondente a uma rota de trabalho com duração total de aproximadamente {{{totalDuration}}}.
Localização: Cidades e bairros na rota.
Região/Rota Específica: {{{routeStops}}}
Condições Climáticas (Previsão): {{{weather}}}
Duração Estimada (Primeiro Trecho): {{{trafficDuration}}}
Beleza, agora vou simplificar o prompt para que a IA produza **respostas mais práticas e objetivas**, sem jargão técnico pesado, mas ainda mantendo a análise dos fatores importantes (clima, eventos, histórico, etc.). Fica mais no tom de **guia prático** para um usuário comum que quer entender o trânsito.

2. Fontes de Informação

* Histórico de trânsito: padrões médios de velocidade e congestionamento no mesmo dia e horário.
* Dados em tempo real: Google Maps, Waze, Here, sensores e câmeras públicas.
* Clima: chuva, neblina, calor extremo.
* Eventos programados: shows, jogos, manifestações, obras.
* Transporte público: greves, atrasos ou alterações de linhas.
* Redes sociais: posts em Twitter ou Facebook sobre acidentes ou congestionamentos.
* Notícias locais: sites e rádios de trânsito.

3. Passo a Passo da Análise
   Etapa 1 – Linha de Base
   Descubra como o trânsito costuma ser normalmente naquele local, dia da semana e horário.

Etapa 2 – Ajustes
Verifique fatores que podem mudar esse padrão:

* Eventos grandes na região (exemplo: jogo de futebol).
* Clima (chuva costuma aumentar congestionamentos).
* Obras ou fechamentos de vias.
* Greves no transporte público.

Etapa 3 – Confirmação
Compare diferentes fontes para ter certeza. Se várias confirmarem o mesmo problema (por exemplo, acidente relatado no Waze, Twitter e rádio), aumente a confiança da previsão.

Etapa 4 – Resultado Final
Mostre:

* Nível de trânsito esperado (leve, moderado, intenso ou muito congestionado).
* Tempo de viagem estimado em relação ao normal (exemplo: 30% a mais).
* Principais motivos (exemplo: chuva forte, evento esportivo, acidente).
* Sugestões práticas de rotas alternativas ou horários melhores.

4. Regras para Responder

* Use linguagem simples e clara.
* Dê sempre um resumo rápido do que esperar.
* Inclua causas principais do trânsito.
* Informe se há alternativas melhores.
* Seja objetivo: máximo de 3 a 5 pontos principais.

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

        const analysisDate = new Date(input.date);
        
        // Format the date to be more human-readable and timezone-aware for the LLM
        const timeZone = 'America/Sao_Paulo';
        const zonedDate = toZonedTime(analysisDate, timeZone);
        const formattedDateForPrompt = format(zonedDate, "dd 'de' MMMM 'de' yyyy, 'iniciando aproximadamente às' HH:mm", { locale: ptBR }) + " (Horário de Brasília)";

        if (input.routeStops.length > 0) {
            const originLocation = await geocodeAddress(input.routeStops[0]);
            
            if (originLocation) {
                // Fetch weather
                const weatherResult = await getWeatherForecastAction(originLocation, analysisDate);
                if (weatherResult) {
                    weatherInfo = `${weatherResult.condition}, temperatura de ${weatherResult.tempC}°C.`;
                }

                // Fetch traffic for the first leg of the journey
                if (input.routeStops.length > 1) {
                    const destinationLocation = await geocodeAddress(input.routeStops[1]);
                    if (destinationLocation) {
                        const directionsResult = await getDirectionsAction(originLocation, destinationLocation);
                        if (directionsResult?.duration) {
                            trafficInfo = `A duração estimada para o primeiro trecho da rota é de ${directionsResult.duration}.`;
                        }
                    }
                }
            }
        }

        const response = await trafficAnalysisPrompt({ 
            ...input, 
            date: formattedDateForPrompt, // Use the new formatted date
            weather: weatherInfo, 
            trafficDuration: trafficInfo 
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
    

