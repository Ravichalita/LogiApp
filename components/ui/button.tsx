import { TouchableOpacity, Text, TouchableOpacityProps, ActivityIndicator } from 'react-native';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface ButtonProps extends TouchableOpacityProps {
    variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link' | 'selected' | 'nooutline';
    size?: 'default' | 'sm' | 'lg' | 'icon' | 'bigicon';
    loading?: boolean;
}

export function Button({ className, variant = 'default', size = 'default', loading, children, ...props }: ButtonProps) {
    const baseStyles = "flex-row items-center justify-center rounded-md disabled:opacity-50";

    const variants = {
        default: "bg-primary active:bg-primary/90",
        destructive: "bg-destructive active:bg-destructive/90",
        outline: "border border-input bg-card active:bg-accent",
        secondary: "bg-secondary active:bg-secondary/80",
        ghost: "bg-transparent active:bg-accent",
        link: "bg-transparent underline-offset-4 active:underline",
        selected: "bg-muted border-2 border-primary/50",
        nooutline: "bg-card active:bg-accent",
    };

    const sizes = {
        default: "h-11 px-6 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-12 rounded-md px-8",
        icon: "h-10 w-10",
        bigicon: "h-11 w-11",
    };

    const textStyles = {
        default: "text-primary-foreground font-medium",
        destructive: "text-destructive-foreground font-medium",
        outline: "text-foreground font-medium",
        secondary: "text-secondary-foreground font-medium",
        ghost: "text-foreground font-medium",
        link: "text-primary font-medium",
        selected: "text-foreground font-medium",
        nooutline: "text-accent-foreground font-medium",
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
