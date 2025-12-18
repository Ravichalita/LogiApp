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
            {label && <Text className="text-foreground font-medium mb-1.5">{label}</Text>}
            <TextInput
                className={cn(
                    "flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary text-foreground",
                    error && "border-destructive",
                    className
                )}
                placeholderTextColor="#9CA3AF"
                {...props}
            />
            {error && <Text className="text-destructive text-xs mt-1">{error}</Text>}
        </View>
    );
}
