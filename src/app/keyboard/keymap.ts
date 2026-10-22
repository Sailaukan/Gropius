// Every shortcut, once: the handlers, the key hints and the Shortcuts tab all read this list.

export interface Shortcut {
  keys: string;
  label: string;
}

export interface ShortcutGroup {
  title: string;
  shortcuts: Shortcut[];
}

export const KEYMAP: ShortcutGroup[] = [
  {
    title: 'Anywhere',
    shortcuts: [
      {keys: 'mod+k', label: 'Search tasks and commands'},
      {keys: 'c', label: 'Create a task'},
      {keys: 'mod+n', label: 'Create a task'},
      {keys: '/', label: 'Search the board'},
      {keys: 'mod+1', label: 'Go to Inbox'},
      {keys: 'mod+2', label: 'Go to Today'},
      {keys: 'mod+3', label: 'Go to Board'},
      {keys: 'mod+4', label: 'Go to Weekly review'},
      {keys: 'mod+5', label: 'Go to Projects'},
      {keys: '[', label: 'Show or hide the sidebar'},
      {keys: 'mod+z', label: 'Undo the last change'},
      {keys: 'mod+,', label: 'Open settings'},
    ],
  },
  {
    title: 'On a task',
    shortcuts: [
      {keys: 'j', label: 'Next task'},
      {keys: 'k', label: 'Previous task'},
      {keys: 'left', label: 'Task in the column to the left'},
      {keys: 'right', label: 'Task in the column to the right'},
      {keys: 'enter', label: 'Open the task'},
      {keys: 'esc', label: 'Close the task'},
      {keys: '1', label: 'Move to Backlog'},
      {keys: '2', label: 'Move to Todo'},
      {keys: '3', label: 'Move to In progress'},
      {keys: '4', label: 'Move to Done'},
      {keys: '5', label: 'Move to Cancelled'},
      {keys: 't', label: 'Start or pause focus'},
      {keys: 'backspace', label: 'Delete the task'},
      {keys: 'shift+mod+c', label: 'Copy the task ID'},
    ],
  },
  {
    title: 'Moving a card',
    shortcuts: [
      {keys: 'space', label: 'Pick up or drop the card'},
      {keys: 'down', label: 'Move it within a column'},
      {keys: 'right', label: 'Move it to the next column'},
      {keys: 'esc', label: 'Put it back'},
    ],
  },
  {
    title: 'In a dialog',
    shortcuts: [{keys: 'mod+enter', label: 'Create the task'}],
  },
];
