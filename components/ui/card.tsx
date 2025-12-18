import { View, Text, ViewProps } from 'react-native';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function Card({ className, ...props }: ViewProps) {
    return (
        <View className={cn("rounded-lg border border-border bg-card shadow-sm", className)} {...props} />
    );
}

export function CardHeader({ className, ...props }: ViewProps) {
    return (
        <View className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
    );
}

export function CardTitle({ className, ...props }: ViewProps & { children: React.ReactNode }) {
    return (
        <View className={cn("", className)} {...props}>
            {typeof props.children === 'string' ? <Text className="text-2xl font-semibold leading-none tracking-tight text-card-foreground">{props.children}</Text> : props.children}
        </View>
    );
}

export function CardDescription({ className, ...props }: ViewProps & { children: React.ReactNode }) {
    return (
        <View className={cn("", className)} {...props}>
            {typeof props.children === 'string' ? <Text className="text-sm text-muted-foreground">{props.children}</Text> : props.children}
        </View>
    );
}

export function CardContent({ className, ...props }: ViewProps) {
    return <View className={cn("p-6 pt-0", className)} {...props} />;
}

export function CardFooter({ className, ...props }: ViewProps) {
    return <View className={cn("flex-row items-center p-6 pt-0", className)} {...props} />;
}
