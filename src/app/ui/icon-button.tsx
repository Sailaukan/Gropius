import {Button, type ButtonProps} from '@/components/glaze/ui/button';
import {Icon, type GlazeIcon} from '@/components/glaze/icon';
import {Tooltip, TooltipContent, TooltipTrigger} from '@/components/glaze/ui/tooltip';

type IconButtonProps = Omit<ButtonProps, 'children' | 'size' | 'variant'> & {
  /** The tooltip, which also names the button: a verb and its object. */
  label: string;
  icon: GlazeIcon;
  shortcut?: string[];
};

/** A ghost icon button named by its tooltip. */
export function IconButton({label, icon, shortcut, ...props}: IconButtonProps) {
  return <Tooltip>
    <TooltipTrigger render={<Button variant="ghost" size="icon-sm" {...props}/>}>
      <Icon icon={icon}/>
    </TooltipTrigger>
    <TooltipContent shortcut={shortcut}>{label}</TooltipContent>
  </Tooltip>;
}
