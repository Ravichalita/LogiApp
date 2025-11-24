
'use client';

import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';

export interface RecurrenceData {
    enabled: boolean;
    frequency: 'weekly' | 'custom';
    daysOfWeek: number[];
    time: string;
    endDate?: Date;
    billingType: 'perService' | 'monthly';
}

interface RecurrenceSelectorProps {
    value: RecurrenceData;
    onChange: (data: RecurrenceData) => void;
    disabled?: boolean;
}

const DAYS = [
    { label: 'D', value: 0 },
    { label: 'S', value: 1 },
    { label: 'T', value: 2 },
    { label: 'Q', value: 3 },
    { label: 'Q', value: 4 },
    { label: 'S', value: 5 },
    { label: 'S', value: 6 },
];

export function RecurrenceSelector({ value, onChange, disabled }: RecurrenceSelectorProps) {
    const [isEndDateOpen, setIsEndDateOpen] = useState(false);

    const toggleDay = (day: number) => {
        const newDays = value.daysOfWeek.includes(day)
            ? value.daysOfWeek.filter((d) => d !== day)
            : [...value.daysOfWeek, day].sort();
        onChange({ ...value, daysOfWeek: newDays });
    };

    return (
        <div className="space-y-4 p-4 border rounded-md bg-card">
            <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                    <Label className="text-base">Tornar Recorrente</Label>
                    <p className="text-sm text-muted-foreground">
                        Repetir esta ordem de serviço automaticamente
                    </p>
                </div>
                <Switch
                    checked={value.enabled}
                    onCheckedChange={(checked) => onChange({ ...value, enabled: checked })}
                    disabled={disabled}
                />
            </div>

            {value.enabled && (
                <div className="space-y-4 pt-2 animate-in fade-in slide-in-from-top-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Frequência</Label>
                            <Select
                                value={value.frequency}
                                onValueChange={(v: 'weekly' | 'custom') => onChange({ ...value, frequency: v })}
                                disabled={disabled}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="weekly">Semanal</SelectItem>
                                    {/* <SelectItem value="custom">Personalizado</SelectItem> */}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Horário da Geração</Label>
                            <Input
                                type="time"
                                value={value.time}
                                onChange={(e) => onChange({ ...value, time: e.target.value })}
                                disabled={disabled}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Dias da Semana</Label>
                        <div className="flex gap-2">
                            {DAYS.map((day) => (
                                <Button
                                    key={day.value}
                                    type="button"
                                    variant={value.daysOfWeek.includes(day.value) ? 'default' : 'outline'}
                                    size="sm"
                                    className={cn("w-10 h-10 p-0 rounded-full", {
                                        "opacity-50 cursor-not-allowed": disabled
                                    })}
                                    onClick={() => !disabled && toggleDay(day.value)}
                                >
                                    {day.label}
                                </Button>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Tipo de Cobrança</Label>
                            <Select
                                value={value.billingType}
                                onValueChange={(v: 'perService' | 'monthly') => onChange({ ...value, billingType: v })}
                                disabled={disabled}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="perService">Por Serviço (Gerar valor em cada OS)</SelectItem>
                                    <SelectItem value="monthly">Mensal (Valor fixo por mês)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Data Final (Opcional)</Label>
                            <Popover open={isEndDateOpen} onOpenChange={setIsEndDateOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant={"outline"}
                                        className={cn(
                                            "w-full justify-start text-left font-normal",
                                            !value.endDate && "text-muted-foreground"
                                        )}
                                        disabled={disabled}
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {value.endDate ? format(value.endDate, "PPP", { locale: ptBR }) : <span>Indeterminado</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar
                                        mode="single"
                                        selected={value.endDate}
                                        onSelect={(date) => {
                                            onChange({ ...value, endDate: date });
                                            setIsEndDateOpen(false);
                                        }}
                                        initialFocus
                                        locale={ptBR}
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
