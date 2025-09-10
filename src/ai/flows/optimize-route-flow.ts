
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
import type { PopulatedOperation, Location, Account, Truck } from '@/lib/types';
import { getDirectionsAction } from '@/lib/data-server-actions';
import { addMinutes, formatISO, max, parseISO, subMinutes, differenceInMinutes, addSeconds } from 'date-fns';
import { getFirestore } from 'firebase-admin/firestore';

const LocationSchema = z.object({
    address: z.string(),
    lat: z.number(),
    lng: z.number(),
});

const OptimizeRouteInputSchema = z.object({
  operations: z.custom<PopulatedOperation[]>(),
  startLocation: LocationSchema,
  startBaseId: z.string().optional(),
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


const optimizeRouteFlow = ai.defineFlow(
  {
    name: 'optimizeRouteFlow',
    inputSchema: OptimizeRouteInputSchema,
    outputSchema: OptimizeRouteOutputSchema,
  },
  async ({ operations, accountId, startLocation, startBaseId }) => {
    
    if (!startLocation) {
        throw new Error("Endereço da base de partida não fornecido.");
    }
    
    if (!operations || operations.length === 0) {
        return { stops: [] };
    }

    const db = getFirestore();
    const accountSnap = await db.doc(`accounts/${accountId}`).get();
    const accountData = accountSnap.data() as Account | undefined;
    const operationalCosts = accountData?.operationalCosts || [];

    const rotaAgendada = operations.sort((a, b) => {
        const dateA = a.startDate ? parseISO(a.startDate).getTime() : 0;
        const dateB = b.startDate ? parseISO(b.startDate).getTime() : 0;
        return dateA - dateB;
    });

    const rotaOtimizada: OptimizedStop[] = [];
    let pontoDePartidaAtual = startLocation;
    let horarioDeTerminoPontoAnterior = new Date(); // Will be set correctly in the loop.

    let baseDepartureTime: string | undefined;

    let totalKm = 0;
    let totalSeconds = 0;
    let totalRevenue = 0;
    
    const truckIds = [...new Set(rotaAgendada.map(op => op.truckId).filter(Boolean))];
    let truckMap = new Map<string, Truck>();
    if (truckIds.length > 0) {
      const truckDocs = await db.collection(`accounts/${accountId}/trucks`).where('__name__', 'in', truckIds).get();
      truckDocs.forEach(doc => truckMap.set(doc.id, doc.data() as Truck));
    }

    for (let i = 0; i < rotaAgendada.length; i++) {
        const os = rotaAgendada[i];
        
        if (!os.destinationLatitude || !os.destinationLongitude || !os.startDate || !os.endDate) continue;
        
        totalRevenue += os.value || 0;
        const destinoAtual = { lat: os.destinationLatitude, lng: os.destinationLongitude };
        
        const directions = await getDirectionsAction(pontoDePartidaAtual, destinoAtual);
        const tempoViagemSeg = directions ? directions.durationSeconds : 0;
        const distanciaKm = directions ? (directions.distanceMeters / 1000) : 0;

        totalKm += distanciaKm;
        totalSeconds += tempoViagemSeg;

        const horarioAgendado = parseISO(os.startDate);
        const MARGEM_SEGURANCA_MIN = 15;

        // Horário de saída do ponto anterior para chegar com antecedência
        const horarioSugeridoSaida = subMinutes(horarioAgendado, (tempoViagemSeg / 60) + MARGEM_SEGURANCA_MIN);
        
        let horarioPrevistoChegada: Date;
        
        if (i === 0) {
            baseDepartureTime = formatISO(horarioSugeridoSaida);
            horarioPrevistoChegada = addSeconds(horarioSugeridoSaida, tempoViagemSeg);
        } else {
            const saidaPontoAnterior = subMinutes(horarioAgendado, (tempoViagemSeg / 60) + MARGEM_SEGURANCA_MIN);
            horarioPrevistoChegada = addSeconds(saidaPontoAnterior, tempoViagemSeg);
        }
        
        // O serviço só pode começar no horário agendado, nunca antes.
        const horarioInicioEfetivo = max([horarioAgendado, horarioPrevistoChegada]);

        // A duração do serviço vem da própria OS
        const duracaoServicoMin = differenceInMinutes(parseISO(os.endDate), parseISO(os.startDate));
        const horarioTerminoServico = addMinutes(horarioInicioEfetivo, duracaoServicoMin);

        const novaParada: OptimizedStop = {
            ordemServico: os,
            ordemNaRota: i + 1,
            tempoViagemAteAquiMin: Math.round(tempoViagemSeg / 60),
            distanciaAteAquiKm: parseFloat(distanciaKm.toFixed(1)),
            horarioPrevistoChegada: formatISO(horarioPrevistoChegada),
            horarioPrevistoInicioServico: formatISO(horarioInicioEfetivo),
            horarioPrevistoTerminoServico: formatISO(horarioTerminoServico),
            horarioSugeridoSaidaDoPontoAnterior: formatISO(horarioSugeridoSaida),
        };

        rotaOtimizada.push(novaParada);

        pontoDePartidaAtual = {
            address: os.destinationAddress!,
            lat: os.destinationLatitude!,
            lng: os.destinationLongitude!,
        };
        horarioDeTerminoPontoAnterior = horarioTerminoServico; 
    }
    
    // Calculate return to base
    const returnToHomeDirections = await getDirectionsAction(pontoDePartidaAtual, startLocation);
    if (returnToHomeDirections) {
        totalKm += returnToHomeDirections.distanceMeters / 1000;
        totalSeconds += returnToHomeDirections.durationSeconds;
    }
    
    // Calculate total cost after total distance is known
    let totalCost = 0;
    const firstOpTruck = rotaAgendada.length > 0 ? truckMap.get(rotaAgendada[0].truckId!) : undefined;
    if (firstOpTruck && accountData?.truckTypes) {
        const truckType = accountData.truckTypes.find(tt => tt.name === firstOpTruck.type);
        if (truckType) {
            // Prioritize cost for specific base AND truck type
            let costConfig = operationalCosts.find(c => c.baseId === startBaseId && c.truckTypeId === truckType.id);
            // Fallback: if no specific base config, find any config for this truck type.
            if (!costConfig) {
                 costConfig = operationalCosts.find(c => c.truckTypeId === truckType.id);
            }
            const costPerKm = costConfig?.value || 0;
            totalCost = totalKm * costPerKm;
        }
    }

    const totalMin = Math.round(totalSeconds / 60);
    const totalDurationHours = Math.floor(totalMin / 60);
    const totalDurationMins = totalMin % 60;
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
