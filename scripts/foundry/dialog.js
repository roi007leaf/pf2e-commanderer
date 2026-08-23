export function formFromDialogSubmit(button, dialog) {
  const form = button?.form ?? dialog?.element?.querySelector?.("form") ?? null;
  if (!form?.elements) throw new Error("Dialog form is unavailable.");
  return form;
}
