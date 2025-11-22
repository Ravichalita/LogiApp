
import React from 'react';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export type RecurrenceData = {
    enabled: boolean;
    daysOfWeek: number[]; // 0 = Sunday, 1 = Monday, etc.
    time: string;
    endDateMode: 'permanent' | 'date';
    endDate?: Date;
    billingType: 'per_service' | 'monthly';
};

interface RecurrenceSelectorProps {
    data: RecurrenceData;
    onChange: (data: RecurrenceData) => void;
    disabled?: boolean;
}

const DAYS = [
    { label: 'Dom', value: 0 },
    { label: 'Seg', value: 1 },
    { label: 'Ter', value: 2 },
    { label: 'Qua', value: 3 },
    { label: 'Qui', value: 4 },
    { label: 'Sex', value: 5 },
    { label: 'Sáb', value: 6 },
];

export function RecurrenceSelector({ data, onChange, disabled }: RecurrenceSelectorProps) {
    const handleToggle = (checked: boolean) => {
        onChange({ ...data, enabled: checked });
    };

    const handleDayToggle = (dayValue: number) => {
        const currentDays = data.daysOfWeek;
        const newDays = currentDays.includes(dayValue)
            ? currentDays.filter((d) => d !== dayValue)
            : [...currentDays, dayValue].sort();
        onChange({ ...data, daysOfWeek: newDays });
    };

    return (
        <div className="space-y-4 border p-4 rounded-md bg-card">
            <div className="flex items-center space-x-2">
                <Checkbox
                    id="recurrence-enabled"
                    checked={data.enabled}
                    onCheckedChange={handleToggle}
                    disabled={disabled}
                />
                <Label htmlFor="recurrence-enabled" className="font-semibold">
                    Tornar esta OS recorrente
                </Label>
            </div>

            {data.enabled && (
                <div className="pl-6 space-y-4 animate-in slide-in-from-top-2 duration-200">
                    <div className="space-y-2">
                        <Label>Dias da Semana</Label>
                        <div className="flex flex-wrap gap-2">
                            {DAYS.map((day) => (
                                <div key={day.value} className="flex items-center space-x-1">
                                    <Checkbox
                                        id={`day-${day.value}`}
                                        checked={data.daysOfWeek.includes(day.value)}
                                        onCheckedChange={() => handleDayToggle(day.value)}
                                    />
                                    <Label htmlFor={`day-${day.value}`} className="font-normal cursor-pointer">
                                        {day.label}
                                    </Label>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="recurrence-time">Horário</Label>
                            <Input
                                id="recurrence-time"
                                type="time"
                                value={data.time}
                                onChange={(e) => onChange({ ...data, time: e.target.value })}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label>Cobrança</Label>
                            <Select
                                value={data.billingType}
                                onValueChange={(val: 'per_service' | 'monthly') =>
                                    onChange({ ...data, billingType: val })
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="per_service">Por Serviço</SelectItem>
                                    <SelectItem value="monthly">Mensal</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Fim da Recorrência</Label>
                        <RadioGroup
                            value={data.endDateMode}
                            onValueChange={(val: 'permanent' | 'date') =>
                                onChange({ ...data, endDateMode: val })
                            }
                            className="flex flex-col space-y-1"
                        >
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="permanent" id="mode-permanent" />
                                <Label htmlFor="mode-permanent">Permanente (até cancelar)</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <RadioGroupItem value="date" id="mode-date" />
                                <Label htmlFor="mode-date">Até uma data específica</Label>
                            </div>
                        </RadioGroup>

                        {data.endDateMode === 'date' && (
                            <div className="mt-2">
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant={'outline'}
                                            className={cn(
                                                'w-[240px] justify-start text-left font-normal',
                                                !data.endDate && 'text-muted-foreground'
                                            )}
                                        >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {data.endDate ? (
                                                format(data.endDate, 'PPP', { locale: ptBR })
                                            ) : (
                                                <span>Escolha uma data</span>
                                            )}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                        <Calendar
                                            mode="single"
                                            selected={data.endDate}
                                            onSelect={(date) => onChange({ ...data, endDate: date })}
                                            initialFocus
                                            locale={ptBR}
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
