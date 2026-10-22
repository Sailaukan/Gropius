import {useEffect} from 'react';
import {STATUSES} from '@/lib/domain/status';
import {copyTaskKey, deleteTask, toggleFocus, undoLast, updateSettings, updateTask} from '@/lib/store/actions';
import {getSettings, useData} from '@/lib/store/data';
import {closeTask, navigate, useUi, VIEWS} from '@/lib/store/ui';
import {keyboardDrag} from '@/app/board/dnd';

/** Typing in a field, or a menu or dialog is open: single-key shortcuts stand down. */
function busy(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (el?.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"], [role=combobox]')) return true;
  return Boolean(document.querySelector('[role=dialog], [role=alertdialog], [role=menu], [role=listbox]'));
}

/** The task the keys act on: the focused card or row, else the one open in the sheet. */
function targetTask(): number | null {
  const link = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>('[data-task-id]');
  if (link) return Number(link.dataset.taskId);
  return useUi.getState().task;
}

function taskLinks(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('main [data-task-id][data-task-link]')];
}

/** Moves focus between task links: up and down within a column or list, left and right across columns. */
function moveFocus(direction: 'up' | 'down' | 'left' | 'right') {
  const links = taskLinks();
  if (!links.length) return;
  const current = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>('[data-task-link]');
  if (!current) {
    links[0].focus();
    return;
  }
  const column = current.dataset.column;
  const sameColumn = links.filter(l => l.dataset.column === column);
  const index = sameColumn.indexOf(current);
  let next: HTMLElement | undefined;
  if (direction === 'up' || direction === 'down') {
    next = sameColumn[index + (direction === 'down' ? 1 : -1)];
  } else {
    const columns = [...new Set(links.map(l => l.dataset.column))];
    const target = columns[columns.indexOf(column) + (direction === 'right' ? 1 : -1)];
    const targetLinks = links.filter(l => l.dataset.column === target);
    next = targetLinks[Math.min(index, targetLinks.length - 1)];
  }
  if (!next) return;
  next.focus();
  next.scrollIntoView({block: 'nearest', inline: 'nearest'});
  // The sheet follows the focus, as Linear's peek does.
  if (useUi.getState().task !== null) navigate(useUi.getState().view, Number(next.dataset.taskId));
}

export function useHotkeys() {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (keyboardDrag.active) return;
      const mod = event.metaKey || event.ctrlKey;
      const ui = useUi.getState();
      const key = event.key.toLowerCase();

      // With ⌘: these work even while typing, except where a field owns the key.
      if (mod && !event.altKey) {
        if (key === 'k') {
          event.preventDefault();
          // The palette offers actions on the task that had focus when it opened.
          if (!ui.paletteOpen) ui.focusTask(targetTask());
          ui.setPaletteOpen(!ui.paletteOpen);
          return;
        }
        if (key === ',') {
          event.preventDefault();
          ui.openSettings();
          return;
        }
        if (busy(event.target)) return;
        if (key === 'n') {
          event.preventDefault();
          ui.openNewTask();
        } else if (/^[1-5]$/.test(key)) {
          event.preventDefault();
          navigate(VIEWS[Number(key) - 1]);
        } else if (key === 'z' && !event.shiftKey) {
          event.preventDefault();
          void undoLast();
        } else if (key === 'c' && event.shiftKey) {
          const id = targetTask();
          if (id) {
            event.preventDefault();
            void copyTaskKey(id);
          }
        }
        return;
      }
      if (event.altKey || busy(event.target)) return;

      const id = targetTask();
      switch (key) {
        case 'c':
          event.preventDefault();
          ui.openNewTask();
          return;
        case '[':
          event.preventDefault();
          void updateSettings({sidebarCollapsed: !getSettings().sidebarCollapsed});
          return;
        case 'j':
        case 'arrowdown':
          event.preventDefault();
          moveFocus('down');
          return;
        case 'k':
        case 'arrowup':
          event.preventDefault();
          moveFocus('up');
          return;
        case 'arrowleft':
        case 'arrowright':
          if (!(document.activeElement as HTMLElement | null)?.closest('[data-task-link]')) return;
          event.preventDefault();
          moveFocus(key === 'arrowleft' ? 'left' : 'right');
          return;
        case 'escape':
          if (ui.task !== null) {
            event.preventDefault();
            closeTask();
          }
          return;
      }
      if (id === null || !useData.getState().tasks[id]) return;
      if (/^[1-5]$/.test(key)) {
        event.preventDefault();
        void updateTask(id, {status: STATUSES[Number(key) - 1]});
      } else if (key === 't') {
        event.preventDefault();
        void toggleFocus(id);
      } else if (key === 'backspace' || key === 'delete') {
        event.preventDefault();
        void deleteTask(id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
