import {Dialog, DialogBody, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle} from '@/components/glaze/ui/dialog';
import {Tabs, TabsContent, TabsList, TabsTrigger} from '@/components/glaze/ui/tabs';
import {useUi, type SettingsTab} from '@/lib/store/ui';
import {BoardTab} from './board-tab';
import {ContextsTab} from './contexts-tab';
import {GeneralTab} from './general-tab';
import {PomodoroTab} from './pomodoro-tab';
import {ShortcutsTab} from './shortcuts-tab';

export function SettingsDialog() {
  const {open, tab} = useUi(s => s.settings);
  const close = useUi(s => s.closeSettings);
  const setTab = useUi(s => s.setSettingsTab);

  return <Dialog open={open} onOpenChange={next => { if (!next) close(); }}>
    <DialogContent size="lg" className="h-[min(42rem,calc(100dvh-var(--space-10)))]">
      <DialogHeader><DialogTitle>Settings</DialogTitle></DialogHeader>
      <Tabs value={tab} onValueChange={value => setTab(value as SettingsTab)} className="flex min-h-0 flex-1 flex-col">
        <div className="px-4"><TabsList aria-label="Settings">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="board">Board</TabsTrigger>
          <TabsTrigger value="pomodoro">Pomodoro</TabsTrigger>
          <TabsTrigger value="contexts">Contexts</TabsTrigger>
          <TabsTrigger value="shortcuts">Shortcuts</TabsTrigger>
        </TabsList></div>
        <DialogBody>
          <TabsContent value="general" keepMounted><GeneralTab/></TabsContent>
          <TabsContent value="board" keepMounted><BoardTab/></TabsContent>
          <TabsContent value="pomodoro" keepMounted><PomodoroTab/></TabsContent>
          <TabsContent value="contexts" keepMounted><ContextsTab/></TabsContent>
          <TabsContent value="shortcuts"><ShortcutsTab/></TabsContent>
        </DialogBody>
      </Tabs>
      <DialogFooter meta="Changes save as you make them." defaultAction="dismiss">
        <DialogClose>Close</DialogClose>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
