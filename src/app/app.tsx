import {Toaster} from '@/components/glaze/ui/toast';
import {TooltipProvider} from '@/components/glaze/ui/tooltip';
import {GlazePortalProvider} from '@/lib/glaze/portal';
import {useSettings} from '@/lib/store/data';
import {useUi, type View} from '@/lib/store/ui';
import {BoardView} from './board/board-view';
import {CommandPalette} from './command/command-palette';
import {InboxView} from './inbox/inbox-view';
import {useHotkeys} from './keyboard/use-hotkeys';
import {NewProjectDialog} from './projects/new-project-dialog';
import {ProjectsView} from './projects/projects-view';
import {ReviewView} from './review/review-view';
import {SettingsDialog} from './settings/settings-dialog';
import {Sidebar} from './shell/sidebar';
import {NewTaskDialog} from './task/new-task-dialog';
import {TaskSheet} from './task/task-sheet';
import {TodayView} from './today/today-view';

const views: Record<View, () => React.ReactNode> = {
  inbox: InboxView,
  today: TodayView,
  board: BoardView,
  review: ReviewView,
  projects: ProjectsView,
};

export function App() {
  useHotkeys();
  const collapsed = useSettings().sidebarCollapsed;
  const view = useUi(s => s.view);
  const Current = views[view];

  return <GlazePortalProvider>
    <TooltipProvider>
      <div className="flex h-dvh min-h-0 bg-page text-text-1">
        {!collapsed && <Sidebar/>}
        <main className="flex min-w-0 flex-1 flex-col">
          <Current/>
        </main>
        <TaskSheet/>
      </div>
      <NewTaskDialog/>
      <NewProjectDialog/>
      <SettingsDialog/>
      <CommandPalette/>
      <Toaster/>
    </TooltipProvider>
  </GlazePortalProvider>;
}
