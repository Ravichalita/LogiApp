import { View, Text, ViewProps } from 'react-native';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface BadgeProps extends ViewProps {
    variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning';
    children: React.ReactNode;
}

export function Badge({ className, variant = 'default', children, ...props }: BadgeProps) {
    const variants = {
        default: "bg-blue-600 border-transparent",
        secondary: "bg-gray-100 border-transparent",
        destructive: "bg-red-500 border-transparent",
        outline: "text-gray-900 border-gray-200",
        success: "bg-green-500 border-transparent",
        warning: "bg-yellow-500 border-transparent",
    };

    const textVariants = {
        default: "text-white",
        secondary: "text-gray-900",
        destructive: "text-white",
        outline: "text-gray-900",
        success: "text-white",
        warning: "text-white",
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
