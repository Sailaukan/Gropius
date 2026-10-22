// Development only: `VITE_SELF_TEST=1 npm run tauri dev` runs this inside the real app against the real Rust side and
// database, and writes each check to the app's log. It cleans up what it makes.

import {commands} from '@/lib/tauri/commands';
import {createTask, deleteTask, moveTask, timer, updateSettings, updateTask} from '@/lib/store/actions';
import {useData} from '@/lib/store/data';

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function runSelfTest() {
  const results: string[] = [];
  const check = (name: string, ok: boolean, detail = '') => results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? `: ${detail}` : ''}`);
  const data = () => useData.getState();
  try {
    check('bootstrap loaded settings', data().settings !== null, `theme ${data().settings?.theme}`);

    const created = await createTask({title: 'Self test: book the car service', status: 'todo', priority: 2, processed: true});
    check('create task', Boolean(created), created ? `GRP-${created.seq}` : '');
    if (!created) throw new Error('no task');

    const captured = await commands.createTask({title: 'Self test: captured', processed: false});
    await wait(200);
    check('capture lands in the inbox via the event', data().tasks[captured.id]?.processedAt === null && data().tasks[captured.id]?.status === 'backlog');

    await updateTask(created.id, {dueDate: '2026-10-24', contextIds: [data().contexts[0].id]});
    check('update due date and context', data().tasks[created.id]?.dueDate === '2026-10-24' && data().tasks[created.id]?.contextIds.length === 1);

    await moveTask(created.id, 'done', null, null);
    check('move to Done stamps completedAt', data().tasks[created.id]?.completedAt !== null);
    await moveTask(created.id, 'in_progress', null, null);
    check('move out of Done clears it', data().tasks[created.id]?.completedAt === null && data().tasks[created.id]?.startedAt !== null);

    const before = data().settings!.focusMinutes;
    await updateSettings({focusMinutes: 30});
    check('settings save', data().settings?.focusMinutes === 30);
    await updateSettings({focusMinutes: before});

    await timer.start(created.id);
    await wait(300);
    const running = data().pomodoro;
    check('timer starts on the task', running?.status === 'running' && running.task?.id === created.id, `${running?.status} ${running?.remainingMs}ms`);
    await commands.log('self-test timer running for 5s');
    await wait(5000);
    await timer.pause();
    await wait(200);
    check('timer pauses', data().pomodoro?.status === 'paused');
    await timer.resume();
    await wait(200);
    check('timer resumes', data().pomodoro?.status === 'running');
    await timer.reset();
    await wait(200);
    check('timer resets', data().pomodoro?.status === 'idle' && data().pomodoro?.phase === 'focus');

    const sessions = await commands.taskSessions(created.id);
    check('the stopped session is recorded', sessions.length === 1 && !sessions[0].completed);

    await deleteTask(created.id);
    await commands.deleteTask(captured.id);
    await wait(200);
    check('delete removes them from the board', !data().tasks[created.id] && !data().tasks[captured.id]);
  } catch (error) {
    check('self test ran to the end', false, String(error));
  }
  for (const line of results) await commands.log(`self-test ${line}`);
}
