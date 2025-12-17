import { View, Text, ViewProps } from 'react-native';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function Card({ className, ...props }: ViewProps) {
    return (
        <View className={cn("rounded-lg border border-gray-200 bg-white shadow-sm", className)} {...props} />
    );
}

export function CardHeader({ className, ...props }: ViewProps) {
    return (
        <View className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
    );
}

export function CardTitle({ className, ...props }: ViewProps & { children: React.ReactNode }) {
    // Text component is simpler for title, but strictly CardTitle in web is H3.
    // We expect text children usually.
    return (
        // If children is a string, wrap in Text, else assume it's custom.
        <View className={cn("", className)} {...props}>
            {typeof props.children === 'string' ? <Text className="text-2xl font-semibold leading-none tracking-tight text-gray-900">{props.children}</Text> : props.children}
        </View>
    );
}

export function CardDescription({ className, ...props }: ViewProps & { children: React.ReactNode }) {
    return (
        <View className={cn("", className)} {...props}>
            {typeof props.children === 'string' ? <Text className="text-sm text-gray-500">{props.children}</Text> : props.children}
        </View>
    );
}

export function CardContent({ className, ...props }: ViewProps) {
    return <View className={cn("p-6 pt-0", className)} {...props} />;
}

export function CardFooter({ className, ...props }: ViewProps) {
    return <View className={cn("flex-row items-center p-6 pt-0", className)} {...props} />;
}
