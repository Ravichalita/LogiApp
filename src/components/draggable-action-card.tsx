
'use client';

import React, { useState, useRef } from 'react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface DraggableActionCardProps {
  children: React.ReactNode;
  actions: React.ReactNode;
}

export function DraggableActionCard({ children, actions }: DraggableActionCardProps) {
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const dragStartX = useRef(0);
  const thresholdReached = useRef(false);

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    // Allow dragging unless the target is an interactive element like a link or button
    if (target.closest('a, button, [role="button"], [role="link"]')) {
      return;
    }
    dragStartX.current = e.touches[0].clientX;
    setIsDragging(true);
    thresholdReached.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isDragging) return;

    const currentX = e.touches[0].clientX;
    let diffX = currentX - dragStartX.current;

    // Restrict dragging from right to left
    if (diffX < 0) {
      diffX = 0;
    }

    const screenWidth = window.innerWidth;
    const threshold = screenWidth * 0.25;

    // Vibrate when threshold is met, but only once per drag
    if (diffX >= threshold && !thresholdReached.current) {
      if (navigator.vibrate) {
        navigator.vibrate(50); // Vibrate for 50ms
      }
      thresholdReached.current = true;
    }

    // Limit drag distance to avoid card going too far
    setDragX(Math.min(diffX, screenWidth * 0.5));
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;

    setIsDragging(false);
    const screenWidth = window.innerWidth;
    const threshold = screenWidth * 0.25;

    if (dragX >= threshold) {
      setIsDialogOpen(true);
    }
    
    // Animate back to original position
    setDragX(0);
  };
  
  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
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
       <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md rounded-lg">
          <DialogHeader>
            <DialogTitle>Ações Rápidas</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
              {actions}
          </div>
       </DialogContent>
    </Dialog>
  );
}
