import { cn } from "@/lib/utils";
import { Loader } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";

const spinnerVariants = cva(
  "animate-spin text-primary",
  {
    variants: {
      size: {
        small: "h-4 w-4",
        medium: "h-6 w-6",
        large: "h-8 w-8",
      },
    },
    defaultVariants: {
      size: "medium",
    },
  }
);

interface SpinnerProps extends VariantProps<typeof spinnerVariants> {
  className?: string;
}

export const Spinner = ({ size, className }: SpinnerProps) => {
  return (
    <Loader className={cn(spinnerVariants({ size }), className)} />
  );
};
