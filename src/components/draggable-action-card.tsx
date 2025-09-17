
'use client';

import React, { useState, useRef } from 'react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useIsMobile } from '@/hooks/use-mobile';


interface DraggableActionCardProps {
  children: React.ReactNode;
  actions: React.ReactNode;
}

export function DraggableActionCard({ children, actions }: DraggableActionCardProps) {
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const dragStartX = useRef(0);
  const thresholdReached = useRef(false);
  const isMobile = useIsMobile();

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('a, button, [role="button"], [role="link"]')) {
      return;
    }
    dragStartX.current = e.touches[0].clientX;
    setIsDragging(true);
    thresholdReached.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isDragging) return;

    let diffX = e.touches[0].clientX - dragStartX.current;
    if (diffX < 0) diffX = 0;

    const threshold = window.innerWidth * 0.25;

    if (diffX >= threshold && !thresholdReached.current) {
      if (navigator.vibrate) navigator.vibrate(50);
      thresholdReached.current = true;
    }

    setDragX(Math.min(diffX, window.innerWidth * 0.5));
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;

    setIsDragging(false);
    if (dragX >= window.innerWidth * 0.25) {
        if (isMobile) {
            setIsSheetOpen(true);
        } else {
            setIsDialogOpen(true);
        }
    }
    
    setDragX(0);
  };
  
  const ActionContent = () => (
    <div className="grid grid-cols-2 gap-4 py-4">
      {actions}
    </div>
  );

  return (
    <>
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ transform: `translateX(${dragX}px)` }}
        className={cn(
          'relative w-full',
          isDragging ? 'transition-none' : 'transition-transform duration-300 ease-out'
        )}
      >
        {children}
      </div>

      {isMobile ? (
         <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
            <SheetContent side="bottom" className="rounded-t-lg">
                <SheetHeader>
                    <SheetTitle>Ações Rápidas</SheetTitle>
                </SheetHeader>
                <ActionContent />
            </SheetContent>
         </Sheet>
      ) : (
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md rounded-lg">
              <DialogHeader>
                <DialogTitle>Ações Rápidas</DialogTitle>
              </DialogHeader>
              <ActionContent />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
