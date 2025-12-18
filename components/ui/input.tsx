import { TextInput, TextInputProps, View, Text } from 'react-native';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export interface InputProps extends TextInputProps {
    label?: string;
    error?: string;
}

export function Input({ className, label, error, ...props }: InputProps) {
    return (
        <View className="w-full">
            {label && <Text className="text-gray-700 font-medium mb-1.5">{label}</Text>}
            <TextInput
                className={cn(
                    "flex h-11 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:border-orange-500",
                    error && "border-red-500",
                    className
                )}
                placeholderTextColor="#9CA3AF"
                {...props}
            />
            {error && <Text className="text-red-500 text-xs mt-1">{error}</Text>}
        </View>
    );
}
