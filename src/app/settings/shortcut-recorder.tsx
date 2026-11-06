import {useEffect, useState} from 'react';
import {Button} from '@/components/glaze/ui/button';
import {Field, FieldContent, FieldDescription, FieldError, FieldLabel} from '@/components/glaze/ui/field';
import {Kbd} from '@/components/glaze/ui/kbd';
import {acceleratorFromEvent, acceleratorKeys} from '@/lib/domain/accelerator';
import {commands, errorText} from '@/lib/tauri/commands';
import {useData, useSettings} from '@/lib/store/data';

/** The global quick capture shortcut: press Change shortcut, then the new keys. macOS has the last word on whether it is free. */
export function ShortcutRecorder() {
  const {captureShortcut} = useSettings();
  const [recording, setRecording] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!recording) return;
    const onKey = async (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.key === 'Escape' && !event.metaKey && !event.altKey && !event.ctrlKey && !event.shiftKey) {
        setRecording(false);
        return;
      }
      const accelerator = acceleratorFromEvent(event);
      if (!accelerator) return;
      setRecording(false);
      setSaving(true);
      try {
        useData.getState().setSettings(await commands.updateSettings({captureShortcut: accelerator}));
        setError(null);
      } catch (e) {
        setError(errorText(e));
      } finally {
        setSaving(false);
      }
    };
    // Capture phase, so the keys never reach the dialog or the app's own shortcuts.
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [recording]);

  return <Field orientation="horizontal" invalid={error !== null}>
    <FieldContent>
      <FieldLabel>Quick capture</FieldLabel>
      <FieldDescription>
        {recording
          ? 'Press the new shortcut, with ⌘, ⌥ or ⌃. Esc keeps the old one.'
          : <>Opens the capture box from any app: <Kbd keys={acceleratorKeys(captureShortcut)}/></>}
      </FieldDescription>
      {error && <FieldError>{error}</FieldError>}
    </FieldContent>
    <Button
      variant="secondary"
      size="sm"
      pending={saving}
      pendingLabel="Saving"
      aria-pressed={recording}
      onClick={() => { setError(null); setRecording(r => !r); }}
    >
      {recording ? 'Cancel' : 'Change shortcut'}
    </Button>
  </Field>;
}
