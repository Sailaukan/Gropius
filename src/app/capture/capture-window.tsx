import {listen} from '@tauri-apps/api/event';
import {useEffect, useRef, useState} from 'react';
import {GlazePortalProvider} from '@/lib/glaze/portal';
import {Input} from '@/components/glaze/ui/input';
import {Kbd} from '@/components/glaze/ui/kbd';
import {taskKey} from '@/lib/domain/status';
import {commands} from '@/lib/tauri/commands';

/**
 * The quick capture box the global shortcut opens over any app. GTD's first step: get it out of your head in a few
 * seconds and decide later. Everything lands in the Inbox.
 */
export function CaptureWindow() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    inputRef.current?.focus();
    const shown = listen('capture:shown', () => {
      setNote(null);
      setFailed(false);
      inputRef.current?.focus();
    });
    return () => void shown.then(stop => stop());
  }, []);

  const save = async (keepOpen: boolean) => {
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      const task = await commands.createTask({title, status: 'backlog', processed: false});
      setTitle('');
      setFailed(false);
      if (keepOpen) setNote(`Saved ${taskKey(task.seq)} to Inbox.`);
      else await commands.dismissCapture();
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  // The window is larger than the box, to leave room for its shadow (index.css). A press in that clear margin counts as
  // a click away: the box closes and keeps the draft.
  return <GlazePortalProvider>
    <div className="flex h-dvh px-8 pt-6 pb-12" onPointerDown={event => { if (event.target === event.currentTarget) void commands.dismissCapture(); }}>
      <div data-capture-box className="overlay flex flex-1 flex-col justify-center gap-2 overflow-hidden p-3">
        <Input
          ref={inputRef}
          size="lg"
          shape="box"
          aria-label="Capture a task"
          aria-invalid={failed || undefined}
          placeholder="Call Dana about the lease"
          value={title}
          onChange={event => { setTitle(event.target.value); setNote(null); }}
          onKeyDown={event => {
            if (event.nativeEvent.isComposing) return;
            if (event.key === 'Enter') {
              event.preventDefault();
              void save(event.shiftKey);
            } else if (event.key === 'Escape') {
              event.preventDefault();
              setTitle('');
              void commands.dismissCapture();
            }
          }}
          trailing={<Kbd keys="enter"/>}
        />
        <p role="status" className={`px-3 text-center type-caption ${failed ? 'text-fail-text' : 'text-text-2'}`}>
          {failed ? "Couldn't save. Press Enter to try again." : note ?? 'Saves to Inbox. Shift and Enter saves and keeps this open.'}
        </p>
      </div>
    </div>
  </GlazePortalProvider>;
}
