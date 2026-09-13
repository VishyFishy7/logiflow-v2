'use client';

/**
 * Registry: KanbanBoard — props-driven reusable board (PRD §14.5).
 *
 * Converts the original registry demo (hardcoded sampleData) into a generic,
 * data-driven board. Keyboard/touch users can move cards via a status-change
 * dropdown because native drag-and-drop does not work on touch devices.
 *
 * No new dependencies — uses Card, Badge, Button, DropdownMenu, Skeleton.
 */
import { useCallback, useRef, useState } from 'react';
import { GripVertical, MoreHorizontal } from 'lucide-react';

import { Badge } from '@/components/spectrumui/badge';
import { Card, CardContent } from '@/components/spectrumui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/spectrumui/dropdown-menu';
import { Skeleton } from '@/components/spectrumui/skeleton';
import { cn } from '@/lib/utils';

// ── Types ──────────────────────────────────────────────────────────────────

export interface KanbanColumn<T = Record<string, unknown>> {
  /** Unique key — typically a status value like "new". */
  id: string;
  /** Display label for the column header. */
  title: string;
  /** Items in this column. */
  items: T[];
  /** Dot colour for the column header. */
  color?: string;
}

export interface KanbanBoardProps<T = Record<string, unknown>> {
  /** Ordered list of columns to render. */
  columns: KanbanColumn<T>[];
  /**
   * Render each card. `onMove` is passed so the card can offer a status
   * change (dropdown or drag).
   */
  renderCard: (item: T, ctx: { onMove: (toColumnId: string) => void }) => React.ReactNode;
  /**
   * Called when an item is moved (via drag or dropdown) to a different column.
   * The caller should persist the change.
   */
  onMove?: (itemId: string, toColumnId: string) => void;
  /** True while data is being fetched. Renders skeleton columns. */
  loading?: boolean;
  /** Content to render inside an empty column. */
  emptyState?: React.ReactNode;
  /** Extra classes on the root. */
  className?: string;
  /**
   * Map column IDs to labels for the move dropdown shown on touch/keyboard.
   * Required when `onMove` is provided — enables the accessible move path.
   */
  moveLabelMap?: Record<string, string>;
}

// ── Internal: card move dropdown ────────────────────────────────────────────

function CardMoveDropdown({
  currentColumnId,
  columns,
  moveLabelMap,
  onMove,
}: {
  currentColumnId: string;
  columns: KanbanColumn[];
  moveLabelMap: Record<string, string> | undefined;
  onMove: (toColumnId: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-md text-sm font-medium h-7 w-7 shrink-0 text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            aria-label="Move card"
          />
        }
      >
        <MoreHorizontal className="size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {columns
          .filter((col) => col.id !== currentColumnId)
          .map((col) => (
            <DropdownMenuItem
              key={col.id}
              onClick={(e) => {
                e.stopPropagation();
                onMove(col.id);
              }}
            >
              <span
                className="inline-block size-2 shrink-0 rounded-full"
                style={{ backgroundColor: col.color }}
                aria-hidden
              />
              {moveLabelMap?.[col.id] ?? col.title}
            </DropdownMenuItem>
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ── Internal: skeleton columns ──────────────────────────────────────────────

function KanbanSkeleton({ columns }: { columns: KanbanColumn[] }) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {columns.map((col) => (
        <div
          key={col.id}
          className="flex min-w-[260px] shrink-0 flex-col gap-3 rounded-2xl border border-border/60 bg-card/50 p-4"
        >
          <div className="flex items-center gap-2">
            <Skeleton className="size-3 rounded-full" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="ml-auto h-5 w-7 rounded-full" />
          </div>
          <div className="space-y-3">
            <Skeleton className="h-28 rounded-xl" />
            <Skeleton className="h-28 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main: KanbanBoard ──────────────────────────────────────────────────────

export function KanbanBoard<T extends { id: string }>({
  columns,
  renderCard,
  onMove,
  loading = false,
  emptyState,
  className,
  moveLabelMap,
}: KanbanBoardProps<T>) {
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const dragDataRef = useRef<{ itemId: string; sourceColumnId: string } | null>(null);

  // ── drag handlers (desktop HTML5) ───────────────────────────────────────
  const handleDragStart = useCallback(
    (e: React.DragEvent, item: T, columnId: string) => {
      if (!onMove) return;
      dragDataRef.current = { itemId: item.id, sourceColumnId: columnId };
      e.dataTransfer.effectAllowed = 'move';
      // IE / legacy fallback
      e.dataTransfer.setData('text/plain', item.id);
    },
    [onMove],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDragEnter = useCallback(
    (e: React.DragEvent, columnId: string) => {
      e.preventDefault();
      setDragOverColumn(columnId);
    },
    [],
  );

  const handleDragLeave = useCallback(() => {
    setDragOverColumn(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, targetColumnId: string) => {
      e.preventDefault();
      setDragOverColumn(null);
      const data = dragDataRef.current;
      if (!data || data.sourceColumnId === targetColumnId || !onMove) return;
      onMove(data.itemId, targetColumnId);
      dragDataRef.current = null;
    },
    [onMove],
  );

  const handleDragEnd = useCallback(() => {
    dragDataRef.current = null;
    setDragOverColumn(null);
  }, []);

  // ── skeleton state ──────────────────────────────────────────────────────
  if (loading) {
    return <KanbanSkeleton columns={columns} />;
  }

  return (
    <div
      className={cn(
        'flex gap-4 overflow-x-auto pb-2',
        className,
      )}
    >
      {columns.map((column) => {
        const isOver = dragOverColumn === column.id;
        return (
          <div
            key={column.id}
            className={cn(
              'flex min-w-[260px] shrink-0 flex-col gap-3 rounded-2xl border bg-card/50 p-4 transition-colors duration-150',
              isOver
                ? 'border-primary/40 bg-primary/5'
                : 'border-border/60',
            )}
            onDragOver={handleDragOver}
            onDragEnter={(e) => handleDragEnter(e, column.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, column.id)}
          >
            {/* Column header */}
            <div className="flex items-center gap-2.5">
              {column.color && (
                <span
                  className="inline-block size-3 shrink-0 rounded-full"
                  style={{ backgroundColor: column.color }}
                  aria-hidden
                />
              )}
              <h3 className="text-sm font-medium">{column.title}</h3>
              <Badge
                variant="secondary"
                className="ml-auto px-1.5 py-0 text-[11px] tabular-nums"
              >
                {column.items.length}
              </Badge>
            </div>

            {/* Cards */}
            {column.items.length === 0 ? (
              <div className="flex min-h-[80px] items-center justify-center rounded-xl border border-dashed border-border/60 text-[13px] text-muted-foreground">
                {emptyState ?? 'No items'}
              </div>
            ) : (
              <div className="space-y-2.5">
                {column.items.map((item) => (
                  <Card
                    key={item.id}
                    className={cn(
                      'group cursor-grab transition-all duration-150 border border-border/60 hover:border-border active:cursor-grabbing',
                      onMove && 'active:scale-[0.98]',
                    )}
                    draggable={!!onMove}
                    onDragStart={(e) => handleDragStart(e, item, column.id)}
                    onDragEnd={handleDragEnd}
                  >
                    <CardContent className="flex items-start gap-2 p-3.5">
                      {onMove && (
                        <GripVertical className="mt-0.5 size-4 shrink-0 text-muted-foreground/50 group-hover:text-muted-foreground" />
                      )}
                      <div className="min-w-0 flex-1">
                        {renderCard(item, {
                          onMove: (toColumnId) => {
                            if (onMove) onMove(item.id, toColumnId);
                          },
                        })}
                      </div>
                      {onMove && (
                        <CardMoveDropdown
                          currentColumnId={column.id}
                          columns={columns}
                          moveLabelMap={moveLabelMap}
                          onMove={(toColumnId) => onMove(item.id, toColumnId)}
                        />
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Group an array of items by a key function — the standard pattern for
 * populating KanbanBoard columns from a flat query result.
 */
export function groupBy<T, K extends string | number>(
  items: T[],
  keyFn: (item: T) => K,
): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    let arr = map.get(key);
    if (!arr) {
      arr = [];
      map.set(key, arr);
    }
    arr.push(item);
  }
  return map;
}
