'use client';

import * as React from 'react';
import { CalendarIcon, ChevronDown } from 'lucide-react';
import { addDays, format, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths, getYear, setMonth, setYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

export type PeriodType = 'month' | 'year' | 'custom';

export interface PeriodSelectorProps {
    periodType: PeriodType;
    onPeriodTypeChange: (type: PeriodType) => void;
    dateRange: DateRange | undefined;
    onDateRangeChange: (range: DateRange | undefined) => void;
    selectedDate: Date; // For month/year selectors
    onSelectedDateChange: (date: Date) => void;
}

export function PeriodSelector({
    periodType,
    onPeriodTypeChange,
    dateRange,
    onDateRangeChange,
    selectedDate,
    onSelectedDateChange,
}: PeriodSelectorProps) {
    const months = [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];

    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i); // 2 years back, 2 years forward

    const handleMonthChange = (monthIndex: string) => {
        const newDate = setMonth(selectedDate, parseInt(monthIndex));
        onSelectedDateChange(newDate);
        // Automatically update range for "month" mode
        onDateRangeChange({
            from: startOfMonth(newDate),
            to: endOfMonth(newDate)
        });
    };

    const handleYearChange = (yearStr: string) => {
        const newDate = setYear(selectedDate, parseInt(yearStr));
        onSelectedDateChange(newDate);
         // Automatically update range for "year" mode
        if (periodType === 'year') {
             onDateRangeChange({
                from: startOfYear(newDate),
                to: endOfYear(newDate)
            });
        } else if (periodType === 'month') {
             onDateRangeChange({
                from: startOfMonth(newDate),
                to: endOfMonth(newDate)
            });
        }
    };

    // Effect to set initial range when switching types
    React.useEffect(() => {
        if (periodType === 'month') {
             onDateRangeChange({
                from: startOfMonth(selectedDate),
                to: endOfMonth(selectedDate)
            });
        } else if (periodType === 'year') {
             onDateRangeChange({
                from: startOfYear(selectedDate),
                to: endOfYear(selectedDate)
            });
        }
    }, [periodType, selectedDate]);


    return (
        <div className="flex items-center space-x-2 bg-background/95 p-1 rounded-lg border shadow-sm">
            <Select value={periodType} onValueChange={(v) => onPeriodTypeChange(v as PeriodType)}>
                <SelectTrigger className="w-[130px] h-9 border-none bg-transparent focus:ring-0 focus:ring-offset-0 font-medium">
                    <SelectValue placeholder="Período" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="month">Mensal</SelectItem>
                    <SelectItem value="year">Anual</SelectItem>
                    <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
            </Select>

            <div className="h-4 w-px bg-border mx-2" />

            {periodType === 'month' && (
                <div className="flex items-center space-x-2 px-2">
                     <Select value={selectedDate.getMonth().toString()} onValueChange={handleMonthChange}>
                        <SelectTrigger className="w-[140px] h-9 border-none shadow-none focus:ring-0">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {months.map((month, index) => (
                                <SelectItem key={index} value={index.toString()}>
                                    {month}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select value={selectedDate.getFullYear().toString()} onValueChange={handleYearChange}>
                        <SelectTrigger className="w-[100px] h-9 border-none shadow-none focus:ring-0">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {years.map((year) => (
                                <SelectItem key={year} value={year.toString()}>
                                    {year}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}

            {periodType === 'year' && (
                 <div className="flex items-center space-x-2 px-2">
                     <Select value={selectedDate.getFullYear().toString()} onValueChange={handleYearChange}>
                        <SelectTrigger className="w-[100px] h-9 border-none shadow-none focus:ring-0">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {years.map((year) => (
                                <SelectItem key={year} value={year.toString()}>
                                    {year}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}

            {periodType === 'custom' && (
                <div className="grid gap-2 px-2">
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                id="date"
                                variant={"ghost"}
                                className={cn(
                                    "w-[260px] justify-start text-left font-normal h-9 hover:bg-transparent",
                                    !dateRange && "text-muted-foreground"
                                )}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {dateRange?.from ? (
                                    dateRange.to ? (
                                        <>
                                            {format(dateRange.from, "dd/MM/y")} -{" "}
                                            {format(dateRange.to, "dd/MM/y")}
                                        </>
                                    ) : (
                                        format(dateRange.from, "dd/MM/y")
                                    )
                                ) : (
                                    <span>Selecione uma data</span>
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                                initialFocus
                                mode="range"
                                defaultMonth={dateRange?.from}
                                selected={dateRange}
                                onSelect={onDateRangeChange}
                                numberOfMonths={2}
                                locale={ptBR}
                            />
                        </PopoverContent>
                    </Popover>
                </div>
            )}
        </div>
    );
}
