
'use server';
/**
 * @fileOverview Flow para otimização de rotas de Ordens de Serviço.
 *
 * - optimizeRoute - Função principal que recebe operações e otimiza a rota.
 * - OptimizeRouteInput - O tipo de entrada para a função optimizeRoute.
 * - OptimizeRouteOutput - O tipo de saída da função optimizeRoute.
 * - OptimizedStop - O tipo de cada parada na rota otimizada retornada.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import type { PopulatedOperation, Location, Account } from '@/lib/types';
import { getDirectionsAction } from '@/lib/data-server-actions';
import { addMinutes, formatISO, max, parseISO, subMinutes } from 'date-fns';
import { getFirestore } from 'firebase-admin/firestore';

const OptimizeRouteInputSchema = z.object({
  operations: z.custom<PopulatedOperation[]>(),
  startLocation: z.custom<Location>(),
  accountId: z.string(),
});

export type OptimizeRouteInput = z.infer<typeof OptimizeRouteInputSchema>;

const OptimizedStopSchema = z.object({
  ordemServico: z.custom<PopulatedOperation>(),
  ordemNaRota: z.number(),
  tempoViagemAteAquiMin: z.number(),
  distanciaAteAquiKm: z.number(),
  horarioPrevistoChegada: z.string(),
  horarioPrevistoInicioServico: z.string(),
  horarioPrevistoTerminoServico: z.string(),
  horarioSugeridoSaidaDoPontoAnterior: z.string(),
});

export type OptimizedStop = z.infer<typeof OptimizedStopSchema>;

const OptimizeRouteOutputSchema = z.object({
  stops: z.array(OptimizedStopSchema),
  baseDepartureTime: z.string().optional(),
  totalDistance: z.string().optional(),
  totalDuration: z.string().optional(),
  totalCost: z.number().optional(),
  totalRevenue: z.number().optional(),
  profit: z.number().optional(),
});

export type OptimizeRouteOutput = z.infer<typeof OptimizeRouteOutputSchema>;


export async function optimizeRoute(input: OptimizeRouteInput): Promise<OptimizeRouteOutput> {
  return optimizeRouteFlow(input);
}

// Helper to parse duration string (e.g., "15 mins", "1 hour 20 mins") into minutes
function parseDurationToMinutes(duration: string): number {
    const parts = duration.split(' ');
    let totalMinutes = 0;
    for (let i = 0; i < parts.length; i++) {
        if (parts[i].match(/\d+/)) {
            const value = parseInt(parts[i], 10);
            if (isNaN(value)) continue;

            const unit = parts[i+1] || '';
            if (unit.startsWith('hora') || unit.startsWith('hour')) {
                totalMinutes += value * 60;
            } else {
                totalMinutes += value; // Assume minutes
            }
        }
    }
    return totalMinutes;
}

function parseDistanceToKm(distance: string): number {
    const value = parseFloat(distance.replace(',', '.'));
    return isNaN(value) ? 0 : value;
}

const optimizeRouteFlow = ai.defineFlow(
  {
    name: 'optimizeRouteFlow',
    inputSchema: OptimizeRouteInputSchema,
    outputSchema: OptimizeRouteOutputSchema,
  },
  async ({ operations, startLocation, accountId }) => {
    if (!operations || operations.length === 0) {
        return { stops: [] };
    }

    const accountSnap = await getFirestore().doc(`accounts/${accountId}`).get();
    const costPerKm = accountSnap.data()?.costPerKm || 0;

    const rotaAgendada = operations.sort((a, b) => {
        const dateA = a.startDate ? parseISO(a.startDate).getTime() : 0;
        const dateB = b.startDate ? parseISO(b.startDate).getTime() : 0;
        return dateA - dateB;
    });

    const rotaOtimizada: OptimizedStop[] = [];
    let pontoDePartidaAtual = startLocation;
    let horarioDePartidaAnterior = new Date(); // Este será atualizado em cada iteração
    let baseDepartureTime: string | undefined;

    let totalKm = 0;
    let totalMin = 0;
    let totalRevenue = 0;

    for (let i = 0; i < rotaAgendada.length; i++) {
        const os = rotaAgendada[i];
        
        if (!os.destinationLatitude || !os.destinationLongitude || !os.startDate) continue;
        
        totalRevenue += os.value || 0;
        const destinoAtual = { lat: os.destinationLatitude, lng: os.destinationLongitude };
        
        const directions = await getDirectionsAction(pontoDePartidaAtual, destinoAtual);
        const tempoViagemMin = directions ? parseDurationToMinutes(directions.duration) : 0;
        const distanciaKm = directions ? parseDistanceToKm(directions.distance) : 0;

        totalKm += distanciaKm;
        totalMin += tempoViagemMin;

        const horarioAgendado = parseISO(os.startDate);
        const MARGEM_SEGURANCA_MIN = 15;

        // Horário de saída do ponto anterior para chegar com antecedência
        const horarioSugeridoSaida = subMinutes(horarioAgendado, tempoViagemMin + MARGEM_SEGURANCA_MIN);
        
        if (i === 0) {
            baseDepartureTime = formatISO(horarioSugeridoSaida);
        }
        
        // O horário de chegada é a saída do ponto anterior mais o tempo de viagem
        const horarioPrevistoChegada = addMinutes(horarioSugeridoSaida, tempoViagemMin);

        // O serviço só pode começar no horário agendado, nunca antes.
        const horarioInicioEfetivo = horarioAgendado;

        // A duração do serviço precisa vir da OS ou ser um padrão
        const duracaoServicoMin = 60;
        const horarioTerminoServico = addMinutes(horarioInicioEfetivo, duracaoServicoMin);

        const novaParada: OptimizedStop = {
            ordemServico: os,
            ordemNaRota: i + 1,
            tempoViagemAteAquiMin: tempoViagemMin,
            distanciaAteAquiKm: distanciaKm,
            horarioPrevistoChegada: formatISO(horarioPrevistoChegada),
            horarioPrevistoInicioServico: formatISO(horarioInicioEfetivo),
            horarioPrevistoTerminoServico: formatISO(horarioTerminoServico),
            horarioSugeridoSaidaDoPontoAnterior: formatISO(horarioSugeridoSaida),
        };

        rotaOtimizada.push(novaParada);

        // Atualiza o ponto de partida para a próxima iteração
        pontoDePartidaAtual = {
            address: os.destinationAddress!,
            lat: os.destinationLatitude!,
            lng: os.destinationLongitude!,
        };
    }
    
    // Calculate return to base
    const returnToHomeDirections = await getDirectionsAction(pontoDePartidaAtual, startLocation);
    if (returnToHomeDirections) {
        totalKm += parseDistanceToKm(returnToHomeDirections.distance);
        totalMin += parseDurationToMinutes(returnToHomeDirections.duration);
    }
    
    const totalDurationHours = Math.floor(totalMin / 60);
    const totalDurationMins = totalMin % 60;
    const totalCost = totalKm * costPerKm;
    const profit = totalRevenue - totalCost;
    
    return { 
        stops: rotaOtimizada, 
        baseDepartureTime,
        totalDistance: `${totalKm.toFixed(1).replace('.',',')} km`,
        totalDuration: `${totalDurationHours}h ${totalDurationMins}min`,
        totalCost,
        totalRevenue,
        profit,
    };
  }
);
