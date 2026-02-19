import { ReactNode } from "react";
import { DndContext, DragEndEvent, closestCenter } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";

interface DndWrapperProps {
  children: ReactNode;
  items: string[];
  onDragEnd: (event: DragEndEvent) => void;
}

/**
 * Wrapper component for drag-and-drop functionality
 * Lazy loaded only for admin users to reduce bundle size for regular visitors
 */
export const DndWrapper = ({ children, items, onDragEnd }: DndWrapperProps) => {
  return (
    <DndContext collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={items} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
};

export default DndWrapper;
