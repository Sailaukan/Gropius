import type {ReactNode} from 'react';
import {Sidebar} from '@/components/glaze/icon';
import {updateSettings} from '@/lib/store/actions';
import {useSettings} from '@/lib/store/data';
import {IconButton} from '@/app/ui/icon-button';
import {TimerPill} from './timer-pill';

/**
 * The bar across the top of a view: its title, the focus timer while a session runs, and the view's own actions. It
 * doubles as the window's title bar, so it drags the window, and it leaves room for the traffic lights when the
 * sidebar is hidden.
 */
export function ViewHeader({title, actions}: {title: string; actions?: ReactNode}) {
  const collapsed = useSettings().sidebarCollapsed;
  return <header
    data-tauri-drag-region="deep"
    className={`flex h-13 shrink-0 items-center gap-2 border-b border-line-faint pe-4 ${collapsed ? 'ps-22' : 'ps-5'}`}
  >
    {collapsed && <IconButton label="Show sidebar" icon={Sidebar} shortcut={['[']} onClick={() => void updateSettings({sidebarCollapsed: false})}/>}
    <h1 className="min-w-0 truncate type-heading-sm">{title}</h1>
    <div className="ms-auto flex shrink-0 items-center gap-2">
      <TimerPill/>
      {actions}
    </div>
  </header>;
}
