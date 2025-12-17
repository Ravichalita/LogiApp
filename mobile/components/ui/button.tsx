import { TouchableOpacity, Text, TouchableOpacityProps, ActivityIndicator } from 'react-native';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface ButtonProps extends TouchableOpacityProps {
    variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
    size?: 'default' | 'sm' | 'lg' | 'icon';
    loading?: boolean;
}

export function Button({ className, variant = 'default', size = 'default', loading, children, ...props }: ButtonProps) {
    const baseStyles = "flex-row items-center justify-center rounded-md disabled:opacity-50";

    const variants = {
        default: "bg-blue-600 active:bg-blue-700",
        destructive: "bg-red-500 active:bg-red-600",
        outline: "border border-gray-300 bg-transparent active:bg-gray-100",
        secondary: "bg-gray-100 active:bg-gray-200",
        ghost: "bg-transparent active:bg-gray-100",
        link: "bg-transparent underline-offset-4 active:underline",
    };

    const sizes = {
        default: "h-11 px-6 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-12 rounded-md px-8",
        icon: "h-10 w-10",
    };

    const textStyles = {
        default: "text-white font-medium",
        destructive: "text-white font-medium",
        outline: "text-gray-900 font-medium",
        secondary: "text-gray-900 font-medium",
        ghost: "text-gray-900 font-medium",
        link: "text-blue-600 font-medium",
    };

    return (
        <TouchableOpacity
            className={cn(baseStyles, variants[variant], sizes[size], className)}
            {...props}
            disabled={props.disabled || loading}
        >
            {loading ? (
                <ActivityIndicator color={variant === 'outline' || variant === 'ghost' ? '#000' : '#fff'} />
            ) : (
                typeof children === 'string' ? (
                    <Text className={textStyles[variant]}>{children}</Text>
                ) : (
                    children
                )
            )}
        </TouchableOpacity>
    );
}
