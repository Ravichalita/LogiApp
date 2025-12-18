import { View, Text, ViewProps } from 'react-native';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface BadgeProps extends ViewProps {
    variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'info';
    children: React.ReactNode;
}

export function Badge({ className, variant = 'default', children, ...props }: BadgeProps) {
    const variants = {
        default: "bg-primary border-transparent",
        secondary: "bg-secondary border-transparent",
        destructive: "bg-destructive border-transparent",
        outline: "text-foreground border-border",
        success: "bg-green-500 border-transparent",
        warning: "bg-yellow-500 border-transparent",
        info: "bg-blue-500 border-transparent",
    };

    const textVariants = {
        default: "text-primary-foreground",
        secondary: "text-secondary-foreground",
        destructive: "text-destructive-foreground",
        outline: "text-foreground",
        success: "text-white",
        warning: "text-white",
        info: "text-white",
    };

    return (
        <View className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 transition-colors focus:ring-2 focus:ring-ring focus:ring-offset-2", variants[variant], className)} {...props}>
            {typeof children === 'string' ? (
                <Text className={cn("text-xs font-semibold", textVariants[variant])}>{children}</Text>
            ) : (
                children
            )}
        </View>
    );
}
