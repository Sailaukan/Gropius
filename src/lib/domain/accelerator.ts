// The capture shortcut is stored as a Tauri accelerator ("Alt+Shift+Space"); Glaze's Kbd reads "alt+shift+space".

const modifiers: Record<string, string> = {
  commandorcontrol: 'mod', cmdorctrl: 'mod', command: 'mod', cmd: 'mod', super: 'mod', meta: 'mod',
  control: 'ctrl', ctrl: 'ctrl', alt: 'alt', option: 'alt', shift: 'shift',
};

export function acceleratorKeys(accelerator: string): string {
  return accelerator.split('+').map(part => modifiers[part.toLowerCase()] ?? part.toLowerCase()).join('+');
}

/** Turns a key press into an accelerator, or null while only modifiers are down or none is held. */
export function acceleratorFromEvent(event: KeyboardEvent): string | null {
  const parts: string[] = [];
  if (event.metaKey) parts.push('CommandOrControl');
  if (event.ctrlKey) parts.push('Control');
  if (event.altKey) parts.push('Alt');
  if (event.shiftKey) parts.push('Shift');
  const code = event.code;
  let key: string | null = null;
  if (/^Key[A-Z]$/.test(code)) key = code.slice(3);
  else if (/^Digit[0-9]$/.test(code)) key = code.slice(5);
  else if (/^F([1-9]|1[0-9]|2[0-4])$/.test(code)) key = code;
  else if (['Space', 'Enter', 'Tab', 'Backspace', 'Escape', 'Comma', 'Period', 'Slash', 'Semicolon', 'Quote', 'BracketLeft', 'BracketRight', 'Backquote', 'Minus', 'Equal'].includes(code)) key = code;
  else if (code.startsWith('Arrow')) key = code.slice(5);
  // A global shortcut needs at least one modifier, or it would swallow plain typing in every app.
  if (!key || parts.length === 0 || (parts.length === 1 && parts[0] === 'Shift')) return null;
  return [...parts, key].join('+');
}
