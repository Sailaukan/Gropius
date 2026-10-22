import {useEffect, useRef, useState} from 'react';
import {
  Dialog, DialogAction, DialogBody, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/glaze/ui/dialog';
import {Field, FieldDescription, FieldLabel} from '@/components/glaze/ui/field';
import {Input} from '@/components/glaze/ui/input';
import {Textarea} from '@/components/glaze/ui/textarea';
import {commands, errorText} from '@/lib/tauri/commands';
import {useUi} from '@/lib/store/ui';

/** A new project: in GTD, any outcome that takes more than one action. */
export function ProjectDialog() {
  const open = useUi(s => s.projectDialogOpen);
  const setOpen = useUi(s => s.setProjectDialogOpen);
  const nameRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState('');
  const [outcome, setOutcome] = useState('');

  useEffect(() => {
    if (open) {
      setName('');
      setOutcome('');
    }
  }, [open]);

  const create = async () => {
    if (!name.trim()) {
      nameRef.current?.focus();
      throw new Error('Write a name for the project.');
    }
    try {
      await commands.createProject(name, outcome);
    } catch (error) {
      throw new Error(errorText(error));
    }
  };

  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogContent size="sm" initialFocus={nameRef}>
      <DialogHeader>
        <DialogTitle>New project</DialogTitle>
        <DialogDescription>Any outcome that takes more than one step.</DialogDescription>
      </DialogHeader>
      <DialogBody>
        <Field>
          <FieldLabel>Name</FieldLabel>
          <Input ref={nameRef} placeholder="Kitchen renovation" value={name} onChange={e => setName(e.target.value)}/>
        </Field>
        <Field>
          <FieldLabel optional>Outcome</FieldLabel>
          <Textarea autoGrow minRows={2} maxRows={6} placeholder="New cabinets in, old ones sold." value={outcome} onValueChange={setOutcome}/>
          <FieldDescription>What done looks like.</FieldDescription>
        </Field>
      </DialogBody>
      <DialogFooter>
        <DialogClose>Cancel</DialogClose>
        <DialogAction onAction={create} pendingLabel="Creating">Create project</DialogAction>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
