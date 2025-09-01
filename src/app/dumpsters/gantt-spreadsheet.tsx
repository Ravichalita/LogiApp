
'use client';

import * as React from 'react';
import { useMemo } from 'react';
import type { Dumpster, Rental, Client, DumpsterColor } from '@/lib/types';
import { addDays, startOfToday, format, isWithinInterval, parseISO, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { DUMPSTER_COLORS } from '@/lib/types';

interface GanttSpreadsheetProps {
  dumpsters: Dumpster[];
  rentals: (Rental & {id: string})[];
  clients: Client[];
}

const NUMBER_OF_DAYS = 30;

export function GanttSpreadsheet({ dumpsters, rentals, clients }: GanttSpreadsheetProps) {
  const { dateHeaders, dumpsterData } = useMemo(() => {
    const today = startOfToday();
    const dates = Array.from({ length: NUMBER_OF_DAYS }, (_, i) => addDays(today, i));
    const dateHeaders = dates.map(date => {
      const dayOfWeekShort = format(date, 'EEE', { locale: ptBR }).replace('.', '');
      return {
        dayOfWeek: dayOfWeekShort.charAt(0).toUpperCase() + dayOfWeekShort.slice(1),
        dayOfMonth: format(date, 'd'),
        isWeekend: dayOfWeekShort === 'sáb' || dayOfWeekShort === 'dom',
        isToday: isSameDay(date, today),
      }
    });

    const clientMap = new Map(clients.map(c => [c.id, c.name]));

    const data = dumpsters
      .sort((a,b) => a.name.localeCompare(b.name))
      .map(dumpster => {
        const dailyStatuses = dates.map(date => {
          const rentalOnDate = rentals.find(r =>
            r.dumpsterId === dumpster.id &&
            isWithinInterval(date, { start: parseISO(r.rentalDate), end: parseISO(r.returnDate) })
          );

          if (rentalOnDate) {
            const clientName = clientMap.get(rentalOnDate.clientId) || 'Cliente não encontrado';
            return {
              status: isWithinInterval(today, { start: parseISO(rentalOnDate.rentalDate), end: parseISO(rentalOnDate.returnDate) }) ? 'Alugada' : 'Reservada',
              tooltip: `${clientName} (${format(parseISO(rentalOnDate.rentalDate), 'dd/MM')} - ${format(parseISO(rentalOnDate.returnDate), 'dd/MM')})`
            };
          }
          return { status: 'Disponível', tooltip: 'Disponível' };
        });
        return { name: dumpster.name, statuses: dailyStatuses, color: dumpster.color as DumpsterColor };
      });

    return { dateHeaders, dumpsterData: data };
  }, [dumpsters, rentals, clients]);

  if (dumpsters.length === 0) {
    return <div className="flex items-center justify-center h-[200px] text-muted-foreground bg-muted rounded-md">Nenhuma caçamba para exibir na planilha.</div>;
  }

  const getStatusStyle = (status: string, color: DumpsterColor): React.CSSProperties => {
    switch (status) {
      case 'Alugada':
      case 'Reservada':
        return { backgroundColor: DUMPSTER_COLORS[color]?.value || '#ccc' };
      case 'Disponível':
      default:
        return {}; // Will use the default bg-muted/50 class
    }
  };

  return (
    <TooltipProvider>
      <div className="w-full text-xs" style={{ minWidth: '800px' }}>
        <div 
          className="sticky top-0 z-10 grid bg-card"
          style={{ gridTemplateColumns: `minmax(120px, 1.5fr) repeat(${NUMBER_OF_DAYS}, minmax(32px, 1fr))` }}
        >
          <div className="p-1 border-b border-r text-muted-foreground font-semibold"></div>
          {dateHeaders.map((header, index) => (
            <div key={index} className={cn("flex flex-col items-center justify-center border-b border-r p-1 text-center font-semibold", header.isWeekend && 'text-muted-foreground', header.isToday && 'bg-primary/10')}>
              <span>{header.dayOfMonth}</span>
            </div>
          ))}
        </div>
        <div className="grid" style={{ gridTemplateColumns: `minmax(120px, 1.5fr) repeat(${NUMBER_OF_DAYS}, minmax(32px, 1fr))` }}>
          {dumpsterData.map((row, rowIndex) => (
            <React.Fragment key={rowIndex}>
              <div className="p-2 border-b border-r font-medium flex items-center">{row.name}</div>
              {row.statuses.map((cell, cellIndex) => (
                 <Tooltip key={cellIndex} delayDuration={100}>
                  <TooltipTrigger asChild>
                    <div className={cn(
                      "h-full border-b border-r",
                      cell.status === 'Disponível' && 'bg-muted/50',
                      dateHeaders[cellIndex].isToday && 'border-l-2 border-l-primary'
                    )}>
                       <div 
                         className="h-full w-full opacity-75 hover:opacity-100 transition-opacity"
                         style={getStatusStyle(cell.status, row.color)}
                       ></div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{cell.tooltip}</p>
                  </TooltipContent>
                </Tooltip>
              ))}
            </React.Fragment>
          ))}
        </div>
      </div>
    </TooltipProvider>
  );
}
