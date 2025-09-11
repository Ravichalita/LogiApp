
'use server';
/**
 * @fileOverview Flow para otimização de rotas de entrega e retirada de caçambas.
 *
 * - optimizeRentalRoute - Função principal que recebe aluguéis e otimiza a rota.
 * - OptimizeRentalRouteInput - O tipo de entrada para a função optimizeRentalRoute.
 * - OptimizeRouteOutput - O tipo de saída da função optimizeRentalRoute.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import type { PopulatedRental, Location, Account, Truck, PopulatedOperation } from '@/lib/types';
import { getDirectionsAction } from '@/lib/data-server-actions';
import { addMinutes, formatISO, max, parseISO, subMinutes, differenceInMinutes, addSeconds, set, startOfDay, isSameDay } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { getFirestore } from 'firebase-admin/firestore';

const LocationSchema = z.object({
    address: z.string(),
    lat: z.number(),
    lng: z.number(),
});

const OptimizeRentalRouteInputSchema = z.object({
  rentals: z.custom<PopulatedRental[]>(),
  day: z.string().describe("The date for which to optimize the route, in ISO format."),
  startLocation: LocationSchema,
  baseId: z.string().optional(),
  accountId: z.string(),
  baseDepartureTime: z.string().optional().describe("The suggested departure time from base, in HH:mm format."),
});

export type OptimizeRentalRouteInput = z.infer<typeof OptimizeRentalRouteInputSchema>;

// Reusing existing output types from the operation flow as they are compatible
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

export async function optimizeRentalRoute(input: OptimizeRentalRouteInput): Promise<OptimizeRouteOutput> {
  return optimizeRentalRouteFlow(input);
}


const optimizeRentalRouteFlow = ai.defineFlow(
  {
    name: 'optimizeRentalRouteFlow',
    inputSchema: OptimizeRentalRouteInputSchema,
    outputSchema: OptimizeRouteOutputSchema,
  },
  async ({ rentals, day, accountId, startLocation, baseId, baseDepartureTime }) => {
    
    if (!startLocation) {
        throw new Error("Endereço da base de partida não fornecido.");
    }
    
    if (!rentals || rentals.length === 0) {
        return { stops: [] };
    }

    const db = getFirestore();
    const accountSnap = await db.doc(`accounts/${accountId}`).get();
    const accountData = accountSnap.data() as Account | undefined;
    
    const timeZone = 'America/Sao_Paulo';
    
    // Treat the incoming date string as being in the local timezone by parsing only the date part.
    const today = parseISO(day.substring(0, 10));

    // Convert rentals into "operations" for the day
    const operations: PopulatedOperation[] = rentals.flatMap(rental => {
        const tasks: PopulatedOperation[] = [];
        const deliveryDate = startOfDay(parseISO(rental.rentalDate));
        const returnDate = startOfDay(parseISO(rental.returnDate));

        // Create a fake startDate for sorting, e.g., 8 AM for deliveries, 5 PM for pickups
        if (isSameDay(deliveryDate, today)) {
            tasks.push({
                ...rental,
                id: `${rental.id}-delivery`,
                startDate: set(today, { hours: 8 }).toISOString(),
                endDate: set(today, { hours: 9 }).toISOString(),
                destinationAddress: rental.deliveryAddress,
                destinationLatitude: rental.latitude,
                destinationLongitude: rental.longitude,
                operationTypes: [{id: 'delivery', name: 'Entrega'}],
            } as unknown as PopulatedOperation);
        }
        if (isSameDay(returnDate, today)) {
            tasks.push({
                ...rental,
                id: `${rental.id}-pickup`,
                startDate: set(today, { hours: 17 }).toISOString(),
                endDate: set(today, { hours: 18 }).toISOString(),
                destinationAddress: rental.deliveryAddress,
                destinationLatitude: rental.latitude,
                destinationLongitude: rental.longitude,
                operationTypes: [{id: 'pickup', name: 'Retirada'}],
            } as unknown as PopulatedOperation);
        }
        return tasks;
    });

    const rotaAgendada = operations.sort((a, b) => {
        const dateA = a.startDate ? parseISO(a.startDate).getTime() : 0;
        const dateB = b.startDate ? parseISO(b.startDate).getTime() : 0;
        return dateA - dateB;
    });

    const rotaOtimizada: OptimizedStop[] = [];
    let pontoDePartidaAtual = startLocation;
    let horarioDePartidaAtual: Date;

    if (baseDepartureTime) {
      const [hours, minutes] = baseDepartureTime.split(':').map(Number);
      horarioDePartidaAtual = set(today, { hours, minutes, seconds: 0, milliseconds: 0 });
    } else {
      // Fallback to a default time if not provided
      horarioDePartidaAtual = set(today, { hours: 8, minutes: 0, seconds: 0, milliseconds: 0 });
    }
    
    // Convert the initial departure time to the correct timezone before storing it.
    const initialDepartureTime = toZonedTime(horarioDePartidaAtual, timeZone);

    let totalKm = 0;
    let totalSeconds = 0;

    for (let i = 0; i < rotaAgendada.length; i++) {
        const os = rotaAgendada[i];
        
        if (!os.destinationLatitude || !os.destinationLongitude) continue;
        
        const destinoAtual = { lat: os.destinationLatitude, lng: os.destinationLongitude };
        
        const directions = await getDirectionsAction(pontoDePartidaAtual, destinoAtual);
        const tempoViagemSeg = directions?.durationSeconds ?? 0;
        const distanciaKm = directions?.distanceMeters ? (directions.distanceMeters / 1000) : 0;

        totalKm += distanciaKm;
        totalSeconds += tempoViagemSeg;

        const horarioPrevistoChegada = addSeconds(horarioDePartidaAtual, tempoViagemSeg);
        
        // O serviço começa assim que chegar.
        const horarioInicioEfetivo = horarioPrevistoChegada;
        const duracaoServicoMin = 30; // Assume 30 mins for a drop-off/pick-up
        const horarioTerminoServico = addMinutes(horarioInicioEfetivo, duracaoServicoMin);

        const novaParada: OptimizedStop = {
            ordemServico: os,
            ordemNaRota: i + 1,
            tempoViagemAteAquiMin: Math.round(tempoViagemSeg / 60),
            distanciaAteAquiKm: parseFloat(distanciaKm.toFixed(1)),
            horarioPrevistoChegada: formatISO(horarioPrevistoChegada),
            horarioPrevistoInicioServico: formatISO(horarioInicioEfetivo),
            horarioPrevistoTerminoServico: formatISO(horarioTerminoServico),
            horarioSugeridoSaidaDoPontoAnterior: formatISO(horarioDePartidaAtual),
        };

        rotaOtimizada.push(novaParada);

        pontoDePartidaAtual = {
            address: os.destinationAddress!,
            lat: os.destinationLatitude!,
            lng: os.destinationLongitude!,
        };
        // A próxima partida acontece depois do término do serviço + 5 minutos de pausa
        horarioDePartidaAtual = addMinutes(horarioTerminoServico, 5); 
    }
    
    // Calculate return to base
    const returnToHomeDirections = await getDirectionsAction(pontoDePartidaAtual, startLocation);
    if (returnToHomeDirections) {
        totalKm += (returnToHomeDirections.distanceMeters || 0) / 1000;
        totalSeconds += returnToHomeDirections.durationSeconds || 0;
    }
    
    // Calculate total cost
    let totalCost = 0;
    const poliguindasteType = accountData?.truckTypes.find(tt => tt.name.toLowerCase().includes('poliguindaste'));
    if (poliguindasteType && accountData?.operationalCosts) {
         let costConfig = accountData.operationalCosts.find(c => c.baseId === baseId && c.truckTypeId === poliguindasteType.id);
        if (!costConfig) {
            costConfig = accountData.operationalCosts.find(c => c.truckTypeId === poliguindasteType.id);
        }
        const costPerKm = costConfig?.value || 0;
        totalCost = totalKm * costPerKm;
    }

    const totalMin = Math.round(totalSeconds / 60);
    const totalDurationHours = Math.floor(totalMin / 60);
    const totalDurationMins = totalMin % 60;
    
    return { 
        stops: rotaOtimizada, 
        baseDepartureTime: formatISO(initialDepartureTime),
        totalDistance: `${totalKm.toFixed(1).replace('.',',')} km`,
        totalDuration: `${totalDurationHours}h ${totalDurationMins}min`,
        totalCost,
    };
  }
);

    