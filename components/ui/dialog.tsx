import React from 'react';
import { Modal, View, Text, TouchableOpacity, TouchableWithoutFeedback, ViewProps } from 'react-native';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface DialogProps {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    children: React.ReactNode;
}

export function Dialog({ open, onOpenChange, children }: DialogProps) {
    return (
        <React.Fragment>
            {React.Children.map(children, child => {
                if (React.isValidElement(child)) {
                    // @ts-ignore
                    return React.cloneElement(child, { open, onOpenChange });
                }
                return child;
            })}
        </React.Fragment>
    );
}

export function DialogTrigger({ children, asChild, onPress, ...props }: any) {
    // In a real implementation, we'd handle the trigger logic here.
    // For now, we assume the parent controls the state or the user passes an onPress.
    const Comp = asChild ? React.Fragment : TouchableOpacity;
    return (
        <Comp {...props} onPress={onPress}>
            {children}
        </Comp>
    );
}

export function DialogContent({ className, children, open, onOpenChange, ...props }: ViewProps & { open?: boolean, onOpenChange?: (open: boolean) => void }) {
    if (!open) return null;

    return (
        <Modal
            transparent
            visible={open}
            animationType="fade"
            onRequestClose={() => onOpenChange?.(false)}
        >
            <TouchableWithoutFeedback onPress={() => onOpenChange?.(false)}>
                <View className="flex-1 bg-black/50 justify-center items-center p-4">
                    <TouchableWithoutFeedback>
                        <View className={cn("bg-background rounded-lg border border-border shadow-lg w-full max-w-lg p-6", className)} {...props}>
                            {children}
                        </View>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
}

export function DialogHeader({ className, ...props }: ViewProps) {
    return (
        <View className={cn("flex flex-col space-y-1.5 text-center sm:text-left mb-4", className)} {...props} />
    );
}

export function DialogFooter({ className, ...props }: ViewProps) {
    return (
        <View className={cn("flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)} {...props} />
    );
}

export function DialogTitle({ className, ...props }: ViewProps & { children: React.ReactNode }) {
    return (
        <View className={cn("", className)} {...props}>
            {typeof props.children === 'string' ? <Text className="text-lg font-semibold leading-none tracking-tight text-foreground">{props.children}</Text> : props.children}
        </View>
    );
}

export function DialogDescription({ className, ...props }: ViewProps & { children: React.ReactNode }) {
    return (
        <View className={cn("", className)} {...props}>
            {typeof props.children === 'string' ? <Text className="text-sm text-muted-foreground">{props.children}</Text> : props.children}
        </View>
    );
}
