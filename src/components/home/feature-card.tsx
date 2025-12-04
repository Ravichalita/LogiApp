'use client';

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp } from "lucide-react";

interface FeatureCardProps {
    title: string;
    icon: React.ReactNode;
    summary: string;
    description: string;
}

export function FeatureCard({ title, icon, summary, description }: FeatureCardProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <div className="flex flex-col items-center space-y-4 text-center p-6 rounded-lg transition-all duration-300 hover:bg-muted/30">
            <div className="p-4 bg-primary/10 rounded-full transition-transform duration-300 hover:scale-110">
                {icon}
            </div>
            <h3 className="text-xl font-bold">{title}</h3>
            <p className="text-muted-foreground">
                {summary}
            </p>

            <div
                className={cn(
                    "grid transition-all duration-500 ease-in-out overflow-hidden text-sm text-muted-foreground/90 text-justify",
                    isExpanded ? "grid-rows-[1fr] opacity-100 mt-4" : "grid-rows-[0fr] opacity-0"
                )}
            >
                <div className="overflow-hidden">
                    <p className="leading-relaxed">
                        {description}
                    </p>
                </div>
            </div>

            <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                className="mt-2 group"
            >
                {isExpanded ? "Ler menos" : "Saiba mais"}
                {isExpanded ? (
                    <ChevronUp className="ml-2 h-4 w-4 transition-transform group-hover:-translate-y-1" />
                ) : (
                    <ChevronDown className="ml-2 h-4 w-4 transition-transform group-hover:translate-y-1" />
                )}
            </Button>
        </div>
    );
}
