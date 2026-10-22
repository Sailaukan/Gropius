import {useState} from 'react';
import {
  Dialog, DialogAction, DialogBody, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/glaze/ui/dialog';
import {Field, FieldLabel} from '@/components/glaze/ui/field';
import {Input} from '@/components/glaze/ui/input';
import {Textarea} from '@/components/glaze/ui/textarea';
import type {Project} from '@/lib/domain/types';
import {useData} from '@/lib/store/data';
import {commands, errorText} from '@/lib/tauri/commands';

/** Renames a project or changes its outcome. Open while project is set. */
export function EditProjectDialog({project, onClose}: {project: Project | null; onClose: () => void}) {
  const [name, setName] = useState('');
  const [outcome, setOutcome] = useState('');
  const [shown, setShown] = useState<Project | null>(null);
  // Keep the last project while the dialog fades out.
  if (project && project !== shown) {
    setShown(project);
    setName(project.name);
    setOutcome(project.outcome);
  }

  const save = async () => {
    if (!shown) return;
    if (!name.trim()) throw new Error('Write a name for the project.');
    try {
      useData.getState().setProjects(await commands.updateProject(shown.id, {name, outcome}));
    } catch (error) {
      throw new Error(errorText(error));
    }
  };

  return <Dialog open={project !== null} onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent size="sm">
      <DialogHeader><DialogTitle>Edit {shown?.name ?? 'project'}</DialogTitle></DialogHeader>
      <DialogBody>
        <Field>
          <FieldLabel>Name</FieldLabel>
          <Input value={name} onChange={e => setName(e.target.value)}/>
        </Field>
        <Field>
          <FieldLabel optional>Outcome</FieldLabel>
          <Textarea autoGrow minRows={2} maxRows={6} value={outcome} onValueChange={setOutcome}/>
        </Field>
      </DialogBody>
      <DialogFooter>
        <DialogClose>Cancel</DialogClose>
        <DialogAction onAction={save} pendingLabel="Saving">Save project</DialogAction>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
