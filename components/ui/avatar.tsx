import { View, Image, Text, ViewProps } from 'react-native';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface AvatarProps extends ViewProps {
    src?: string | null;
    fallback?: string;
    alt?: string;
}

export function Avatar({ className, src, fallback = '?', alt, ...props }: AvatarProps) {
    return (
        <View className={cn("relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full bg-gray-100 items-center justify-center", className)} {...props}>
            {src ? (
                <Image
                    source={{ uri: src }}
                    className="aspect-square h-full w-full"
                    alt={alt}
                />
            ) : (
                <Text className="text-gray-500 font-medium">{fallback}</Text>
            )}
        </View>
    );
}
