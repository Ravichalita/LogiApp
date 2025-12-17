import { View, ViewProps } from 'react-native';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface SeparatorProps extends ViewProps {
    orientation?: 'horizontal' | 'vertical';
}

export function Separator({ className, orientation = 'horizontal', ...props }: SeparatorProps) {
    return (
        <View
            className={cn(
                "bg-gray-200 shrink-0",
                orientation === 'horizontal' ? "h-[1px] w-full" : "h-full w-[1px]",
                className
            )}
            {...props}
        />
    );
}
