import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { cn } from '../lib/utils';
import { RecurrenceData } from '../lib/types';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Check, ChevronDown, Calendar, Clock } from 'lucide-react-native';

const DAYS = [
    { label: 'D', value: 0 },
    { label: 'S', value: 1 },
    { label: 'T', value: 2 },
    { label: 'Q', value: 3 },
    { label: 'Q', value: 4 },
    { label: 'S', value: 5 },
    { label: 'S', value: 6 },
];

interface RecurrenceSelectorProps {
    value: RecurrenceData;
    onChange: (data: RecurrenceData) => void;
    disabled?: boolean;
}

export function RecurrenceSelector({ value, onChange, disabled }: RecurrenceSelectorProps) {
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [showEndDatePicker, setShowEndDatePicker] = useState(false);

    const toggleDay = (day: number) => {
        const newDays = value.daysOfWeek.includes(day)
            ? value.daysOfWeek.filter((d) => d !== day)
            : [...value.daysOfWeek, day].sort();
        onChange({ ...value, daysOfWeek: newDays });
    };

    const handleTimeChange = (event: any, date?: Date) => {
        setShowTimePicker(false);
        if (date) {
            onChange({ ...value, time: format(date, 'HH:mm') });
        }
    };

    const handleEndDateChange = (event: any, date?: Date) => {
        setShowEndDatePicker(false);
        if (date) {
            onChange({ ...value, endDate: date });
        }
    };

    if (!value.enabled) {
        return (
            <View className="flex-row items-center justify-between p-4 bg-white rounded-lg border border-gray-200">
                <View>
                    <Text className="text-base font-semibold text-gray-900">Tornar Recorrente</Text>
                    <Text className="text-sm text-gray-500">Repetir automaticamente</Text>
                </View>
                <TouchableOpacity
                    onPress={() => onChange({ ...value, enabled: true })}
                    disabled={disabled}
                    className={`w-12 h-6 rounded-full ${disabled ? 'bg-gray-200' : 'bg-gray-200'} justify-center px-1`}
                >
                    <View className="w-4 h-4 rounded-full bg-white shadow-sm" />
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <View className="flex-row items-center justify-between p-4 border-b border-gray-100">
                <View>
                    <Text className="text-base font-semibold text-gray-900">Recorrência Ativa</Text>
                    <Text className="text-sm text-gray-500">Configurar repetição</Text>
                </View>
                <TouchableOpacity
                    onPress={() => onChange({ ...value, enabled: false })}
                    disabled={disabled}
                    className="w-12 h-6 rounded-full bg-orange-500 justify-center items-end px-1"
                >
                    <View className="w-4 h-4 rounded-full bg-white shadow-sm" />
                </TouchableOpacity>
            </View>

            <View className="p-4 space-y-4">
                {/* Frequência */}
                <View>
                    <Label className="mb-2">Frequência</Label>
                    <View className="flex-row gap-2 flex-wrap">
                        {[
                            { label: 'Semanal', val: 'weekly' },
                            { label: 'Quinzenal', val: 'biweekly' },
                            { label: 'Mensal', val: 'monthly' }
                        ].map((opt) => (
                            <TouchableOpacity
                                key={opt.val}
                                onPress={() => onChange({ ...value, frequency: opt.val as any })}
                                className={cn(
                                    "px-3 py-2 rounded-md border text-sm",
                                    value.frequency === opt.val
                                        ? "bg-orange-100 border-orange-500"
                                        : "bg-white border-gray-300"
                                )}
                            >
                                <Text className={value.frequency === opt.val ? "text-orange-700 font-medium" : "text-gray-700"}>
                                    {opt.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Dias da Semana */}
                <View>
                    <Label className="mb-2">Dias da Semana</Label>
                    <View className="flex-row gap-2 justify-between">
                        {DAYS.map((day) => (
                            <TouchableOpacity
                                key={day.value}
                                onPress={() => toggleDay(day.value)}
                                className={cn(
                                    "w-10 h-10 rounded-full items-center justify-center border",
                                    value.daysOfWeek.includes(day.value)
                                        ? "bg-orange-500 border-orange-500"
                                        : "bg-white border-gray-300"
                                )}
                            >
                                <Text className={cn(
                                    "font-medium",
                                    value.daysOfWeek.includes(day.value) ? "text-white" : "text-gray-700"
                                )}>
                                    {day.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Horário */}
                <View>
                    <Label className="mb-2">Horário da Geração</Label>
                    <TouchableOpacity
                        onPress={() => setShowTimePicker(true)}
                        className="border border-gray-300 rounded-lg p-3 bg-white flex-row items-center"
                    >
                        <Clock size={16} color="#6b7280" className="mr-2" />
                        <Text className="text-gray-900">{value.time}</Text>
                    </TouchableOpacity>
                </View>

                {/* Data Final */}
                <View>
                    <Label className="mb-2">Data Final (Opcional)</Label>
                    <TouchableOpacity
                        onPress={() => setShowEndDatePicker(true)}
                        className="border border-gray-300 rounded-lg p-3 bg-white flex-row items-center"
                    >
                        <Calendar size={16} color="#6b7280" className="mr-2" />
                        <Text className={value.endDate ? "text-gray-900" : "text-gray-500"}>
                            {value.endDate ? format(value.endDate, 'dd/MM/yyyy', { locale: ptBR }) : 'Indeterminado'}
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Tipo de Cobrança */}
                <View>
                    <Label className="mb-2">Tipo de Cobrança</Label>
                    <View className="gap-2">
                        {[
                            { label: 'Por Serviço (Gerar valor em cada OS)', val: 'perService' },
                            { label: 'Mensal (Valor fixo por mês)', val: 'monthly' },
                            { label: 'Semanal (Valor fixo por semana)', val: 'weekly' },
                            { label: 'Quinzenal (Valor fixo por quinzena)', val: 'biweekly' }
                        ].map((opt) => (
                            <TouchableOpacity
                                key={opt.val}
                                onPress={() => onChange({ ...value, billingType: opt.val as any })}
                                className={cn(
                                    "flex-row items-center p-3 rounded-lg border",
                                    value.billingType === opt.val
                                        ? "bg-orange-50 border-orange-500"
                                        : "bg-white border-gray-300"
                                )}
                            >
                                <View className={cn(
                                    "w-4 h-4 rounded-full border mr-3 items-center justify-center",
                                    value.billingType === opt.val ? "border-orange-500" : "border-gray-400"
                                )}>
                                    {value.billingType === opt.val && <View className="w-2 h-2 rounded-full bg-orange-500" />}
                                </View>
                                <Text className="text-gray-700 text-sm flex-1">{opt.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Valor Mensal/Fixo (se aplicável) */}
                {value.billingType !== 'perService' && (
                    <View>
                        <Label className="mb-2">Valor Fixo (R$)</Label>
                        <Input
                            placeholder="0,00"
                            keyboardType="numeric"
                            value={value.monthlyValue ? value.monthlyValue.toString() : ''}
                            onChangeText={(text) => {
                                const num = parseFloat(text.replace(',', '.'));
                                onChange({ ...value, monthlyValue: isNaN(num) ? undefined : num });
                            }}
                        />
                    </View>
                )}
            </View>

            {showTimePicker && (
                <DateTimePicker
                    value={(() => {
                        const [h, m] = value.time.split(':').map(Number);
                        const d = new Date();
                        d.setHours(h || 0, m || 0);
                        return d;
                    })()}
                    mode="time"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={handleTimeChange}
                />
            )}

            {showEndDatePicker && (
                <DateTimePicker
                    value={value.endDate || new Date()}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={handleEndDateChange}
                    minimumDate={new Date()}
                />
            )}
        </View>
    );
}
